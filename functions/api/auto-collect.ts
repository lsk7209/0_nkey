/**
 * 자동 수집 배치 API (Pages Functions)
 * - 데이터페이지에 저장된 키워드를 시드로 사용하여 연관검색어를 추가 수집
 * - auto_seed_usage 테이블로 활용 이력 기록
 * - limit=0이면 무제한 모드(프론트에서 반복 호출)로 동작
 */
export async function onRequest(context: any) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const adminKey = request.headers.get('x-admin-key');
  if (adminKey !== 'dev-key-2024') {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limitInput = Number(body.limit ?? 30); // 한 번 호출당 처리할 최대 시드 수 (기본 30개로 증가)
    const batchSize = Number.isFinite(limitInput) && limitInput >= 0 ? limitInput : 30;
    const unlimited = batchSize === 0; // 0이면 무제한 모드(프론트에서 반복 호출)
    const concurrentLimit = Math.min(Math.max(Number(body.concurrent ?? 15), 1), 15); // 동시에 처리할 시드 수 (1-15, 기본 15)
    const targetKeywords = Number(body.targetKeywords ?? 0); // 목표 키워드 수 (0이면 무제한)

    const db = env.DB;

    // 아직 활용되지 않은 시드 가져오기: auto_seed_usage에 없는 키워드 우선, 다음으로 오래된 순
    const seedsQuery = `
      SELECT k.id, k.keyword
      FROM keywords k
      LEFT JOIN auto_seed_usage a ON a.seed = k.keyword
      WHERE a.seed IS NULL
      ORDER BY k.avg_monthly_search DESC, k.created_at ASC
      LIMIT ?
    `;

    const take = unlimited ? 30 : Math.max(1, Math.min(batchSize, 100)); // 최대 100개까지 처리 가능
    const seeds = await db.prepare(seedsQuery).bind(take).all();
    const seedRows = seeds.results || [];

    if (seedRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, remaining: 0, message: '활용 가능한 시드가 없습니다.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 현재 오리진으로 내부 수집 API 호출
    const origin = new URL(request.url).origin;
    const collectUrl = `${origin}/api/collect-naver`;

    let processed = 0;
    let totalKeywordsCollected = 0;
    let totalKeywordsSaved = 0;
    let totalNewKeywords = 0; // 새로 추가된 키워드 수 누적
    const processedSeeds: string[] = [];

    // 시드들을 청크로 나누어 병렬 처리 (Rate Limit 고려)
    const chunks = [];
    for (let i = 0; i < seedRows.length; i += concurrentLimit) {
      chunks.push(seedRows.slice(i, i + concurrentLimit));
    }

    for (const chunk of chunks) {
      console.log(`🔄 청크 처리 시작: ${chunk.length}개 시드 동시 처리`);

      // 청크 내 시드들을 병렬로 처리
      const chunkPromises = chunk.map(async (row: any) => {
        const seed: string = row.keyword;
        try {
          // 타임아웃 설정 (30초)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 30000); // 30초 타임아웃

          const res = await fetch(collectUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': 'dev-key-2024' },
            body: JSON.stringify({ seed }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          let collectResult = null;
          if (res.ok) {
            collectResult = await res.json();
            if (collectResult.success) {
              return {
                seed,
                success: true,
                totalCollected: collectResult.totalCollected || 0,
                totalSavedOrUpdated: collectResult.totalSavedOrUpdated || 0,
                savedCount: collectResult.savedCount || collectResult.actualNewKeywords || 0 // 새로 추가된 키워드 수
              };
            }
          }

          return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0 };
        } catch (e: any) {
          const error = e as Error;
          // 타임아웃 에러는 로그만 남기고 계속 진행
          if (error.name === 'AbortError') {
            console.warn(`⏱️ 시드 처리 타임아웃 (${seed}): 30초 초과`);
          } else {
            console.error(`❌ 시드 처리 실패 (${seed}):`, error.message || error);
          }
          return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0 };
        }
      });

      // 청크 내 모든 시드 처리 완료 대기 (일부 실패해도 계속 진행)
      const chunkResults = await Promise.allSettled(chunkPromises).then(results =>
        results.map(result => result.status === 'fulfilled' ? result.value : {
          seed: 'unknown',
          success: false,
          totalCollected: 0,
          totalSavedOrUpdated: 0
        })
      );

      // 결과 집계 및 DB 기록
      for (const result of chunkResults) {
        // collect 결과와 무관하게 활용 이력 기록 (중복 방지용)
        await db.prepare(`
          INSERT INTO auto_seed_usage (seed, usage_count, last_used)
          VALUES (?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(seed) DO UPDATE SET
            usage_count = usage_count + 1,
            last_used = CURRENT_TIMESTAMP
        `).bind(result.seed).run();

        if (result.success) {
          totalKeywordsCollected += result.totalCollected;
          totalKeywordsSaved += result.totalSavedOrUpdated;
          totalNewKeywords += result.savedCount || 0; // 새로 추가된 키워드 수 누적
          processed++;
          processedSeeds.push(result.seed);
          
          // 목표 키워드 수 도달 확인
          if (targetKeywords > 0 && totalNewKeywords >= targetKeywords) {
            console.log(`🎯 목표 키워드 수 도달: ${totalNewKeywords}개 (목표: ${targetKeywords}개)`);
            break; // 청크 루프 종료
          }
        }
      }

      // 목표 키워드 수 도달 확인 (청크 간에도 확인)
      if (targetKeywords > 0 && totalNewKeywords >= targetKeywords) {
        console.log(`🎯 목표 키워드 수 도달: ${totalNewKeywords}개 (목표: ${targetKeywords}개)`);
        break; // 청크 루프 종료
      }

      // 청크 간 Rate Limit 방지 간격 (5개 API 키 사용 시 500ms로 최적화)
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        console.log(`⏳ 청크 간 대기: 500ms (5개 API 키 최적화)`);
        await new Promise(r => setTimeout(r, 500)); // 800ms → 500ms로 감소
      }
    }

    // 남은 수 추정: 정확한 계산 (keywords 테이블 기준)
    // 1. 전체 키워드 수 조회
    const totalKeywordsQuery = `SELECT COUNT(*) as total FROM keywords`;
    const totalKeywordsResult = await db.prepare(totalKeywordsQuery).all();
    const totalKeywords = totalKeywordsResult.results?.[0]?.total ?? 0;
    
    // 2. 실제로 사용된 시드 수 조회 (keywords 테이블에 존재하는 키워드 중에서만)
    const usedSeedsQuery = `
      SELECT COUNT(DISTINCT k.keyword) as used
      FROM keywords k
      INNER JOIN auto_seed_usage a ON a.seed = k.keyword
    `;
    const usedSeedsResult = await db.prepare(usedSeedsQuery).all();
    const usedSeeds = usedSeedsResult.results?.[0]?.used ?? 0;
    
    // 3. 남은 시드 수 계산 (전체 - 사용된)
    const actualRemaining = Math.max(0, totalKeywords - usedSeeds);
    
    // 4. 기존 쿼리로 계산한 값 (비교용)
    const remainingQuery = `
      SELECT COUNT(1) as remaining
      FROM keywords k
      LEFT JOIN auto_seed_usage a ON a.seed = k.keyword
      WHERE a.seed IS NULL
    `;
    const remainingRow = await db.prepare(remainingQuery).all();
    const oldRemaining = remainingRow.results?.[0]?.remaining ?? 0;
    
    // 디버깅 로그
    console.log(`📊 시드 키워드 통계:`, {
      totalKeywords,
      usedSeeds,
      actualRemaining,
      oldRemaining,
      discrepancy: oldRemaining - actualRemaining,
      note: oldRemaining !== actualRemaining ? '⚠️ 계산 방식 차이 감지됨' : '✅ 계산 일치'
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        processedSeeds,
        remaining: actualRemaining, // 실제 남은 시드 수 (정확한 계산)
        totalKeywords, // 전체 키워드 수 (디버깅용)
        usedSeeds, // 사용된 시드 수 (디버깅용)
        unlimited,
        concurrentLimit,
        totalKeywordsCollected,
        totalKeywordsSaved,
        totalNewKeywords, // 새로 추가된 키워드 수
        targetKeywords, // 목표 키워드 수
        targetReached: targetKeywords > 0 && totalNewKeywords >= targetKeywords, // 목표 도달 여부
        message: `시드 ${processed}개 처리 (${concurrentLimit}개 동시), 키워드 ${totalKeywordsCollected}개 수집, ${totalKeywordsSaved}개 저장 (새로 추가: ${totalNewKeywords}개)${targetKeywords > 0 ? ` / 목표: ${targetKeywords}개` : ''}, 남은 시드 ${actualRemaining}개 (전체: ${totalKeywords}개, 사용됨: ${usedSeeds}개)`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}



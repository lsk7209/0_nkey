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
    const limitInput = Number(body.limit ?? 50); // 한 번 호출당 처리할 최대 시드 수 (기본 50개 - 5개 API 키 활용)
    const batchSize = Number.isFinite(limitInput) && limitInput >= 0 ? limitInput : 50;
    const unlimited = batchSize === 0; // 0이면 무제한 모드(프론트에서 반복 호출)
    const concurrentLimit = Math.min(Math.max(Number(body.concurrent ?? 20), 1), 25); // 동시에 처리할 시드 수 (1-25, 기본 20 - 5개 API 키 활용)
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

    const take = unlimited ? 50 : Math.max(1, Math.min(batchSize, 200)); // 최대 200개까지 처리 가능 (5개 API 키 활용)
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
    const failedSeeds: Array<{ seed: string; error: string }> = []; // 실패한 시드 목록
    let totalAttempted = 0; // 시도한 총 시드 수
    let timeoutCount = 0; // 타임아웃 발생 횟수
    let apiFailureCount = 0; // API 실패 횟수

    // 시드들을 청크로 나누어 병렬 처리 (Rate Limit 고려)
    const chunks = [];
    for (let i = 0; i < seedRows.length; i += concurrentLimit) {
      chunks.push(seedRows.slice(i, i + concurrentLimit));
    }

      for (const chunk of chunks) {
        console.log(`🔄 청크 처리 시작: ${chunk.length}개 시드 동시 처리 (시드 목록: ${chunk.map((r: any) => r.keyword).join(', ')})`);
        totalAttempted += chunk.length;

      // 청크 내 시드들을 병렬로 처리
      const chunkPromises = chunk.map(async (row: any) => {
        const seed: string = row.keyword;
        try {
            // 타임아웃 설정 (60초로 증가 - 네이버 API 응답 시간 고려)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              controller.abort();
            }, 60000); // 60초 타임아웃 (30초 → 60초로 증가)

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
                const savedCount = collectResult.savedCount || collectResult.actualNewKeywords || 0;
                const totalCollected = collectResult.totalCollected || 0;
                const totalSavedOrUpdated = collectResult.totalSavedOrUpdated || 0;
                
                // 상세 로깅 (디버깅용)
                if (savedCount === 0 && totalCollected === 0) {
                  console.log(`⚠️ 시드 "${seed}" 처리 완료했지만 키워드 수집 없음 (이미 수집되었거나 키워드 없음)`);
                } else {
                  console.log(`✅ 시드 "${seed}" 처리 성공: 수집 ${totalCollected}개, 저장 ${savedCount}개 (신규), 업데이트 ${totalSavedOrUpdated - savedCount}개`);
                }
                
                return {
                  seed,
                  success: true,
                  totalCollected,
                  totalSavedOrUpdated,
                  savedCount // 새로 추가된 키워드 수
                };
              } else {
                // collect-naver API가 실패한 경우
                const errorMessage = collectResult.error || collectResult.message || '알 수 없는 오류';
                console.warn(`⚠️ 시드 "${seed}" collect-naver API 실패: ${errorMessage}`);
                return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: errorMessage };
              }
            } else {
              // HTTP 응답이 실패한 경우
              const errorText = await res.text().catch(() => '');
              console.error(`❌ 시드 "${seed}" HTTP ${res.status} 에러: ${errorText.substring(0, 200)}`);
              return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: `HTTP ${res.status}` };
            }
        } catch (e: any) {
          const error = e as Error;
          // 타임아웃 에러는 로그만 남기고 계속 진행
          if (error.name === 'AbortError') {
            console.warn(`⏱️ 시드 처리 타임아웃 (${seed}): 60초 초과`);
            return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: 'Timeout (60초 초과)' };
          } else {
            console.error(`❌ 시드 처리 실패 (${seed}):`, error.message || error);
            return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: error.message || 'Unknown error' };
          }
        }
      });

      // 청크 내 모든 시드 처리 완료 대기 (일부 실패해도 계속 진행)
      const chunkResults = await Promise.allSettled(chunkPromises).then(results =>
        results.map(result => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            console.error(`❌ 시드 처리 Promise 실패:`, result.reason);
            return {
              seed: 'unknown',
              success: false,
              totalCollected: 0,
              totalSavedOrUpdated: 0,
              savedCount: 0,
              error: result.reason?.message || 'Promise rejected'
            };
          }
        })
      );

      // 결과 집계 및 DB 기록
      let chunkSuccessCount = 0;
      let chunkFailureCount = 0;
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
          chunkSuccessCount++;
          
          // 목표 키워드 수 도달 확인
          if (targetKeywords > 0 && totalNewKeywords >= targetKeywords) {
            console.log(`🎯 목표 키워드 수 도달: ${totalNewKeywords}개 (목표: ${targetKeywords}개)`);
            break; // 청크 루프 종료
          }
        } else {
          chunkFailureCount++;
          // 실패한 시드 정보 수집 (최대 10개)
          if (failedSeeds.length < 10) {
            failedSeeds.push({ seed: result.seed, error: result.error || 'Unknown error' });
          }
          // 타임아웃 및 API 실패 카운트
          if (result.error?.includes('Timeout')) {
            timeoutCount++;
          } else if (result.error) {
            apiFailureCount++;
          }
          // 실패한 시드의 에러 정보 로깅 (최대 3개만)
          if (chunkFailureCount <= 3 && result.error) {
            console.warn(`⚠️ 시드 "${result.seed}" 처리 실패: ${result.error}`);
          }
        }
      }
      
      // 청크 처리 결과 요약 로깅
      console.log(`📊 청크 처리 완료: 성공 ${chunkSuccessCount}개, 실패 ${chunkFailureCount}개 (총 ${chunk.length}개)`);

      // 목표 키워드 수 도달 확인 (청크 간에도 확인)
      if (targetKeywords > 0 && totalNewKeywords >= targetKeywords) {
        console.log(`🎯 목표 키워드 수 도달: ${totalNewKeywords}개 (목표: ${targetKeywords}개)`);
        break; // 청크 루프 종료
      }

      // 청크 간 Rate Limit 방지 간격 (5개 API 키 사용 시 200ms로 최적화)
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        console.log(`⏳ 청크 간 대기: 200ms (5개 API 키 최적화)`);
        await new Promise(r => setTimeout(r, 200)); // 500ms → 200ms로 감소 (다중 키 활용)
      }
    }

    // 남은 수 추정: 정확한 계산 (keywords 테이블 기준)
    // 1. 전체 키워드 수 조회 (keywords 테이블의 실제 수집된 키워드 수)
    const totalKeywordsQuery = `SELECT COUNT(*) as total FROM keywords`;
    const totalKeywordsResult = await db.prepare(totalKeywordsQuery).all();
    const totalKeywords = totalKeywordsResult.results?.[0]?.total ?? 0;
    
    // 2. 실제로 사용된 시드 수 조회 (keywords 테이블에 존재하는 키워드 중에서만)
    // auto_seed_usage에 기록되어 있지만 keywords 테이블에 없는 시드는 제외
    const usedSeedsQuery = `
      SELECT COUNT(DISTINCT k.keyword) as used
      FROM keywords k
      INNER JOIN auto_seed_usage a ON a.seed = k.keyword
    `;
    const usedSeedsResult = await db.prepare(usedSeedsQuery).all();
    const usedSeeds = usedSeedsResult.results?.[0]?.used ?? 0;
    
    // 3. 남은 시드 수 계산 (전체 키워드 수 - 사용된 시드 수)
    // keywords 테이블의 모든 키워드가 시드로 활용 가능하므로
    // 남은 시드 = 전체 키워드 수 - 사용된 시드 수
    const actualRemaining = Math.max(0, totalKeywords - usedSeeds);
    
    // 4. 정확한 남은 시드 수 조회 (keywords 테이블 기준)
    const remainingQuery = `
      SELECT COUNT(1) as remaining
      FROM keywords k
      LEFT JOIN auto_seed_usage a ON a.seed = k.keyword
      WHERE a.seed IS NULL
    `;
    const remainingRow = await db.prepare(remainingQuery).all();
    const exactRemaining = remainingRow.results?.[0]?.remaining ?? 0;
    
           // 디버깅 로그
           console.log(`📊 시드 키워드 통계:`, {
             totalKeywords: `${totalKeywords.toLocaleString()}개 (수집된 총 키워드 수)`,
             usedSeeds: `${usedSeeds.toLocaleString()}개 (시드로 사용된 키워드 수)`,
             actualRemaining: `${actualRemaining.toLocaleString()}개 (계산된 남은 시드)`,
             exactRemaining: `${exactRemaining.toLocaleString()}개 (실제 남은 시드)`,
             note: actualRemaining === exactRemaining ? '✅ 계산 일치' : '⚠️ 계산 방식 차이 감지됨'
           });
           
           // 처리 통계 로그
           console.log(`📊 배치 처리 통계:`, {
             totalAttempted: `${totalAttempted}개 (시도한 시드 수)`,
             processed: `${processed}개 (성공한 시드 수)`,
             successRate: totalAttempted > 0 ? `${((processed / totalAttempted) * 100).toFixed(1)}%` : '0%',
             timeoutCount: `${timeoutCount}개 (타임아웃 발생)`,
             apiFailureCount: `${apiFailureCount}개 (API 실패)`,
             totalNewKeywords: `${totalNewKeywords}개 (새로 추가된 키워드)`
           });

           return new Response(
             JSON.stringify({
               success: true,
               processed,
               processedSeeds,
               remaining: exactRemaining, // 실제 남은 시드 수 (keywords 테이블 기준)
               totalKeywords, // 전체 키워드 수 (keywords 테이블의 실제 수집된 키워드 수)
               usedSeeds, // 사용된 시드 수 (keywords 테이블에 존재하는 키워드 중 시드로 사용된 수)
               unlimited,
               concurrentLimit,
               totalKeywordsCollected,
               totalKeywordsSaved,
               totalNewKeywords, // 새로 추가된 키워드 수
               targetKeywords, // 목표 키워드 수
               targetReached: targetKeywords > 0 && totalNewKeywords >= targetKeywords, // 목표 도달 여부
               // 디버깅 정보 추가
               stats: {
                 totalAttempted, // 시도한 총 시드 수
                 successRate: totalAttempted > 0 ? ((processed / totalAttempted) * 100).toFixed(1) + '%' : '0%',
                 timeoutCount, // 타임아웃 발생 횟수
                 apiFailureCount, // API 실패 횟수
                 failedSeeds: failedSeeds.slice(0, 10) // 실패한 시드 목록 (최대 10개)
               },
               message: `시드 ${processed}개 처리 (${concurrentLimit}개 동시, 시도: ${totalAttempted}개, 성공률: ${totalAttempted > 0 ? ((processed / totalAttempted) * 100).toFixed(1) : 0}%), 키워드 ${totalKeywordsCollected}개 수집, ${totalKeywordsSaved}개 저장 (새로 추가: ${totalNewKeywords}개)${targetKeywords > 0 ? ` / 목표: ${targetKeywords}개` : ''}, 남은 시드 ${exactRemaining.toLocaleString()}개 (전체 키워드: ${totalKeywords.toLocaleString()}개, 시드로 사용됨: ${usedSeeds.toLocaleString()}개)${timeoutCount > 0 ? `, 타임아웃: ${timeoutCount}개` : ''}${apiFailureCount > 0 ? `, API 실패: ${apiFailureCount}개` : ''}`
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



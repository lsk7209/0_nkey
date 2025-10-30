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
    const limitInput = Number(body.limit ?? 10); // 한 번 호출당 처리할 최대 시드 수
    const batchSize = Number.isFinite(limitInput) && limitInput >= 0 ? limitInput : 10;
    const unlimited = batchSize === 0; // 0이면 무제한 모드(프론트에서 반복 호출)

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

    const take = unlimited ? 10 : Math.max(1, Math.min(batchSize, 50));
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
    const processedSeeds: string[] = [];
    for (const row of seedRows) {
      const seed: string = row.keyword;
      try {
        const res = await fetch(collectUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': 'dev-key-2024' },
          body: JSON.stringify({ seed })
        });

        // collect 결과와 무관하게 활용 이력 기록 (중복 방지용)
        await db.prepare(`
          INSERT INTO auto_seed_usage (seed, usage_count, last_used)
          VALUES (?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(seed) DO UPDATE SET
            usage_count = usage_count + 1,
            last_used = CURRENT_TIMESTAMP
        `).bind(seed).run();

        processed++;
        processedSeeds.push(seed);
        // Rate Limit 방지 간격
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        // 실패해도 다음 시드로 진행
        await db.prepare(`
          INSERT INTO auto_seed_usage (seed, usage_count, last_used)
          VALUES (?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(seed) DO UPDATE SET
            usage_count = usage_count + 1,
            last_used = CURRENT_TIMESTAMP
        `).bind(seed).run();
      }
    }

    // 남은 수 추정: 단순 카운트 (auto_seed_usage에 없는 키워드 수)
    const remainingQuery = `
      SELECT COUNT(1) as remaining
      FROM keywords k
      LEFT JOIN auto_seed_usage a ON a.seed = k.keyword
      WHERE a.seed IS NULL
    `;
    const remainingRow = await db.prepare(remainingQuery).all();
    const remaining = remainingRow.results?.[0]?.remaining ?? 0;

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        processedSeeds,
        remaining,
        unlimited,
        message: `시드 ${processed}개 처리, 남은 시드 ${remaining}개`
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



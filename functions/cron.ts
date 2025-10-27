// Cloudflare Workers 크론 작업
export async function onRequest(context) {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/cron/auto-collect':
        return await handleAutoCollect(env);
      case '/cron/cleanup':
        return await handleCleanup(env);
      default:
        return new Response(
          JSON.stringify({ error: 'Not Found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Cron error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 자동 수집 크론 작업
async function handleAutoCollect(env) {
  try {
    console.log('Starting auto collect cron job...');

    // 사용되지 않은 시드 키워드 조회 (30일 이내 사용되지 않은 것)
    const unusedSeeds = await env.DB.prepare(`
      SELECT DISTINCT k.seed_keyword_text as seed
      FROM keywords k
      LEFT JOIN auto_seed_usage a ON k.seed_keyword_text = a.seed
      WHERE a.seed IS NULL OR a.last_used < datetime('now', '-30 days')
      ORDER BY k.avg_monthly_search DESC
      LIMIT 10
    `).all();

    if (unusedSeeds.results.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unused seeds found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let totalProcessed = 0;
    let totalSaved = 0;

    for (const seedData of unusedSeeds.results) {
      const seed = seedData.seed;
      console.log(`Processing seed: ${seed}`);

      // 시뮬레이션 데이터 생성 (실제로는 네이버 API 호출)
      const mockKeywords = generateMockKeywords(seed);
      
      let savedCount = 0;
      for (const keywordData of mockKeywords) {
        // 키워드 저장
        const existing = await env.DB.prepare(
          'SELECT id FROM keywords WHERE keyword = ?'
        ).bind(keywordData.keyword).first();

        if (!existing) {
          await env.DB.prepare(`
            INSERT INTO keywords (keyword, seed_keyword_text, monthly_search_pc, monthly_search_mob, 
                                 avg_monthly_search, cpc, comp_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            keywordData.keyword,
            seed,
            keywordData.monthly_search_pc,
            keywordData.monthly_search_mob,
            keywordData.avg_monthly_search,
            keywordData.cpc,
            keywordData.comp_index
          ).run();
          savedCount++;
        }
      }

      // 시드 사용 기록 업데이트
      await env.DB.prepare(`
        INSERT INTO auto_seed_usage (seed, last_used, usage_count, created_at)
        VALUES (?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(seed) DO UPDATE SET 
          last_used = CURRENT_TIMESTAMP,
          usage_count = usage_count + 1
      `).bind(seed).run();

      totalProcessed++;
      totalSaved += savedCount;

      console.log(`Processed seed: ${seed}, saved: ${savedCount} keywords`);
    }

    // 로그 저장
    await env.DB.prepare(`
      INSERT INTO collect_logs (keyword, type, status, message)
      VALUES (?, ?, ?, ?)
    `).bind(
      'AUTO_COLLECT',
      'cron',
      'completed',
      `Processed ${totalProcessed} seeds, saved ${totalSaved} keywords`
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Auto collect completed: ${totalProcessed} seeds processed, ${totalSaved} keywords saved`,
        totalProcessed,
        totalSaved
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Auto collect error:', error);
    
    // 에러 로그 저장
    await env.DB.prepare(`
      INSERT INTO collect_logs (keyword, type, status, message)
      VALUES (?, ?, ?, ?)
    `).bind('AUTO_COLLECT', 'cron', 'failed', error.message).run();

    return new Response(
      JSON.stringify({ error: 'Auto collect failed', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 정리 작업 크론
async function handleCleanup(env) {
  try {
    console.log('Starting cleanup cron job...');

    // 90일 이상 된 로그 삭제
    const deletedLogs = await env.DB.prepare(`
      DELETE FROM collect_logs 
      WHERE created_at < datetime('now', '-90 days')
    `).run();

    // 중복 키워드 정리 (같은 키워드가 여러 시드에서 생성된 경우)
    const duplicateKeywords = await env.DB.prepare(`
      SELECT keyword, COUNT(*) as count
      FROM keywords
      GROUP BY keyword
      HAVING COUNT(*) > 1
    `).all();

    let cleanedDuplicates = 0;
    for (const dup of duplicateKeywords.results) {
      // 가장 높은 검색량을 가진 것만 남기고 나머지 삭제
      await env.DB.prepare(`
        DELETE FROM keywords 
        WHERE keyword = ? AND id NOT IN (
          SELECT id FROM keywords 
          WHERE keyword = ? 
          ORDER BY avg_monthly_search DESC 
          LIMIT 1
        )
      `).bind(dup.keyword, dup.keyword).run();
      cleanedDuplicates++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup completed: ${deletedLogs.changes} old logs deleted, ${cleanedDuplicates} duplicate keywords cleaned`,
        deletedLogs: deletedLogs.changes,
        cleanedDuplicates
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: 'Cleanup failed', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 시뮬레이션 키워드 생성 함수
function generateMockKeywords(seed) {
  const patterns = [
    { suffix: '방법', pc: 1200, mob: 800, cpc: 500, comp: 80 },
    { suffix: '가이드', pc: 900, mob: 600, cpc: 450, comp: 75 },
    { suffix: '팁', pc: 700, mob: 500, cpc: 400, comp: 70 },
    { suffix: '전략', pc: 600, mob: 400, cpc: 350, comp: 65 },
    { suffix: '노하우', pc: 500, mob: 350, cpc: 300, comp: 60 },
    { suffix: '기법', pc: 400, mob: 300, cpc: 250, comp: 55 },
    { suffix: '활용법', pc: 350, mob: 250, cpc: 200, comp: 50 },
    { suffix: '사례', pc: 300, mob: 200, cpc: 180, comp: 45 },
    { suffix: '예시', pc: 250, mob: 180, cpc: 150, comp: 40 },
    { suffix: '도구', pc: 200, mob: 150, cpc: 120, comp: 35 },
  ];

  return patterns.map(pattern => ({
    keyword: `${seed} ${pattern.suffix}`,
    monthly_search_pc: pattern.pc,
    monthly_search_mob: pattern.mob,
    avg_monthly_search: pattern.pc + pattern.mob,
    cpc: pattern.cpc,
    comp_index: pattern.comp
  }));
}

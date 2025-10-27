// Cloudflare Workers용 키워드 수집 API
export default {
  async fetch(request: Request, env: any, ctx: any) {
    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    };

    // OPTIONS 요청 처리
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 인증 확인
      const adminKey = request.headers.get('x-admin-key');
      if (!adminKey || adminKey !== env.ADMIN_KEY) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      switch (path) {
        case '/api/collect':
          return await handleCollect(request, env, corsHeaders);
        case '/api/keywords':
          return await handleGetKeywords(request, env, corsHeaders);
        case '/api/health':
          return new Response(
            JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        default:
          return new Response(
            JSON.stringify({ error: 'Not Found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    } catch (error) {
      console.error('API Error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
};


// 키워드 수집 처리
async function handleCollect(request: Request, env: any, corsHeaders: any) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { seed, keywords } = await request.json();
    
    if (!seed || !keywords || !Array.isArray(keywords)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let savedCount = 0;
    let updatedCount = 0;

    for (const keywordData of keywords) {
      // 키워드 존재 여부 확인
      const existing = await env.DB.prepare(
        'SELECT id, updated_at FROM keywords WHERE keyword = ?'
      ).bind(keywordData.keyword).first();

      if (existing) {
        // 30일 이내 업데이트된 키워드는 스킵
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (existing.updated_at && new Date(existing.updated_at) > thirtyDaysAgo) {
          continue;
        }

        // 기존 키워드 업데이트
        await env.DB.prepare(`
          UPDATE keywords 
          SET monthly_search_pc = ?, monthly_search_mob = ?, avg_monthly_search = ?, 
              cpc = ?, comp_index = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          keywordData.monthly_search_pc || 0,
          keywordData.monthly_search_mob || 0,
          keywordData.avg_monthly_search || 0,
          keywordData.cpc || 0,
          keywordData.comp_index || 0,
          existing.id
        ).run();

        updatedCount++;
      } else {
        // 새 키워드 저장
        await env.DB.prepare(`
          INSERT INTO keywords (keyword, seed_keyword_text, monthly_search_pc, monthly_search_mob, 
                               avg_monthly_search, cpc, comp_index)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          keywordData.keyword,
          seed,
          keywordData.monthly_search_pc || 0,
          keywordData.monthly_search_mob || 0,
          keywordData.avg_monthly_search || 0,
          keywordData.cpc || 0,
          keywordData.comp_index || 0
        ).run();

        savedCount++;
      }
    }

    // 시드 키워드 사용 기록 업데이트
    await env.DB.prepare(`
      INSERT INTO auto_seed_usage (seed, last_used, usage_count, created_at)
      VALUES (?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(seed) DO UPDATE SET 
        last_used = CURRENT_TIMESTAMP,
        usage_count = usage_count + 1
    `).bind(seed).run();

    return new Response(
      JSON.stringify({
        success: true,
        seed,
        totalSavedOrUpdated: savedCount + updatedCount,
        savedCount,
        updatedCount,
        message: `${savedCount + updatedCount}개의 키워드가 성공적으로 저장 또는 갱신되었습니다.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Collect error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save keywords', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// 키워드 조회 처리
async function handleGetKeywords(request: Request, env: any, corsHeaders: any) {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // 총 개수 조회
    const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM keywords').first();
    const total = countResult.total;

    // 키워드 목록 조회
    const keywords = await env.DB.prepare(`
      SELECT k.*, m.monthly_click_pc, m.monthly_click_mobile, m.ctr_pc, m.ctr_mobile, m.ad_count,
             d.blog_total, d.cafe_total, d.web_total, d.news_total, d.collected_at
      FROM keywords k
      LEFT JOIN keyword_metrics m ON k.id = m.keyword_id
      LEFT JOIN naver_doc_counts d ON k.id = d.keyword_id
      ORDER BY k.avg_monthly_search DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return new Response(
      JSON.stringify({
        keywords: keywords.results,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Get keywords error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch keywords', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

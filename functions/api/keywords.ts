// Cloudflare Pages Functions용 키워드 조회 API
export async function onRequest(context: any) {
  const { request, env } = context;
  
  console.log('🌐 Pages Functions - keywords 실행!');
  console.log('📅 요청 시간:', new Date().toISOString());
  console.log('🔗 요청 URL:', request.url);
  console.log('📝 요청 메서드:', request.method);
  
  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
  };

  // OPTIONS 요청 처리
  if (request.method === 'OPTIONS') {
    console.log('🔄 OPTIONS 요청 처리');
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = 'dev-key-2024';
    if (!adminKey || adminKey !== expectedKey) {
      console.log('❌ 인증 실패:', adminKey);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.method !== 'GET') {
      console.log('❌ 잘못된 메서드:', request.method);
      return new Response(
        JSON.stringify({ error: 'Method Not Allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Pages Functions - 키워드 조회 시작');

    // 필터 파라미터 파싱
    const url = new URL(request.url);
    const minAvgSearch = url.searchParams.get('minAvgSearch');
    const maxAvgSearch = url.searchParams.get('maxAvgSearch');
    const minCafeTotal = url.searchParams.get('minCafeTotal');
    const maxCafeTotal = url.searchParams.get('maxCafeTotal');
    const minBlogTotal = url.searchParams.get('minBlogTotal');
    const maxBlogTotal = url.searchParams.get('maxBlogTotal');
    const minWebTotal = url.searchParams.get('minWebTotal');
    const maxWebTotal = url.searchParams.get('maxWebTotal');
    const minNewsTotal = url.searchParams.get('minNewsTotal');
    const maxNewsTotal = url.searchParams.get('maxNewsTotal');

    // 페이지네이션 파라미터
    const pageParam = parseInt(url.searchParams.get('page') || '1');
    const pageSizeParam = parseInt(url.searchParams.get('pageSize') || '100');
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const pageSizeRaw = isNaN(pageSizeParam) ? 100 : pageSizeParam;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 1000); // 최대 1000까지 허용
    const offset = (page - 1) * pageSize;

    // WHERE 절 조건 구성
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (minAvgSearch) {
      conditions.push('k.avg_monthly_search >= ?');
      bindings.push(parseInt(minAvgSearch));
    }
    if (maxAvgSearch) {
      conditions.push('k.avg_monthly_search <= ?');
      bindings.push(parseInt(maxAvgSearch));
    }
    if (minCafeTotal) {
      conditions.push('COALESCE(ndc.cafe_total, 0) >= ?');
      bindings.push(parseInt(minCafeTotal));
    }
    if (maxCafeTotal) {
      conditions.push('COALESCE(ndc.cafe_total, 0) <= ?');
      bindings.push(parseInt(maxCafeTotal));
    }
    if (minBlogTotal) {
      conditions.push('COALESCE(ndc.blog_total, 0) >= ?');
      bindings.push(parseInt(minBlogTotal));
    }
    if (maxBlogTotal) {
      conditions.push('COALESCE(ndc.blog_total, 0) <= ?');
      bindings.push(parseInt(maxBlogTotal));
    }
    if (minWebTotal) {
      conditions.push('COALESCE(ndc.web_total, 0) >= ?');
      bindings.push(parseInt(minWebTotal));
    }
    if (maxWebTotal) {
      conditions.push('COALESCE(ndc.web_total, 0) <= ?');
      bindings.push(parseInt(maxWebTotal));
    }
    if (minNewsTotal) {
      conditions.push('COALESCE(ndc.news_total, 0) >= ?');
      bindings.push(parseInt(minNewsTotal));
    }
    if (maxNewsTotal) {
      conditions.push('COALESCE(ndc.news_total, 0) <= ?');
      bindings.push(parseInt(maxNewsTotal));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // D1 데이터베이스에서 키워드 조회 (문서수 포함, 필터 적용)
    // schema.sql의 실제 컬럼명 사용: monthly_search_pc, monthly_search_mob
    // keyword_metrics 테이블과 JOIN하여 메트릭 데이터 조회
    const db = env.DB;
    const baseSelect = `
      SELECT 
        k.keyword,
        k.avg_monthly_search,
        k.monthly_search_pc as pc_search,
        k.monthly_search_mob as mobile_search,
        COALESCE(km.monthly_click_pc, 0) as monthly_click_pc,
        COALESCE(km.monthly_click_mobile, 0) as monthly_click_mo,
        COALESCE(km.ctr_pc, 0) as ctr_pc,
        COALESCE(km.ctr_mobile, 0) as ctr_mo,
        COALESCE(km.ad_count, 0) as ad_count,
        k.created_at,
        COALESCE(ndc.blog_total, 0) as blog_total,
        COALESCE(ndc.cafe_total, 0) as cafe_total,
        COALESCE(ndc.web_total, 0) as web_total,
        COALESCE(ndc.news_total, 0) as news_total
      FROM keywords k
      LEFT JOIN keyword_metrics km ON k.id = km.keyword_id
      LEFT JOIN naver_doc_counts ndc ON k.id = ndc.keyword_id
      ${whereClause}
      ORDER BY COALESCE(ndc.cafe_total, 0) ASC, k.avg_monthly_search DESC
    `;

    const query = `${baseSelect} LIMIT ? OFFSET ?`;

    let result;
    try {
      const dataBindings = [...bindings, pageSize, offset];
      result = await db.prepare(query).bind(...dataBindings).all();
    } catch (queryError: any) {
      console.error('키워드 조회 쿼리 에러:', queryError.message);
      throw queryError;
    }

    // 총 개수 조회 (동일 조건)
    const countQuery = `
      SELECT COUNT(1) as total
      FROM keywords k
      LEFT JOIN naver_doc_counts ndc ON k.id = ndc.keyword_id
      ${whereClause}
    `;
    let total = 0;
    try {
      const countRes = bindings.length > 0
        ? await db.prepare(countQuery).bind(...bindings).all()
        : await db.prepare(countQuery).all();
      total = countRes.results?.[0]?.total || 0;
    } catch (countErr: any) {
      console.warn('총 개수 조회 실패, 페이지 데이터 길이로 대체:', countErr?.message);
      total = result.results?.length || 0;
    }

    console.log(`✅ 키워드 조회 완료: ${result.results?.length || 0}개`);

    return new Response(
      JSON.stringify({
        success: true,
        keywords: result.results || [],
        total,
        page,
        pageSize,
        message: `${result.results?.length || 0}개의 키워드를 조회했습니다.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Pages Functions keywords 에러 발생!');
    console.error('📅 에러 발생 시간:', new Date().toISOString());
    console.error('🔍 에러 타입:', typeof error);
    console.error('📝 에러 메시지:', error?.message);
    console.error('📚 에러 스택:', error?.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Pages Functions Keywords Error', 
        message: error?.message || 'Unknown error',
        details: error?.toString(),
        timestamp: new Date().toISOString(),
        source: 'Pages Functions Keywords'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

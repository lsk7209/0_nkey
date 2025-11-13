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
    const seedKeywordText = url.searchParams.get('seed_keyword_text');
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

    // 문서 수 0 제외 옵션 (선택적, 기본값: false - 모든 키워드 표시)
    const excludeZeroDocs = url.searchParams.get('excludeZeroDocs') === 'true';
    if (excludeZeroDocs) {
      conditions.push('(COALESCE(ndc.cafe_total, 0) > 0 OR COALESCE(ndc.blog_total, 0) > 0 OR COALESCE(ndc.web_total, 0) > 0 OR COALESCE(ndc.news_total, 0) > 0)');
    }

    if (seedKeywordText) {
      conditions.push('k.seed_keyword_text = ?');
      bindings.push(seedKeywordText);
    }
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

    // 필터 디버깅 로그 (프로덕션에서는 최소화)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 필터 적용:`, {
        conditions: conditions.length,
        whereClause,
        bindings: bindings.map((b, i) => `${i}: ${b}`).join(', '),
        filters: {
          minAvgSearch, maxAvgSearch,
          minCafeTotal, maxCafeTotal,
          minBlogTotal, maxBlogTotal,
          minWebTotal, maxWebTotal,
          minNewsTotal, maxNewsTotal
        }
      });
    }

    // D1 데이터베이스에서 키워드 조회 (최적화된 쿼리)
    const db = env.DB;

    // 최적화된 쿼리: 필요한 필드만 선택, 효율적인 JOIN, 인덱스 활용
    // 인덱스 활용을 위해 WHERE 절이 있을 때와 없을 때 쿼리 분리
    let query: string;
    if (whereClause) {
      // 필터가 있을 때: 인덱스 활용 최적화
      query = `
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
          k.updated_at,
          COALESCE(ndc.blog_total, 0) as blog_total,
          COALESCE(ndc.cafe_total, 0) as cafe_total,
          COALESCE(ndc.web_total, 0) as web_total,
          COALESCE(ndc.news_total, 0) as news_total
        FROM keywords k
        LEFT JOIN keyword_metrics km ON k.id = km.keyword_id
        LEFT JOIN naver_doc_counts ndc ON k.id = ndc.keyword_id
        ${whereClause}
        ORDER BY COALESCE(ndc.cafe_total, 0) ASC, k.avg_monthly_search DESC
        LIMIT ? OFFSET ?
      `;
    } else {
      // 필터가 없을 때: 커버링 인덱스 활용 (더 빠른 쿼리)
      query = `
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
          k.updated_at,
          COALESCE(ndc.blog_total, 0) as blog_total,
          COALESCE(ndc.cafe_total, 0) as cafe_total,
          COALESCE(ndc.web_total, 0) as web_total,
          COALESCE(ndc.news_total, 0) as news_total
        FROM keywords k
        LEFT JOIN keyword_metrics km ON k.id = km.keyword_id
        LEFT JOIN naver_doc_counts ndc ON k.id = ndc.keyword_id
        ORDER BY COALESCE(ndc.cafe_total, 0) ASC, k.avg_monthly_search DESC
        LIMIT ? OFFSET ?
      `;
    }

    // 최적화된 COUNT 쿼리 (WHERE 절 조건 반영)
    // WHERE 절이 없으면 단순 COUNT, 있으면 조건 반영
    let countQuery: string;
    if (whereClause) {
      countQuery = `
        SELECT COUNT(*) as total
        FROM keywords k
        LEFT JOIN naver_doc_counts ndc ON k.id = ndc.keyword_id
        ${whereClause}
      `;
    } else {
      // WHERE 절이 없으면 가장 빠른 단순 COUNT
      countQuery = `SELECT COUNT(*) as total FROM keywords`;
    }

    let result, total = 0;

    try {
      // 데이터와 카운트를 동시에 조회 (병렬 처리)
      const [dataResult, countResult] = await Promise.all([
        db.prepare(query).bind(...bindings, pageSize, offset).all(),
        whereClause && bindings.length > 0
          ? db.prepare(countQuery).bind(...bindings).all()
          : db.prepare(countQuery).all()
      ]);

      result = dataResult;
      total = countResult.results?.[0]?.total || 0;

      // COUNT 쿼리 결과 디버깅 (프로덕션에서는 최소화)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 COUNT 쿼리 결과:`, {
          countQuery,
          whereClause: whereClause || '(없음)',
          total,
          bindingsCount: bindings.length,
          actualKeywordsReturned: result.results?.length || 0
        });
      }

      // 필터가 적용되었는데 결과가 없으면 경고 (프로덕션에서는 최소화)
      if (conditions.length > 0 && total === 0 && process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ 필터 적용되었지만 결과가 0개`);
      }

    } catch (queryError: any) {
      console.error('키워드 조회 쿼리 에러:', queryError.message);
      throw queryError;
    }

    // 전체 키워드 수 조회 (필터링 없이)
    const totalAllKeywordsQuery = `SELECT COUNT(*) as total FROM keywords`;
    const totalAllKeywordsResult = await db.prepare(totalAllKeywordsQuery).all();
    const totalAllKeywords = totalAllKeywordsResult.results?.[0]?.total || 0;

    // 프로덕션에서는 간단한 로그만
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ 키워드 조회 완료: ${result.results?.length || 0}개 (필터링: ${total}개 / 전체: ${totalAllKeywords}개)`);
    }

    // 응답 데이터 준비
    const responseData = {
      success: true,
      keywords: result.results || [],
      total, // 필터링된 키워드 수
      totalAll: totalAllKeywords, // 전체 키워드 수 (필터링 없이)
      page,
      pageSize,
      message: `${result.results?.length || 0}개의 키워드를 조회했습니다.`
    };

    const response = new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // 캐싱 헤더 제거 (실시간 데이터 조회)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    // Cloudflare가 자동으로 압축 처리하므로 Content-Encoding 헤더 제거
    // 응답 크기 최적화: 불필요한 필드 제거는 이미 쿼리에서 처리됨

    return response;

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

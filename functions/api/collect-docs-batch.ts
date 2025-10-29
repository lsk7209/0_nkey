/**
 * ⚠️ 헌법 준수 필수 (CONSTITUTION.md)
 * 
 * 절대 변경 금지 사항:
 * - 네이버 오픈API 사용 (https://openapi.naver.com)
 * - 문서수 필드명 변경 금지 (blog_total, cafe_total, web_total, news_total)
 * - 샘플 데이터 반환 금지
 * 
 * 헌법 문서: CONSTITUTION.md (절대 변경 금지)
 */

// Cloudflare Pages Functions용 문서수 배치 수집 API
export async function onRequest(context: any) {
  const { request, env } = context;
  
  console.log('🌐 Pages Functions - collect-docs-batch 실행!');
  console.log('📅 요청 시간:', new Date().toISOString());
  
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

    if (request.method !== 'POST') {
      console.log('❌ 잘못된 메서드:', request.method);
      return new Response(
        JSON.stringify({ error: 'Method Not Allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const keywords = body.keywords; // 키워드 배열 또는 키워드 ID 배열
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid keywords array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 문서수 배치 수집 시작: ${keywords.length}개 키워드`);

    const db = env.DB;
    let successCount = 0;
    let failCount = 0;

    // 최대 20개까지만 처리 (API 제한 고려)
    const keywordsToProcess = keywords.slice(0, 20);

    for (const keyword of keywordsToProcess) {
      try {
        // keyword가 문자열인 경우와 객체인 경우 처리
        const keywordText = typeof keyword === 'string' ? keyword : keyword.keyword;
        const keywordId = typeof keyword === 'string' ? null : keyword.id;

        // 키워드 ID가 없으면 키워드 텍스트로 찾기
        let targetKeywordId = keywordId;
        if (!targetKeywordId) {
          const keywordRecord = await db.prepare(
            'SELECT id FROM keywords WHERE keyword = ?'
          ).bind(keywordText).first();
          targetKeywordId = keywordRecord?.id;
        }

        if (!targetKeywordId) {
          console.warn(`키워드를 찾을 수 없음: ${keywordText}`);
          failCount++;
          continue;
        }

        // 문서수 수집
        const docCounts = await collectDocCountsFromNaver(keywordText, env);
        
        if (docCounts) {
          const existingDocCount = await db.prepare(
            'SELECT id FROM naver_doc_counts WHERE keyword_id = ?'
          ).bind(targetKeywordId).first();

          if (existingDocCount) {
            await db.prepare(`
              UPDATE naver_doc_counts 
              SET blog_total = ?, cafe_total = ?, web_total = ?, news_total = ?, collected_at = CURRENT_TIMESTAMP
              WHERE keyword_id = ?
            `).bind(
              docCounts.blog_total || 0,
              docCounts.cafe_total || 0,
              docCounts.web_total || 0,
              docCounts.news_total || 0,
              targetKeywordId
            ).run();
          } else {
            await db.prepare(`
              INSERT INTO naver_doc_counts (keyword_id, blog_total, cafe_total, web_total, news_total)
              VALUES (?, ?, ?, ?, ?)
            `).bind(
              targetKeywordId,
              docCounts.blog_total || 0,
              docCounts.cafe_total || 0,
              docCounts.web_total || 0,
              docCounts.news_total || 0
            ).run();
          }
          successCount++;
        } else {
          failCount++;
        }

        // API 호출 간격 조절 (Rate Limit 방지)
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error: any) {
        console.error(`문서수 수집 실패 (${keyword}):`, error.message);
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: keywordsToProcess.length,
        successCount,
        failCount,
        message: `${successCount}개 키워드의 문서수를 성공적으로 수집했습니다.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Pages Functions collect-docs-batch 에러 발생!');
    console.error('📅 에러 발생 시간:', new Date().toISOString());
    console.error('📝 에러 메시지:', error?.message);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Pages Functions Error', 
        message: error?.message || 'Unknown error',
        details: error?.toString(),
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// 네이버 오픈API로 문서 수 수집
async function collectDocCountsFromNaver(keyword: string, env: any) {
  try {
    // 사용 가능한 네이버 오픈API 키 찾기
    const openApiKeys = [
      { key: env.NAVER_OPENAPI_KEY_1, secret: env.NAVER_OPENAPI_SECRET_1 },
      { key: env.NAVER_OPENAPI_KEY_2, secret: env.NAVER_OPENAPI_SECRET_2 },
      { key: env.NAVER_OPENAPI_KEY_3, secret: env.NAVER_OPENAPI_SECRET_3 },
      { key: env.NAVER_OPENAPI_KEY_4, secret: env.NAVER_OPENAPI_SECRET_4 },
      { key: env.NAVER_OPENAPI_KEY_5, secret: env.NAVER_OPENAPI_SECRET_5 },
      { key: env.NAVER_OPENAPI_KEY_6, secret: env.NAVER_OPENAPI_SECRET_6 },
      { key: env.NAVER_OPENAPI_KEY_7, secret: env.NAVER_OPENAPI_SECRET_7 },
      { key: env.NAVER_OPENAPI_KEY_8, secret: env.NAVER_OPENAPI_SECRET_8 },
      { key: env.NAVER_OPENAPI_KEY_9, secret: env.NAVER_OPENAPI_SECRET_9 },
      { key: env.NAVER_OPENAPI_KEY_10, secret: env.NAVER_OPENAPI_SECRET_10 }
    ].filter(api => api.key && api.secret);

    if (openApiKeys.length === 0) {
      throw new Error('네이버 오픈API 키가 설정되지 않았습니다.');
    }

    // 첫 번째 사용 가능한 API 키 사용
    const apiKey = openApiKeys[0];

    const docCounts: { [key: string]: number } = {
      blog_total: 0,
      cafe_total: 0,
      web_total: 0,
      news_total: 0
    };

    // 각 검색 타입별로 문서 수 수집
    const searchTypes = [
      { type: 'blog', field: 'blog_total' },
      { type: 'cafearticle', field: 'cafe_total' },
      { type: 'webkr', field: 'web_total' },
      { type: 'news', field: 'news_total' }
    ];

    for (const searchType of searchTypes) {
      try {
        const apiUrl = `https://openapi.naver.com/v1/search/${searchType.type}.json`;
        const params = new URLSearchParams({
          query: keyword,
          display: '1',
          start: '1'
        });

        const response = await fetch(`${apiUrl}?${params}`, {
          method: 'GET',
          headers: {
            'X-Naver-Client-Id': apiKey.key,
            'X-Naver-Client-Secret': apiKey.secret
          }
        });

        if (response.ok) {
          const data = await response.json();
          docCounts[searchType.field] = parseInt(data.total) || 0;
        } else {
          console.error(`Failed to get ${searchType.type} count: ${response.status}`);
          docCounts[searchType.field] = 0;
        }

        // API 호출 간격 조절 (Rate Limit 방지)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`Error collecting ${searchType.type} count:`, error);
        docCounts[searchType.field] = 0;
      }
    }

    return docCounts;

  } catch (error: any) {
    console.error('Error collecting document counts from Naver OpenAPI:', error);
    throw new Error(`네이버 오픈API 호출 실패: ${error.message}`);
  }
}


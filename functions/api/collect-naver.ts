/**
 * ⚠️ 헌법 준수 필수 (CONSTITUTION.md)
 * 
 * 절대 변경 금지 사항:
 * - API 응답에 keywords 배열 필수 포함
 * - 필드명 변경 금지 (pc_search, mobile_search 등)
 * - 네이버 API 호출 로직 변경 금지
 * - 샘플 데이터 반환 금지
 * 
 * 헌법 문서: CONSTITUTION.md (절대 변경 금지)
 */

// Cloudflare Pages Functions용 네이버 API 키워드 수집
export async function onRequest(context: any) {
  const { request, env } = context;
  
  console.log('🌐 Pages Functions - collect-naver 실행!');
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

    if (request.method !== 'POST') {
      console.log('❌ 잘못된 메서드:', request.method);
      return new Response(
        JSON.stringify({ error: 'Method Not Allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const seed = body.seed;
    
    if (!seed || typeof seed !== 'string') {
      console.log('❌ 잘못된 시드 키워드:', seed);
      return new Response(
        JSON.stringify({ error: 'Invalid seed keyword' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 Pages Functions - 네이버 API 수집 시작: ${seed}`);
    console.log(`🆔 코드 버전: v4.0 - 환경변수 디버그 (${new Date().toISOString()})`);
    console.log(`🔧 네이버 SearchAd API 공식 구현 확인됨`);

    // 환경변수 디버그
    console.log('🔍 환경변수 확인:');
    console.log('NAVER_API_KEY_1:', env.NAVER_API_KEY_1 ? '설정됨' : '없음');
    console.log('NAVER_API_SECRET_1:', env.NAVER_API_SECRET_1 ? '설정됨' : '없음');
    console.log('NAVER_CUSTOMER_ID_1:', env.NAVER_CUSTOMER_ID_1 ? '설정됨' : '없음');
    console.log('DB:', env.DB ? '설정됨' : '없음');

    // 실제 네이버 SearchAd API 호출
    const keywords = await fetchKeywordsFromOfficialNaverAPI(seed.trim(), env);
    console.log(`✅ 네이버 API 수집 완료: ${keywords?.length || 0}개 키워드`);

    if (!keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `네이버 API에서 연관검색어를 찾을 수 없습니다: ${seed.trim()}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // D1 데이터베이스에 저장
    const db = env.DB;
    let savedCount = 0;
    let updatedCount = 0;
    let docCountsCollected = 0;
    const maxDocCountsToCollect = 10;

    // 네이버 오픈API 키 확인
    const hasOpenApiKeys = [
      env.NAVER_OPENAPI_KEY_1, env.NAVER_OPENAPI_KEY_2, env.NAVER_OPENAPI_KEY_3,
      env.NAVER_OPENAPI_KEY_4, env.NAVER_OPENAPI_KEY_5
    ].some(key => key);
    console.log(`📄 네이버 오픈API 키 확인: ${hasOpenApiKeys ? '설정됨' : '미설정'}`);

    for (const keyword of keywords) {
      try {
        // 기존 키워드 확인 (keyword와 seed_keyword_text로 검색)
        const existing = await db.prepare(
          'SELECT id FROM keywords WHERE keyword = ?'
        ).bind(keyword.keyword).first();

        let keywordId: number | null = null;

        if (existing) {
          keywordId = existing.id as number;
          // 기존 키워드 업데이트 - 스키마에 맞게 컬럼명 수정
          await db.prepare(`
            UPDATE keywords SET 
              monthly_search_pc = ?, monthly_search_mob = ?, avg_monthly_search = ?,
              seed_keyword_text = ?, comp_index = ?, updated_at = ?
            WHERE keyword = ?
          `).bind(
            keyword.pc_search, keyword.mobile_search, keyword.avg_monthly_search,
            seed.trim(), keyword.comp_idx || 0, new Date().toISOString(),
            keyword.keyword
          ).run();

          // keyword_metrics 테이블 업데이트 또는 삽입
          const existingMetrics = await db.prepare(
            'SELECT id FROM keyword_metrics WHERE keyword_id = ?'
          ).bind(existing.id).first();

          if (existingMetrics) {
            await db.prepare(`
              UPDATE keyword_metrics SET
                monthly_click_pc = ?, monthly_click_mobile = ?, ctr_pc = ?, ctr_mobile = ?, ad_count = ?
              WHERE keyword_id = ?
            `).bind(
              keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
              keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0,
              existing.id
            ).run();
          } else {
            await db.prepare(`
              INSERT INTO keyword_metrics (
                keyword_id, monthly_click_pc, monthly_click_mobile, ctr_pc, ctr_mobile, ad_count
              ) VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
              existing.id,
              keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
              keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0
            ).run();
          }
          updatedCount++;
        } else {
          // 새 키워드 삽입 - 스키마에 맞게 컬럼명 수정
          const insertResult = await db.prepare(`
            INSERT INTO keywords (
              keyword, seed_keyword_text, monthly_search_pc, monthly_search_mob, 
              avg_monthly_search, comp_index, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            keyword.keyword, seed.trim(), keyword.pc_search, keyword.mobile_search,
            keyword.avg_monthly_search, keyword.comp_idx || 0,
            new Date().toISOString(), new Date().toISOString()
          ).run();

          keywordId = insertResult.meta.last_row_id;

          // keyword_metrics 테이블에 메트릭 데이터 삽입
          await db.prepare(`
            INSERT INTO keyword_metrics (
              keyword_id, monthly_click_pc, monthly_click_mobile, ctr_pc, ctr_mobile, ad_count
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            keywordId,
            keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
            keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0
          ).run();
          savedCount++;
        }

        // 문서수 수집 (최대 10개까지, API 제한 고려)
        if (docCountsCollected < maxDocCountsToCollect && hasOpenApiKeys && keywordId) {
          try {
            console.log(`📄 문서수 수집 시작: ${keyword.keyword} (${docCountsCollected + 1}/${maxDocCountsToCollect})`);
            const docCounts = await collectDocCountsFromNaver(keyword.keyword, env);
            
            if (docCounts) {
              console.log(`✅ 문서수 수집 완료 (${keyword.keyword}):`, docCounts);
              
              const existingDocCount = await db.prepare(
                'SELECT id FROM naver_doc_counts WHERE keyword_id = ?'
              ).bind(keywordId).first();

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
                  keywordId
                ).run();
                console.log(`📄 문서수 업데이트 완료: ${keyword.keyword}`);
              } else {
                await db.prepare(`
                  INSERT INTO naver_doc_counts (keyword_id, blog_total, cafe_total, web_total, news_total)
                  VALUES (?, ?, ?, ?, ?)
                `).bind(
                  keywordId,
                  docCounts.blog_total || 0,
                  docCounts.cafe_total || 0,
                  docCounts.web_total || 0,
                  docCounts.news_total || 0
                ).run();
                console.log(`📄 문서수 저장 완료: ${keyword.keyword}`);
              }
              docCountsCollected++;
            } else {
              console.warn(`⚠️ 문서수 수집 결과 없음: ${keyword.keyword}`);
            }
            // API 호출 간격 조절 (Rate Limit 방지)
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (docError: any) {
            console.error(`❌ 문서수 수집 실패 (${keyword.keyword}):`, docError.message);
            console.error('에러 상세:', docError.stack);
            // 문서수 수집 실패해도 키워드 저장은 성공으로 처리
          }
        } else if (!hasOpenApiKeys) {
          console.warn('⚠️ 네이버 오픈API 키가 설정되지 않아 문서수 수집을 건너뜁니다.');
        } else if (docCountsCollected >= maxDocCountsToCollect) {
          console.log(`📄 문서수 수집 제한 도달 (${maxDocCountsToCollect}개), 나머지 건너뜀`);
        }
      } catch (dbError: any) {
        console.error(`데이터베이스 저장 실패 (${keyword.keyword}):`, dbError);
        console.error('에러 상세:', dbError.message, dbError.stack);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        seed: seed.trim(),
        totalCollected: keywords.length,
        totalSavedOrUpdated: savedCount + updatedCount,
        savedCount,
        updatedCount,
        keywords: keywords, // 실제 수집된 키워드 데이터 반환
        docCountsCollected, // 문서수 수집된 키워드 수
        hasOpenApiKeys, // 네이버 오픈API 키 설정 여부
        message: `네이버 API로 ${keywords.length}개의 연관검색어를 수집하여 ${savedCount + updatedCount}개를 저장했습니다.${docCountsCollected > 0 ? ` 문서수 ${docCountsCollected}개 수집 완료.` : hasOpenApiKeys ? '' : ' (네이버 오픈API 키 미설정으로 문서수 수집 건너뜀)'}`,
        version: 'v5.0 - 문서수 수집 로직 개선',
        timestamp: new Date().toISOString(),
        api_implementation: {
          endpoint: 'https://api.naver.com/keywordstool',
          authentication: 'HMAC-SHA256 + Base64',
          parameters: 'hintKeywords, showDetail=1',
          response_mapping: 'relKeyword → keyword, monthlyPcQcCnt → pc_search, etc.',
          data_normalization: '< 10 strings handled',
          rate_limit_handling: '429 → 5min cooldown'
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Pages Functions 에러 발생!');
    console.error('📅 에러 발생 시간:', new Date().toISOString());
    console.error('🔍 에러 타입:', typeof error);
    console.error('📝 에러 메시지:', error?.message);
    console.error('📚 에러 스택:', error?.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Pages Functions Error', 
        message: error?.message || 'Unknown error',
        details: error?.toString(),
        timestamp: new Date().toISOString(),
        source: 'Pages Functions',
        version: 'v5.0 - 문서수 수집 로직 개선'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// 공식 네이버 SearchAd API로 키워드 수집
async function fetchKeywordsFromOfficialNaverAPI(seed: string, env: any) {
  console.log('🚀 Official Naver SearchAd API called with seed:', seed);
  
  try {
    // 기존 환경변수에서 API 키 가져오기 (공식 API 사용)
    const BASE = 'https://api.naver.com';
    
    // 사용 가능한 네이버 API 키 찾기
    const apiKeys = [
      { key: env.NAVER_API_KEY_1, secret: env.NAVER_API_SECRET_1, customerId: env.NAVER_CUSTOMER_ID_1 },
      { key: env.NAVER_API_KEY_2, secret: env.NAVER_API_SECRET_2, customerId: env.NAVER_CUSTOMER_ID_2 },
      { key: env.NAVER_API_KEY_3, secret: env.NAVER_API_SECRET_3, customerId: env.NAVER_CUSTOMER_ID_3 },
      { key: env.NAVER_API_KEY_4, secret: env.NAVER_API_SECRET_4, customerId: env.NAVER_CUSTOMER_ID_4 },
      { key: env.NAVER_API_KEY_5, secret: env.NAVER_API_SECRET_5, customerId: env.NAVER_CUSTOMER_ID_5 }
    ].filter(api => api.key && api.secret && api.customerId);

    if (apiKeys.length === 0) {
      throw new Error('네이버 API 키가 설정되지 않았습니다.');
    }

    // 첫 번째 사용 가능한 API 키 사용
    const apiKey = apiKeys[0];
    const KEY = apiKey.key;
    const SECRET = apiKey.secret;
    const CID = apiKey.customerId;

    console.log('Using official Naver SearchAd API:', {
      base: BASE,
      key: KEY.substring(0, 8) + '...',
      customerId: CID
    });

    // 공식 API 엔드포인트 및 파라미터
    const uri = '/keywordstool';
    const qs = new URLSearchParams({ 
      hintKeywords: seed, 
      showDetail: '1' 
    });
    const ts = Date.now().toString();
    
    // HMAC-SHA256 시그니처 생성 (공식 문서 기준)
    const sig = await generateOfficialHMACSignature(ts, 'GET', uri, SECRET);

    console.log('Official API call details:', {
      url: `${BASE}${uri}?${qs.toString()}`,
      timestamp: ts,
      signature: sig.substring(0, 20) + '...'
    });

    // 공식 API 호출
    const res = await fetch(`${BASE}${uri}?${qs.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Timestamp': ts,
        'X-API-KEY': KEY,
        'X-Customer': CID,
        'X-Signature': sig,
      },
    });

    console.log(`Official Naver API response status: ${res.status}`);

    // 429 Rate Limit 처리
    if (res.status === 429) {
      console.warn('Rate limit reached. Cooling down for 5 minutes...');
      await new Promise(r => setTimeout(r, 5 * 60 * 1000));
      return fetchKeywordsFromOfficialNaverAPI(seed, env);
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Official Naver API Error: ${res.status} - ${errorText}`);
      throw new Error(`공식 네이버 SearchAd API 호출 실패: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    console.log('Official Naver API response:', JSON.stringify(data, null, 2));

    // 응답 데이터 매핑 (공식 필드명 사용)
    if (!data.keywordList || !Array.isArray(data.keywordList)) {
      console.log('No keywordList data found in official API response');
      return [];
    }

    const keywords = data.keywordList.map((k: any) => ({
      keyword: k.relKeyword,
      pc_search: normalizeSearchCount(k.monthlyPcQcCnt),
      mobile_search: normalizeSearchCount(k.monthlyMobileQcCnt),
      avg_monthly_search: normalizeSearchCount(k.monthlyPcQcCnt) + normalizeSearchCount(k.monthlyMobileQcCnt),
      monthly_click_pc: parseFloat(k.monthlyAvePcClkCnt || '0'),
      monthly_click_mo: parseFloat(k.monthlyAveMobileClkCnt || '0'),
      ctr_pc: parseFloat(k.monthlyAvePcCtr || '0'),
      ctr_mo: parseFloat(k.monthlyAveMobileCtr || '0'),
      ad_count: parseInt(k.plAvgDepth || '0'),
      comp_idx: k.compIdx || null
    })).filter((kw: any) => kw.keyword && kw.keyword.trim() !== '');

    console.log(`✅ Collected ${keywords.length} keywords from official Naver SearchAd API`);
    console.log('First few keywords:', keywords.slice(0, 3));
    return keywords;

  } catch (error: any) {
    console.error('❌ Error collecting from official Naver SearchAd API:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    throw new Error(`공식 네이버 SearchAd API 호출 실패: ${error.message}`);
  }
}

// 공식 HMAC 시그니처 생성 함수
async function generateOfficialHMACSignature(timestamp: string, method: string, uri: string, secret: string): Promise<string> {
  try {
    const message = `${timestamp}.${method}.${uri}`;
    console.log('Generating official HMAC signature:', {
      timestamp,
      method,
      uri,
      message,
      secret: secret.substring(0, 8) + '...'
    });

    // 공식 문서 기준: secret을 그대로 사용 (Base64 디코딩하지 않음)
    const secretBytes = new TextEncoder().encode(secret);
    const messageBytes = new TextEncoder().encode(message);
    
    // HMAC-SHA256 생성
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
    
    // Base64 인코딩
    const base64String = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    console.log('Generated official signature (Base64):', base64String.substring(0, 20) + '...');
    return base64String;
  } catch (error: any) {
    console.error('Official HMAC signature generation error:', error);
    throw new Error(`공식 시그니처 생성 실패: ${error.message}`);
  }
}

// 검색량 정규화 함수
function normalizeSearchCount(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === '') return 0;
  
  const str = value.toString();
  if (str.includes('<')) {
    return parseInt(str.replace('<', '').replace(' ', '')) || 0;
  }
  return parseInt(str) || 0;
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
    console.log(`Using Naver OpenAPI key: ${apiKey.key.substring(0, 8)}...`);

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
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          // 공식 문서 기준: query 파라미터는 UTF-8 인코딩 필수
          const apiUrl = `https://openapi.naver.com/v1/search/${searchType.type}.json`;
          const params = new URLSearchParams({
            query: keyword, // URLSearchParams가 자동으로 UTF-8 인코딩 처리
            display: '1', // 문서 수만 필요하므로 최소한으로 설정 (공식 문서: 1~100)
            start: '1' // 공식 문서: 1~1000
          });

          const response = await fetch(`${apiUrl}?${params}`, {
            method: 'GET',
            headers: {
              'X-Naver-Client-Id': apiKey.key,
              'X-Naver-Client-Secret': apiKey.secret,
              'Content-Type': 'application/json; charset=UTF-8'
            }
          });

          // 응답 상태 코드별 처리 (공식 문서 기준)
          if (response.ok) {
            const data = await response.json();
            
            // 응답 타입 검증 (공식 문서 구조)
            if (typeof data === 'object' && 'total' in data) {
              docCounts[searchType.field] = parseInt(String(data.total)) || 0;
              console.log(`✅ ${searchType.type} total: ${docCounts[searchType.field]}`);
              success = true;
            } else {
              console.warn(`⚠️ ${searchType.type} 응답 구조 이상:`, data);
              docCounts[searchType.field] = 0;
              success = true; // 다음 타입으로 진행
            }
          } else {
            // 에러 응답 본문 읽기 (공식 문서: 4xx, 429, 500 처리)
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`❌ ${searchType.type} API 호출 실패 (${response.status}):`, errorText);

            // 429 Rate Limit 또는 500 서버 에러 시 재시도 (공식 문서: 지수백오프)
            if (response.status === 429 || response.status === 500) {
              retryCount++;
              if (retryCount < maxRetries) {
                const backoffMs = Math.min(300 * Math.pow(2, retryCount - 1), 1200); // 300ms → 600ms → 1200ms
                console.log(`🔄 ${searchType.type} 재시도 ${retryCount}/${maxRetries} (${backoffMs}ms 대기)`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue; // 재시도
              }
            }
            
            // 4xx 에러는 재시도하지 않음 (공식 문서: 사용자 입력 검증)
            docCounts[searchType.field] = 0;
            success = true; // 다음 타입으로 진행
          }

        } catch (error: any) {
          retryCount++;
          console.error(`❌ ${searchType.type} 에러 (시도 ${retryCount}/${maxRetries}):`, error.message);
          
          if (retryCount < maxRetries) {
            const backoffMs = Math.min(300 * Math.pow(2, retryCount - 1), 1200);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } else {
            docCounts[searchType.field] = 0;
            success = true; // 다음 타입으로 진행
          }
        }
      }

      // API 호출 간격 조절 (Rate Limit 방지, 공식 문서: 쿼터 25,000회/일)
      if (success) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Collected document counts for "${keyword}":`, docCounts);
    return docCounts;

  } catch (error: any) {
    console.error('Error collecting document counts from Naver OpenAPI:', error);
    throw new Error(`네이버 오픈API 호출 실패: ${error.message}`);
  }
}

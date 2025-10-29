// Cloudflare Workers용 키워드 수집 API
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const uniqueId = Math.random().toString(36).substring(7);
    console.log(`🌐 [${uniqueId}] 메인 라우터 실행!`);
    console.log(`📅 [${uniqueId}] 요청 시간:`, new Date().toISOString());
    console.log(`🔗 [${uniqueId}] 요청 URL:`, request.url);
    console.log(`📝 [${uniqueId}] 요청 메서드:`, request.method);
    console.log(`🚨 [${uniqueId}] 고유 ID: ${uniqueId} - 이 로그가 보이면 우리 코드가 실행되고 있습니다!`);
    
    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    };

    // OPTIONS 요청 처리
    if (request.method === 'OPTIONS') {
      console.log(`🔄 [${uniqueId}] OPTIONS 요청 처리`);
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      console.log(`🛤️ [${uniqueId}] 요청 경로:`, path);

          // 인증 확인
          const adminKey = request.headers.get('x-admin-key');
          const expectedKey = env.ADMIN_KEY || 'dev-key-2024';
          if (!adminKey || adminKey !== expectedKey) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      switch (path) {
        case '/api/collect':
          console.log('🎯 /api/collect 라우트 선택됨');
          return await handleCollect(request, env, corsHeaders);
        case '/api/collect-naver':
          console.log('🎯 /api/collect-naver 라우트 선택됨');
          return await handleCollectFromNaver(request, env, corsHeaders);
        case '/api/collect-docs':
          console.log('🎯 /api/collect-docs 라우트 선택됨');
          return await handleCollectDocs(request, env, corsHeaders);
        case '/api/keywords':
          console.log('🎯 /api/keywords 라우트 선택됨');
          return await handleGetKeywords(request, env, corsHeaders);
            case '/api/health':
              console.log('🎯 /api/health 라우트 선택됨');
              return new Response(
                JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
        case '/api/debug/env':
          console.log('🎯 /api/debug/env 라우트 선택됨');
          return await handleDebugEnv(request, env, corsHeaders);
        case '/api/debug/logs':
          console.log('🎯 /api/debug/logs 라우트 선택됨');
          return await handleDebugLogs(request, env, corsHeaders);
        default:
          console.log('❌ 알 수 없는 경로:', path);
          return new Response(
            JSON.stringify({ error: 'Not Found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    } catch (error: any) {
      console.error('API Error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: error?.message || 'Unknown error' }),
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

// 네이버 API로 키워드 수집 처리
async function handleCollectFromNaver(request: Request, env: any, corsHeaders: any) {
  console.log('🚨🚨🚨 handleCollectFromNaver 함수가 실행되었습니다! 🚨🚨🚨');
  console.log('📅 실행 시간:', new Date().toISOString());
  console.log('🔗 요청 URL:', request.url);
  console.log('📝 요청 메서드:', request.method);
  console.log('🔑 Admin Key:', request.headers.get('x-admin-key'));
  
  if (request.method !== 'POST') {
    console.log('❌ 잘못된 메서드:', request.method);
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let seed = '';
  try {
    console.log('📥 요청 본문 파싱 시작...');
    const body = await request.json();
    seed = body.seed;
    console.log('📝 파싱된 시드 키워드:', seed);
    
    if (!seed || typeof seed !== 'string') {
      console.log('❌ 잘못된 시드 키워드:', seed);
      return new Response(
        JSON.stringify({ error: 'Invalid seed keyword' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 Starting Naver API collection for seed: ${seed}`);
    console.log('⏰ 현재 시간:', new Date().toISOString());

    // 공식 네이버 SearchAd API로 연관검색어 수집
    console.log('📞 About to call official Naver SearchAd API...');
    console.log('🔍 환경변수 확인 시작...');
    
    // 🚨 강제 에러 발생 - 실제 함수 실행 여부 확인
    console.log('💥 강제 에러 발생 시도...');
    throw new Error('🚨 강제 에러 발생 - 이 메시지가 보이면 우리 코드가 실행되고 있습니다!');
    
    const keywords = await fetchKeywordsFromOfficialNaverAPI(seed.trim(), env);
    console.log(`Official Naver API collection completed:`, {
      keywordCount: keywords?.length || 0,
      keywords: keywords?.slice(0, 3) || [] // 처음 3개만 로그
    });
    
    if (!keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '수집된 연관검색어가 없습니다.',
          seed: seed.trim()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 수집된 키워드를 데이터베이스에 저장
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
          seed.trim(),
          keywordData.monthly_search_pc || 0,
          keywordData.monthly_search_mob || 0,
          keywordData.avg_monthly_search || 0,
          keywordData.cpc || 0,
          keywordData.comp_index || 0
        ).run();

        savedCount++;
      }
    }

    // 수집된 키워드들의 문서 수도 함께 수집
    let docCountsCollected = 0;
    for (const keywordData of keywords.slice(0, 5)) { // 처음 5개 키워드만 문서 수 수집 (API 제한 고려)
      try {
        const docCounts = await collectDocCountsFromNaver(keywordData.keyword, env);
        if (docCounts) {
          // 키워드 ID 찾기
          const keywordRecord = await env.DB.prepare(
            'SELECT id FROM keywords WHERE keyword = ?'
          ).bind(keywordData.keyword).first();

          if (keywordRecord) {
            // 문서 수 데이터 저장 또는 업데이트
            const existing = await env.DB.prepare(
              'SELECT id FROM naver_doc_counts WHERE keyword_id = ?'
            ).bind(keywordRecord.id).first();

            if (existing) {
              await env.DB.prepare(`
                UPDATE naver_doc_counts 
                SET blog_total = ?, cafe_total = ?, web_total = ?, news_total = ?, collected_at = CURRENT_TIMESTAMP
                WHERE keyword_id = ?
              `).bind(
                docCounts.blog_total || 0,
                docCounts.cafe_total || 0,
                docCounts.web_total || 0,
                docCounts.news_total || 0,
                keywordRecord.id
              ).run();
            } else {
              await env.DB.prepare(`
                INSERT INTO naver_doc_counts (keyword_id, blog_total, cafe_total, web_total, news_total)
                VALUES (?, ?, ?, ?, ?)
              `).bind(
                keywordRecord.id,
                docCounts.blog_total || 0,
                docCounts.cafe_total || 0,
                docCounts.web_total || 0,
                docCounts.news_total || 0
              ).run();
            }
            docCountsCollected++;
          }
        }
        // API 호출 간격 조절
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        console.error(`Error collecting doc counts for ${keywordData.keyword}:`, error);
      }
    }

    // 시드 키워드 사용 기록 업데이트
    await env.DB.prepare(`
      INSERT INTO auto_seed_usage (seed, last_used, usage_count, created_at)
      VALUES (?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(seed) DO UPDATE SET 
        last_used = CURRENT_TIMESTAMP,
        usage_count = usage_count + 1
    `).bind(seed.trim()).run();

    return new Response(
      JSON.stringify({
        success: true,
        seed: seed.trim(),
        totalCollected: keywords.length,
        totalSavedOrUpdated: savedCount + updatedCount,
        savedCount,
        updatedCount,
        docCountsCollected,
        message: `네이버 API로 ${keywords.length}개의 연관검색어를 수집하여 ${savedCount + updatedCount}개를 저장했습니다. ${docCountsCollected}개의 키워드 문서 수도 수집했습니다.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Naver collect error 발생!');
    console.error('📅 에러 발생 시간:', new Date().toISOString());
    console.error('🔍 에러 타입:', typeof error);
    console.error('📝 에러 메시지:', error?.message);
    console.error('📚 에러 스택:', error?.stack);
    console.error('🔑 시드 키워드:', seed);
    
    // 네이버 API 키 문제로 인한 실패인 경우 명확한 메시지 제공
    if (error.message.includes('403') || error.message.includes('invalid-signature')) {
      console.log('🔐 네이버 API 키 인증 실패 감지');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `❌ 네이버 API 키 인증 실패: ${error.message}`,
          seed: seed.trim(),
          error: '네이버 검색광고 API 키가 유효하지 않거나 만료되었습니다. 관리자에게 문의하세요.',
          solution: '네이버 검색광고 API 콘솔에서 키 상태를 확인하고 새로운 키를 발급받아주세요.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('🔄 일반 에러 응답 반환');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to collect keywords from Naver API', 
        message: error?.message || 'Unknown error',
        details: error?.toString(),
        timestamp: new Date().toISOString()
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
          comp_idx: k.compIdx || null,
          // 기존 필드명 호환성 유지
          monthly_search_pc: normalizeSearchCount(k.monthlyPcQcCnt),
          monthly_search_mob: normalizeSearchCount(k.monthlyMobileQcCnt),
          cpc: parseFloat(k.plAvgBid) || 0,
          comp_index: parseCompIndex(k.compIdx),
          monthly_click_mobile: parseFloat(k.monthlyAveMobileClkCnt || '0'),
          ctr_mobile: parseFloat(k.monthlyAveMobileCtr || '0')
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

// 공식 네이버 SearchAd API용 HMAC-SHA256 시그니처 생성
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

// 기존 HMAC 시그니처 생성 함수 (호환성 유지)
async function generateHMACSignature(secret: string, message: string): Promise<string> {
  try {
    console.log('Generating HMAC signature (Naver official method):', {
      secret: secret.substring(0, 8) + '...',
      message,
      secretLength: secret.length,
      messageLength: message.length
    });

    // 네이버 API 공식 문서에 따른 시그니처 생성
    // 방법 1: secret을 Base64 디코딩해서 사용
    let secretBytes;
    try {
      secretBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
      console.log('Using Base64 decoded secret');
    } catch (e) {
      // Base64 디코딩 실패 시 원본 secret 사용
      secretBytes = new TextEncoder().encode(secret);
      console.log('Using raw secret (Base64 decode failed)');
    }
    
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
    
    console.log('Generated signature (Base64):', base64String.substring(0, 20) + '...');
    return base64String;
  } catch (error: any) {
    console.error('HMAC signature generation error:', error);
    throw new Error(`시그니처 생성 실패: ${error.message}`);
  }
}

// 검색 수 정규화 (< 10 같은 문자열 처리)
function normalizeSearchCount(value: string): number {
  if (!value || typeof value !== 'string') return 0;
  
  // < 10 같은 문자열 처리
  const cleaned = value.replace(/[<>]/g, '').trim();
  const parsed = parseInt(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

// 경쟁 지수 정규화 (낮음/중간/높음 → 숫자)
function parseCompIndex(value: string): number {
  if (!value) return 0;
  
  switch (value) {
    case '낮음': return 1;
    case '중간': return 2;
    case '높음': return 3;
    default: return 0;
  }
}

// 네이버 오픈API로 문서 수 수집 처리
async function handleCollectDocs(request: Request, env: any, corsHeaders: any) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { keyword } = await request.json();
    
    if (!keyword || typeof keyword !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid keyword' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting document count collection for keyword: ${keyword}`);

    // 네이버 오픈API로 문서 수 수집
    const docCounts = await collectDocCountsFromNaver(keyword.trim(), env);
    
    if (!docCounts) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '문서 수 수집에 실패했습니다.',
          keyword: keyword.trim()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 키워드 ID 찾기
    const keywordRecord = await env.DB.prepare(
      'SELECT id FROM keywords WHERE keyword = ?'
    ).bind(keyword.trim()).first();

    if (!keywordRecord) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '키워드를 찾을 수 없습니다.',
          keyword: keyword.trim()
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 문서 수 데이터 저장 또는 업데이트
    const existing = await env.DB.prepare(
      'SELECT id FROM naver_doc_counts WHERE keyword_id = ?'
    ).bind(keywordRecord.id).first();

    if (existing) {
      // 기존 문서 수 업데이트
      await env.DB.prepare(`
        UPDATE naver_doc_counts 
        SET blog_total = ?, cafe_total = ?, web_total = ?, news_total = ?, collected_at = CURRENT_TIMESTAMP
        WHERE keyword_id = ?
      `).bind(
        docCounts.blog_total || 0,
        docCounts.cafe_total || 0,
        docCounts.web_total || 0,
        docCounts.news_total || 0,
        keywordRecord.id
      ).run();
    } else {
      // 새 문서 수 저장
      await env.DB.prepare(`
        INSERT INTO naver_doc_counts (keyword_id, blog_total, cafe_total, web_total, news_total)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        keywordRecord.id,
        docCounts.blog_total || 0,
        docCounts.cafe_total || 0,
        docCounts.web_total || 0,
        docCounts.news_total || 0
      ).run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        keyword: keyword.trim(),
        docCounts,
        message: `네이버 오픈API로 "${keyword.trim()}"의 문서 수를 성공적으로 수집했습니다.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Doc count collect error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to collect document counts from Naver OpenAPI', 
        message: error?.message || 'Unknown error',
        details: error?.toString()
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
      { type: 'cafe', field: 'cafe_total' },
      { type: 'web', field: 'web_total' },
      { type: 'news', field: 'news_total' }
    ];

    for (const searchType of searchTypes) {
      try {
        const apiUrl = `https://openapi.naver.com/v1/search/${searchType.type}.json`;
        const params = new URLSearchParams({
          query: keyword,
          display: '1', // 문서 수만 필요하므로 최소한으로 설정
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
          console.log(`${searchType.type} total: ${docCounts[searchType.field]}`);
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

    console.log(`Collected document counts for "${keyword}":`, docCounts);
    return docCounts;

  } catch (error: any) {
    console.error('Error collecting document counts from Naver OpenAPI:', error);
    
    // API 실패 시 에러를 그대로 전파 (샘플 데이터 폴백 제거)
    throw new Error(`네이버 오픈API 호출 실패: ${error.message}`);
  }
}


// 네이버 API 테스트 처리
async function handleTestNaverAPI(request: Request, env: any, corsHeaders: any) {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 환경변수 확인 및 디버깅
    console.log('Environment variables:', {
      NAVER_API_KEY_1: env.NAVER_API_KEY_1 ? 'SET' : 'NOT SET',
      NAVER_API_SECRET_1: env.NAVER_API_SECRET_1 ? 'SET' : 'NOT SET',
      NAVER_CUSTOMER_ID_1: env.NAVER_CUSTOMER_ID_1 ? 'SET' : 'NOT SET',
      ADMIN_KEY: env.ADMIN_KEY ? 'SET' : 'NOT SET'
    });

    // 임시로 하드코딩된 API 키 사용 (테스트용)
    const hardcodedApiKeys = [
      { 
        key: '0100000000d027bb5287da074c48fc79503e97ae8e4bb0e7e928b39108e0b4dd6ce3950b7f', 
        secret: 'AQAAAADQJ7tSh9oHTEj8eVA+l66OGm0FwBl/Ejg+WP/5GntSew==', 
        customerId: '4129627' 
      }
    ];

    const envApiKeys = [
      { key: env.NAVER_API_KEY_1, secret: env.NAVER_API_SECRET_1, customerId: env.NAVER_CUSTOMER_ID_1 },
      { key: env.NAVER_API_KEY_2, secret: env.NAVER_API_SECRET_2, customerId: env.NAVER_CUSTOMER_ID_2 },
      { key: env.NAVER_API_KEY_3, secret: env.NAVER_API_SECRET_3, customerId: env.NAVER_CUSTOMER_ID_3 },
      { key: env.NAVER_API_KEY_4, secret: env.NAVER_API_SECRET_4, customerId: env.NAVER_CUSTOMER_ID_4 },
      { key: env.NAVER_API_KEY_5, secret: env.NAVER_API_SECRET_5, customerId: env.NAVER_CUSTOMER_ID_5 }
    ].filter(api => api.key && api.secret && api.customerId);

    // 환경변수가 없으면 하드코딩된 키 사용
    const apiKeys = envApiKeys.length > 0 ? envApiKeys : hardcodedApiKeys;

    console.log(`Found ${apiKeys.length} valid API keys (${envApiKeys.length} from env, ${hardcodedApiKeys.length} hardcoded)`);

    if (apiKeys.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '네이버 API 키가 설정되지 않았습니다.',
          availableKeys: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = apiKeys[0];
    
    // 실제 네이버 API 호출 테스트
    const apiUrl = 'https://api.naver.com/keywordstool';
    const params = new URLSearchParams({
      hintKeywords: '테스트',
      showDetail: '1'
    });

    const timestamp = Date.now().toString();
    const method = 'GET';
    const uri = '/keywordstool';
    const message = `${timestamp}.${method}.${uri}`;
    const signature = await generateHMACSignature(apiKey.secret, message);

    console.log('Testing Naver API with:', {
      url: `${apiUrl}?${params}`,
      timestamp,
      customerId: apiKey.customerId,
      apiKey: apiKey.key.substring(0, 8) + '...',
      signature: signature.substring(0, 20) + '...'
    });

    const response = await fetch(`${apiUrl}?${params}`, {
      method: 'GET',
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': apiKey.key,
        'X-Customer': apiKey.customerId,
        'X-Signature': signature,
        'Content-Type': 'application/json; charset=UTF-8'
      }
    });

    const responseText = await response.text();
    
    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.substring(0, 500), // 처음 500자만
        apiKey: apiKey.key.substring(0, 8) + '...',
        customerId: apiKey.customerId,
        timestamp,
        signature: signature.substring(0, 20) + '...'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Test Naver API error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// 로그 디버그 함수
async function handleDebugLogs(request: Request, env: any, corsHeaders: any) {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const logInfo = {
    timestamp: new Date().toISOString(),
    message: '로그 디버그 엔드포인트 호출됨',
    request_url: request.url,
    request_method: request.method,
    user_agent: request.headers.get('user-agent'),
    admin_key: request.headers.get('x-admin-key'),
    test_message: '🚨 이 메시지가 보이면 우리 코드가 실행되고 있습니다!'
  };

  console.log('🔍 로그 디버그 함수 실행:', logInfo);

  return new Response(
    JSON.stringify({
      message: '로그 디버그 정보',
      logs: logInfo,
      recommendation: '이 응답이 보이면 우리가 수정한 코드가 실행되고 있습니다.'
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// 환경변수 디버그 함수
async function handleDebugEnv(request: Request, env: any, corsHeaders: any) {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const envStatus = {
    // 실제 Workers 설정에 맞는 환경변수들 확인
    ADMIN_KEY: env.ADMIN_KEY ? '✅ 설정됨' : '❌ 미설정',
    NAVER_API_KEY_1: env.NAVER_API_KEY_1 ? '✅ 설정됨' : '❌ 미설정',
    NAVER_API_SECRET_1: env.NAVER_API_SECRET_1 ? '✅ 설정됨' : '❌ 미설정',
    NAVER_CUSTOMER_ID_1: env.NAVER_CUSTOMER_ID_1 ? '✅ 설정됨' : '❌ 미설정',
    NAVER_OPENAPI_KEY_1: env.NAVER_OPENAPI_KEY_1 ? '✅ 설정됨' : '❌ 미설정',
    NAVER_OPENAPI_SECRET_1: env.NAVER_OPENAPI_SECRET_1 ? '✅ 설정됨' : '❌ 미설정'
  };

  return new Response(
    JSON.stringify({
      message: '환경변수 상태 확인',
      environment_status: envStatus,
      recommendation: '기존 NAVER_API_KEY_1, NAVER_API_SECRET_1, NAVER_CUSTOMER_ID_1을 사용하여 공식 네이버 SearchAd API를 호출합니다.'
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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

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

    for (const keyword of keywords) {
      try {
        const existing = await db.prepare(
          'SELECT id FROM keywords WHERE keyword = ?'
        ).bind(keyword.keyword).first();

        if (existing) {
          await db.prepare(`
            UPDATE keywords SET 
              pc_search = ?, mobile_search = ?, avg_monthly_search = ?,
              monthly_click_pc = ?, monthly_click_mo = ?, ctr_pc = ?, ctr_mo = ?,
              ad_count = ?, comp_idx = ?, updated_at = ?
            WHERE keyword = ?
          `).bind(
            keyword.pc_search, keyword.mobile_search, keyword.avg_monthly_search,
            keyword.monthly_click_pc, keyword.monthly_click_mo, keyword.ctr_pc, keyword.ctr_mo,
            keyword.ad_count, keyword.comp_idx, new Date().toISOString(),
            keyword.keyword
          ).run();
          updatedCount++;
        } else {
          await db.prepare(`
            INSERT INTO keywords (
              keyword, pc_search, mobile_search, avg_monthly_search,
              monthly_click_pc, monthly_click_mo, ctr_pc, ctr_mo,
              ad_count, comp_idx, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            keyword.keyword, keyword.pc_search, keyword.mobile_search, keyword.avg_monthly_search,
            keyword.monthly_click_pc, keyword.monthly_click_mo, keyword.ctr_pc, keyword.ctr_mo,
            keyword.ad_count, keyword.comp_idx, new Date().toISOString(), new Date().toISOString()
          ).run();
          savedCount++;
        }
      } catch (dbError) {
        console.error(`데이터베이스 저장 실패 (${keyword.keyword}):`, dbError);
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
        message: `네이버 API로 ${keywords.length}개의 연관검색어를 수집하여 ${savedCount + updatedCount}개를 저장했습니다.`,
        version: 'v4.0 - 환경변수 디버그',
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
        version: 'v4.0 - 환경변수 디버그'
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

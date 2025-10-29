// 테스트용 간단한 API 엔드포인트
export async function onRequest(context: any) {
  const { request, env } = context;
  
  console.log('🧪 테스트 API 실행!');
  console.log('📅 실행 시간:', new Date().toISOString());
  console.log('🔗 요청 URL:', request.url);
  
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
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key');
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '🧪 테스트 API 정상 작동!',
        version: 'v2.0 - 실제 네이버 API 구현',
        timestamp: new Date().toISOString(),
        source: 'Pages Functions Test API',
        environment: {
          hasDB: !!env.DB,
          hasNaverKeys: !!(env.NAVER_API_KEY_1 && env.NAVER_API_SECRET_1 && env.NAVER_CUSTOMER_ID_1)
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Test API Error', 
        message: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
        version: 'v2.0 - 실제 네이버 API 구현'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

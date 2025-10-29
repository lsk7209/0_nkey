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

    // D1 데이터베이스에서 키워드 조회
    const db = env.DB;
    const result = await db.prepare(
      'SELECT * FROM keywords ORDER BY avg_monthly_search DESC LIMIT 100'
    ).all();

    console.log(`✅ 키워드 조회 완료: ${result.results?.length || 0}개`);

    return new Response(
      JSON.stringify({
        success: true,
        keywords: result.results || [],
        total: result.results?.length || 0,
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

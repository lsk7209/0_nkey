/**
 * ⚠️ 헌법 준수 필수 (CONSTITUTION.md)
 * 
 * 절대 변경 금지 사항:
 * - Pages Functions URL 사용
 * - Admin Key 인증 필수
 * 
 * 헌법 문서: CONSTITUTION.md (절대 변경 금지)
 */

// Cloudflare Pages Functions용 키워드 삭제 API
export async function onRequest(context: any) {
  const { request, env } = context;
  
  console.log('🌐 Pages Functions - keywords-delete 실행!');
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

    if (request.method !== 'DELETE') {
      console.log('❌ 잘못된 메서드:', request.method);
      return new Response(
        JSON.stringify({ error: 'Method Not Allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🗑️ Pages Functions - 키워드 전체 삭제 시작');

    // D1 데이터베이스에서 모든 키워드 삭제
    const db = env.DB;

    // CPU 타임 리밋을 피하기 위해 TRUNCATE 또는 배치 삭제 사용
    let totalDeleted = 0;

    // 외래 키 제약조건 때문에 순서대로 삭제: naver_doc_counts -> keyword_metrics -> keywords
    
    // 1. naver_doc_counts 테이블 삭제
    console.log('🗑️ [1/3] naver_doc_counts 테이블 삭제 시도');
    let deletedCount = 0;
    try {
      // TRUNCATE 시도 (더 효율적)
      await db.prepare('DELETE FROM naver_doc_counts').run();
      console.log('✅ naver_doc_counts 테이블 DELETE 완료');
    } catch (truncateError) {
      console.log('⚠️ DELETE 실패, 배치 삭제로 전환:', (truncateError as any).message);
      // DELETE 실패 시 배치 삭제
      const batchSize = 500;
      while (true) {
        const result = await db.prepare('DELETE FROM naver_doc_counts LIMIT ?').bind(batchSize).run();
        const deleted = (result as any).meta?.changes || 0;
        deletedCount += deleted;
        console.log(`🗑️ naver_doc_counts ${deleted}개 삭제 (총: ${deletedCount}개)`);
        if (deleted < batchSize) break;
      }
    }

    // 2. keyword_metrics 테이블 삭제
    console.log('🗑️ [2/3] keyword_metrics 테이블 삭제 시도');
    deletedCount = 0;
    try {
      await db.prepare('DELETE FROM keyword_metrics').run();
      console.log('✅ keyword_metrics 테이블 DELETE 완료');
    } catch (truncateError) {
      console.log('⚠️ DELETE 실패, 배치 삭제로 전환:', (truncateError as any).message);
      const batchSize = 500;
      while (true) {
        const result = await db.prepare('DELETE FROM keyword_metrics LIMIT ?').bind(batchSize).run();
        const deleted = (result as any).meta?.changes || 0;
        deletedCount += deleted;
        console.log(`🗑️ keyword_metrics ${deleted}개 삭제 (총: ${deletedCount}개)`);
        if (deleted < batchSize) break;
      }
    }

    // 3. keywords 테이블 삭제 (메인 테이블)
    console.log('🗑️ [3/3] keywords 테이블 삭제 시도');
    deletedCount = 0;
    try {
      await db.prepare('DELETE FROM keywords').run();
      console.log('✅ keywords 테이블 DELETE 완료');
    } catch (truncateError) {
      console.log('⚠️ DELETE 실패, 배치 삭제로 전환:', (truncateError as any).message);
      const batchSize = 500;
      while (true) {
        const result = await db.prepare('DELETE FROM keywords LIMIT ?').bind(batchSize).run();
        const deleted = (result as any).meta?.changes || 0;
        deletedCount += deleted;
        totalDeleted += deleted;
        console.log(`🗑️ keywords ${deleted}개 삭제 (총: ${totalDeleted}개)`);
        if (deleted < batchSize) break;
      }
    }

    // 최종 확인: 모든 테이블이 비어있는지 확인
    console.log('🔍 최종 삭제 확인 중...');
    const keywordsCount = await db.prepare('SELECT COUNT(*) as total FROM keywords').first() as { total: number } | null;
    const docCountsCount = await db.prepare('SELECT COUNT(*) as total FROM naver_doc_counts').first() as { total: number } | null;
    const metricsCount = await db.prepare('SELECT COUNT(*) as total FROM keyword_metrics').first() as { total: number } | null;
    
    console.log('📊 삭제 후 상태:', {
      keywords: keywordsCount?.total || 0,
      naver_doc_counts: docCountsCount?.total || 0,
      keyword_metrics: metricsCount?.total || 0
    });

    console.log('✅ 키워드 전체 삭제 완료');

    return new Response(
      JSON.stringify({
        success: true,
        message: '모든 키워드가 삭제되었습니다.',
        deleted: {
          keywords: keywordsCount?.total || 0,
          naver_doc_counts: docCountsCount?.total || 0,
          keyword_metrics: metricsCount?.total || 0
        },
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Pages Functions keywords-delete 에러 발생!');
    console.error('📅 에러 발생 시간:', new Date().toISOString());
    console.error('🔍 에러 타입:', typeof error);
    console.error('📝 에러 메시지:', error?.message);
    console.error('📚 에러 스택:', error?.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Pages Functions Keywords Delete Error', 
        message: error?.message || 'Unknown error',
        details: error?.toString(),
        timestamp: new Date().toISOString(),
        source: 'Pages Functions Keywords Delete'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}


/**
 * ⚠️ 헌법 준수 필수 (CONSTITUTION.md)
 * 
 * 절대 변경 금지 사항:
 * - 파일 위치 변경 금지 (functions/_middleware.ts)
 * - 라우팅 로직 변경 금지 (onRequest 핸들러 직접 호출)
 * - Pages Functions 구조 변경 금지
 * 
 * 헌법 문서: CONSTITUTION.md (절대 변경 금지)
 */

// Cloudflare Pages Functions 라우트 설정
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  console.log('🛤️ Middleware - 요청 경로:', url.pathname);
  
  // API 라우트 처리
  if (url.pathname.startsWith('/api/')) {
    const path = url.pathname;
    
    try {
      // 특정 API 엔드포인트별 라우팅
      if (path === '/api/collect-naver') {
        console.log('🎯 collect-naver 라우트 선택');
        const handler = await import('./api/collect-naver');
        return handler.onRequest(context);
      } else if (path === '/api/keywords') {
        console.log('🎯 keywords 라우트 선택');
        const handler = await import('./api/keywords');
        return handler.onRequest(context);
      } else if (path === '/api/keywords-delete') {
        console.log('🎯 keywords-delete 라우트 선택');
        const handler = await import('./api/keywords-delete');
        return handler.onRequest(context);
      } else if (path === '/api/test') {
        console.log('🎯 test 라우트 선택');
        const handler = await import('./api/test');
        return handler.onRequest(context);
      } else if (path === '/api/collect') {
        console.log('🎯 collect 라우트 선택');
        const { default: handler } = await import('./api/collect');
        return handler.fetch(request, env, context);
      } else {
        console.log('❌ 알 수 없는 API 경로:', path);
        return new Response(
          JSON.stringify({ error: 'API Not Found', path }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error: any) {
      console.error('🚨 Middleware 에러:', error);
      return new Response(
        JSON.stringify({ error: 'Middleware Error', message: error?.message || 'Unknown error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // 정적 파일 요청은 그대로 통과
  console.log('📁 정적 파일 요청 통과');
  return context.next();
}

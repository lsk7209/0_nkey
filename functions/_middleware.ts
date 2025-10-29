// Cloudflare Pages Functions 라우트 설정
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // API 라우트 처리
  if (url.pathname.startsWith('/api/')) {
    // collect.ts의 핸들러를 직접 호출
    const { default: handler } = await import('./api/collect');
    return handler.fetch(request, env, context);
  }
  
  // 정적 파일 요청은 그대로 통과
  return context.next();
}

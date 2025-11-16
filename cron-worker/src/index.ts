/**
 * Cloudflare Workers Cron Job
 * 백엔드에서 자동으로 키워드를 수집하는 크론 작업
 * 
 * 실행 주기: 5분마다 (wrangler.toml에서 설정)
 * 대상: https://0-nkey.pages.dev/api/auto-collect
 */

export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    console.log(`[Cron Worker] Scheduled event triggered at ${new Date(event.scheduledTime).toISOString()}`);
    
    const origin = 'https://0-nkey.pages.dev';
    const autoCollectUrl = `${origin}/api/auto-collect`;
    
    try {
      // 타임아웃 설정 (10분)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 600000); // 10분
      
      const response = await fetch(autoCollectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({
          limit: 30, // 타임아웃 감소를 위해 최적화된 배치 크기
          concurrent: 15, // 타임아웃 감소를 위해 최적화된 동시 처리 수
          targetKeywords: 0 // 무제한 모드
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[Cron Worker] API 호출 실패: ${response.status} - ${errorText}`);
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`[Cron Worker] ✅ 성공: ${result.processed}개 시드 처리, ${result.totalNewKeywords}개 새로운 키워드 수집`);
      } else {
        console.error(`[Cron Worker] ❌ 실패: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[Cron Worker] ⏱️ 타임아웃: API 호출이 10분을 초과했습니다.');
      } else {
        console.error(`[Cron Worker] ❌ 에러: ${error.message || error}`);
      }
    }
  }
};


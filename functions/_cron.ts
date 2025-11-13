/**
 * Cloudflare Pages Scheduled Functions (Cron Jobs)
 * 브라우저 없이 자동으로 실행되는 크론 작업
 * 
 * 설정 방법:
 * 1. Cloudflare Dashboard → Pages → 0_nkey → Settings → Functions → Scheduled Triggers
 * 2. Cron expression 추가 (예: "*\/10 * * * *" = 10분마다)
 * 3. Path: "/_cron" 또는 빈 값
 */

export async function onScheduled(event: any, env: any, ctx: any) {
  console.log(`[Cron] Scheduled event triggered: ${event.cron}, scheduledTime: ${event.scheduledTime}`);

  // 여러 크론 작업을 처리할 수 있도록 설정
  const cronPattern = event.cron || '';
  
  try {
    // 자동 수집 크론 (5분마다 실행 - 24시간 무한 수집 모드)
    // 모든 크론 패턴에 대해 자동수집 실행 (더 자주 실행)
    if (cronPattern.includes('*/5') || 
        cronPattern.includes('*/10') || 
        cronPattern === '' || 
        cronPattern.includes('auto-collect') ||
        cronPattern.includes('*')) {
      await handleAutoCollect(env, ctx);
    }
  } catch (error: any) {
    console.error('[Cron] Error in scheduled function:', error);
    // 에러 발생해도 다음 크론에서 재시도하도록 로그만 남김
  }
}

/**
 * 자동 수집 크론 작업
 * - 미사용 시드 키워드를 자동으로 수집
 * - 한 번에 50개의 시드 처리 (24시간 무한 수집을 위해 증가)
 * - 남은 시드가 0이어도 계속 재시도
 * - 오래된 로그 정리 (데이터베이스 용량 최적화)
 */
async function handleAutoCollect(env: any, ctx: any) {
  console.log('[Cron] Starting auto collect (24-hour mode)...');

  try {
    const db = env.DB;

    // 데이터베이스 용량 최적화: 오래된 로그 정리 (크론 실행 시마다)
    await cleanupOldLogs(db);

    // 현재 사이트의 오리진 가져오기
    const origin = 'https://0-nkey.pages.dev';
    const autoCollectUrl = `${origin}/api/auto-collect`;

    let processed = 0;
    let totalKeywordsCollected = 0;
    let totalKeywordsSaved = 0;
    let remaining = 0;

    // 내부 API를 통해 자동 수집 실행 (24시간 무한 수집 모드)
    try {
      // 한 번에 50개 시드 처리 (5개 API 키 활용, 동시 처리 20개)
      const response = await fetch(autoCollectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({ 
          limit: 50, // 한 번에 50개 시드 처리 (증가)
          concurrent: 20, // 동시 처리 20개
          targetKeywords: 0 // 무제한 모드
        })
      });

      const result = await response.json();

      if (result.success) {
        processed = result.processed || 0;
        totalKeywordsCollected = result.totalKeywordsCollected || 0;
        totalKeywordsSaved = result.totalKeywordsSaved || 0;
        remaining = result.remaining || 0;
        
        console.log(`[Cron] Auto collect completed: ${processed} seeds processed, ${totalKeywordsSaved} keywords saved, ${remaining} seeds remaining`);
        
        // 로그 저장
        await db.prepare(`
          INSERT INTO collect_logs (keyword, type, status, message, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          'AUTO_COLLECT_CRON',
          'cron',
          'success',
          `Cron: ${processed} seeds processed, ${totalKeywordsSaved} keywords saved, ${remaining} remaining`
        ).run();
      } else {
        console.error('[Cron] Auto collect failed:', result.message);
        // 실패해도 로그만 남기고 계속 진행 (24시간 모드)
        await db.prepare(`
          INSERT INTO collect_logs (keyword, type, status, message, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          'AUTO_COLLECT_CRON',
          'cron',
          'error',
          `Cron failed: ${result.message || 'Unknown error'}`
        ).run();
      }
    } catch (fetchError: any) {
      console.error('[Cron] Error calling auto-collect API:', fetchError.message);
      // 에러 발생해도 로그만 남기고 계속 진행 (다음 크론에서 재시도)
      await db.prepare(`
        INSERT INTO collect_logs (keyword, type, status, message, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        'AUTO_COLLECT_CRON',
        'cron',
        'error',
        `Cron API error: ${fetchError.message}`
      ).run();
    }

    console.log(`[Cron] Auto collect finished: ${processed} seeds, ${totalKeywordsSaved} keywords saved, ${remaining} remaining (24-hour mode)`);

  } catch (error: any) {
    console.error('[Cron] Auto collect error:', error);
    
    // 에러 로그 저장
    try {
      await env.DB.prepare(`
        INSERT INTO collect_logs (keyword, type, status, message, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        'AUTO_COLLECT_CRON',
        'cron',
        'error',
        `Cron error: ${error.message || 'Unknown error'}`
      ).run();
    } catch (logError) {
      console.error('[Cron] Failed to save error log:', logError);
    }
  }
}

/**
 * 오래된 로그 정리 (데이터베이스 용량 최적화)
 * - collect_logs: 7일 이상 된 데이터 삭제
 * - api_call_logs: 7일 이상 된 데이터 삭제
 * - system_metrics: 30일 이상 된 데이터 삭제
 */
async function cleanupOldLogs(db: any) {
  try {
    console.log('[Cron] Starting old logs cleanup...');
    
    // 1. collect_logs 정리 (7일 이상)
    const collectLogsCleanup = await db.prepare(`
      DELETE FROM collect_logs
      WHERE created_at < datetime('now', '-7 days')
    `).run();
    const collectLogsDeleted = (collectLogsCleanup as any).meta?.changes || 0;
    
    // 2. api_call_logs 정리 (7일 이상)
    const apiLogsCleanup = await db.prepare(`
      DELETE FROM api_call_logs
      WHERE created_at < datetime('now', '-7 days')
    `).run();
    const apiLogsDeleted = (apiLogsCleanup as any).meta?.changes || 0;
    
    // 3. system_metrics 정리 (30일 이상)
    const metricsCleanup = await db.prepare(`
      DELETE FROM system_metrics
      WHERE created_at < datetime('now', '-30 days')
    `).run();
    const metricsDeleted = (metricsCleanup as any).meta?.changes || 0;
    
    console.log(`[Cron] Cleanup completed: collect_logs=${collectLogsDeleted}, api_call_logs=${apiLogsDeleted}, system_metrics=${metricsDeleted}`);
    
    // 정리 후 VACUUM 실행 (데이터베이스 용량 최적화)
    if (collectLogsDeleted > 0 || apiLogsDeleted > 0 || metricsDeleted > 0) {
      try {
        await db.prepare('VACUUM').run();
        console.log('[Cron] VACUUM completed successfully');
      } catch (vacuumError: any) {
        // VACUUM 실패는 치명적이지 않으므로 경고만
        console.warn('[Cron] VACUUM failed (non-critical):', vacuumError?.message);
      }
    }
  } catch (error: any) {
    // 정리 실패는 치명적이지 않으므로 경고만
    console.warn('[Cron] Cleanup failed (non-critical):', error?.message);
  }
}


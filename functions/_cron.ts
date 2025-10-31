/**
 * Cloudflare Pages Scheduled Functions (Cron Jobs)
 * 브라우저 없이 자동으로 실행되는 크론 작업
 * 
 * 설정 방법:
 * 1. Cloudflare Dashboard → Pages → 0_nkey → Settings → Functions → Scheduled Triggers
 * 2. Cron expression 추가 (예: "*/10 * * * *" = 10분마다)
 * 3. Path: "/_cron" 또는 빈 값
 */

export async function onScheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
  console.log(`[Cron] Scheduled event triggered: ${event.cron}, scheduledTime: ${event.scheduledTime}`);

  // 여러 크론 작업을 처리할 수 있도록 설정
  const cronPattern = event.cron || '';
  
  try {
    // 자동 수집 크론 (10분마다 실행 권장)
    if (cronPattern.includes('*/10') || cronPattern === '' || cronPattern.includes('auto-collect')) {
      await handleAutoCollect(env, ctx);
    }
  } catch (error: any) {
    console.error('[Cron] Error in scheduled function:', error);
  }
}

/**
 * 자동 수집 크론 작업
 * - 미사용 시드 키워드를 자동으로 수집
 * - 한 번에 10개의 시드 처리 (API 제한 고려)
 */
async function handleAutoCollect(env: any, ctx: ExecutionContext) {
  console.log('[Cron] Starting auto collect...');

  try {
    const db = env.DB;

    // 아직 활용되지 않은 시드 키워드 조회
    const seedsQuery = `
      SELECT k.id, k.keyword
      FROM keywords k
      LEFT JOIN auto_seed_usage a ON a.seed = k.keyword
      WHERE a.seed IS NULL
      ORDER BY k.avg_monthly_search DESC, k.created_at ASC
      LIMIT 10
    `;

    const seeds = await db.prepare(seedsQuery).all();
    const seedRows = seeds.results || [];

    if (seedRows.length === 0) {
      console.log('[Cron] No unused seeds found');
      return;
    }

    console.log(`[Cron] Found ${seedRows.length} unused seeds, processing...`);

    // 현재 사이트의 오리진 가져오기
    const origin = 'https://0-nkey.pages.dev'; // 실제 배포된 도메인으로 자동 감지되도록 수정 가능
    const collectUrl = `${origin}/api/collect-naver`;
    const autoCollectUrl = `${origin}/api/auto-collect`;

    let processed = 0;
    let totalKeywordsCollected = 0;
    let totalKeywordsSaved = 0;

    // 내부 API를 통해 자동 수집 실행
    try {
      const response = await fetch(autoCollectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({ limit: 10 }) // 한 번에 10개 시드 처리
      });

      const result = await response.json();

      if (result.success) {
        processed = result.processed || 0;
        totalKeywordsCollected = result.totalKeywordsCollected || 0;
        totalKeywordsSaved = result.totalKeywordsSaved || 0;
        
        console.log(`[Cron] Auto collect completed: ${processed} seeds processed, ${totalKeywordsSaved} keywords saved`);
        
        // 로그 저장
        await db.prepare(`
          INSERT INTO collect_logs (keyword, type, status, message, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          'AUTO_COLLECT_CRON',
          'cron',
          'success',
          `Cron: ${processed} seeds processed, ${totalKeywordsSaved} keywords saved`
        ).run();
      } else {
        console.error('[Cron] Auto collect failed:', result.message);
        throw new Error(result.message || 'Auto collect failed');
      }
    } catch (fetchError: any) {
      console.error('[Cron] Error calling auto-collect API:', fetchError.message);
      
      // 개별 시드 처리로 폴백
      for (const row of seedRows.slice(0, 10)) {
        const seed: string = row.keyword;
        try {
          const res = await fetch(collectUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-key': 'dev-key-2024'
            },
            body: JSON.stringify({ seed })
          });

          if (res.ok) {
            const collectResult = await res.json();
            if (collectResult.success) {
              totalKeywordsCollected += collectResult.totalCollected || 0;
              totalKeywordsSaved += collectResult.totalSavedOrUpdated || 0;
              
              await db.prepare(`
                INSERT INTO auto_seed_usage (seed, usage_count, last_used)
                VALUES (?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(seed) DO UPDATE SET
                  usage_count = usage_count + 1,
                  last_used = CURRENT_TIMESTAMP
              `).bind(seed).run();
              
              processed++;
            }
          }
          
          // Rate Limit 방지
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error(`[Cron] Error processing seed "${seed}":`, e);
        }
      }
    }

    console.log(`[Cron] Auto collect finished: ${processed} seeds, ${totalKeywordsSaved} keywords saved`);

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


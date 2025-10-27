import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, keywordQueries, CacheService } from '@/lib/db'
import { createNaverAdsApi } from '@/lib/naver-api'

// 매일 00:30 UTC에 실행되는 자동수집 크론 작업
export async function GET(request: NextRequest) {
  try {
    // 크론 트리거 인증 확인
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid cron secret' 
        },
        { status: 401 }
      )
    }

    const db = getDatabase()
    const cache = new CacheService()
    const naverAdsApi = createNaverAdsApi()
    
    // 자동수집 활성화 확인
    const autoCollectEnabled = await cache.get('auto_collect_enabled')
    if (!autoCollectEnabled) {
      return NextResponse.json({
        success: true,
        message: '자동수집이 비활성화되어 있습니다.',
        processed: 0
      })
    }

    // 오늘 처리한 시드 수 확인 (일일 제한: 200개)
    const today = new Date().toISOString().split('T')[0]
    const todayUsage = await cache.get(`auto_collect_usage_${today}`) || 0
    const dailyLimit = 200

    if (todayUsage >= dailyLimit) {
      return NextResponse.json({
        success: true,
        message: '일일 자동수집 한도에 도달했습니다.',
        processed: 0,
        usage: todayUsage,
        limit: dailyLimit
      })
    }

    // 자동수집 대상 키워드 조회 (최근 7일 내 수집된 키워드 중 아직 시드로 사용하지 않은 것)
    const candidateKeywords = await db.prepare(`
      SELECT DISTINCT k.keyword
      FROM keywords k
      LEFT JOIN auto_seed_usage asu ON k.keyword = asu.seed
      WHERE k.created_at >= datetime('now', '-7 days')
        AND (asu.seed IS NULL OR asu.last_auto_collect_at < datetime('now', '-30 days'))
      ORDER BY k.created_at DESC
      LIMIT ?
    `).bind(dailyLimit - todayUsage).all()

    if (candidateKeywords.length === 0) {
      return NextResponse.json({
        success: true,
        message: '자동수집할 키워드가 없습니다.',
        processed: 0
      })
    }

    let processedCount = 0
    const errors: string[] = []

    // 각 키워드를 시드로 사용하여 연관검색어 수집
    for (const candidate of candidateKeywords) {
      try {
        const seed = candidate.keyword
        
        // 중복 실행 방지 락
        const lockKey = `auto:seed:lock:${seed}`
        const existingLock = await cache.get(lockKey)
        if (existingLock) {
          console.log(`Skipping ${seed} - already in progress`)
          continue
        }

        // 락 설정 (10분 TTL)
        await cache.set(lockKey, 'processing', 600)

        try {
          // 연관검색어 수집
          const relatedKeywords = await naverAdsApi.getRelatedKeywords(seed)
          
          if (relatedKeywords.length > 0) {
            // 키워드 저장
            for (const keywordData of relatedKeywords) {
              // 키워드 저장
              const keywordResult = await db.prepare(keywordQueries.insertKeyword)
                .bind(
                  seed,
                  keywordData.keyword,
                  'naver-ads',
                  new Date().toISOString(),
                  new Date().toISOString()
                )
                .run()

              const keywordId = keywordResult.meta.last_row_id

              // 메트릭 저장
              await db.prepare(keywordQueries.insertKeywordMetrics)
                .bind(
                  keywordId,
                  keywordData.monthly_search_pc,
                  keywordData.monthly_search_mob,
                  keywordData.avg_monthly_search,
                  keywordData.cpc,
                  keywordData.comp_index,
                  new Date().toISOString()
                )
                .run()
            }

            // 자동수집 사용 기록 저장
            await db.prepare(keywordQueries.insertAutoSeedUsage)
              .bind(
                seed,
                new Date().toISOString(),
                1,
                'auto-collect-cron'
              )
              .run()

            processedCount++
          }
        } finally {
          // 락 해제
          await cache.delete(lockKey)
        }

      } catch (error) {
        console.error(`Failed to process seed ${candidate.keyword}:`, error)
        errors.push(`${candidate.keyword}: ${error}`)
      }
    }

    // 오늘 사용량 업데이트
    await cache.set(`auto_collect_usage_${today}`, todayUsage + processedCount, 86400)

    // 로그 저장
    await db.prepare(keywordQueries.insertCollectLog)
      .bind(
        'cron-auto-collect',
        'cron',
        processedCount > 0 ? 'success' : 'warning',
        `Processed ${processedCount} seeds. Errors: ${errors.length}`
      )
      .run()

    return NextResponse.json({
      success: true,
      message: `자동수집 완료`,
      processed: processedCount,
      total: candidateKeywords.length,
      usage: todayUsage + processedCount,
      limit: dailyLimit,
      errors: errors.length
    })

  } catch (error) {
    console.error('Auto Collect Cron Error:', error)
    return NextResponse.json(
      { 
        type: 'https://example.com/probs/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Auto collect cron job failed' 
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, keywordQueries } from '@/lib/db'
import { createNaverOpenApi } from '@/lib/naver-api'

// 매일 00:00 UTC에 실행되는 문서수 갱신 크론 작업
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
    const naverApi = createNaverOpenApi()
    
    // 30일 이상 경과한 키워드 조회
    const expiredKeywords = await db.prepare(`
      SELECT k.id, k.keyword, ndc.collected_at
      FROM keywords k
      LEFT JOIN naver_doc_counts ndc ON k.id = ndc.keyword_id
      WHERE ndc.collected_at < datetime('now', '-30 days')
         OR ndc.collected_at IS NULL
      LIMIT 100
    `).all()

    if (expiredKeywords.length === 0) {
      return NextResponse.json({
        success: true,
        message: '갱신할 키워드가 없습니다.',
        updated: 0
      })
    }

    let updatedCount = 0
    const errors: string[] = []

    // 배치로 문서수 조회
    const keywords = expiredKeywords.map(item => item.keyword)
    const docCountsMap = await naverApi.getBatchDocCounts(keywords)

    // 각 키워드의 문서수 업데이트
    for (const item of expiredKeywords) {
      try {
        const docCounts = docCountsMap.get(item.keyword)
        if (!docCounts) continue

        await db.prepare(keywordQueries.insertNaverDocCounts)
          .bind(
            item.id,
            docCounts.blog_total,
            docCounts.cafe_total,
            docCounts.web_total,
            docCounts.news_total,
            new Date().toISOString()
          )
          .run()

        updatedCount++
      } catch (error) {
        console.error(`Failed to update doc counts for ${item.keyword}:`, error)
        errors.push(`${item.keyword}: ${error}`)
      }
    }

    // 로그 저장
    await db.prepare(keywordQueries.insertCollectLog)
      .bind(
        'cron-update-docs',
        'cron',
        updatedCount > 0 ? 'success' : 'warning',
        `Updated ${updatedCount} keywords. Errors: ${errors.length}`
      )
      .run()

    return NextResponse.json({
      success: true,
      message: `문서수 갱신 완료`,
      updated: updatedCount,
      total: expiredKeywords.length,
      errors: errors.length
    })

  } catch (error) {
    console.error('Cron Error:', error)
    return NextResponse.json(
      { 
        type: 'https://example.com/probs/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Cron job failed' 
      },
      { status: 500 }
    )
  }
}

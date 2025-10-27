import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'
import { createNaverOpenApiStrict } from '@/lib/naver-openapi-strict'

export async function POST(request: NextRequest) {
  try {
    // 관리자 키 확인
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 크론 작업 시작: 문서수 자동 수집')

    // 모든 키워드 조회 (최근 30일 이내)
    const allKeywords = persistentDB.getKeywords(0, 999999, 30, 1, 1000)
    
    if (allKeywords.keywords.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '수집할 키워드가 없습니다.',
        processed: 0,
        total: 0
      })
    }

    console.log(`📊 총 ${allKeywords.keywords.length}개 키워드 문서수 수집 시작`)

    const naverOpenApi = createNaverOpenApiStrict()
    let processedCount = 0
    let totalDocuments = 0
    const results = []
    const errors = []

    // 문서수가 없는 키워드만 필터링
    const keywordsWithoutDocCounts = allKeywords.keywords.filter(keywordData => {
      return !persistentDB.hasDocCounts(keywordData.id)
    })
    
    console.log(`📊 문서수 수집 대상: ${keywordsWithoutDocCounts.length}개 키워드 (문서수가 없는 키워드만)`)
    
    if (keywordsWithoutDocCounts.length === 0) {
      console.log('✅ 모든 키워드의 문서수가 이미 수집되었습니다.')
      return NextResponse.json({
        success: true,
        message: '모든 키워드의 문서수가 이미 수집되었습니다.',
        processed: 0,
        total: 0,
        results: [],
        errors: []
      })
    }

    // 키워드별로 문서수 수집
    for (let i = 0; i < keywordsWithoutDocCounts.length; i++) {
      const keywordData = keywordsWithoutDocCounts[i]
      const keyword = keywordData.keyword
      
      try {
        console.log(`🔍 [${i + 1}/${keywordsWithoutDocCounts.length}] 문서수 수집 중: "${keyword}"`)
        
        // 네이버 오픈API로 문서수 수집
        const docCounts = await naverOpenApi.getDocCounts(keyword)
        
        // 데이터베이스 업데이트
        persistentDB.insertNaverDocCounts(
          keywordData.id,
          docCounts.blog_total,
          docCounts.cafe_total,
          docCounts.web_total,
          docCounts.news_total
        )
        
        processedCount++
        totalDocuments += docCounts.blog_total + docCounts.cafe_total + docCounts.web_total + docCounts.news_total
        results.push({ keyword, docCounts, status: 'success' })
        
        console.log(`✅ [${i + 1}/${keywordsWithoutDocCounts.length}] 문서수 수집 완료: "${keyword}" (총 ${docCounts.blog_total + docCounts.cafe_total + docCounts.web_total + docCounts.news_total}개)`)
        
        // API 호출 간격 조절 (Rate Limiting) - 다중 키 사용으로 단축
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (error: any) {
        console.error(`❌ 문서수 수집 실패: "${keyword}"`, error)
        results.push({ keyword, status: 'failed', error: error.message })
        errors.push(`문서수 수집 실패: "${keyword}" - ${error.message}`)
      }
    }

    console.log(`📄 크론 작업 완료: ${processedCount}/${keywordsWithoutDocCounts.length}개 성공, 총 ${totalDocuments}개 문서`)

    return NextResponse.json({
      success: true,
      message: '크론 작업 완료',
      processed: processedCount,
      total: keywordsWithoutDocCounts.length,
      totalDocuments,
      results,
      errors
    })

  } catch (error: any) {
    console.error('❌ 크론 작업 에러:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

// GET 요청으로 크론 작업 상태 확인
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = persistentDB.getStats()
    const recentKeywords = persistentDB.getKeywords(0, 999999, 30, 1, 10)

    return NextResponse.json({
      success: true,
      stats,
      recentKeywords: recentKeywords.keywords,
      message: '크론 작업 상태 확인'
    })

  } catch (error: any) {
    console.error('❌ 크론 상태 확인 에러:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createNaverOpenApiStrict } from '@/lib/naver-openapi-strict'
import { persistentDB } from '@/lib/persistent-db'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid admin key' 
        },
        { status: 401 }
      )
    }

    const { keywords } = await request.json()
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/invalid-input',
          title: 'Invalid Input',
          status: 400,
          detail: 'Keywords array is required' 
        },
        { status: 400 }
      )
    }

    console.log(`📄 [절대규칙] 문서수 수집 시작: ${keywords.length}개 키워드`)

    // 네이버 오픈API 클라이언트 생성 (절대규칙 준수)
    const naverOpenApi = createNaverOpenApiStrict()
    
    let processedCount = 0
    const results = []
    const errors = []

    // 각 키워드의 문서수 수집 (순차 처리로 레이트 리미팅 방지)
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i]
      
      try {
        console.log(`🔍 [${i + 1}/${keywords.length}] 문서수 수집 중: "${keyword}"`)
        
        // 네이버 오픈API로 문서수 조회 (절대규칙 준수)
        const docCounts = await naverOpenApi.getDocCounts(keyword)
        
        // 키워드 ID 찾기
        const keywordCheck = persistentDB.keywordExists(keyword)
        
        if (keywordCheck.exists && keywordCheck.keywordId) {
          // 문서수 업데이트
          persistentDB.insertNaverDocCounts(
            keywordCheck.keywordId,
            docCounts.blog_total,
            docCounts.cafe_total,
            docCounts.web_total,
            docCounts.news_total
          )
          
          processedCount++
          results.push({
            keyword,
            docCounts,
            status: 'success',
            total: docCounts.blog_total + docCounts.cafe_total + docCounts.web_total + docCounts.news_total
          })
          
          console.log(`✅ [${i + 1}/${keywords.length}] 문서수 수집 완료: "${keyword}" (총 ${docCounts.blog_total + docCounts.cafe_total + docCounts.web_total + docCounts.news_total}개)`)
        } else {
          console.warn(`⚠️ [${i + 1}/${keywords.length}] 키워드를 찾을 수 없음: "${keyword}"`)
          results.push({
            keyword,
            status: 'not_found',
            error: '키워드가 데이터베이스에 없습니다'
          })
          errors.push(`키워드 없음: ${keyword}`)
        }
        
        // API 호출 간 지연 (레이트 리미팅 방지)
        // 하루 25,000회 제한을 고려하여 1초 간격으로 호출
        if (i < keywords.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
      } catch (error) {
        console.error(`❌ [${i + 1}/${keywords.length}] 문서수 수집 실패: "${keyword}"`, error)
        results.push({
          keyword,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        errors.push(`${keyword}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    const totalDocs = results
      .filter(r => r.status === 'success')
      .reduce((sum, r) => sum + (r.total || 0), 0)

    console.log(`📄 [절대규칙] 문서수 수집 완료: ${processedCount}/${keywords.length}개 성공, 총 ${totalDocs}개 문서`)

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: keywords.length,
      totalDocuments: totalDocs,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: `[절대규칙] ${processedCount}개 키워드의 문서수를 수집했습니다. (총 ${totalDocs}개 문서)`
    })

  } catch (error) {
    console.error('❌ [절대규칙] 문서수 수집 API 에러:', error)
    return NextResponse.json(
      { 
        type: 'https://example.com/probs/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred' 
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createNaverOpenApi } from '@/lib/naver-api'
import { mockDB } from '@/lib/mock-db'

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

    console.log(`📄 문서수 수집 시작: ${keywords.length}개 키워드`)

    // 네이버 오픈API 클라이언트 생성
    const naverOpenApi = createNaverOpenApi()
    
    let processedCount = 0
    const results = []

    // 각 키워드의 문서수 수집
    for (const keyword of keywords) {
      try {
        console.log(`🔍 문서수 수집 중: ${keyword}`)
        
        // 네이버 오픈API로 문서수 조회
        const docCounts = await naverOpenApi.getDocCounts(keyword)
        
        // 키워드 ID 찾기
        const keywordRecord = Array.from(mockDB['keywords'].values())
          .find(record => record.keyword === keyword)
        
        if (keywordRecord) {
          // 문서수 업데이트
          mockDB.insertNaverDocCounts(
            keywordRecord.id,
            docCounts.blog_total,
            docCounts.cafe_total,
            docCounts.web_total,
            docCounts.news_total
          )
          
          processedCount++
          results.push({
            keyword,
            docCounts,
            status: 'success'
          })
          
          console.log(`✅ 문서수 수집 완료: ${keyword} (블로그: ${docCounts.blog_total}, 카페: ${docCounts.cafe_total}, 웹: ${docCounts.web_total}, 뉴스: ${docCounts.news_total})`)
        } else {
          console.warn(`⚠️ 키워드를 찾을 수 없음: ${keyword}`)
          results.push({
            keyword,
            status: 'not_found'
          })
        }
        
        // API 호출 간 지연 (레이트 리미팅 방지)
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`❌ 문서수 수집 실패: ${keyword}`, error)
        results.push({
          keyword,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`📄 문서수 수집 완료: ${processedCount}/${keywords.length}개 성공`)

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: keywords.length,
      results,
      message: `${processedCount}개 키워드의 문서수를 수집했습니다.`
    })

  } catch (error) {
    console.error('문서수 수집 API 에러:', error)
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
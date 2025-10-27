import { NextRequest, NextResponse } from 'next/server'
import { createNaverAdsApi } from '@/lib/naver-api'

export async function GET(request: NextRequest) {
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

    const seed = request.nextUrl.searchParams.get('seed') || '테스트'
    
    console.log('🧪 네이버 API 테스트 시작:', seed)
    
    const naverAdsApi = createNaverAdsApi()
    const keywords = await naverAdsApi.getRelatedKeywords(seed)
    
    console.log('🧪 네이버 API 테스트 결과:', keywords.length, '개')
    
    return NextResponse.json({
      success: true,
      seed,
      keywords,
      count: keywords.length,
      message: '네이버 API 테스트 완료'
    })

  } catch (error) {
    console.error('네이버 API 테스트 에러:', error)
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

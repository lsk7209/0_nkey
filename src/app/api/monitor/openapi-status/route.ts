import { NextRequest, NextResponse } from 'next/server'
import { createNaverOpenApiStrict } from '@/lib/naver-openapi-strict'

// 문서수 API 상태 조회
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 네이버 오픈API 클라이언트 생성
    const naverOpenApi = createNaverOpenApiStrict()
    
    // API 키 상태 조회
    const apiKeys = naverOpenApi.getApiKeysStatus()
    
    // 요약 정보 계산
    const summary = {
      totalOpenApiKeys: apiKeys.length,
      activeOpenApiKeys: apiKeys.filter(key => key.isActive).length,
      totalRemaining: apiKeys.reduce((sum, key) => sum + (key.dailyLimit - key.usedToday), 0),
      totalUsed: apiKeys.reduce((sum, key) => sum + key.usedToday, 0),
      totalLimit: apiKeys.reduce((sum, key) => sum + key.dailyLimit, 0)
    }

    return NextResponse.json({
      success: true,
      openApiKeys: apiKeys,
      summary
    })

  } catch (error: any) {
    console.error('❌ 문서수 API 상태 조회 에러:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

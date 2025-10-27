import { NextRequest, NextResponse } from 'next/server'
import { optimizedNaverAdsClient } from '@/lib/optimized-naver-api'

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // API 키 상태 조회
    const apiStatus = optimizedNaverAdsClient.getApiKeyStatus()
    
    return NextResponse.json({
      success: true,
      apiKeys: apiStatus,
      message: 'API 키 상태 조회 완료'
    })

  } catch (error: any) {
    console.error('❌ API 키 상태 조회 에러:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

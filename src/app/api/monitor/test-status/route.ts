import { NextRequest, NextResponse } from 'next/server'

// 간단한 테스트 API
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      message: 'API 상태 조회 테스트 성공',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ 테스트 API 에러:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

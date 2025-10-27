import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: '황금키워드 찾기 서비스가 정상적으로 실행 중입니다.'
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { 
        type: 'https://example.com/probs/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Health check failed' 
      },
      { status: 500 }
    )
  }
}

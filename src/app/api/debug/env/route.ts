import { NextRequest, NextResponse } from 'next/server'

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

    return NextResponse.json({
      success: true,
      environment: {
        SEARCHAD_API_KEY: process.env.SEARCHAD_API_KEY ? '설정됨' : '없음',
        SEARCHAD_SECRET: process.env.SEARCHAD_SECRET ? '설정됨' : '없음',
        SEARCHAD_CUSTOMER_ID: process.env.SEARCHAD_CUSTOMER_ID ? '설정됨' : '없음',
        NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID ? '설정됨' : '없음',
        NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET ? '설정됨' : '없음',
        CRON_SECRET: process.env.CRON_SECRET ? '설정됨' : '없음'
      },
      message: '환경변수 상태 확인 완료'
    })

  } catch (error) {
    console.error('환경변수 확인 에러:', error)
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
import { NextRequest, NextResponse } from 'next/server'

// 자동수집 상태 시뮬레이션 (실제로는 KV에서 조회)
let autoCollectEnabled = false

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== (process.env.ADMIN_KEY || 'dev-key')) {
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
      enabled: autoCollectEnabled,
      lastRun: null, // 실제로는 마지막 실행 시간
      nextRun: null, // 실제로는 다음 실행 예정 시간
      queueSize: 0, // 실제로는 큐에 대기 중인 시드 수
      dailyLimit: 200,
      usedToday: 0 // 실제로는 오늘 사용한 시드 수
    })

  } catch (error) {
    console.error('API Error:', error)
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

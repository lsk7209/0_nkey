import { NextRequest, NextResponse } from 'next/server'

// 자동수집 상태 시뮬레이션 (실제로는 KV 저장)
let autoCollectEnabled = false

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/invalid-input',
          title: 'Invalid Input',
          status: 400,
          detail: 'enabled must be a boolean' 
        },
        { status: 400 }
      )
    }

    autoCollectEnabled = enabled

    return NextResponse.json({
      enabled: autoCollectEnabled,
      message: `자동수집이 ${enabled ? '활성화' : '비활성화'}되었습니다.`
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

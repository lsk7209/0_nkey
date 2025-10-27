import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // 관리자 키 확인
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { seed, keywords } = body

    console.log('🔄 백그라운드 수동수집 요청:', { seed, keywordsCount: keywords?.length })

    // 백그라운드 작업 큐에 작업 추가
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/background-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'dev-key-2024'
      },
      body: JSON.stringify({
        type: 'manual-collect',
        data: { seed, keywords }
      })
    })

    const result = await response.json()

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || '백그라운드 작업 시작 실패'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      message: '수동수집이 백그라운드에서 시작되었습니다. 작업 상태는 /api/background-jobs에서 확인할 수 있습니다.'
    })

  } catch (error: any) {
    console.error('❌ 수동수집 요청 에러:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}
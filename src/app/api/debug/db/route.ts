import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 데이터베이스 상태 확인
    const stats = persistentDB.getStats()

    return NextResponse.json({
      stats: stats,
      message: '영구 데이터베이스 상태 확인 완료'
    })

  } catch (error) {
    console.error('Debug API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

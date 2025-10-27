import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 데이터베이스 초기화
    persistentDB.resetData()
    
    const stats = persistentDB.getStats()

    return NextResponse.json({
      success: true,
      stats: stats,
      message: '데이터베이스가 초기화되었습니다.'
    })

  } catch (error) {
    console.error('데이터베이스 초기화 에러:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

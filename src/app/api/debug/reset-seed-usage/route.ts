import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 시드 사용 기록 초기화
    persistentDB.resetSeedUsage()
    
    return NextResponse.json({
      success: true,
      message: '시드 사용 기록이 초기화되었습니다.'
    })

  } catch (error: any) {
    console.error('❌ 시드 사용 기록 초기화 에러:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

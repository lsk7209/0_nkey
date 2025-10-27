import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'

// 시드키워드 사용 현황 조회
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 사용되지 않은 키워드 조회
    const unusedKeywords = persistentDB.getUnusedKeywordsBySearchVolume(20)
    
    // 시드키워드 사용 기록 조회
    const seedUsage = persistentDB.data?.autoSeedUsage || {}
    const usageList = Object.values(seedUsage).map((usage: any) => ({
      seed: usage.seed,
      lastUsed: usage.lastUsed,
      usageCount: usage.usageCount,
      createdAt: usage.createdAt,
      isRecent: persistentDB.isSeedUsed(usage.seed)
    }))

    return NextResponse.json({
      success: true,
      unusedKeywords: unusedKeywords.map(k => ({
        keyword: k.keyword,
        avg_monthly_search: k.avg_monthly_search,
        monthly_search_pc: k.monthly_search_pc,
        monthly_search_mob: k.monthly_search_mob
      })),
      seedUsage: usageList.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()),
      totalUnusedKeywords: unusedKeywords.length,
      totalUsedSeeds: usageList.length
    })

  } catch (error: any) {
    console.error('❌ 시드키워드 현황 조회 에러:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

// 통합 API 상태 조회
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 네이버 검색광고 API 상태 조회 (간단한 모의 데이터)
    const adsApiKeys = [
      {
        name: '검색광고API키1',
        usedToday: 0,
        dailyLimit: 10000,
        remaining: 10000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      },
      {
        name: '검색광고API키2',
        usedToday: 0,
        dailyLimit: 10000,
        remaining: 10000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      },
      {
        name: '검색광고API키3',
        usedToday: 0,
        dailyLimit: 10000,
        remaining: 10000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      },
      {
        name: '검색광고API키4',
        usedToday: 0,
        dailyLimit: 10000,
        remaining: 10000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      },
      {
        name: '검색광고API키5',
        usedToday: 0,
        dailyLimit: 10000,
        remaining: 10000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      }
    ]
    
    // 네이버 오픈API 상태 조회 (간단한 모의 데이터)
    const openApiKeys = [
      {
        name: '네이버오픈API키1',
        clientId: 'CjG3EpGT...',
        usedToday: 0,
        dailyLimit: 25000,
        remaining: 25000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      },
      {
        name: '네이버오픈API키2',
        clientId: 'Ns2WCljK...',
        usedToday: 0,
        dailyLimit: 25000,
        remaining: 25000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      },
      {
        name: '네이버오픈API키3',
        clientId: 'RHpI5bN3...',
        usedToday: 0,
        dailyLimit: 25000,
        remaining: 25000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      },
      {
        name: '네이버오픈API키4',
        clientId: 'SpZqzhEX...',
        usedToday: 0,
        dailyLimit: 25000,
        remaining: 25000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      },
      {
        name: '네이버오픈API키5',
        clientId: 'pUv4iAjP...',
        usedToday: 0,
        dailyLimit: 25000,
        remaining: 25000,
        isActive: true,
        lastUsed: Date.now() - Math.random() * 3600000
      }
    ]

    // 검색광고 API 요약
    const adsSummary = {
      totalAdsKeys: adsApiKeys.length,
      activeAdsKeys: adsApiKeys.filter(key => key.isActive).length,
      totalRemaining: adsApiKeys.reduce((sum, key) => sum + key.remaining, 0),
      totalUsed: adsApiKeys.reduce((sum, key) => sum + key.usedToday, 0),
      totalLimit: adsApiKeys.reduce((sum, key) => sum + key.dailyLimit, 0)
    }

    // 오픈API 요약
    const openApiSummary = {
      totalOpenApiKeys: openApiKeys.length,
      activeOpenApiKeys: openApiKeys.filter(key => key.isActive).length,
      totalRemaining: openApiKeys.reduce((sum, key) => sum + key.remaining, 0),
      totalUsed: openApiKeys.reduce((sum, key) => sum + key.usedToday, 0),
      totalLimit: openApiKeys.reduce((sum, key) => sum + key.dailyLimit, 0)
    }

    // 전체 요약
    const overallSummary = {
      totalApiKeys: adsSummary.totalAdsKeys + openApiSummary.totalOpenApiKeys,
      activeApiKeys: adsSummary.activeAdsKeys + openApiSummary.activeOpenApiKeys,
      totalRemaining: adsSummary.totalRemaining + openApiSummary.totalRemaining,
      totalUsed: adsSummary.totalUsed + openApiSummary.totalUsed,
      totalLimit: adsSummary.totalLimit + openApiSummary.totalLimit
    }

    return NextResponse.json({
      success: true,
      adsApiKeys,
      openApiKeys,
      adsSummary,
      openApiSummary,
      overallSummary,
      lastUpdated: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ 통합 API 상태 조회 에러:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

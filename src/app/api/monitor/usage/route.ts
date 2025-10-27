import { NextRequest, NextResponse } from 'next/server'
import { createApiMonitor } from '@/lib/api-monitor'
import { CacheService } from '@/lib/db'

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

    const cache = new CacheService()
    const apiMonitor = createApiMonitor(cache)
    
    // API 사용량 통계 조회
    const stats = await apiMonitor.getUsageStats()
    
    return NextResponse.json({
      success: true,
      data: {
        searchad: {
          used: stats.searchad.used,
          limit: stats.searchad.limit,
          remaining: stats.searchad.remaining,
          usage_rate: Math.round(stats.searchad.rate * 100),
          status: stats.searchad.rate >= 0.8 ? 'warning' : 'normal'
        },
        openapi: {
          used: stats.openapi.used,
          limit: stats.openapi.limit,
          remaining: stats.openapi.remaining,
          usage_rate: Math.round(stats.openapi.rate * 100),
          status: stats.openapi.rate >= 0.8 ? 'warning' : 'normal'
        },
        last_updated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('API Monitor Error:', error)
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

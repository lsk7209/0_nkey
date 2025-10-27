// API 사용량 모니터링 및 레이트 리미팅

interface ApiUsage {
  date: string
  searchad_calls: number
  openapi_calls: number
  total_calls: number
}

interface RateLimitConfig {
  searchad_daily_limit: number
  openapi_daily_limit: number
  warning_threshold: number // 80%
}

export class ApiMonitor {
  private cache: any
  private config: RateLimitConfig

  constructor(cache: any) {
    this.cache = cache
    this.config = {
      searchad_daily_limit: 1000, // 네이버 검색광고 API 일일 제한
      openapi_daily_limit: 25000, // 네이버 오픈API 일일 제한
      warning_threshold: 0.8 // 80% 도달 시 경고
    }
  }

  // API 사용량 조회
  async getUsage(apiType: 'searchad' | 'openapi'): Promise<ApiUsage> {
    const today = new Date().toISOString().split('T')[0]
    const key = `api_usage_${apiType}_${today}`
    
    const usage = await this.cache.get(key) || {
      date: today,
      searchad_calls: 0,
      openapi_calls: 0,
      total_calls: 0
    }
    
    return usage
  }

  // API 호출 기록
  async recordCall(apiType: 'searchad' | 'openapi'): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    const key = `api_usage_${apiType}_${today}`
    
    const usage = await this.getUsage(apiType)
    usage.total_calls++
    
    if (apiType === 'searchad') {
      usage.searchad_calls++
    } else {
      usage.openapi_calls++
    }
    
    // 24시간 TTL로 저장
    await this.cache.set(key, usage, 86400)
    
    // 경고 체크
    await this.checkWarning(apiType, usage)
  }

  // 경고 체크
  private async checkWarning(apiType: 'searchad' | 'openapi', usage: ApiUsage): Promise<void> {
    const limit = apiType === 'searchad' 
      ? this.config.searchad_daily_limit 
      : this.config.openapi_daily_limit
    
    const usageRate = usage.total_calls / limit
    
    if (usageRate >= this.config.warning_threshold) {
      console.warn(`⚠️ ${apiType.toUpperCase()} API usage warning: ${Math.round(usageRate * 100)}% of daily limit reached`)
      
      // 경고 로그 저장
      await this.cache.set(`api_warning_${apiType}_${usage.date}`, {
        type: 'usage_warning',
        api_type: apiType,
        usage_rate: usageRate,
        current_calls: usage.total_calls,
        limit: limit,
        timestamp: new Date().toISOString()
      }, 86400)
    }
  }

  // API 사용 가능 여부 체크
  async canMakeCall(apiType: 'searchad' | 'openapi'): Promise<boolean> {
    const usage = await this.getUsage(apiType)
    const limit = apiType === 'searchad' 
      ? this.config.searchad_daily_limit 
      : this.config.openapi_daily_limit
    
    return usage.total_calls < limit
  }

  // 남은 호출 수 조회
  async getRemainingCalls(apiType: 'searchad' | 'openapi'): Promise<number> {
    const usage = await this.getUsage(apiType)
    const limit = apiType === 'searchad' 
      ? this.config.searchad_daily_limit 
      : this.config.openapi_daily_limit
    
    return Math.max(0, limit - usage.total_calls)
  }

  // 일일 사용량 리셋 (자정에 실행)
  async resetDailyUsage(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    
    await this.cache.delete(`api_usage_searchad_${today}`)
    await this.cache.delete(`api_usage_openapi_${today}`)
    
    console.log('Daily API usage reset completed')
  }

  // 사용량 통계 조회
  async getUsageStats(): Promise<{
    searchad: { used: number; limit: number; remaining: number; rate: number }
    openapi: { used: number; limit: number; remaining: number; rate: number }
  }> {
    const [searchadUsage, openapiUsage] = await Promise.all([
      this.getUsage('searchad'),
      this.getUsage('openapi')
    ])

    return {
      searchad: {
        used: searchadUsage.searchad_calls,
        limit: this.config.searchad_daily_limit,
        remaining: await this.getRemainingCalls('searchad'),
        rate: searchadUsage.searchad_calls / this.config.searchad_daily_limit
      },
      openapi: {
        used: openapiUsage.openapi_calls,
        limit: this.config.openapi_daily_limit,
        remaining: await this.getRemainingCalls('openapi'),
        rate: openapiUsage.openapi_calls / this.config.openapi_daily_limit
      }
    }
  }
}

// 전역 API 모니터 인스턴스
export function createApiMonitor(cache: any): ApiMonitor {
  return new ApiMonitor(cache)
}

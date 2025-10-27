// 개발 환경에서 사용하는 메모리 데이터베이스
// 실제 운영시에는 Cloudflare D1로 교체

export interface KeywordRecord {
  id: number
  seed: string
  keyword: string
  source: string
  last_related_at: string
  created_at: string
}

export interface KeywordMetricsRecord {
  keyword_id: number
  monthly_search_pc: number
  monthly_search_mob: number
  avg_monthly_search: number
  monthly_click_pc: number
  monthly_click_mobile: number
  ctr_pc: number
  ctr_mobile: number
  ad_count: number
  cpc: number
  comp_index: number
  updated_at: string
}

export interface NaverDocCountsRecord {
  keyword_id: number
  blog_total: number
  cafe_total: number
  web_total: number
  news_total: number
  all_total: number
  collected_at: string
}

export interface AutoSeedUsageRecord {
  seed: string
  lastUsed: string
  usageCount: number
  createdAt: string
}

export interface CollectLogRecord {
  id: number
  keyword: string
  type: string
  status: string
  message: string
  created_at: string
}

// 글로벌 메모리 데이터베이스
class MockDatabase {
  private keywords = new Map<number, KeywordRecord>()
  private keywordMetrics = new Map<number, KeywordMetricsRecord>()
  private naverDocCounts = new Map<number, NaverDocCountsRecord>()
  private autoSeedUsage = new Map<string, AutoSeedUsageRecord>()
  private collectLogs = new Map<number, CollectLogRecord>()
  private nextId = 1

  // 시드키워드 사용 기록 저장
  markSeedAsUsed(seedKeyword: string): void {
    const now = new Date().toISOString()
    
    this.autoSeedUsage.set(seedKeyword, {
      seed: seedKeyword,
      lastUsed: now,
      usageCount: (this.autoSeedUsage.get(seedKeyword)?.usageCount || 0) + 1,
      createdAt: this.autoSeedUsage.get(seedKeyword)?.createdAt || now
    })
    
    console.log(`✅ 시드키워드 사용 기록: "${seedKeyword}" (${this.autoSeedUsage.get(seedKeyword)?.usageCount}번째 사용)`)
  }

  // 시드키워드 사용 여부 확인
  isSeedUsed(seedKeyword: string): boolean {
    const usage = this.autoSeedUsage.get(seedKeyword)
    if (!usage) {
      return false
    }
    
    // 30일 이내에 사용된 경우 true
    const lastUsedDate = new Date(usage.lastUsed)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    return lastUsedDate > thirtyDaysAgo
  }

  // 사용되지 않은 키워드 중 검색량 높은 순으로 조회
  getUnusedKeywordsBySearchVolume(limit: number = 50): Array<{
    id: number
    keyword: string
    seed: string
    avg_monthly_search: number
    monthly_search_pc: number
    monthly_search_mob: number
    created_at: string
  }> {
    const keywords: Array<{
      id: number
      keyword: string
      seed: string
      avg_monthly_search: number
      monthly_search_pc: number
      monthly_search_mob: number
      created_at: string
    }> = []
    
    this.keywords.forEach((record, id) => {
      // 시드로 사용되지 않은 키워드만 선택
      if (!this.isSeedUsed(record.keyword)) {
        const metrics = this.keywordMetrics.get(id)
        if (metrics) {
          keywords.push({
            id,
            keyword: record.keyword,
            seed: record.seed,
            avg_monthly_search: metrics.avg_monthly_search || 0,
            monthly_search_pc: metrics.monthly_search_pc || 0,
            monthly_search_mob: metrics.monthly_search_mob || 0,
            created_at: record.created_at
          })
        }
      }
    })
    
    // 검색량 높은 순으로 정렬
    keywords.sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
    
    return keywords.slice(0, limit)
  }

  // 키워드 존재 여부 확인 (30일 기준)
  keywordExists(keyword: string): { exists: boolean, keywordId?: number, isRecent?: boolean } {
    for (const [id, record] of this.keywords) {
      if (record.keyword === keyword) {
        const createdDate = new Date(record.created_at)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const isRecent = createdDate > thirtyDaysAgo
        
        return {
          exists: true,
          keywordId: id,
          isRecent
        }
      }
    }
    return { exists: false }
  }

  // 키워드 저장 (중복 체크 포함)
  insertKeyword(seed: string, keyword: string, source: string = 'naver-ads'): number {
    const id = this.nextId++
    const now = new Date().toISOString()
    
    this.keywords.set(id, {
      id,
      seed,
      keyword,
      source,
      last_related_at: now,
      created_at: now
    })
    
    return id
  }

  // 키워드 업데이트 (30일 이후 갱신)
  updateKeyword(keywordId: number, seed: string, keyword: string, source: string = 'naver-ads'): void {
    const now = new Date().toISOString()
    
    this.keywords.set(keywordId, {
      id: keywordId,
      seed,
      keyword,
      source,
      last_related_at: now,
      created_at: this.keywords.get(keywordId)?.created_at || now
    })
  }

  // 키워드 메트릭 저장
  insertKeywordMetrics(
    keywordId: number,
    monthlySearchPc: number,
    monthlySearchMob: number,
    avgMonthlySearch: number,
    monthlyClickPc: number = 0,
    monthlyClickMobile: number = 0,
    ctrPc: number = 0,
    ctrMobile: number = 0,
    adCount: number = 0,
    cpc: number = 0,
    compIndex: number = 0
  ): void {
    this.keywordMetrics.set(keywordId, {
      keyword_id: keywordId,
      monthly_search_pc: monthlySearchPc,
      monthly_search_mob: monthlySearchMob,
      avg_monthly_search: avgMonthlySearch,
      monthly_click_pc: monthlyClickPc,
      monthly_click_mobile: monthlyClickMobile,
      ctr_pc: ctrPc,
      ctr_mobile: ctrMobile,
      ad_count: adCount,
      cpc,
      comp_index: compIndex,
      updated_at: new Date().toISOString()
    })
  }

  // 키워드 메트릭 업데이트
  updateKeywordMetrics(
    keywordId: number,
    monthlySearchPc: number,
    monthlySearchMob: number,
    avgMonthlySearch: number,
    monthlyClickPc: number = 0,
    monthlyClickMobile: number = 0,
    ctrPc: number = 0,
    ctrMobile: number = 0,
    adCount: number = 0,
    cpc: number = 0,
    compIndex: number = 0
  ): void {
    this.keywordMetrics.set(keywordId, {
      keyword_id: keywordId,
      monthly_search_pc: monthlySearchPc,
      monthly_search_mob: monthlySearchMob,
      avg_monthly_search: avgMonthlySearch,
      monthly_click_pc: monthlyClickPc,
      monthly_click_mobile: monthlyClickMobile,
      ctr_pc: ctrPc,
      ctr_mobile: ctrMobile,
      ad_count: adCount,
      cpc,
      comp_index: compIndex,
      updated_at: new Date().toISOString()
    })
  }

  // 네이버 문서수 저장
  insertNaverDocCounts(
    keywordId: number,
    blogTotal: number,
    cafeTotal: number,
    webTotal: number,
    newsTotal: number
  ): void {
    this.naverDocCounts.set(keywordId, {
      keyword_id: keywordId,
      blog_total: blogTotal,
      cafe_total: cafeTotal,
      web_total: webTotal,
      news_total: newsTotal,
      all_total: blogTotal + cafeTotal + webTotal + newsTotal,
      collected_at: new Date().toISOString()
    })
  }

  // 자동수집 사용 기록 저장
  insertAutoSeedUsage(seed: string, depth: number = 1, note: string = ''): void {
    this.autoSeedUsage.set(seed, {
      seed,
      last_auto_collect_at: new Date().toISOString(),
      depth,
      note
    })
  }

  // 수집 로그 저장
  insertCollectLog(keyword: string, type: string, status: string, message: string): void {
    const id = this.nextId++
    this.collectLogs.set(id, {
      id,
      keyword,
      type,
      status,
      message,
      created_at: new Date().toISOString()
    })
  }

  // 키워드 조회 (필터링 및 정렬)
  getKeywords(
    minSearch: number = 0,
    maxCafe: number = 999999,
    days: number = 30,
    page: number = 1,
    limit: number = 50
  ): { keywords: any[], total: number } {
    const allData: any[] = []
    
    for (const [id, keyword] of this.keywords) {
      const metrics = this.keywordMetrics.get(id)
      const docCounts = this.naverDocCounts.get(id)
      
      if (!metrics) continue
      
      // docCounts가 없으면 기본값 사용
      const defaultDocCounts = {
        blog_total: 0,
        cafe_total: 0,
        web_total: 0,
        news_total: 0,
        collected_at: keyword.created_at
      }
      
      const finalDocCounts = docCounts || defaultDocCounts
      
      const allTotal = finalDocCounts.blog_total + finalDocCounts.cafe_total + finalDocCounts.web_total + finalDocCounts.news_total
      
      allData.push({
        id: keyword.id,
        seed: keyword.seed,
        keyword: keyword.keyword,
        avg_monthly_search: metrics.avg_monthly_search,
        blog_total: finalDocCounts.blog_total,
        cafe_total: finalDocCounts.cafe_total,
        web_total: finalDocCounts.web_total,
        news_total: finalDocCounts.news_total,
        all_total: allTotal,
        monthly_click_pc: metrics.monthly_click_pc,
        monthly_click_mobile: metrics.monthly_click_mobile,
        ctr_pc: metrics.ctr_pc,
        ctr_mobile: metrics.ctr_mobile,
        ad_count: metrics.ad_count,
        collected_at: finalDocCounts.collected_at,
        created_at: keyword.created_at
      })
    }

    // 필터 적용
    const filteredData = allData.filter(item => {
      const searchMatch = item.avg_monthly_search >= minSearch
      const cafeMatch = item.cafe_total <= maxCafe
      const daysMatch = new Date(item.collected_at) >= new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      
      return searchMatch && cafeMatch && daysMatch
    })

    // 정렬: cafe_total ASC, avg_monthly_search DESC
    const sortedData = filteredData.sort((a, b) => {
      if (a.cafe_total !== b.cafe_total) {
        return a.cafe_total - b.cafe_total
      }
      return b.avg_monthly_search - a.avg_monthly_search
    })

    // 페이지네이션
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedData = sortedData.slice(startIndex, endIndex)

    return {
      keywords: paginatedData,
      total: filteredData.length
    }
  }

  // 황금키워드 조회
  getGoldenKeywords(
    band: string,
    minSearch: number = 0
  ): any[] {
    const allData: any[] = []
    
    for (const [id, keyword] of this.keywords) {
      const metrics = this.keywordMetrics.get(id)
      const docCounts = this.naverDocCounts.get(id)
      
      if (!metrics || !docCounts) continue
      
      const allTotal = docCounts.blog_total + docCounts.cafe_total + docCounts.web_total + docCounts.news_total
      
      allData.push({
        id: keyword.id,
        seed: keyword.seed,
        keyword: keyword.keyword,
        avg_monthly_search: metrics.avg_monthly_search,
        blog_total: docCounts.blog_total,
        cafe_total: docCounts.cafe_total,
        web_total: docCounts.web_total,
        news_total: docCounts.news_total,
        all_total: allTotal,
        gold_score: allTotal > 0 ? metrics.avg_monthly_search / (allTotal + 1) : 0,
        collected_at: docCounts.collected_at
      })
    }

    // 밴드 필터 적용
    const bandRanges = {
      low: { min: 0, max: 50 },
      mid: { min: 51, max: 200 },
      high: { min: 201, max: 1000 },
      ultra: { min: 1001, max: Infinity }
    }

    const bandRange = bandRanges[band as keyof typeof bandRanges]
    if (!bandRange) return []

    const filteredData = allData.filter(item => {
      const searchMatch = item.avg_monthly_search >= minSearch
      const bandMatch = item.all_total >= bandRange.min && item.all_total <= bandRange.max
      
      return searchMatch && bandMatch
    })

    // 정렬: cafe_total ASC, avg_monthly_search DESC
    const sortedData = filteredData.sort((a, b) => {
      if (a.cafe_total !== b.cafe_total) {
        return a.cafe_total - b.cafe_total
      }
      return b.avg_monthly_search - a.avg_monthly_search
    })

    return sortedData.slice(0, 10) // Top 10
  }

  // 통계 조회
  getStats(): { totalKeywords: number, recentKeywords: number } {
    const totalKeywords = this.keywords.size
    const recentKeywords = Array.from(this.keywords.values())
      .filter(k => new Date(k.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .length

    return { totalKeywords, recentKeywords }
  }
}

// 글로벌 인스턴스
export const mockDB = new MockDatabase()

/**
 * 영구 데이터베이스 (JSON 파일 기반)
 * 서버 재시작 후에도 데이터 유지
 */

import fs from 'fs'
import path from 'path'

interface KeywordRecord {
  id: number
  seed: string
  keyword: string
  source: string
  last_related_at: string
  created_at: string
}

interface KeywordMetricsRecord {
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

interface NaverDocCountsRecord {
  keyword_id: number
  blog_total: number
  cafe_total: number
  web_total: number
  news_total: number
  collected_at: string
}

interface DatabaseData {
  keywords: Record<number, KeywordRecord>
  keywordMetrics: Record<number, KeywordMetricsRecord>
  naverDocCounts: Record<number, NaverDocCountsRecord>
  nextId: number
}

export class PersistentDB {
  private data: DatabaseData
  private filePath: string

  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'database.json')
    this.data = this.loadData()
  }

  private loadData(): DatabaseData {
    try {
      // data 디렉토리 생성
      const dataDir = path.dirname(this.filePath)
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }

      // 파일이 존재하면 로드
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8')
        return JSON.parse(fileContent)
      }
    } catch (error) {
      console.error('데이터베이스 로드 실패:', error)
    }

    // 기본 데이터 반환
    return {
      keywords: {},
      keywordMetrics: {},
      naverDocCounts: {},
      nextId: 1
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
      console.log('💾 데이터베이스 저장 완료')
    } catch (error) {
      console.error('데이터베이스 저장 실패:', error)
    }
  }

  // 시드키워드 사용 기록 저장
  markSeedAsUsed(seedKeyword: string): void {
    const now = new Date().toISOString()
    
    if (!this.data.autoSeedUsage) {
      this.data.autoSeedUsage = {}
    }
    
    this.data.autoSeedUsage[seedKeyword] = {
      seed: seedKeyword,
      lastUsed: now,
      usageCount: (this.data.autoSeedUsage[seedKeyword]?.usageCount || 0) + 1,
      createdAt: this.data.autoSeedUsage[seedKeyword]?.createdAt || now
    }
    
    this.saveData()
    console.log(`✅ 시드키워드 사용 기록: "${seedKeyword}" (${this.data.autoSeedUsage[seedKeyword].usageCount}번째 사용)`)
  }

  // 시드키워드 사용 여부 확인
  isSeedUsed(seedKeyword: string): boolean {
    if (!this.data.autoSeedUsage) {
      return false
    }
    
    const usage = this.data.autoSeedUsage[seedKeyword]
    if (!usage) {
      return false
    }
    
    // 30일 이내에 사용된 경우 true
    const lastUsedDate = new Date(usage.lastUsed)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    return lastUsedDate > thirtyDaysAgo
  }

  // 시드 사용 기록 초기화
  resetSeedUsage(): void {
    this.data.autoSeedUsage = {}
    this.saveData()
    console.log('🔄 시드 사용 기록이 초기화되었습니다.')
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
    const keywords = []
    
    for (const [id, record] of Object.entries(this.data.keywords)) {
      // 시드로 사용되지 않은 키워드만 선택
      if (!this.isSeedUsed(record.keyword)) {
        const metrics = this.data.keywordMetrics[parseInt(id)]
        if (metrics) {
          keywords.push({
            id: parseInt(id),
            keyword: record.keyword,
            seed: record.seed,
            avg_monthly_search: metrics.avg_monthly_search || 0,
            monthly_search_pc: metrics.monthly_search_pc || 0,
            monthly_search_mob: metrics.monthly_search_mob || 0,
            created_at: record.created_at
          })
        }
      }
    }
    
    // 검색량 높은 순으로 정렬
    keywords.sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
    
    return keywords.slice(0, limit)
  }

  // 모든 키워드 중 검색량 높은 순으로 조회 (시드 사용 여부 무관)
  getAllKeywordsBySearchVolume(limit: number = 50): Array<{
    id: number
    keyword: string
    seed: string
    avg_monthly_search: number
    monthly_search_pc: number
    monthly_search_mob: number
    created_at: string
  }> {
    const keywords = []
    
    for (const [id, record] of Object.entries(this.data.keywords)) {
      const metrics = this.data.keywordMetrics[parseInt(id)]
      if (metrics) {
        keywords.push({
          id: parseInt(id),
          keyword: record.keyword,
          seed: record.seed,
          avg_monthly_search: metrics.avg_monthly_search || 0,
          monthly_search_pc: metrics.monthly_search_pc || 0,
          monthly_search_mob: metrics.monthly_search_mob || 0,
          created_at: record.created_at
        })
      }
    }
    
    // 검색량 높은 순으로 정렬
    keywords.sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
    
    return keywords.slice(0, limit)
  }

  // 자동수집 설정 조회
  getAutoCollectSettings(): { enabled: boolean } {
    return {
      enabled: this.data.autoCollectSettings?.enabled || false
    }
  }

  // 시드 마지막 사용 시간 조회
  getAutoSeedLastUsed(seed: string): number | null {
    const usage = this.data.autoSeedUsage?.[seed]
    return usage ? new Date(usage.lastUsed).getTime() : null
  }

  // 자동수집 시드 추가
  addAutoSeed(seed: string): void {
    if (!this.data.autoCollectQueue) {
      this.data.autoCollectQueue = []
    }
    
    // 중복 체크
    if (!this.data.autoCollectQueue.includes(seed)) {
      this.data.autoCollectQueue.push(seed)
      this.saveData()
      console.log(`🤖 시드 "${seed}" 자동수집 큐에 추가됨`)
    }
  }

  // 키워드 존재 여부 확인 (30일 기준)
  keywordExists(keyword: string): { exists: boolean, keywordId?: number, isRecent?: boolean } {
    for (const [id, record] of Object.entries(this.data.keywords)) {
      if (record.keyword === keyword) {
        const createdDate = new Date(record.created_at)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const isRecent = createdDate > thirtyDaysAgo
        
        return {
          exists: true,
          keywordId: parseInt(id),
          isRecent
        }
      }
    }
    return { exists: false }
  }

  // 키워드 저장 (중복 체크 포함)
  insertKeyword(seed: string, keyword: string, source: string = 'naver-ads'): number {
    // 중복 체크
    const existsResult = this.keywordExists(keyword)
    if (existsResult.exists) {
      throw new Error(`키워드 "${keyword}"가 이미 존재합니다.`)
    }
    
    const id = this.data.nextId++
    const now = new Date().toISOString()
    
    this.data.keywords[id] = {
      id,
      seed,
      keyword,
      source,
      last_related_at: now,
      created_at: now
    }
    
    this.saveData()
    return id
  }

  // 키워드 업데이트
  updateKeyword(keywordId: number, seed: string, keyword: string, source: string = 'naver-ads'): void {
    const now = new Date().toISOString()
    
    this.data.keywords[keywordId] = {
      id: keywordId,
      seed,
      keyword,
      source,
      last_related_at: now,
      created_at: this.data.keywords[keywordId]?.created_at || now
    }
    
    this.saveData()
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
    this.data.keywordMetrics[keywordId] = {
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
    }
    
    this.saveData()
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
    this.data.keywordMetrics[keywordId] = {
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
    }
    
    this.saveData()
  }

  // 네이버 문서수 저장
  insertNaverDocCounts(
    keywordId: number,
    blogTotal: number,
    cafeTotal: number,
    webTotal: number,
    newsTotal: number
  ): void {
    this.data.naverDocCounts[keywordId] = {
      keyword_id: keywordId,
      blog_total: blogTotal,
      cafe_total: cafeTotal,
      web_total: webTotal,
      news_total: newsTotal,
      collected_at: new Date().toISOString()
    }
    
    this.saveData()
  }

  // 키워드 조회
  getKeywords(
    minSearch: number = 0,
    maxSearch: number = 999999999,
    minCafe: number = 0,
    maxCafe: number = 999999999,
    minBlog: number = 0,
    maxBlog: number = 999999999,
    minWeb: number = 0,
    maxWeb: number = 999999999,
    minNews: number = 0,
    maxNews: number = 999999999,
    days: number = 30,
    page: number = 1,
    limit: number = 50,
    sortBy: string = 'cafe_asc_search_desc'
  ): { keywords: any[], total: number } {
    const allData: any[] = []
    
    for (const [id, keyword] of Object.entries(this.data.keywords)) {
      const metrics = this.data.keywordMetrics[parseInt(id)]
      const docCounts = this.data.naverDocCounts[parseInt(id)]
      
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
      const searchMatch = item.avg_monthly_search >= minSearch && item.avg_monthly_search <= maxSearch
      const cafeMatch = item.cafe_total >= minCafe && item.cafe_total <= maxCafe
      const blogMatch = item.blog_total >= minBlog && item.blog_total <= maxBlog
      const webMatch = item.web_total >= minWeb && item.web_total <= maxWeb
      const newsMatch = item.news_total >= minNews && item.news_total <= maxNews
      const daysMatch = new Date(item.collected_at) >= new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      
      return searchMatch && cafeMatch && blogMatch && webMatch && newsMatch && daysMatch
    })

    // 정렬 로직
    const sortedData = filteredData.sort((a, b) => {
      switch (sortBy) {
        case 'cafe_asc_search_desc':
          // 카페문서수 오름차순(1순위) + 총검색수 내림차순(2순위)
          if (a.cafe_total !== b.cafe_total) {
            return a.cafe_total - b.cafe_total
          }
          return b.avg_monthly_search - a.avg_monthly_search
        case 'cafe_desc_search_desc':
          // 카페문서수 내림차순(1순위) + 총검색수 내림차순(2순위)
          if (a.cafe_total !== b.cafe_total) {
            return b.cafe_total - a.cafe_total
          }
          return b.avg_monthly_search - a.avg_monthly_search
        case 'search_desc_cafe_asc':
          // 총검색수 내림차순(1순위) + 카페문서수 오름차순(2순위)
          if (a.avg_monthly_search !== b.avg_monthly_search) {
            return b.avg_monthly_search - a.avg_monthly_search
          }
          return a.cafe_total - b.cafe_total
        case 'search_desc':
          // 총검색수 내림차순만
          return b.avg_monthly_search - a.avg_monthly_search
        default:
          // 기본값: 카페문서수 오름차순 + 총검색수 내림차순
          if (a.cafe_total !== b.cafe_total) {
            return a.cafe_total - b.cafe_total
          }
          return b.avg_monthly_search - a.avg_monthly_search
      }
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

  // 문서수 존재 여부 확인
  hasDocCounts(keywordId: number): boolean {
    return this.data.naverDocCounts[keywordId] !== undefined
  }

  // 문서수가 없는 키워드 목록 반환
  getKeywordsWithoutDocCounts(
    minSearch: number = 0,
    maxSearch: number = 999999999,
    minCafe: number = 0,
    maxCafe: number = 999999999,
    minBlog: number = 0,
    maxBlog: number = 999999999,
    minWeb: number = 0,
    maxWeb: number = 999999999,
    minNews: number = 0,
    maxNews: number = 999999999,
    days: number = 30,
    page: number = 1,
    limit: number = 50,
    sortBy: string = 'cafe_asc_search_desc'
  ): { keywords: any[], total: number } {
    // 모든 키워드 데이터 가져오기
    const allKeywords = Object.values(this.data.keywords)
    const allMetrics = Object.values(this.data.keywordMetrics)
    const allDocCounts = Object.values(this.data.naverDocCounts)

    // 키워드와 메트릭스 조인
    const keywordMetricsMap = new Map()
    allMetrics.forEach(metric => {
      keywordMetricsMap.set(metric.keyword_id, metric)
    })

    // 키워드와 문서수 조인
    const docCountsMap = new Map()
    allDocCounts.forEach(docCount => {
      docCountsMap.set(docCount.keyword_id, docCount)
    })

    // 데이터 조합
    const allData = allKeywords.map(keyword => {
      const metrics = keywordMetricsMap.get(keyword.id)
      const docCounts = docCountsMap.get(keyword.id)
      
      return {
        id: keyword.id,
        keyword: keyword.keyword,
        seed: keyword.seed,
        created_at: keyword.created_at,
        avg_monthly_search: (metrics?.avg_monthly_search_pc || 0) + (metrics?.avg_monthly_search_mobile || 0),
        monthly_click_pc: metrics?.monthly_click_pc || 0,
        monthly_click_mobile: metrics?.monthly_click_mobile || 0,
        ctr_pc: metrics?.ctr_pc || 0,
        ctr_mobile: metrics?.ctr_mobile || 0,
        ad_count: metrics?.ad_count || 0,
        blog_total: docCounts?.blog_total || 0,
        cafe_total: docCounts?.cafe_total || 0,
        web_total: docCounts?.web_total || 0,
        news_total: docCounts?.news_total || 0,
        collected_at: keyword.created_at
      }
    })

    // 문서수가 없는 키워드만 필터링
    const keywordsWithoutDocCounts = allData.filter(item => {
      const hasDocCounts = docCountsMap.has(item.id)
      return !hasDocCounts
    })

    // 필터 적용
    const filteredData = keywordsWithoutDocCounts.filter(item => {
      const searchMatch = item.avg_monthly_search >= minSearch && item.avg_monthly_search <= maxSearch
      const cafeMatch = item.cafe_total >= minCafe && item.cafe_total <= maxCafe
      const blogMatch = item.blog_total >= minBlog && item.blog_total <= maxBlog
      const webMatch = item.web_total >= minWeb && item.web_total <= maxWeb
      const newsMatch = item.news_total >= minNews && item.news_total <= maxNews
      const daysMatch = new Date(item.collected_at) >= new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      return searchMatch && cafeMatch && blogMatch && webMatch && newsMatch && daysMatch
    })

    // 정렬
    let sortedData = [...filteredData]
    switch (sortBy) {
      case 'cafe_asc_search_desc':
        sortedData.sort((a, b) => {
          if (a.cafe_total !== b.cafe_total) {
            return a.cafe_total - b.cafe_total // 카페문서수 오름차순
          }
          return b.avg_monthly_search - a.avg_monthly_search // 총검색수 내림차순
        })
        break
      case 'search_desc':
        sortedData.sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        break
      case 'cafe_asc':
        sortedData.sort((a, b) => a.cafe_total - b.cafe_total)
        break
      default:
        sortedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    // 페이지네이션
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedData = sortedData.slice(startIndex, endIndex)

    return {
      keywords: paginatedData,
      total: filteredData.length
    }
  }

  // 데이터베이스 상태 확인
  getStats() {
    return {
      keywords: Object.keys(this.data.keywords).length,
      keywordMetrics: Object.keys(this.data.keywordMetrics).length,
      naverDocCounts: Object.keys(this.data.naverDocCounts).length,
      nextId: this.data.nextId
    }
  }

  // 데이터베이스 리로드 (파일에서 다시 읽기)
  reloadData(): void {
    console.log('🔄 데이터베이스 리로드 시작...')
    this.data = this.loadData()
    console.log('✅ 데이터베이스 리로드 완료')
  }

  // 데이터베이스 초기화
  resetData(): void {
    console.log('🔄 데이터베이스 초기화 시작...')
    this.data = {
      keywords: {},
      keywordMetrics: {},
      naverDocCounts: {},
      nextId: 1
    }
    this.saveData()
    console.log('✅ 데이터베이스 초기화 완료')
  }
}

// 싱글톤 인스턴스
export const persistentDB = new PersistentDB()

/**
 * API 응답 타입 정의
 * 타입 안전성을 위한 중앙화된 타입 정의
 */

/**
 * 기본 API 응답 구조
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp?: string
}

/**
 * 키워드 데이터 인터페이스
 */
export interface KeywordData {
  keyword: string
  avg_monthly_search: number
  blog_total?: number
  cafe_total?: number
  web_total?: number
  news_total?: number
  monthly_click_pc?: number
  monthly_click_mo?: number
  ctr_pc?: number
  ctr_mo?: number
  ad_count?: number
  pc_search: number
  mobile_search: number
  created_at?: string
  updated_at?: string
  comp_idx?: string | number
}

/**
 * 네이버 키워드 수집 API 응답
 */
export interface CollectNaverResponse extends ApiResponse {
  seed: string
  totalCollected: number
  totalSavedOrUpdated: number
  savedCount: number
  updatedCount: number
  failedCount: number
  skippedCount: number
  totalAttempted: number
  keywords: KeywordData[]
  failedSamples: Array<{
    keyword: string
    error: string
  }>
  version: string
}

/**
 * 키워드 조회 API 응답
 */
export interface KeywordsResponse extends ApiResponse {
  keywords: KeywordData[]
  total: number
  page: number
  pageSize: number
}

/**
 * 자동 수집 API 응답
 */
export interface AutoCollectResponse extends ApiResponse {
  processed: number
  processedSeeds: string[]
  remaining: number
  totalKeywords: number
  usedSeeds: number
  unlimited: boolean
  concurrentLimit: number
  totalKeywordsCollected: number
  totalKeywordsSaved: number
  totalNewKeywords: number
  targetKeywords: number
  targetReached: boolean
  message: string
}

/**
 * 인사이트 키워드 데이터
 */
export interface InsightKeyword {
  keyword: string
  searchVolume: number
  cafeDocs: number
  blogDocs: number
  webDocs: number
  newsDocs: number
  totalDocs: number
  adCount: number
  cpc: number
  compIndex: number
}

/**
 * 인사이트 데이터
 */
export interface InsightData {
  title: string
  description: string
  keywords: InsightKeyword[]
  count: number
}

/**
 * 인사이트 API 응답
 */
export interface InsightsResponse extends ApiResponse {
  insights: {
    cafeInsights: InsightData
    blogInsights: InsightData
    webInsights: InsightData
    newsInsights: InsightData
    totalDocsInsights: InsightData
    adCountInsights: InsightData
  }
  summary: {
    totalKeywords: number
    minSearchVolume: number
    limit: number
    generatedAt: string
  }
}


// Cloudflare D1 데이터베이스 연결 및 쿼리 헬퍼

export interface Database {
  prepare: (query: string) => any
  exec: (query: string) => any
}

// D1 바인딩이 없는 경우 시뮬레이션
class MockDatabase {
  private data = new Map()

  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        all: () => Promise.resolve({ results: [] }),
        run: () => Promise.resolve({ success: true, meta: { changes: 1 } }),
        first: () => Promise.resolve(null)
      })
    }
  }

  exec(query: string) {
    return Promise.resolve({ success: true })
  }
}

// 환경에 따라 실제 D1 또는 모의 데이터베이스 사용
export function getDatabase(): Database {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return new MockDatabase() as Database
  }
  
  // Cloudflare Pages Functions 환경에서는 D1 바인딩 사용
  // @ts-ignore
  return globalThis.DB || new MockDatabase() as Database
}

// 키워드 관련 쿼리
export const keywordQueries = {
  // 키워드 저장
  insertKeyword: `
    INSERT OR REPLACE INTO keywords (seed, keyword, source, last_related_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
  
  // 키워드 메트릭 저장
  insertKeywordMetrics: `
    INSERT OR REPLACE INTO keyword_metrics 
    (keyword_id, monthly_search_pc, monthly_search_mob, avg_monthly_search, cpc, comp_index, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  
  // 네이버 문서수 저장
  insertNaverDocCounts: `
    INSERT OR REPLACE INTO naver_doc_counts 
    (keyword_id, blog_total, cafe_total, web_total, news_total, collected_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  
  // 키워드 조회 (필터링 및 정렬)
  getKeywords: `
    SELECT 
      k.id, k.seed, k.keyword, k.created_at,
      km.monthly_search_pc, km.monthly_search_mob, km.avg_monthly_search,
      ndc.blog_total, ndc.cafe_total, ndc.web_total, ndc.news_total,
      (ndc.blog_total + ndc.cafe_total + ndc.web_total + ndc.news_total) as all_total,
      ndc.collected_at
    FROM keywords k
    LEFT JOIN keyword_metrics km ON k.id = km.keyword_id
    LEFT JOIN naver_doc_counts ndc ON k.id = ndc.keyword_id
    WHERE km.avg_monthly_search >= ? 
      AND ndc.cafe_total <= ?
      AND ndc.collected_at >= datetime('now', '-30 days')
    ORDER BY ndc.cafe_total ASC, km.avg_monthly_search DESC
    LIMIT ? OFFSET ?
  `,
  
  // 황금키워드 조회
  getGoldenKeywords: `
    SELECT 
      k.id, k.seed, k.keyword,
      km.avg_monthly_search,
      ndc.blog_total, ndc.cafe_total, ndc.web_total, ndc.news_total,
      (ndc.blog_total + ndc.cafe_total + ndc.web_total + ndc.news_total) as all_total,
      (km.avg_monthly_search * 1.0 / (ndc.blog_total + ndc.cafe_total + ndc.web_total + ndc.news_total + 1)) as gold_score,
      ndc.collected_at
    FROM keywords k
    LEFT JOIN keyword_metrics km ON k.id = km.keyword_id
    LEFT JOIN naver_doc_counts ndc ON k.id = ndc.keyword_id
    WHERE km.avg_monthly_search >= ?
      AND (ndc.blog_total + ndc.cafe_total + ndc.web_total + ndc.news_total) >= ?
      AND (ndc.blog_total + ndc.cafe_total + ndc.web_total + ndc.news_total) <= ?
    ORDER BY ndc.cafe_total ASC, km.avg_monthly_search DESC
    LIMIT 10
  `,
  
  // 자동수집 사용 기록 저장
  insertAutoSeedUsage: `
    INSERT OR REPLACE INTO auto_seed_usage (seed, last_auto_collect_at, depth, note)
    VALUES (?, ?, ?, ?)
  `,
  
  // 자동수집 사용 기록 조회
  getAutoSeedUsage: `
    SELECT * FROM auto_seed_usage WHERE seed = ? AND last_auto_collect_at > datetime('now', '-30 days')
  `,
  
  // 수집 로그 저장
  insertCollectLog: `
    INSERT INTO collect_logs (keyword, type, status, message)
    VALUES (?, ?, ?, ?)
  `
}

// KV 캐시 헬퍼
export class CacheService {
  private kv: any

  constructor() {
    // @ts-ignore
    this.kv = globalThis.CACHE || new Map()
  }

  async get(key: string): Promise<any> {
    if (this.kv instanceof Map) {
      return this.kv.get(key)
    }
    return await this.kv.get(key)
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (this.kv instanceof Map) {
      this.kv.set(key, value)
      if (ttl) {
        setTimeout(() => this.kv.delete(key), ttl * 1000)
      }
    } else {
      await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttl })
    }
  }

  async delete(key: string): Promise<void> {
    if (this.kv instanceof Map) {
      this.kv.delete(key)
    } else {
      await this.kv.delete(key)
    }
  }
}

// 에러 처리 헬퍼
export function createErrorResponse(
  type: string,
  title: string,
  status: number,
  detail: string
) {
  return {
    type,
    title,
    status,
    detail
  }
}

// 레이트 리미팅 헬퍼
export class RateLimiter {
  private requests = new Map<string, number[]>()
  private limit: number
  private windowMs: number

  constructor(limit: number = 60, windowMs: number = 60000) {
    this.limit = limit
    this.windowMs = windowMs
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, [])
    }
    
    const userRequests = this.requests.get(identifier)!
    const recentRequests = userRequests.filter(time => time > windowStart)
    
    if (recentRequests.length >= this.limit) {
      return false
    }
    
    recentRequests.push(now)
    this.requests.set(identifier, recentRequests)
    return true
  }
}

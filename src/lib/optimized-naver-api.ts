// 최적화된 네이버 API 클라이언트 (다중 키 + 병렬 처리)

import crypto from 'crypto'

interface ApiKey {
  name: string
  apiKey: string
  secret: string
  customerId: string
  dailyLimit: number
  usedToday: number
  lastUsed: number
  isActive: boolean
}

interface OpenApiKey {
  name: string
  clientId: string
  clientSecret: string
  dailyLimit: number
  usedToday: number
  lastUsed: number
  isActive: boolean
}

interface RelatedKeyword {
  keyword: string
  monthly_search_pc: number
  monthly_search_mob: number
  avg_monthly_search: number
  monthly_click_pc?: number
  monthly_click_mobile?: number
  ctr_pc?: number
  ctr_mobile?: number
  ad_count?: number
  cpc: number
  comp_index: number
}

interface DocCounts {
  blog_total: number
  cafe_total: number
  web_total: number
  news_total: number
}

// 다중 API 키 관리 클래스
class OptimizedApiKeyManager<T extends { name: string; dailyLimit: number; usedToday: number; lastUsed: number; isActive: boolean }> {
  private keys: T[] = []
  private keyIndex = 0

  constructor(keys: T[]) {
    this.keys = keys.filter(key => key.isActive)
  }

  // 다음 사용 가능한 키 선택 (로드 밸런싱)
  getNextAvailableKey(): T | null {
    const availableKeys = this.keys.filter(key => 
      key.isActive && key.usedToday < key.dailyLimit
    )

    if (availableKeys.length === 0) {
      console.warn('⚠️ 사용 가능한 API 키가 없습니다. 모든 키가 비활성화되었거나 한도 초과')
      return null
    }

    // 가장 적게 사용된 키 선택
    const sortedKeys = availableKeys.sort((a, b) => {
      if (a.usedToday !== b.usedToday) {
        return a.usedToday - b.usedToday
      }
      return a.lastUsed - b.lastUsed
    })

    const selectedKey = sortedKeys[0]
    console.log(`🔑 API 키 선택: ${selectedKey.name} (사용량: ${selectedKey.usedToday}/${selectedKey.dailyLimit})`)
    return selectedKey
  }

  // 키 사용량 업데이트 (대규모 수집용 안전장치)
  updateUsage(keyName: string, requests: number = 1) {
    const key = this.keys.find(k => k.name === keyName)
    if (key) {
      key.usedToday += requests
      key.lastUsed = Date.now()
      
      // 사용량 임계치 경고 (일일 한도의 80%)
      const threshold = key.dailyLimit * 0.8
      if (key.usedToday >= threshold && key.usedToday < key.dailyLimit) {
        console.warn(`⚠️ API 키 "${keyName}" 사용량 임계치 도달: ${key.usedToday}/${key.dailyLimit} (80%)`)
      }
      
      // 일일 한도 초과 시 비활성화
      if (key.usedToday >= key.dailyLimit) {
        console.error(`🚫 API 키 "${keyName}" 일일 한도 초과로 비활성화: ${key.usedToday}/${key.dailyLimit}`)
        key.isActive = false
      }
    }
  }

  // 모든 키 상태 조회
  getStatus() {
    const status = this.keys.map(key => ({
      name: key.name,
      usedToday: key.usedToday,
      dailyLimit: key.dailyLimit,
      remaining: key.dailyLimit - key.usedToday,
      isActive: key.isActive,
      lastUsed: key.lastUsed
    }))
    
    const activeKeys = status.filter(k => k.isActive)
    const inactiveKeys = status.filter(k => !k.isActive)
    
    console.log(`🔑 API 키 상태: 활성 ${activeKeys.length}개, 비활성 ${inactiveKeys.length}개`)
    if (inactiveKeys.length > 0) {
      console.log(`🚫 비활성화된 키들:`, inactiveKeys.map(k => k.name).join(', '))
    }
    
    return status
  }
}

// 최적화된 네이버 검색광고 API 클라이언트
export class OptimizedNaverAdsClient {
  private keyManager: OptimizedApiKeyManager<ApiKey>
  private keys: ApiKey[] = []

  constructor() {
    this.loadApiKeys()
    this.keyManager = new OptimizedApiKeyManager(this.keys)
  }

  // 다중 API 키 로드 (환경변수 우선, 없으면 하드코딩된 키 사용)
  private loadApiKeys() {
    const keys: ApiKey[] = []
    
    // 환경변수에서 다중 키 로드
    for (let i = 1; i <= 5; i++) {
      const apiKey = process.env[`SEARCHAD_API_KEY_${i}`]
      const secret = process.env[`SEARCHAD_SECRET_KEY_${i}`]
      const customerId = process.env[`SEARCHAD_CUSTOMER_ID_${i}`]
      
      if (apiKey && secret && customerId && 
          !apiKey.includes('i??i??') && 
          !secret.includes('i??i??') && 
          !customerId.includes('i??i??')) {
        keys.push({
          name: `검색광고API키${i}`,
          apiKey,
          secret,
          customerId,
          dailyLimit: 10000,
          usedToday: 0,
          lastUsed: 0,
          isActive: true
        })
      }
    }
    
    // 환경변수가 없거나 깨져있으면 하드코딩된 키 사용
    if (keys.length === 0) {
      keys.push(
        {
          name: '검색광고API키1',
          apiKey: '0100000000d027bb5287da074c48fc79503e97ae8e4bb0e7e928b39108e0b4dd6ce3950b7f',
          secret: 'AQAAAADQJ7tSh9oHTEj8eVA+l66OGm0FwBl/Ejg+WP/5GntSew==',
          customerId: '4129627',
          dailyLimit: 10000,
          usedToday: 0,
          lastUsed: 0,
          isActive: true
        },
        {
          name: '검색광고API키2',
          apiKey: '0100000000cc9487ea097be3b003d1634f76af9d829f9add05a89bfff3b70502076049b218',
          secret: 'AQAAAADMlIfqCXvjsAPRY092r52CKoSQ0mjfgDr9xnHtAg1j1w==',
          customerId: '588691',
          dailyLimit: 10000,
          usedToday: 0,
          lastUsed: 0,
          isActive: false  // 비활성화
        },
        {
          name: '검색광고API키3',
          apiKey: '01000000004df6f7cf20064146e5567633fb8dee0ddb315f0c0c46ffb79b4084db618b53ae',
          secret: 'AQAAAABN9vfPIAZBRuVWdjP7je4NQviMuG1aQc4wbCGVofNGFQ==',
          customerId: '3834222',
          dailyLimit: 10000,
          usedToday: 0,
          lastUsed: 0,
          isActive: false  // 비활성화
        },
        {
          name: '검색광고API키4',
          apiKey: '01000000007c872e3ad6cc952fc6985cb75ba9bac49bd47118d73c1da388320f2484a5fc34',
          secret: 'AQAAAAB8hy461syVL8aYXLdbqbrEeM8U8CCzJJ7dtIXx/Qei1Q==',
          customerId: '3279649',
          dailyLimit: 10000,
          usedToday: 0,
          lastUsed: 0,
          isActive: false  // 비활성화
        },
        {
          name: '검색광고API키5',
          apiKey: '01000000002f4619842bbd6c8133ee464acf7affed98e8b0a30253f34e4b2359beeb56ec6a',
          secret: 'AQAAAAAvRhmEK71sgTPuRkrPev/t5wskFLEKPQT7H8bwOrhnrQ==',
          customerId: '4136805',
          dailyLimit: 10000,
          usedToday: 0,
          lastUsed: 0,
          isActive: false  // 비활성화
        }
      )
    }
    
    this.keys = keys
    console.log(`🔑 최적화된 다중 검색광고 API 키 로드: ${this.keys.length}개 키 사용 가능`)
    console.log(`🔑 활성화된 키들:`, this.keys.filter(k => k.isActive).map(k => k.name))
    console.log(`🔑 비활성화된 키들:`, this.keys.filter(k => !k.isActive).map(k => k.name))
  }

  // HMAC-SHA256 시그니처 생성
  private createSignature(timestamp: string, method: string, uri: string, secret: string): string {
    const message = `${timestamp}.${method}.${uri}`
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64')
  }

  // 문자열을 숫자로 변환
  private normalizeNumber(value: string | number): number {
    if (!value || value === '') return 0
    
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value
    }
    
    const cleaned = value.replace(/[<>=]/g, '').trim()
    const num = parseInt(cleaned, 10)
    return isNaN(num) ? 0 : num
  }

  // 백분율 문자열을 숫자로 변환
  private normalizePercentage(value: string | number): number {
    if (!value || value === '') return 0
    
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value
    }
    
    const cleaned = value.replace('%', '').trim()
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  // 단일 키워드로 연관검색어 조회 (재시도 로직 포함)
  private async getRelatedKeywordsWithRetry(seed: string): Promise<RelatedKeyword[]> {
    const maxRetries = this.keys.length
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const apiKey = this.keyManager.getNextAvailableKey()
        if (!apiKey) {
          throw new Error('사용 가능한 API 키가 없습니다.')
        }

        const timestamp = Date.now().toString()
        const method = 'GET'
        const uri = '/keywordstool'
        const signature = this.createSignature(timestamp, method, uri, apiKey.secret)
        
        const params = new URLSearchParams({
          hintKeywords: seed,
          showDetail: '1'
        })

        console.log(`🔍 연관검색어 조회 시도 ${attempt + 1}/${maxRetries}: "${seed}" (${apiKey.name})`)
        
        const fullUrl = `https://api.naver.com/keywordstool?${params}`
        console.log('🌐 API URL:', fullUrl)
        
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'X-API-KEY': apiKey.apiKey,
            'X-Customer': apiKey.customerId,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          // 네트워크 안정성을 위한 타임아웃 설정
          signal: AbortSignal.timeout(30000), // 30초 타임아웃
          // 연결 재시도 설정
          keepalive: true
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ API 응답 에러 (${response.status}):`, errorText)
          
          // Rate Limit 에러인 경우 다음 키로 시도
          if (response.status === 429) {
            console.log(`⏳ Rate Limit 감지, 다음 키로 시도...`)
            this.keyManager.updateUsage(apiKey.name, 1)
            lastError = new Error(`Rate Limit: ${response.status}`)
            continue
          }
          
          // 403 Forbidden (잘못된 API 키)인 경우 해당 키 비활성화
          if (response.status === 403) {
            console.log(`🚫 API 키 "${apiKey.name}" 비활성화 (403 Forbidden)`)
            apiKey.isActive = false
            lastError = new Error(`Invalid API Key: ${apiKey.name}`)
            continue
          }
          
          throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        console.log('📊 API 응답 데이터:', JSON.stringify(data, null, 2))
        
        if (!data.keywordList || !Array.isArray(data.keywordList)) {
          console.warn('⚠️ 예상과 다른 API 응답 구조:', data)
          return []
        }

        const keywords: RelatedKeyword[] = data.keywordList.map((item: any) => ({
          keyword: item.relKeyword,
          monthly_search_pc: this.normalizeNumber(item.monthlyPcQcCnt),
          monthly_search_mob: this.normalizeNumber(item.monthlyMobileQcCnt),
          avg_monthly_search: this.normalizeNumber(item.monthlyPcQcCnt) + this.normalizeNumber(item.monthlyMobileQcCnt),
          cpc: this.normalizeNumber(item.plAvgDepth),
          comp_index: this.normalizePercentage(item.compIdx)
        }))

        console.log(`✅ 연관검색어 조회 완료: ${keywords.length}개 키워드 발견 (${apiKey.name})`)
        this.keyManager.updateUsage(apiKey.name, 1)
        return keywords

      } catch (error: any) {
        console.error(`❌ 연관검색어 조회 에러 (시도 ${attempt + 1}):`, error)
        lastError = error
        
        // 네트워크 에러 분류 및 처리
        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
          console.log(`⏰ 타임아웃 발생, 다음 키로 시도...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        } else if (error.message?.includes('Rate Limit') || error.message?.includes('429')) {
          console.log(`⏳ Rate Limit 감지, 대기 후 재시도...`)
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
        } else if (error.message?.includes('fetch')) {
          console.log(`🌐 네트워크 에러, 잠시 대기 후 재시도...`)
          await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)))
        } else {
          // 기타 에러는 짧은 대기
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error('모든 API 키로 시도했지만 실패했습니다.')
  }

  // 대규모 병렬 처리로 여러 시드 키워드의 연관검색어 조회 (안정성 우선)
  async getRelatedKeywordsBatch(seeds: string[], maxConcurrent: number = 2): Promise<Map<string, RelatedKeyword[]>> {
    console.log(`🚀 대규모 병렬 연관검색어 수집 시작: ${seeds.length}개 시드, 최대 ${maxConcurrent}개 동시 처리 (안정성 우선)`)
    
    const results = new Map<string, RelatedKeyword[]>()
    const chunks: string[][] = []
    
    // 시드를 청크로 나누기 (대규모 수집을 위해 작은 청크 크기)
    for (let i = 0; i < seeds.length; i += maxConcurrent) {
      chunks.push(seeds.slice(i, i + maxConcurrent))
    }

    let processedChunks = 0
    let totalProcessedKeywords = 0
    let totalSuccessSeeds = 0

    for (const chunk of chunks) {
      const promises = chunk.map(async (seed) => {
        try {
          const keywords = await this.getRelatedKeywordsWithRetry(seed)
          results.set(seed, keywords)
          return { seed, success: true, count: keywords.length }
        } catch (error) {
          console.error(`❌ 시드 "${seed}" 처리 실패:`, error)
          results.set(seed, [])
          return { seed, success: false, count: 0 }
        }
      })

      const chunkResults = await Promise.all(promises)
      const successCount = chunkResults.filter(r => r.success).length
      const totalKeywords = chunkResults.reduce((sum, r) => sum + r.count, 0)
      
      processedChunks++
      totalProcessedKeywords += totalKeywords
      totalSuccessSeeds += successCount
      
      console.log(`📊 청크 ${processedChunks}/${chunks.length} 완료: ${successCount}/${chunk.length}개 성공, 총 ${totalKeywords}개 키워드 수집`)
      console.log(`📈 누적 진행률: ${Math.round((processedChunks / chunks.length) * 100)}% (${totalSuccessSeeds}/${seeds.length} 시드 성공, ${totalProcessedKeywords}개 키워드)`)
      
      // 청크 간 안정성을 위한 대기 (API 부하 분산)
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        const waitTime = Math.min(1000, 200 * (processedChunks % 5)) // 점진적 대기
        console.log(`⏳ 안정성을 위한 대기: ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    console.log(`🎉 대규모 병렬 연관검색어 수집 완료: 총 ${totalProcessedKeywords}개 키워드 수집 (${totalSuccessSeeds}/${seeds.length} 시드 성공)`)
    
    return results
  }

  // API 키 상태 조회
  getApiKeyStatus() {
    return this.keyManager.getStatus()
  }
}

// 최적화된 네이버 오픈API 클라이언트
export class OptimizedNaverOpenApiClient {
  private keyManager: OptimizedApiKeyManager<OpenApiKey>
  private keys: OpenApiKey[] = []

  constructor() {
    this.loadApiKeys()
    this.keyManager = new OptimizedApiKeyManager(this.keys)
  }

  // 다중 오픈API 키 로드
  private loadApiKeys() {
    this.keys = [
      {
        name: '오픈API키1',
        clientId: 'YOUR_CLIENT_ID_1',
        clientSecret: 'YOUR_CLIENT_SECRET_1',
        dailyLimit: 25000,
        usedToday: 0,
        lastUsed: 0,
        isActive: true
      },
      {
        name: '오픈API키2',
        clientId: 'YOUR_CLIENT_ID_2',
        clientSecret: 'YOUR_CLIENT_SECRET_2',
        dailyLimit: 25000,
        usedToday: 0,
        lastUsed: 0,
        isActive: true
      }
    ]
    
    console.log(`🔑 최적화된 다중 오픈API 키 로드: ${this.keys.length}개 키 사용 가능`)
  }

  // 단일 키워드의 문서수 조회
  private async getDocCountsWithRetry(keyword: string): Promise<DocCounts> {
    const maxRetries = this.keys.length
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const apiKey = this.keyManager.getNextAvailableKey()
        if (!apiKey) {
          throw new Error('사용 가능한 오픈API 키가 없습니다.')
        }

        const encodedKeyword = encodeURIComponent(keyword)
        const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodedKeyword}&display=1&start=1`
        
        console.log(`📄 문서수 조회 시도 ${attempt + 1}/${maxRetries}: "${keyword}" (${apiKey.name})`)
        
        const response = await fetch(url, {
          headers: {
            'X-Naver-Client-Id': apiKey.clientId,
            'X-Naver-Client-Secret': apiKey.clientSecret
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ 오픈API 응답 에러 (${response.status}):`, errorText)
          
          if (response.status === 429) {
            console.log(`⏳ Rate Limit 감지, 다음 키로 시도...`)
            this.keyManager.updateUsage(apiKey.name, 1)
            lastError = new Error(`Rate Limit: ${response.status}`)
            continue
          }
          
          throw new Error(`오픈API 요청 실패: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        
        // 실제 구현에서는 각 API별로 문서수 조회
        const docCounts: DocCounts = {
          blog_total: data.total || 0,
          cafe_total: 0, // 카페 API 호출 필요
          web_total: 0,   // 웹 API 호출 필요
          news_total: 0   // 뉴스 API 호출 필요
        }

        console.log(`✅ 문서수 조회 완료: "${keyword}" - 블로그 ${docCounts.blog_total}개 (${apiKey.name})`)
        this.keyManager.updateUsage(apiKey.name, 1)
        return docCounts

      } catch (error: any) {
        console.error(`❌ 문서수 조회 에러 (시도 ${attempt + 1}):`, error)
        lastError = error
        
        if (error.message?.includes('Rate Limit') || error.message?.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error('모든 오픈API 키로 시도했지만 실패했습니다.')
  }

  // 병렬 처리로 여러 키워드의 문서수 조회
  async getDocCountsBatch(keywords: string[], maxConcurrent: number = 5): Promise<Map<string, DocCounts>> {
    console.log(`🚀 병렬 문서수 수집 시작: ${keywords.length}개 키워드, 최대 ${maxConcurrent}개 동시 처리`)
    
    const results = new Map<string, DocCounts>()
    const chunks: string[][] = []
    
    // 키워드를 청크로 나누기
    for (let i = 0; i < keywords.length; i += maxConcurrent) {
      chunks.push(keywords.slice(i, i + maxConcurrent))
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (keyword) => {
        try {
          const docCounts = await this.getDocCountsWithRetry(keyword)
          results.set(keyword, docCounts)
          return { keyword, success: true }
        } catch (error) {
          console.error(`❌ 키워드 "${keyword}" 문서수 조회 실패:`, error)
          results.set(keyword, { blog_total: 0, cafe_total: 0, web_total: 0, news_total: 0 })
          return { keyword, success: false }
        }
      })

      const chunkResults = await Promise.all(promises)
      const successCount = chunkResults.filter(r => r.success).length
      
      console.log(`📊 문서수 청크 완료: ${successCount}/${chunk.length}개 성공`)
      
      // 청크 간 짧은 대기
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`🎉 병렬 문서수 수집 완료: ${keywords.length}개 키워드 처리`)
    return results
  }

  // API 키 상태 조회
  getApiKeyStatus() {
    return this.keyManager.getStatus()
  }
}

// 싱글톤 인스턴스 생성
export const optimizedNaverAdsClient = new OptimizedNaverAdsClient()
export const optimizedNaverOpenApiClient = new OptimizedNaverOpenApiClient()

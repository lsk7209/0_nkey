// 배치 처리 및 레이트 리미팅 유틸리티

interface BatchProcessorOptions {
  batchSize: number
  delayMs: number
  maxRetries: number
  backoffMultiplier: number
}

interface BatchResult<T> {
  success: T[]
  errors: Array<{ item: any; error: string }>
  totalProcessed: number
  totalErrors: number
}

export class BatchProcessor {
  private options: BatchProcessorOptions

  constructor(options: Partial<BatchProcessorOptions> = {}) {
    this.options = {
      batchSize: 5, // 네이버 API 최대 5개 키워드
      delayMs: 1000, // 1초 지연
      maxRetries: 3,
      backoffMultiplier: 2,
      ...options
    }
  }

  // 배열을 배치 단위로 나누기
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  // 지수적 백오프 지연
  private async backoffDelay(attempt: number): Promise<void> {
    const delay = this.options.delayMs * Math.pow(this.options.backoffMultiplier, attempt - 1)
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  // 429 에러 감지
  private isRateLimitError(error: any): boolean {
    return error.message?.includes('429') || 
           error.message?.includes('호출 한도') ||
           error.message?.includes('Too Many Requests')
  }

  // 배치 처리 실행
  async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<BatchResult<R>> {
    const chunks = this.chunkArray(items, this.options.batchSize)
    const results: R[] = []
    const errors: Array<{ item: T[]; error: string }> = []
    let totalProcessed = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      let attempt = 1
      let success = false

      while (attempt <= this.options.maxRetries && !success) {
        try {
          const batchResults = await processor(chunk)
          results.push(...batchResults)
          success = true
          totalProcessed += chunk.length

          if (onProgress) {
            onProgress(totalProcessed, items.length)
          }

          // 다음 배치 전 지연
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, this.options.delayMs))
          }

        } catch (error) {
          console.error(`Batch ${i + 1} attempt ${attempt} failed:`, error)

          if (this.isRateLimitError(error)) {
            // 429 에러 시 더 긴 지연
            const rateLimitDelay = 5 * 60 * 1000 // 5분
            console.log(`Rate limit hit, waiting ${rateLimitDelay}ms...`)
            await new Promise(resolve => setTimeout(resolve, rateLimitDelay))
          } else {
            // 일반 에러 시 백오프 지연
            await this.backoffDelay(attempt)
          }

          attempt++

          if (attempt > this.options.maxRetries) {
            errors.push({
              item: chunk,
              error: error instanceof Error ? error.message : String(error)
            })
            console.error(`Batch ${i + 1} failed after ${this.options.maxRetries} attempts`)
          }
        }
      }
    }

    return {
      success: results,
      errors,
      totalProcessed,
      totalErrors: errors.length
    }
  }

  // 단일 아이템 처리 (재시도 포함)
  async processWithRetry<T>(
    item: T,
    processor: (item: T) => Promise<any>,
    context?: string
  ): Promise<any> {
    let attempt = 1
    let lastError: any

    while (attempt <= this.options.maxRetries) {
      try {
        return await processor(item)
      } catch (error) {
        lastError = error
        console.error(`${context || 'Process'} attempt ${attempt} failed:`, error)

        if (this.isRateLimitError(error)) {
          // 429 에러 시 5분 대기
          const rateLimitDelay = 5 * 60 * 1000
          console.log(`Rate limit hit, waiting ${rateLimitDelay}ms...`)
          await new Promise(resolve => setTimeout(resolve, rateLimitDelay))
        } else {
          // 일반 에러 시 백오프 지연
          await this.backoffDelay(attempt)
        }

        attempt++
      }
    }

    throw new Error(`Failed after ${this.options.maxRetries} attempts: ${lastError?.message}`)
  }
}

// 네이버 API 전용 배치 프로세서
export class NaverApiBatchProcessor extends BatchProcessor {
  constructor() {
    super({
      batchSize: 5, // 네이버 API 최대 5개
      delayMs: 2000, // 2초 지연 (RelKwdStat는 속도 제한이 엄격)
      maxRetries: 3,
      backoffMultiplier: 3 // 더 긴 백오프
    })
  }

  // 네이버 API 호출을 위한 특별한 처리
  async processNaverApiBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<BatchResult<R>> {
    console.log(`Processing ${items.length} items in batches of ${this.options.batchSize}`)
    
    const result = await this.processBatches(items, processor, onProgress)
    
    console.log(`Batch processing completed: ${result.totalProcessed} processed, ${result.totalErrors} errors`)
    
    return result
  }
}

// 전역 배치 프로세서 인스턴스
export const naverBatchProcessor = new NaverApiBatchProcessor()

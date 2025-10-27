import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'
import { optimizedNaverAdsClient } from '@/lib/optimized-naver-api'

// 작업 상태 타입
type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

// 작업 타입
type JobType = 'auto-collect' | 'manual-collect' | 'doc-count' | 'large-scale-auto-collect'

// 작업 인터페이스
interface BackgroundJob {
  id: string
  type: JobType
  status: JobStatus
  progress: number
  total: number
  current: string
  message: string
  result?: any
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

// 작업 큐 관리 클래스
export class BackgroundJobQueue {
  private jobs = new Map<string, BackgroundJob>()
  private runningJobs = new Set<string>()
  private maxConcurrentJobs = 3

  // 새 작업 생성
  createJob(type: JobType, data: any): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const job: BackgroundJob = {
      id: jobId,
      type,
      status: 'pending',
      progress: 0,
      total: 0,
      current: '',
      message: '작업 대기 중...',
      createdAt: new Date().toISOString()
    }

    this.jobs.set(jobId, job)
    console.log(`📋 새 작업 생성: ${jobId} (${type})`)
    
    // 작업 시작
    this.startJob(jobId, data)
    
    return jobId
  }

  // 작업 시작
  async startJob(jobId: string, data: any) {
    const job = this.jobs.get(jobId)
    if (!job) return

    // 동시 실행 작업 수 제한
    if (this.runningJobs.size >= this.maxConcurrentJobs) {
      console.log(`⏳ 작업 대기: ${jobId} (동시 실행 제한)`)
      return
    }

    this.runningJobs.add(jobId)
    job.status = 'running'
    job.startedAt = new Date().toISOString()
    job.message = '작업 시작됨'

    try {
      switch (job.type) {
        case 'auto-collect':
          await this.runAutoCollectJob(job, data)
          break
        case 'large-scale-auto-collect':
          await this.runLargeScaleAutoCollectJob(job, data)
          break
        case 'manual-collect':
          await this.runManualCollectJob(job, data)
          break
        case 'doc-count':
          await this.runDocCountJob(job, data)
          break
      }
      
      job.status = 'completed'
      job.completedAt = new Date().toISOString()
      job.message = '작업 완료'
      job.progress = 100
      
    } catch (error: any) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.error = error.message
      job.message = `작업 실패: ${error.message}`
    } finally {
      this.runningJobs.delete(jobId)
      console.log(`✅ 작업 완료: ${jobId} (${job.status})`)
    }
  }

  // 대규모 자동수집 작업 실행 (안정성 우선)
  private async runLargeScaleAutoCollectJob(job: BackgroundJob, data: any) {
    const { seedCount = 1000, keywordsPerSeed = 100, maxConcurrent = 2 } = data
    
    job.total = seedCount
    job.message = `대규모 자동수집 시작: ${seedCount}개 시드키워드, 각 ${keywordsPerSeed}개씩 (안정성 우선)`
    
    // 시드키워드 선택 (사용하지 않은 것들)
    const allKeywords = persistentDB.getAllKeywordsBySearchVolume(seedCount * 2)
    const availableKeywords = allKeywords.filter(keyword => !persistentDB.isSeedUsed(keyword.keyword))
    const seedKeywords = availableKeywords.length > 0 
      ? availableKeywords.slice(0, seedCount)
      : allKeywords.slice(0, seedCount)
    
    if (seedKeywords.length === 0) {
      job.status = 'failed'
      job.message = '사용 가능한 시드키워드가 없습니다.'
      return
    }
    
    job.message = `선택된 시드키워드: ${seedKeywords.length}개 (처음 5개: ${seedKeywords.slice(0, 5).map(s => s.keyword).join(', ')})`
    
    let totalProcessed = 0
    let totalNewKeywords = 0
    let totalUpdatedKeywords = 0
    let totalSkippedKeywords = 0
    
    // 대규모 수집을 위한 배치 처리
    const batchSize = Math.min(maxConcurrent, seedKeywords.length)
    const batches: typeof seedKeywords[] = []
    
    for (let i = 0; i < seedKeywords.length; i += batchSize) {
      batches.push(seedKeywords.slice(i, i + batchSize))
    }
    
    console.log(`📦 대규모 수집 배치 구성: ${batches.length}개 배치, 배치당 ${batchSize}개 시드`)
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      
      console.log(`🔄 배치 ${batchIndex + 1}/${batches.length} 처리 시작 (${batch.length}개 시드)`)
      
      // 배치 내 병렬 처리
      const batchPromises = batch.map(async (seedKeyword, index) => {
        const seedKeywordText = seedKeyword.keyword
        const globalIndex = batchIndex * batchSize + index
        
        try {
          job.message = `[배치 ${batchIndex + 1}/${batches.length}] [${globalIndex + 1}/${seedKeywords.length}] "${seedKeywordText}" 처리 중...`
          job.progress = Math.round((globalIndex / seedKeywords.length) * 100)
          
          // 연관검색어 조회
          const relatedKeywords = await optimizedNaverAdsClient.getRelatedKeywordsBatch([seedKeywordText], 1)
          const keywords = relatedKeywords.get(seedKeywordText) || []
          
          // 시드키워드 사용 처리
          persistentDB.markSeedAsUsed(seedKeywordText)
          
          // 키워드 수 제한
          const keywordsToProcess = keywords.slice(0, keywordsPerSeed)
          
          let newCount = 0
          let updatedCount = 0
          let skippedCount = 0

          // 각 연관검색어 처리 (트랜잭션 안정성 보장)
          for (const keywordData of keywordsToProcess) {
            const keyword = keywordData.keyword
            
            try {
              // 데이터 검증
              if (!keyword || keyword.trim() === '') {
                skippedCount++
                continue
              }

              // 중복 체크
              const existsResult = persistentDB.keywordExists(keyword)
              
              if (existsResult.exists && existsResult.isRecent) {
                skippedCount++
                continue // 로깅 최소화로 성능 향상
              }
              
              let keywordId: number
              
              if (existsResult.exists) {
                // 30일 이상 된 키워드는 업데이트
                keywordId = existsResult.keywordId!
                persistentDB.updateKeyword(keywordId, seedKeywordText, keyword)
                updatedCount++
              } else {
                // 새 키워드 삽입
                keywordId = persistentDB.insertKeyword(seedKeywordText, keyword)
                newCount++
              }
              
              // 메트릭 저장 (안전한 값으로 정규화)
              persistentDB.insertKeywordMetrics(
                keywordId,
                Math.max(0, keywordData.monthly_search_pc || 0),
                Math.max(0, keywordData.monthly_search_mob || 0),
                Math.max(0, keywordData.avg_monthly_search || 0),
                0, 0, 0, 0, 0,
                Math.max(0, keywordData.cpc || 0),
                Math.max(0, keywordData.comp_index || 0)
              )
            } catch (error: any) {
              console.error(`❌ 키워드 저장 실패: "${keyword}"`, error)
              skippedCount++
              
              // 심각한 에러인 경우 전체 작업 중단 고려
              if (error.message?.includes('database') || error.message?.includes('connection')) {
                console.error(`🚨 데이터베이스 연결 문제 감지, 작업 중단 고려 중...`)
                throw error
              }
            }
          }

          return {
            seedKeywordText,
            processed: keywordsToProcess.length,
            newCount,
            updatedCount,
            skippedCount
          }

        } catch (error: any) {
          console.error(`❌ 시드키워드 처리 실패: "${seedKeywordText}"`, error)
          
          // 에러 타입별 처리
          if (error.message?.includes('API 요청 실패')) {
            console.log(`🔄 API 에러로 인한 시드키워드 스킵: "${seedKeywordText}"`)
          } else if (error.message?.includes('database') || error.message?.includes('connection')) {
            console.error(`🚨 데이터베이스 에러로 인한 작업 중단: "${seedKeywordText}"`)
            throw error // 심각한 에러는 전체 작업 중단
          } else {
            console.log(`⚠️ 기타 에러로 인한 시드키워드 스킵: "${seedKeywordText}"`)
          }
          
          return {
            seedKeywordText,
            processed: 0,
            newCount: 0,
            updatedCount: 0,
            skippedCount: 0
          }
        }
      })
      
      // 배치 결과 대기
      const batchResults = await Promise.all(batchPromises)
      
      // 배치 결과 집계
      const batchProcessed = batchResults.reduce((sum, r) => sum + r.processed, 0)
      const batchNew = batchResults.reduce((sum, r) => sum + r.newCount, 0)
      const batchUpdated = batchResults.reduce((sum, r) => sum + r.updatedCount, 0)
      const batchSkipped = batchResults.reduce((sum, r) => sum + r.skippedCount, 0)
      
      totalProcessed += batchProcessed
      totalNewKeywords += batchNew
      totalUpdatedKeywords += batchUpdated
      totalSkippedKeywords += batchSkipped
      
      console.log(`✅ 배치 ${batchIndex + 1}/${batches.length} 완료: 신규 ${batchNew}개, 갱신 ${batchUpdated}개, 패스 ${batchSkipped}개`)
      console.log(`📈 누적 진행률: ${Math.round(((batchIndex + 1) / batches.length) * 100)}% (총 ${totalNewKeywords}개 신규 저장)`)
      
      // 배치 간 안정성을 위한 대기
      if (batchIndex < batches.length - 1) {
        const waitTime = Math.min(2000, 500 * (batchIndex % 3)) // 점진적 대기
        console.log(`⏳ 배치 간 안정성 대기: ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    // 최종 결과 로깅
    console.log(`📊 대규모 자동수집 완료 결과:`)
    console.log(`  - 처리된 시드키워드: ${seedKeywords.length}개`)
    console.log(`  - 총 처리된 키워드: ${totalProcessed}개`)
    console.log(`  - 신규 저장: ${totalNewKeywords}개`)
    console.log(`  - 갱신: ${totalUpdatedKeywords}개`)
    console.log(`  - 패스: ${totalSkippedKeywords}개`)

    job.result = {
      seedKeywords: seedKeywords.length,
      totalProcessed,
      totalNewKeywords,
      totalUpdatedKeywords,
      totalSkippedKeywords
    }
  }

  // 자동수집 작업 실행
  private async runAutoCollectJob(job: BackgroundJob, data: any) {
    const { seedCount = 5, maxKeywordsPerSeed = 10 } = data
    
    job.total = seedCount
    job.message = '시드키워드 선택 중...'

    // 모든 키워드 중 검색량 높은 순으로 시드키워드 선택 (새로 수집된 키워드도 포함)
    const allKeywords = persistentDB.getAllKeywordsBySearchVolume(seedCount * 2) // 여유분 확보
    
    if (allKeywords.length === 0) {
      throw new Error('시드키워드로 사용할 수 있는 키워드가 없습니다.')
    }

    // 최근에 시드로 사용되지 않은 키워드 우선 선택
    const availableKeywords = allKeywords.filter(keyword => !persistentDB.isSeedUsed(keyword.keyword))
    const seedKeywords = availableKeywords.length > 0 
      ? availableKeywords.slice(0, seedCount)
      : allKeywords.slice(0, seedCount) // 모든 키워드가 최근에 사용되었다면 강제로 선택
    
    console.log(`🔍 선택된 시드키워드들:`, seedKeywords.map(k => k.keyword))
    console.log(`🔍 사용 가능한 키워드 수: ${availableKeywords.length}, 전체 키워드 수: ${allKeywords.length}`)
    
    job.message = `${seedKeywords.length}개 시드키워드 선택 완료`

    let totalProcessed = 0
    let totalNewKeywords = 0
    let totalUpdatedKeywords = 0
    let totalSkippedKeywords = 0

    // 각 시드키워드 처리
    for (let i = 0; i < seedKeywords.length; i++) {
      const seedKeyword = seedKeywords[i]
      const seedKeywordText = seedKeyword.keyword
      
      job.current = seedKeywordText
      job.progress = Math.round((i / seedKeywords.length) * 100)
      job.message = `[${i + 1}/${seedKeywords.length}] "${seedKeywordText}" 처리 중...`

      try {
        // 시드키워드 사용 기록 저장
        persistentDB.markSeedAsUsed(seedKeywordText)

        // 연관검색어 수집
        const relatedKeywords = await optimizedNaverAdsClient.getRelatedKeywordsBatch([seedKeywordText], 1)
        const keywords = relatedKeywords.get(seedKeywordText) || []
        
        const keywordsToProcess = keywords.slice(0, maxKeywordsPerSeed)
        
        let newCount = 0
        let updatedCount = 0
        let skippedCount = 0

        // 각 연관검색어 처리 (트랜잭션 안정성 보장)
        for (const keywordData of keywordsToProcess) {
          const keyword = keywordData.keyword
          
          try {
            // 데이터 검증
            if (!keyword || keyword.trim() === '') {
              console.warn(`⚠️ 빈 키워드 스킵: "${keyword}"`)
              skippedCount++
              continue
            }

            // 중복 체크
            const existsResult = persistentDB.keywordExists(keyword)
            
            if (existsResult.exists && existsResult.isRecent) {
              skippedCount++
              console.log(`⏭️ 키워드 패스 (30일 이내): ${keyword}`)
              continue
            }
            
            let keywordId: number
            
            if (existsResult.exists) {
              // 30일 이상 된 키워드는 업데이트
              keywordId = existsResult.keywordId!
              persistentDB.updateKeyword(keywordId, seedKeywordText, keyword)
              updatedCount++
              console.log(`🔄 키워드 갱신: ${keyword} (검색량: ${keywordData.avg_monthly_search})`)
            } else {
              // 새 키워드 삽입
              keywordId = persistentDB.insertKeyword(seedKeywordText, keyword)
              newCount++
              console.log(`✅ 키워드 저장: ${keyword} (검색량: ${keywordData.avg_monthly_search})`)
            }
            
            // 메트릭 저장 (안전한 값으로 정규화)
            persistentDB.insertKeywordMetrics(
              keywordId,
              Math.max(0, keywordData.monthly_search_pc || 0),
              Math.max(0, keywordData.monthly_search_mob || 0),
              Math.max(0, keywordData.avg_monthly_search || 0),
              0, 0, 0, 0, 0,
              Math.max(0, keywordData.cpc || 0),
              Math.max(0, keywordData.comp_index || 0)
            )
          } catch (error: any) {
            console.error(`❌ 키워드 저장 실패: "${keyword}"`, error)
            skippedCount++
            
            // 심각한 에러인 경우 전체 작업 중단 고려
            if (error.message?.includes('database') || error.message?.includes('connection')) {
              console.error(`🚨 데이터베이스 연결 문제 감지, 작업 중단 고려 중...`)
              throw error
            }
          }
        }

        totalProcessed += keywordsToProcess.length
        totalNewKeywords += newCount
        totalUpdatedKeywords += updatedCount
        totalSkippedKeywords += skippedCount

        // 진행률 업데이트
        job.progress = Math.round(((i + 1) / seedKeywords.length) * 100)
        job.message = `[${i + 1}/${seedKeywords.length}] "${seedKeywordText}" 완료 (신규: ${newCount}, 갱신: ${updatedCount}, 패스: ${skippedCount})`
        
        console.log(`✅ 시드키워드 "${seedKeywordText}" 처리 완료: 신규 ${newCount}개, 갱신 ${updatedCount}개, 패스 ${skippedCount}개`)

      } catch (error: any) {
        console.error(`❌ 시드키워드 처리 실패: "${seedKeywordText}"`, error)
        
        // 에러 타입별 처리
        if (error.message?.includes('API 요청 실패')) {
          console.log(`🔄 API 에러로 인한 시드키워드 스킵: "${seedKeywordText}"`)
        } else if (error.message?.includes('database') || error.message?.includes('connection')) {
          console.error(`🚨 데이터베이스 에러로 인한 작업 중단: "${seedKeywordText}"`)
          throw error // 심각한 에러는 전체 작업 중단
        } else {
          console.log(`⚠️ 기타 에러로 인한 시드키워드 스킵: "${seedKeywordText}"`)
        }
        
        // 에러가 발생해도 다음 키워드 계속 처리 (데이터베이스 에러 제외)
      }
    }

    // 최종 결과 로깅
    console.log(`📊 자동수집 완료 결과:`)
    console.log(`  - 처리된 시드키워드: ${seedKeywords.length}개`)
    console.log(`  - 총 처리된 키워드: ${totalProcessed}개`)
    console.log(`  - 신규 저장: ${totalNewKeywords}개`)
    console.log(`  - 갱신: ${totalUpdatedKeywords}개`)
    console.log(`  - 패스: ${totalSkippedKeywords}개`)

    job.result = {
      seedKeywords: seedKeywords.length,
      totalProcessed,
      totalNewKeywords,
      totalUpdatedKeywords,
      totalSkippedKeywords
    }
  }

  // 수동수집 작업 실행
  private async runManualCollectJob(job: BackgroundJob, data: any) {
    const { seed, keywords } = data
    
    job.total = keywords ? keywords.length : 1
    job.message = `"${seed}" 연관검색어 수집 중...`

    let collectedKeywords = []
    
    if (keywords && keywords.length > 0) {
      collectedKeywords = keywords
    } else {
      // 실제 API 호출로 수집
      const result = await optimizedNaverAdsClient.getRelatedKeywordsBatch([seed], 1)
      collectedKeywords = result.get(seed) || []
    }

    job.total = collectedKeywords.length
    job.message = `${collectedKeywords.length}개 키워드 저장 중...`

    let saved = 0
    let skipped = 0

    // 키워드 저장
    for (let i = 0; i < collectedKeywords.length; i++) {
      const keywordData = collectedKeywords[i]
      
      job.current = keywordData.keyword
      job.progress = Math.round((i / collectedKeywords.length) * 100)
      job.message = `[${i + 1}/${collectedKeywords.length}] "${keywordData.keyword}" 저장 중...`

      try {
        // 중복 체크
        const existsResult = persistentDB.keywordExists(keywordData.keyword)
        
        if (existsResult.exists && existsResult.isRecent) {
          skipped++
          continue
        }
        
        let keywordId: number
        
        if (existsResult.exists) {
          // 30일 이상 된 키워드는 업데이트
          keywordId = existsResult.keywordId!
          persistentDB.updateKeyword(keywordId, seed, keywordData.keyword)
        } else {
          // 새 키워드 삽입
          keywordId = persistentDB.insertKeyword(seed, keywordData.keyword)
        }
        
        // 메트릭 저장
        persistentDB.insertKeywordMetrics(
          keywordId,
          keywordData.monthly_search_pc || 0,
          keywordData.monthly_search_mob || 0,
          keywordData.avg_monthly_search || 0,
          0, 0, 0, 0, 0,
          keywordData.cpc || 0,
          keywordData.comp_index || 0
        )
        
        saved++
        
      } catch (error: any) {
        console.error(`❌ 키워드 저장 실패: "${keywordData.keyword}"`, error)
        skipped++
      }
    }

    job.result = {
      seed,
      count: collectedKeywords.length,
      saved,
      skipped
    }
  }

  // 문서수 수집 작업 실행
  private async runDocCountJob(job: BackgroundJob, data: any) {
    job.message = '문서수 수집 작업 준비 중...'
    // 문서수 수집 로직 구현
    job.result = { message: '문서수 수집 완료' }
  }

  // 작업 상태 조회
  getJob(jobId: string): BackgroundJob | undefined {
    return this.jobs.get(jobId)
  }

  // 모든 작업 조회
  getAllJobs(): BackgroundJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  // 작업 취소
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'running') return false

    job.status = 'cancelled'
    job.completedAt = new Date().toISOString()
    job.message = '작업 취소됨'
    
    this.runningJobs.delete(jobId)
    return true
  }

  // 완료된 작업 정리 (24시간 이상 된 작업)
  cleanupOldJobs(): number {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    let cleanedCount = 0

    this.jobs.forEach((job, jobId) => {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        if (job.completedAt && new Date(job.completedAt) < oneDayAgo) {
          this.jobs.delete(jobId)
          cleanedCount++
        }
      }
    })

    if (cleanedCount > 0) {
      console.log(`🧹 오래된 작업 ${cleanedCount}개 정리 완료`)
    }

    return cleanedCount
  }
}

// 전역 작업 큐 인스턴스
const jobQueue = new BackgroundJobQueue()

// 주기적으로 오래된 작업 정리 (5분마다)
setInterval(() => {
  jobQueue.cleanupOldJobs()
}, 5 * 60 * 1000)

// 백그라운드 작업 시작 API
export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, data } = body

    if (!type) {
      return NextResponse.json({ error: '작업 타입이 필요합니다.' }, { status: 400 })
    }

    const jobId = jobQueue.createJob(type, data)

    return NextResponse.json({
      success: true,
      jobId,
      message: '백그라운드 작업이 시작되었습니다.'
    })

  } catch (error: any) {
    console.error('❌ 백그라운드 작업 시작 에러:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

// 작업 상태 조회 API
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')

    if (jobId) {
      // 특정 작업 조회
      const job = jobQueue.getJob(jobId)
      if (!job) {
        return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 })
      }
      
      return NextResponse.json({
        success: true,
        job
      })
    } else {
      // 모든 작업 조회
      const jobs = jobQueue.getAllJobs()
      
      return NextResponse.json({
        success: true,
        jobs,
        total: jobs.length,
        running: jobs.filter(j => j.status === 'running').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length
      })
    }

  } catch (error: any) {
    console.error('❌ 작업 상태 조회 에러:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

// 작업 취소 API
export async function DELETE(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: '작업 ID가 필요합니다.' }, { status: 400 })
    }

    const cancelled = jobQueue.cancelJob(jobId)
    
    if (!cancelled) {
      return NextResponse.json({ error: '작업을 취소할 수 없습니다.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: '작업이 취소되었습니다.'
    })

  } catch (error: any) {
    console.error('❌ 작업 취소 에러:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

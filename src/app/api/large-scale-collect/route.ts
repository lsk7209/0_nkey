import { NextRequest, NextResponse } from 'next/server'
import { BackgroundJobQueue } from '../background-jobs/route'

const jobQueue = new BackgroundJobQueue()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      seedCount = 1000, 
      keywordsPerSeed = 100, 
      maxConcurrent = 2,
      description = '대규모 자동수집'
    } = body

    // 대규모 수집 파라미터 검증
    if (seedCount > 10000) {
      return NextResponse.json(
        { error: '시드키워드 수는 10,000개를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    if (keywordsPerSeed > 1000) {
      return NextResponse.json(
        { error: '시드당 키워드 수는 1,000개를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    if (maxConcurrent > 5) {
      return NextResponse.json(
        { error: '최대 동시 처리 수는 5개를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    console.log(`🚀 대규모 자동수집 요청: ${seedCount}개 시드, 각 ${keywordsPerSeed}개씩, 최대 ${maxConcurrent}개 동시 처리`)

    // 대규모 수집 작업 생성
    const job = jobQueue.createJob('large-scale-auto-collect', {
      seedCount,
      keywordsPerSeed,
      maxConcurrent,
      description
    })

    // 작업 시작
    jobQueue.startJob(job.id, {
      seedCount,
      keywordsPerSeed,
      maxConcurrent
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `대규모 자동수집 작업이 시작되었습니다. (${seedCount}개 시드, 각 ${keywordsPerSeed}개씩)`,
      estimatedDuration: `${Math.ceil(seedCount / maxConcurrent) * 2}분 예상`,
      estimatedKeywords: `${seedCount * keywordsPerSeed}개 키워드 예상`
    })

  } catch (error: any) {
    console.error('❌ 대규모 자동수집 시작 실패:', error)
    return NextResponse.json(
      { error: '대규모 자동수집 시작에 실패했습니다.', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const jobs = jobQueue.getAllJobs()
    const largeScaleJobs = jobs.filter(job => job.type === 'large-scale-auto-collect')
    
    return NextResponse.json({
      success: true,
      jobs: largeScaleJobs,
      totalJobs: largeScaleJobs.length,
      runningJobs: largeScaleJobs.filter(job => job.status === 'running').length,
      completedJobs: largeScaleJobs.filter(job => job.status === 'completed').length,
      failedJobs: largeScaleJobs.filter(job => job.status === 'failed').length
    })

  } catch (error: any) {
    console.error('❌ 대규모 수집 작업 조회 실패:', error)
    return NextResponse.json(
      { error: '작업 조회에 실패했습니다.', details: error.message },
      { status: 500 }
    )
  }
}

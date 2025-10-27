'use client'

import { useState, useEffect } from 'react'

interface LargeScaleJob {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  message: string
  total: number
  current: number
  startedAt: string
  completedAt?: string
  result?: {
    seedKeywords: number
    totalProcessed: number
    totalNewKeywords: number
    totalUpdatedKeywords: number
    totalSkippedKeywords: number
  }
}

export default function LargeScaleCollectPage() {
  const [jobs, setJobs] = useState<LargeScaleJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    seedCount: 1000,
    keywordsPerSeed: 100,
    maxConcurrent: 2
  })

  // 작업 목록 조회
  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/large-scale-collect')
      const data = await response.json()
      if (data.success) {
        setJobs(data.jobs)
      }
    } catch (error) {
      console.error('작업 조회 실패:', error)
    }
  }

  // 대규모 수집 시작
  const startLargeScaleCollect = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/large-scale-collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      if (data.success) {
        alert(`대규모 수집이 시작되었습니다!\n예상 시간: ${data.estimatedDuration}\n예상 키워드: ${data.estimatedKeywords}`)
        fetchJobs()
      } else {
        alert(`수집 시작 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('수집 시작 실패:', error)
      alert('수집 시작에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600'
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'cancelled': return 'text-gray-600'
      default: return 'text-yellow-600'
    }
  }

  // 상태명
  const getStatusName = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'running': return '실행중'
      case 'completed': return '완료'
      case 'failed': return '실패'
      case 'cancelled': return '취소됨'
      default: return status
    }
  }

  // 시간 포맷
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('ko-KR')
  }

  // 진행률 계산
  const getProgressPercentage = (job: LargeScaleJob) => {
    if (job.status === 'completed') return 100
    if (job.status === 'failed' || job.status === 'cancelled') return 0
    return job.progress || 0
  }

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000) // 5초마다 업데이트
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">🚀 대규모 자동수집</h1>
      
      {/* 수집 설정 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">수집 설정</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">시드키워드 수</label>
            <input
              type="number"
              min="1"
              max="10000"
              value={formData.seedCount}
              onChange={(e) => setFormData({...formData, seedCount: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">최대 10,000개</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">시드당 키워드 수</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={formData.keywordsPerSeed}
              onChange={(e) => setFormData({...formData, keywordsPerSeed: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">최대 1,000개</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">최대 동시 처리</label>
            <input
              type="number"
              min="1"
              max="5"
              value={formData.maxConcurrent}
              onChange={(e) => setFormData({...formData, maxConcurrent: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">최대 5개 (안정성 우선)</p>
          </div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-md mb-4">
          <h3 className="font-semibold text-blue-800 mb-2">📊 예상 결과</h3>
          <p className="text-blue-700">
            • 총 키워드 수: <strong>{formData.seedCount * formData.keywordsPerSeed}개</strong><br/>
            • 예상 소요 시간: <strong>{Math.ceil(formData.seedCount / formData.maxConcurrent) * 2}분</strong><br/>
            • 처리 방식: <strong>안정성 우선 배치 처리</strong>
          </p>
        </div>
        
        <button
          onClick={startLargeScaleCollect}
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? '시작 중...' : '🚀 대규모 수집 시작'}
        </button>
      </div>

      {/* 작업 목록 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">수집 작업 목록</h2>
        
        {jobs.length === 0 ? (
          <p className="text-gray-500">수행된 대규모 수집 작업이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">작업 ID: {job.id}</h3>
                    <p className="text-sm text-gray-600">{job.message}</p>
                  </div>
                  <span className={`font-semibold ${getStatusColor(job.status)}`}>
                    {getStatusName(job.status)}
                  </span>
                </div>
                
                {job.status === 'running' && (
                  <div className="mb-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>진행률</span>
                      <span>{getProgressPercentage(job)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPercentage(job)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-gray-600">
                  <p>시작 시간: {formatTime(job.startedAt)}</p>
                  {job.completedAt && (
                    <p>완료 시간: {formatTime(job.completedAt)}</p>
                  )}
                </div>
                
                {job.result && (
                  <div className="mt-3 p-3 bg-green-50 rounded-md">
                    <h4 className="font-semibold text-green-800 mb-2">📊 수집 결과</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">{job.result.seedKeywords}</div>
                        <div className="text-gray-600">시드키워드</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-600">{job.result.totalNewKeywords}</div>
                        <div className="text-gray-600">신규 저장</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-yellow-600">{job.result.totalUpdatedKeywords}</div>
                        <div className="text-gray-600">갱신</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-600">{job.result.totalSkippedKeywords}</div>
                        <div className="text-gray-600">패스</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-purple-600">{job.result.totalProcessed}</div>
                        <div className="text-gray-600">총 처리</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

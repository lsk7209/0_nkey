'use client'

import { useState, useEffect } from 'react'

interface BackgroundJob {
  id: string
  type: 'auto-collect' | 'manual-collect' | 'doc-count'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
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

interface JobStatusResponse {
  success: boolean
  jobs?: BackgroundJob[]
  job?: BackgroundJob
  total?: number
  running?: number
  completed?: number
  failed?: number
  error?: string
}

export default function BackgroundJobsPage() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0
  })

  // 작업 상태 조회
  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/background-jobs', {
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })
      
      const data: JobStatusResponse = await response.json()
      
      if (data.success) {
        setJobs(data.jobs || [])
        setStats({
          total: data.total || 0,
          running: data.running || 0,
          completed: data.completed || 0,
          failed: data.failed || 0
        })
        setError(null)
      } else {
        setError(data.error || '작업 상태 조회 실패')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 작업 취소
  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/background-jobs?jobId=${jobId}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchJobs() // 상태 새로고침
      } else {
        alert(data.error || '작업 취소 실패')
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  // 자동수집 시작
  const startAutoCollect = async () => {
    try {
      const response = await fetch('/api/auto-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({
          seedCount: 5,
          maxKeywordsPerSeed: 10
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // 팝업 없이 바로 상태 새로고침
        await fetchJobs()
      } else {
        alert(data.error || '자동수집 시작 실패')
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  // 수동수집 시작
  const startManualCollect = async () => {
    const seed = prompt('시드키워드를 입력하세요:')
    if (!seed) return

    try {
      const response = await fetch('/api/collect/related-optimized', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({ seed })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // 팝업 없이 바로 상태 새로고침
        await fetchJobs()
      } else {
        alert(data.error || '수동수집 시작 실패')
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  // 상태별 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'running': return 'text-blue-600 bg-blue-100'
      case 'completed': return 'text-green-600 bg-green-100'
      case 'failed': return 'text-red-600 bg-red-100'
      case 'cancelled': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  // 타입별 한글명 반환
  const getTypeName = (type: string) => {
    switch (type) {
      case 'auto-collect': return '자동수집'
      case 'manual-collect': return '수동수집'
      case 'doc-count': return '문서수수집'
      default: return type
    }
  }

  // 상태별 한글명 반환
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

  // 시간 포맷팅
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('ko-KR')
  }

  // 진행률 계산
  const getProgressPercentage = (job: BackgroundJob) => {
    if (job.total === 0) return 0
    return Math.round((job.progress / job.total) * 100)
  }

  useEffect(() => {
    fetchJobs()
    
    // 5초마다 상태 새로고침
    const interval = setInterval(fetchJobs, 5000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">작업 상태를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">백그라운드 작업 모니터</h1>
          <p className="mt-2 text-gray-600">실시간 작업 상태 및 진행률을 확인할 수 있습니다.</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">{stats.total}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">전체 작업</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">{stats.running}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">실행중</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.running}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-semibold">{stats.completed}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">완료</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-semibold">{stats.failed}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">실패</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="mb-8 flex space-x-4">
          <button
            onClick={startAutoCollect}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            자동수집 시작
          </button>
          <button
            onClick={startManualCollect}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            수동수집 시작
          </button>
          <button
            onClick={fetchJobs}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            새로고침
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 작업 목록 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">작업 목록</h2>
          </div>
          
          {jobs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">작업이 없습니다</h3>
              <p className="mt-1 text-sm text-gray-500">새로운 작업을 시작해보세요.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <div key={job.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                          {getStatusName(job.status)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {getTypeName(job.type)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {job.id}
                        </span>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm text-gray-900">{job.message}</p>
                        {job.current && (
                          <p className="text-sm text-gray-600">현재 처리: {job.current}</p>
                        )}
                      </div>

                      {/* 진행률 바 */}
                      {job.status === 'running' && job.total > 0 && (
                        <div className="mt-3">
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

                      {/* 결과 표시 */}
                      {job.result && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">결과:</h4>
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                            {JSON.stringify(job.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* 에러 표시 */}
                      {job.error && (
                        <div className="mt-3 p-3 bg-red-50 rounded-lg">
                          <h4 className="text-sm font-medium text-red-900 mb-1">에러:</h4>
                          <p className="text-sm text-red-700">{job.error}</p>
                        </div>
                      )}

                      <div className="mt-3 text-xs text-gray-500">
                        <span>생성: {formatTime(job.createdAt)}</span>
                        {job.startedAt && (
                          <span className="ml-4">시작: {formatTime(job.startedAt)}</span>
                        )}
                        {job.completedAt && (
                          <span className="ml-4">완료: {formatTime(job.completedAt)}</span>
                        )}
                      </div>
                    </div>

                    {/* 취소 버튼 */}
                    {job.status === 'running' && (
                      <div className="ml-4">
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          취소
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

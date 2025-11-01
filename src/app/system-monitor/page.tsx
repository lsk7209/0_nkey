'use client'

import { useState, useEffect } from 'react'

interface SystemStatus {
  api_stats: Array<{
    api_type: string
    total_calls: number
    success_calls: number
    avg_response_time: number
    max_response_time: number
    min_response_time: number
  }>
  db_stats: {
    total_keywords: number
    keywords_last_hour: number
    avg_search_volume: number
  }
  recent_metrics: Array<{
    metric_type: string
    metric_name: string
    metric_value: number
    created_at: string
  }>
  rate_limit_status: {
    overall_health: string
    recommendations: string[]
    api_key_performance: Record<string, {
      success_rate: number
      avg_response_time: number
      health: string
    }>
  }
}

export default function SystemMonitorPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'status' | 'metrics' | 'api-stats' | 'optimize' | 'cleanup'>('status')

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/functions/system-monitor?action=status', {
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStatus(data.data)
        }
      }
    } catch (error) {
      console.error('시스템 상태 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const runOptimization = async () => {
    setLoading(true)
    try {
      const response = await fetch('/functions/system-monitor?action=optimize', {
        method: 'POST',
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          alert('시스템 최적화가 완료되었습니다!')
          fetchStatus() // 상태 새로고침
        }
      }
    } catch (error) {
      console.error('시스템 최적화 실패:', error)
      alert('시스템 최적화 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // 30초마다 자동 갱신
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600 bg-green-100'
      case 'good': return 'text-blue-600 bg-blue-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getOverallHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">시스템 모니터링</h1>
          <p className="text-gray-600">API 성능, 데이터베이스 상태, 시스템 최적화 모니터링</p>
        </div>

        {/* 탭 메뉴 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'status', label: '시스템 상태' },
                { id: 'metrics', label: '성능 메트릭스' },
                { id: 'api-stats', label: 'API 통계' },
                { id: 'cleanup', label: '중복 정리' },
                { id: 'optimize', label: '최적화' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">데이터 로딩 중...</p>
          </div>
        )}

        {/* 시스템 상태 탭 */}
        {activeTab === 'status' && status && !loading && (
          <div className="space-y-6">
            {/* 전체 건강 상태 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">전체 시스템 건강 상태</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${getOverallHealthColor(status.rate_limit_status.overall_health)}`}>
                  <div className="text-2xl font-bold">
                    {status.rate_limit_status.overall_health === 'healthy' ? '🟢' :
                     status.rate_limit_status.overall_health === 'warning' ? '🟡' : '🔴'}
                  </div>
                  <div className="text-sm capitalize">{status.rate_limit_status.overall_health}</div>
                </div>

                {status.rate_limit_status.recommendations.length > 0 && (
                  <div className="md:col-span-2">
                    <h3 className="font-medium text-gray-900 mb-2">권장사항</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {status.rate_limit_status.recommendations.map((rec, idx) => (
                        <li key={idx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* API 통계 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">API 호출 통계 (최근 1시간)</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API 타입</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 호출</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">성공률</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 응답시간</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">최대 응답시간</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {status.api_stats.map((stat, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {stat.api_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.total_calls.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.total_calls > 0 ? ((stat.success_calls / stat.total_calls) * 100).toFixed(1) : 0}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.avg_response_time.toFixed(0)}ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.max_response_time}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 데이터베이스 상태 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">데이터베이스 상태</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {status.db_stats.total_keywords.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-800">총 키워드 수</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {status.db_stats.keywords_last_hour}
                  </div>
                  <div className="text-sm text-green-800">최근 1시간 추가</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {status.db_stats.avg_search_volume?.toLocaleString() || 'N/A'}
                  </div>
                  <div className="text-sm text-purple-800">평균 검색량</div>
                </div>
              </div>
            </div>

            {/* API 키별 성능 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">API 키별 성능</h2>
              <div className="space-y-3">
                {Object.entries(status.rate_limit_status.api_key_performance).map(([apiType, perf]) => (
                  <div key={apiType} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">{apiType.toUpperCase()}</span>
                      <span className={`px-2 py-1 text-xs rounded ${getHealthColor(perf.health)}`}>
                        {perf.health}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      성공률: {(perf.success_rate * 100).toFixed(1)}% |
                      응답시간: {perf.avg_response_time.toFixed(0)}ms
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 성능 메트릭스 탭 */}
        {activeTab === 'metrics' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">성능 메트릭스 추이</h2>
            <p className="text-gray-600 mb-4">최근 24시간 메트릭스 데이터를 확인할 수 있습니다.</p>
            <button
              onClick={fetchStatus}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              메트릭스 조회
            </button>
          </div>
        )}

        {/* API 통계 탭 */}
        {activeTab === 'api-stats' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">API 통계 상세</h2>
            <p className="text-gray-600 mb-4">각 API 키별 상세 통계를 확인할 수 있습니다.</p>
            <button
              onClick={fetchStatus}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              API 통계 조회
            </button>
          </div>
        )}

        {/* 중복 정리 탭 */}
        {activeTab === 'cleanup' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">중복 키워드 정리</h2>
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="font-medium text-red-800 mb-2">중요 안내</h3>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• 각 키워드별로 가장 오래된 레코드(created_at이 가장 빠른 것)만 유지됩니다.</li>
                  <li>• 중복된 키워드의 최신 데이터는 삭제될 수 있습니다.</li>
                  <li>• 실행 전 데이터 백업을 권장합니다.</li>
                </ul>
              </div>

              <button
                onClick={async () => {
                  if (!confirm('정말로 중복 키워드를 정리하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
                    return
                  }

                  setLoading(true)
                  try {
                    const response = await fetch('/functions/system-monitor?action=cleanup-duplicates', {
                      method: 'POST',
                      headers: {
                        'x-admin-key': 'dev-key-2024'
                      }
                    })

                    if (response.ok) {
                      const data = await response.json()
                      if (data.success) {
                        alert(`중복 정리 완료!\n${data.stats.deletedRecords}개 레코드 삭제됨\n최종 고유 키워드: ${data.stats.finalUniqueKeywords}개`)
                        fetchStatus() // 상태 새로고침
                      } else {
                        alert('중복 정리 실패: ' + data.error)
                      }
                    } else {
                      alert('중복 정리 요청 실패')
                    }
                  } catch (error) {
                    console.error('중복 정리 실패:', error)
                    alert('중복 정리 중 오류가 발생했습니다.')
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                className="w-full bg-red-600 text-white px-4 py-3 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '중복 정리 실행 중...' : '중복 키워드 정리 실행'}
              </button>

              <p className="text-xs text-gray-500">
                중복 키워드를 정리하여 데이터베이스의 무결성을 유지합니다.
              </p>
            </div>
          </div>
        )}

        {/* 최적화 탭 */}
        {activeTab === 'optimize' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">시스템 최적화</h2>
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-medium text-yellow-800 mb-2">최적화 작업</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• 오래된 메트릭스 데이터 정리 (30일 이상)</li>
                  <li>• 오래된 API 로그 정리 (7일 이상)</li>
                  <li>• 데이터베이스 VACUUM 실행</li>
                </ul>
              </div>

              <button
                onClick={runOptimization}
                disabled={loading}
                className="w-full bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '최적화 실행 중...' : '시스템 최적화 실행'}
              </button>

              <p className="text-xs text-gray-500">
                최적화 작업은 시스템 성능을 향상시키고 저장 공간을 절약합니다.
              </p>
            </div>
          </div>
        )}

        {/* 새로고침 버튼 */}
        <div className="mt-8 text-center">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '새로고침 중...' : '데이터 새로고침'}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            30초마다 자동 갱신됩니다
          </p>
        </div>
      </div>
    </div>
  )
}

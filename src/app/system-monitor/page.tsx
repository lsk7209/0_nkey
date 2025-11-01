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

interface MetricsData {
  metric_type: string
  metric_name: string
  avg_value: number
  max_value: number
  min_value: number
  sample_count: number
  hour: string
}

interface ApiStatsData {
  api_type: string
  api_key_index: number
  calls: number
  avg_response_time: number
  success_rate: number
  rate_limit_hits: number
  recent_errors: string | null
}

export default function SystemMonitorPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [metrics, setMetrics] = useState<MetricsData[]>([])
  const [apiStats, setApiStats] = useState<ApiStatsData[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'status' | 'metrics' | 'api-stats' | 'optimize' | 'cleanup'>('status')

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/system-monitor?action=status', {
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStatus(data.data)
        }
      } else {
        console.error('시스템 상태 조회 실패:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('시스템 상태 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/system-monitor?action=metrics', {
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setMetrics(data.data || [])
        }
      } else {
        console.error('메트릭스 조회 실패:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('메트릭스 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchApiStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/system-monitor?action=api_stats&hours=24', {
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setApiStats(data.data || [])
        }
      } else {
        console.error('API 통계 조회 실패:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('API 통계 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const runOptimization = async () => {
    if (!confirm('시스템 최적화를 실행하시겠습니까?\n\n최적화 작업:\n- 30일 이상 된 메트릭스 데이터 정리\n- 7일 이상 된 API 로그 정리\n- 데이터베이스 VACUUM 실행')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/system-monitor?action=optimize', {
        method: 'POST',
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const optimizations = data.data?.optimizations || []
          let message = '시스템 최적화가 완료되었습니다!\n\n'
          
          optimizations.forEach((opt: any) => {
            if (opt.type === 'old_metrics_cleanup') {
              message += `• 오래된 메트릭스: ${opt.deleted_count}개 삭제\n`
            } else if (opt.type === 'old_api_logs_cleanup') {
              message += `• 오래된 API 로그: ${opt.deleted_count}개 삭제\n`
            } else if (opt.type === 'database_vacuum') {
              message += `• 데이터베이스 VACUUM: ${opt.status === 'completed' ? '완료' : '실패'}\n`
            }
          })
          
          alert(message)
          fetchStatus() // 상태 새로고침
        } else {
          alert('시스템 최적화 실패: ' + (data.error || '알 수 없는 오류'))
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert('시스템 최적화 요청 실패: ' + (errorData.error || response.statusText))
      }
    } catch (error: any) {
      console.error('시스템 최적화 실패:', error)
      alert('시스템 최적화 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 초기 데이터 로드
    fetchStatus()
    
    // 30초마다 현재 탭에 맞는 데이터 자동 갱신
    const interval = setInterval(() => {
      if (activeTab === 'status') {
        fetchStatus()
      } else if (activeTab === 'metrics') {
        fetchMetrics()
      } else if (activeTab === 'api-stats') {
        fetchApiStats()
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [activeTab])

  // 탭 변경 시 해당 데이터 로드
  useEffect(() => {
    if (activeTab === 'metrics') {
      fetchMetrics()
    } else if (activeTab === 'api-stats') {
      fetchApiStats()
    }
  }, [activeTab])

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
        {activeTab === 'metrics' && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">성능 메트릭스 추이 (최근 24시간)</h2>
                <button
                  onClick={fetchMetrics}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  새로고침
                </button>
              </div>
              
              {metrics.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  메트릭스 데이터가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">메트릭 타입</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">메트릭 이름</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균값</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">최대값</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">최소값</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">샘플 수</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metrics.map((metric, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{metric.hour}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{metric.metric_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.metric_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.avg_value?.toFixed(2) || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.max_value?.toLocaleString() || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.min_value?.toLocaleString() || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.sample_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* API 통계 탭 */}
        {activeTab === 'api-stats' && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">API 통계 상세 (최근 24시간)</h2>
                <button
                  onClick={fetchApiStats}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  새로고침
                </button>
              </div>
              
              {apiStats.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  API 통계 데이터가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API 타입</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API 키 인덱스</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 호출</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">성공률</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 응답시간</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate Limit</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">최근 에러</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {apiStats.map((stat, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.api_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{stat.api_key_index}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.calls?.toLocaleString() || 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              stat.success_rate >= 95 ? 'bg-green-100 text-green-800' :
                              stat.success_rate >= 80 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {stat.success_rate?.toFixed(1) || 0}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.avg_response_time?.toFixed(0) || 0}ms</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {stat.rate_limit_hits > 0 ? (
                              <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">{stat.rate_limit_hits}회</span>
                            ) : (
                              <span className="text-gray-400">0회</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={stat.recent_errors || ''}>
                            {stat.recent_errors ? (
                              <span className="text-red-600">{stat.recent_errors.substring(0, 50)}...</span>
                            ) : (
                              <span className="text-gray-400">없음</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                    const response = await fetch('/api/system-monitor?action=cleanup-duplicates', {
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

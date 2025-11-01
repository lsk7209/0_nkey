'use client'

import { useState, useEffect } from 'react'

interface ApiKeyStatus {
  name: string
  clientId?: string
  usedToday: number
  dailyLimit: number
  remaining: number
  isActive: boolean
  lastUsed: number
}

interface ApiStatusResponse {
  success: boolean
  adsApiKeys: ApiKeyStatus[]
  openApiKeys: ApiKeyStatus[]
  adsSummary: {
    totalAdsKeys: number
    activeAdsKeys: number
    totalRemaining: number
    totalUsed: number
    totalLimit: number
  }
  openApiSummary: {
    totalOpenApiKeys: number
    activeOpenApiKeys: number
    totalRemaining: number
    totalUsed: number
    totalLimit: number
  }
  overallSummary: {
    totalApiKeys: number
    activeApiKeys: number
    totalRemaining: number
    totalUsed: number
    totalLimit: number
  }
  lastUpdated: string
}

export default function ApiStatusPage() {
  const [apiStatus, setApiStatus] = useState<ApiStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchApiStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/functions/system-monitor?action=api-status', {
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })
      
      if (!response.ok) {
        throw new Error('API 상태 조회에 실패했습니다.')
      }
      
      const data = await response.json()
      setApiStatus(data)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('API 상태 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApiStatus()
    
    // 30초마다 자동 새로고침
    const interval = setInterval(fetchApiStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatLastUsed = (timestamp: number) => {
    if (timestamp === 0) return '사용 안함'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}시간 전`
    return date.toLocaleDateString()
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100)
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50'
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">API 키 상태 모니터링</h1>
          <p className="text-gray-600">다중 API 키 사용량 및 상태 실시간 모니터링</p>
        </div>

        {/* 새로고침 버튼 */}
        <div className="mb-6">
          <button
            onClick={fetchApiStatus}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '새로고침 중...' : '새로고침'}
          </button>
          {lastUpdated && (
            <span className="ml-4 text-sm text-gray-500">
              마지막 업데이트: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* 전체 요약 정보 */}
        {apiStatus && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">총 API 키</p>
                  <p className="text-2xl font-semibold text-gray-900">{apiStatus.overallSummary.totalApiKeys}개</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">활성 키</p>
                  <p className="text-2xl font-semibold text-gray-900">{apiStatus.overallSummary.activeApiKeys}개</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">남은 요청</p>
                  <p className="text-2xl font-semibold text-gray-900">{apiStatus.overallSummary.totalRemaining.toLocaleString()}개</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">사용률</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round((apiStatus.overallSummary.totalUsed / apiStatus.overallSummary.totalLimit) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API별 간단 요약 */}
        {apiStatus && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* 네이버 검색광고 API 요약 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4zM9 6v10h6V6H9z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">네이버 검색광고 API</h3>
                  <p className="text-sm text-gray-500">연관검색어 수집</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">키 개수</p>
                  <p className="text-xl font-semibold text-gray-900">{apiStatus.adsSummary.totalAdsKeys}개</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">활성 키</p>
                  <p className="text-xl font-semibold text-gray-900">{apiStatus.adsSummary.activeAdsKeys}개</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">남은 요청</p>
                  <p className="text-xl font-semibold text-gray-900">{apiStatus.adsSummary.totalRemaining.toLocaleString()}개</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">사용률</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {Math.round((apiStatus.adsSummary.totalUsed / apiStatus.adsSummary.totalLimit) * 100)}%
                  </p>
                </div>
              </div>
            </div>

            {/* 네이버 오픈API 요약 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">네이버 오픈API</h3>
                  <p className="text-sm text-gray-500">문서수 수집</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">키 개수</p>
                  <p className="text-xl font-semibold text-gray-900">{apiStatus.openApiSummary.totalOpenApiKeys}개</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">활성 키</p>
                  <p className="text-xl font-semibold text-gray-900">{apiStatus.openApiSummary.activeOpenApiKeys}개</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">남은 요청</p>
                  <p className="text-xl font-semibold text-gray-900">{apiStatus.openApiSummary.totalRemaining.toLocaleString()}개</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">사용률</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {Math.round((apiStatus.openApiSummary.totalUsed / apiStatus.openApiSummary.totalLimit) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API 키 상세 정보 */}
        {apiStatus && (
          <div className="space-y-6">
            {/* 네이버 검색광고 API 키 상세 */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">네이버 검색광고 API 키 상세</h2>
                <p className="text-sm text-gray-500">연관검색어 수집용 API 키</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">키 이름</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용량</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">남은 요청</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용률</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">마지막 사용</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {apiStatus.adsApiKeys.map((key, index) => {
                      const usagePercentage = getUsagePercentage(key.usedToday, key.dailyLimit)
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {key.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              key.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {key.isActive ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {key.usedToday.toLocaleString()} / {key.dailyLimit.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {key.remaining.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    usagePercentage >= 90 ? 'bg-red-500' :
                                    usagePercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${usagePercentage}%` }}
                                ></div>
                              </div>
                              <span className={`text-sm font-medium ${getStatusColor(usagePercentage)}`}>
                                {usagePercentage}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatLastUsed(key.lastUsed)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 네이버 오픈API 키 상세 */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">네이버 오픈API 키 상세</h2>
                <p className="text-sm text-gray-500">문서수 수집용 API 키</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">키 이름</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">클라이언트 ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용량</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">남은 요청</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용률</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">마지막 사용</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {apiStatus.openApiKeys.map((key, index) => {
                      const usagePercentage = getUsagePercentage(key.usedToday, key.dailyLimit)
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {key.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {key.clientId || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              key.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {key.isActive ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {key.usedToday.toLocaleString()} / {key.dailyLimit.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {key.remaining.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    usagePercentage >= 90 ? 'bg-red-500' :
                                    usagePercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${usagePercentage}%` }}
                                ></div>
                              </div>
                              <span className={`text-sm font-medium ${getStatusColor(usagePercentage)}`}>
                                {usagePercentage}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatLastUsed(key.lastUsed)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 로딩 상태 */}
        {loading && !apiStatus && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">API 상태 로딩 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {!loading && !apiStatus && (
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-gray-600">API 상태를 불러올 수 없습니다.</p>
            <button
              onClick={fetchApiStatus}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

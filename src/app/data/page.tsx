'use client'

import { useState, useEffect } from 'react'

interface KeywordData {
  keyword: string
  seed: string
  monthly_search_pc: number
  monthly_search_mob: number
  avg_monthly_search: number
  cpc?: number
  comp_index?: number
  created_at: string
}

export default function DataPage() {
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  useEffect(() => {
    loadKeywords()
  }, [])

  const loadKeywords = async () => {
    try {
      // 먼저 클라우드 데이터베이스에서 시도
      try {
        const response = await fetch('/api/keywords?page=1&limit=1000', {
          headers: {
            'x-admin-key': 'dev-key-2024'
          }
        })

        if (response.ok) {
      const data = await response.json()
      setKeywords(data.keywords)
          setMessage(`클라우드 데이터베이스에서 ${data.keywords.length}개의 키워드를 불러왔습니다.`)
          return
        }
      } catch (apiError) {
        console.log('API 호출 실패, 로컬 스토리지 사용:', apiError)
      }

      // API 실패 시 로컬 스토리지에서 로드
      const storedData = JSON.parse(localStorage.getItem('keywords') || '[]')
      setKeywords(storedData)
      setMessage(`로컬 스토리지에서 ${storedData.length}개의 키워드를 불러왔습니다. (API 연결 실패)`)
    } catch (error) {
      setMessage('저장된 키워드를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleClearAll = () => {
    if (confirm('모든 키워드를 삭제하시겠습니까?')) {
      localStorage.removeItem('keywords')
      setKeywords([])
      setMessage('모든 키워드가 삭제되었습니다.')
    }
  }

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(keywords, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `keywords-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('키워드 데이터를 JSON 파일로 내보냈습니다.')
    } catch (error) {
      setMessage('데이터 내보내기에 실패했습니다.')
    }
  }

  // 페이지네이션 계산
  const totalPages = Math.ceil(keywords.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentKeywords = keywords.slice(startIndex, endIndex)

  // 통계 계산
  const totalKeywords = keywords.length
  const totalSearchVolume = keywords.reduce((sum, k) => sum + k.avg_monthly_search, 0)
  const avgSearchVolume = totalKeywords > 0 ? Math.round(totalSearchVolume / totalKeywords) : 0
  const uniqueSeeds = new Set(keywords.map(k => k.seed)).size

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">데이터를 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">저장된 키워드 데이터</h1>
        
        {message && (
          <div className={`p-3 rounded-lg mb-4 ${
            message.includes('불러왔습니다') || message.includes('내보냈습니다')
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800">총 키워드 수</h3>
            <p className="text-2xl font-bold text-blue-900">{totalKeywords.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-800">총 검색량</h3>
            <p className="text-2xl font-bold text-green-900">{totalSearchVolume.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-800">평균 검색량</h3>
            <p className="text-2xl font-bold text-purple-900">{avgSearchVolume.toLocaleString()}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-orange-800">시드 키워드 수</h3>
            <p className="text-2xl font-bold text-orange-900">{uniqueSeeds}</p>
          </div>
        </div>

        <div className="flex space-x-4 mb-6">
          <button
            onClick={loadStoredKeywords}
            className="btn-secondary"
          >
            새로고침
          </button>
          <button
            onClick={handleExport}
            disabled={keywords.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            JSON 내보내기
          </button>
          <button
            onClick={handleClearAll}
            disabled={keywords.length === 0}
            className="btn-danger disabled:opacity-50"
          >
            전체 삭제
          </button>
        </div>
      </div>

      {keywords.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">저장된 키워드가 없습니다</h3>
          <p className="text-gray-600 mb-4">메인 페이지에서 키워드를 수집해보세요.</p>
          <a href="/" className="btn-primary">
            키워드 수집하기
          </a>
        </div>
      ) : (
        <>
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              키워드 목록 (페이지 {currentPage} / {totalPages})
            </h2>
            
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    키워드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      시드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PC 검색량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      모바일 검색량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      총 검색량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CPC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      경쟁도
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      생성일
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {currentKeywords.map((keyword, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {keyword.keyword}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {keyword.seed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {keyword.monthly_search_pc.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {keyword.monthly_search_mob.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {keyword.avg_monthly_search.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {keyword.cpc?.toLocaleString() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {keyword.comp_index || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(keyword.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-6">
              <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                  if (pageNum > totalPages) return null
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
              <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
            )}
          </div>
        </>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">데이터 관리</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• 데이터는 브라우저 로컬 스토리지에 저장됩니다</p>
          <p>• 브라우저를 삭제하거나 시크릿 모드를 사용하면 데이터가 사라집니다</p>
          <p>• 중요한 데이터는 "JSON 내보내기" 기능으로 백업하세요</p>
          <p>• 클라우드플레어 페이지는 정적 호스팅이므로 서버 사이드 저장이 불가능합니다</p>
        </div>
      </div>
    </div>
  )
}
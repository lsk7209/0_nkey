/**
 * ⚠️ 헌법 준수 필수 (CONSTITUTION.md)
 * 
 * 절대 변경 금지 사항:
 * - Pages Functions URL 사용 (https://0-nkey.pages.dev/api/keywords)
 * - 필드명 변경 금지 (pc_search, mobile_search 등)
 * - D1 데이터베이스만 사용 (로컬 스토리지 제거)
 * 
 * 헌법 문서: CONSTITUTION.md (절대 변경 금지)
 */

'use client'

import { useState, useEffect } from 'react'

interface KeywordData {
  keyword: string
  avg_monthly_search: number
  blog_total?: number
  cafe_total?: number
  web_total?: number
  news_total?: number
  monthly_click_pc?: number
  monthly_click_mo?: number
  ctr_pc?: number
  ctr_mo?: number
  ad_count?: number
  pc_search: number
  mobile_search: number
  created_at?: string
}

interface FilterValues {
  minAvgSearch: string
  maxAvgSearch: string
  minCafeTotal: string
  maxCafeTotal: string
  minBlogTotal: string
  maxBlogTotal: string
  minWebTotal: string
  maxWebTotal: string
  minNewsTotal: string
  maxNewsTotal: string
}

export default function DataPage() {
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [filters, setFilters] = useState<FilterValues>({
    minAvgSearch: '',
    maxAvgSearch: '',
    minCafeTotal: '',
    maxCafeTotal: '',
    minBlogTotal: '',
    maxBlogTotal: '',
    minWebTotal: '',
    maxWebTotal: '',
    minNewsTotal: '',
    maxNewsTotal: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadKeywords()
  }, [])

  const loadKeywords = async () => {
    try {
      setLoading(true)
      // 필터 파라미터 구성
      const params = new URLSearchParams()
      if (filters.minAvgSearch) params.append('minAvgSearch', filters.minAvgSearch)
      if (filters.maxAvgSearch) params.append('maxAvgSearch', filters.maxAvgSearch)
      if (filters.minCafeTotal) params.append('minCafeTotal', filters.minCafeTotal)
      if (filters.maxCafeTotal) params.append('maxCafeTotal', filters.maxCafeTotal)
      if (filters.minBlogTotal) params.append('minBlogTotal', filters.minBlogTotal)
      if (filters.maxBlogTotal) params.append('maxBlogTotal', filters.maxBlogTotal)
      if (filters.minWebTotal) params.append('minWebTotal', filters.minWebTotal)
      if (filters.maxWebTotal) params.append('maxWebTotal', filters.maxWebTotal)
      if (filters.minNewsTotal) params.append('minNewsTotal', filters.minNewsTotal)
      if (filters.maxNewsTotal) params.append('maxNewsTotal', filters.maxNewsTotal)

      const url = `https://0-nkey.pages.dev/api/keywords${params.toString() ? `?${params.toString()}` : ''}`
      
      // Pages Functions를 통해 D1 데이터베이스에서 키워드 조회
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.keywords)) {
          setKeywords(data.keywords)
          setMessage(`✅ 클라우드 D1 데이터베이스에서 ${data.keywords.length}개의 키워드를 불러왔습니다.`)
          
          // 문서수가 없는 키워드 자동 수집
          const keywordsWithoutDocCounts = data.keywords.filter((kw: KeywordData) => 
            !kw.blog_total && !kw.cafe_total && !kw.web_total && !kw.news_total
          )
          
          if (keywordsWithoutDocCounts.length > 0) {
            console.log(`📄 문서수가 없는 키워드 ${keywordsWithoutDocCounts.length}개 발견, 자동 수집 시작`)
            setMessage(`✅ ${data.keywords.length}개의 키워드를 불러왔습니다. 문서수 수집 중... (${keywordsWithoutDocCounts.length}개)`)
            
            // 백그라운드에서 문서수 수집 (비동기)
            collectDocCountsForKeywords(keywordsWithoutDocCounts.slice(0, 20)).catch(err => {
              console.error('자동 문서수 수집 실패:', err)
            })
          }
        } else {
          setKeywords([])
          setMessage('키워드 데이터를 찾을 수 없습니다.')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `데이터 조회 실패: ${response.status}`)
      }
    } catch (error) {
      console.error('키워드 조회 실패:', error)
      setMessage(`❌ 저장된 키워드를 불러오는데 실패했습니다: ${(error as Error).message}`)
      setKeywords([])
    } finally {
      setLoading(false)
    }
  }

  // 문서수가 없는 키워드들의 문서수 자동 수집
  const collectDocCountsForKeywords = async (keywordsToCollect: KeywordData[]) => {
    try {
      const response = await fetch('https://0-nkey.pages.dev/api/collect-docs-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({
          keywords: keywordsToCollect.map(kw => kw.keyword)
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          console.log(`✅ ${data.successCount}개 키워드의 문서수 수집 완료`)
          // 수집 완료 후 키워드 목록 다시 로드
          setTimeout(() => {
            loadKeywords()
          }, 1000)
        }
      }
    } catch (error) {
      console.error('문서수 수집 실패:', error)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('모든 키워드를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('https://0-nkey.pages.dev/api/keywords-delete', {
        method: 'DELETE',
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setKeywords([]);
          setMessage('✅ 모든 키워드가 삭제되었습니다.');
          setCurrentPage(1);
        } else {
          throw new Error(data.message || '삭제 실패');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `삭제 실패: ${response.status}`);
      }
    } catch (error) {
      console.error('키워드 삭제 실패:', error);
      setMessage(`❌ 키워드 삭제 실패: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = (field: keyof FilterValues, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleApplyFilters = () => {
    setCurrentPage(1)
    loadKeywords()
  }

  const handleResetFilters = () => {
    setFilters({
      minAvgSearch: '',
      maxAvgSearch: '',
      minCafeTotal: '',
      maxCafeTotal: '',
      minBlogTotal: '',
      maxBlogTotal: '',
      minWebTotal: '',
      maxWebTotal: '',
      minNewsTotal: '',
      maxNewsTotal: ''
    })
    setCurrentPage(1)
    // 필터 초기화 후 즉시 로드
    setTimeout(() => loadKeywords(), 100)
  }

  const handleExport = () => {
    try {
      // CSV 헤더 생성
      const headers = [
        '키워드',
        '총검색량',
        '카페문서수',
        '블로그문서수',
        '웹문서수',
        '뉴스문서수',
        '월클릭(pc)',
        '월클릭(m)',
        '월클릭률(pc)',
        '월클릭률(m)',
        '월광고수',
        'PC 검색량',
        '모바일 검색량',
        '생성일'
      ]

      // CSV 데이터 행 생성
      const rows = keywords.map(keyword => [
        keyword.keyword || '',
        keyword.avg_monthly_search || 0,
        keyword.cafe_total || 0,
        keyword.blog_total || 0,
        keyword.web_total || 0,
        keyword.news_total || 0,
        keyword.monthly_click_pc ? keyword.monthly_click_pc.toFixed(1) : '',
        keyword.monthly_click_mo ? keyword.monthly_click_mo.toFixed(1) : '',
        keyword.ctr_pc ? `${keyword.ctr_pc.toFixed(2)}%` : '',
        keyword.ctr_mo ? `${keyword.ctr_mo.toFixed(2)}%` : '',
        keyword.ad_count || '',
        keyword.pc_search || 0,
        keyword.mobile_search || 0,
        keyword.created_at ? new Date(keyword.created_at).toLocaleDateString() : ''
      ])

      // CSV 형식으로 변환 (쉼표로 구분, 따옴표로 감싸기)
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // 쉼표, 따옴표, 줄바꿈이 포함된 경우 따옴표로 감싸기
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        }).join(','))
      ].join('\n')

      // BOM 추가 (한글 깨짐 방지)
      const BOM = '\uFEFF'
      const csvWithBOM = BOM + csvContent

      // Blob 생성 및 다운로드
      const dataBlob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `keywords-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setMessage(`✅ 키워드 데이터를 CSV 파일로 내보냈습니다. (${keywords.length}개)`)
    } catch (error) {
      console.error('CSV 내보내기 실패:', error)
      setMessage('❌ 데이터 내보내기에 실패했습니다: ' + (error as Error).message)
    }
  }

  // 페이지네이션 계산
  const totalPages = Math.ceil(keywords.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentKeywords = keywords.slice(startIndex, endIndex)

  // 통계 계산
  const totalKeywords = keywords.length
  const totalSearchVolume = keywords.reduce((sum, k) => sum + (k.avg_monthly_search || 0), 0)
  const avgSearchVolume = totalKeywords > 0 ? Math.round(totalSearchVolume / totalKeywords) : 0
  const totalPcSearch = keywords.reduce((sum, k) => sum + (k.pc_search || 0), 0)
  const totalMobileSearch = keywords.reduce((sum, k) => sum + (k.mobile_search || 0), 0)

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
            <h3 className="text-sm font-medium text-orange-800">PC/모바일 비율</h3>
            <p className="text-2xl font-bold text-orange-900">
              {totalPcSearch > 0 || totalMobileSearch > 0
                ? `${Math.round((totalPcSearch / (totalPcSearch + totalMobileSearch)) * 100)}% / ${Math.round((totalMobileSearch / (totalPcSearch + totalMobileSearch)) * 100)}%`
                : 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex space-x-4 mb-6">
          <button
            onClick={loadKeywords}
            className="btn-secondary"
          >
            새로고침
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary"
          >
            {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <button
            onClick={handleExport}
            disabled={keywords.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            CSV 내보내기
          </button>
          <button
            onClick={handleClearAll}
            disabled={keywords.length === 0}
            className="btn-danger disabled:opacity-50"
          >
            전체 삭제
          </button>
        </div>

        {/* 필터 섹션 */}
        {showFilters && (
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">필터 설정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 총검색수 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">총검색수</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="최소"
                    value={filters.minAvgSearch}
                    onChange={(e) => handleFilterChange('minAvgSearch', e.target.value)}
                    className="input-field flex-1"
                  />
                  <input
                    type="number"
                    placeholder="최대"
                    value={filters.maxAvgSearch}
                    onChange={(e) => handleFilterChange('maxAvgSearch', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>

              {/* 카페문서수 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">카페문서수</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="최소"
                    value={filters.minCafeTotal}
                    onChange={(e) => handleFilterChange('minCafeTotal', e.target.value)}
                    className="input-field flex-1"
                  />
                  <input
                    type="number"
                    placeholder="최대"
                    value={filters.maxCafeTotal}
                    onChange={(e) => handleFilterChange('maxCafeTotal', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>

              {/* 블로그문서수 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">블로그문서수</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="최소"
                    value={filters.minBlogTotal}
                    onChange={(e) => handleFilterChange('minBlogTotal', e.target.value)}
                    className="input-field flex-1"
                  />
                  <input
                    type="number"
                    placeholder="최대"
                    value={filters.maxBlogTotal}
                    onChange={(e) => handleFilterChange('maxBlogTotal', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>

              {/* 웹문서수 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">웹문서수</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="최소"
                    value={filters.minWebTotal}
                    onChange={(e) => handleFilterChange('minWebTotal', e.target.value)}
                    className="input-field flex-1"
                  />
                  <input
                    type="number"
                    placeholder="최대"
                    value={filters.maxWebTotal}
                    onChange={(e) => handleFilterChange('maxWebTotal', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>

              {/* 뉴스문서수 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">뉴스문서수</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="최소"
                    value={filters.minNewsTotal}
                    onChange={(e) => handleFilterChange('minNewsTotal', e.target.value)}
                    className="input-field flex-1"
                  />
                  <input
                    type="number"
                    placeholder="최대"
                    value={filters.maxNewsTotal}
                    onChange={(e) => handleFilterChange('maxNewsTotal', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-4 mt-4">
              <button
                onClick={handleApplyFilters}
                className="btn-primary"
              >
                필터 적용
              </button>
              <button
                onClick={handleResetFilters}
                className="btn-secondary"
              >
                필터 초기화
              </button>
            </div>
          </div>
        )}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    키워드
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총검색량
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    카페문서수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    블로그문서수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    웹문서수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    뉴스문서수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월클릭(pc)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월클릭(m)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월클릭률(pc)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월클릭률(m)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월광고수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PC 검색량
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    모바일 검색량
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    생성일
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {currentKeywords.map((keyword, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {keyword.keyword}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(keyword.avg_monthly_search || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(keyword.cafe_total || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(keyword.blog_total || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(keyword.web_total || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(keyword.news_total || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {keyword.monthly_click_pc ? keyword.monthly_click_pc.toFixed(1) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {keyword.monthly_click_mo ? keyword.monthly_click_mo.toFixed(1) : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {keyword.ctr_pc ? `${keyword.ctr_pc.toFixed(2)}%` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {keyword.ctr_mo ? `${keyword.ctr_mo.toFixed(2)}%` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {keyword.ad_count?.toLocaleString() || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(keyword.pc_search || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(keyword.mobile_search || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {keyword.created_at ? new Date(keyword.created_at).toLocaleDateString() : 'N/A'}
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
          <p>• 데이터는 Cloudflare D1 데이터베이스에 안전하게 저장됩니다</p>
          <p>• 홈 페이지에서 수집한 키워드는 자동으로 이 페이지에 표시됩니다</p>
          <p>• "새로고침" 버튼을 클릭하여 최신 데이터를 불러올 수 있습니다</p>
          <p>• 중요한 데이터는 "CSV 내보내기" 기능으로 백업하세요</p>
          <p>• 데이터는 Pages Functions를 통해 D1에서 조회됩니다</p>
        </div>
      </div>
    </div>
  )
}
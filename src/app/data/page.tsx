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

import { useState, useEffect, useMemo, useCallback, memo } from 'react'

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

// 메모이제이션된 키워드 행 컴포넌트 (성능 최적화)
const KeywordRow = memo(({ keyword, index }: { keyword: KeywordData; index: number }) => (
  <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
));

KeywordRow.displayName = 'KeywordRow'

export default function DataPage() {
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50) // 페이지당 50개 표시
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
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

  // 메모이제이션된 키워드 로드 함수 (페이지 이동 방식)
  const loadKeywords = useCallback(async (page: number = 1) => {
    setLoading(true)

    try {
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

      // 페이지네이션 파라미터
      params.append('page', String(page))
      params.append('pageSize', String(itemsPerPage))
      
      // 문서수 0 제외 (기본값: true)
      params.append('excludeZeroDocs', 'true')

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
          setTotalCount(typeof data.total === 'number' ? data.total : data.keywords.length)

          setMessage(`✅ 클라우드 D1 데이터베이스에서 ${data.keywords.length}개 (총 ${data.total ?? data.keywords.length}개 중, 페이지 ${page}) 불러왔습니다.`)

          // 전체 페이지 수 계산
          const calculatedTotalPages = Math.ceil((data.total ?? data.keywords.length) / itemsPerPage)
          setTotalPages(calculatedTotalPages)
          setCurrentPage(page)

          // 문서수가 없는 키워드 자동 수집 (첫 페이지에서만)
          if (page === 1) {
            const keywordsWithoutDocCounts = data.keywords.filter((kw: KeywordData) =>
              (!kw.blog_total || kw.blog_total === 0) && 
              (!kw.cafe_total || kw.cafe_total === 0) && 
              (!kw.web_total || kw.web_total === 0) && 
              (!kw.news_total || kw.news_total === 0)
            )

            if (keywordsWithoutDocCounts.length > 0) {
              console.log(`📄 문서수가 없는 키워드 ${keywordsWithoutDocCounts.length}개 발견, 자동 수집 시작`)
              setMessage(`✅ ${data.keywords.length}개의 키워드를 불러왔습니다. 문서수 자동 수집 중... (${keywordsWithoutDocCounts.length}개)`)
              
              // 문서수 수집 (최대 20개, API 제한 고려)
              collectDocCountsForKeywords(keywordsWithoutDocCounts.slice(0, 20))
                .then((result) => {
                  if (result.success) {
                    console.log(`✅ 문서수 수집 완료: ${result.successCount}개 성공`)
                    // 수집 완료 후 자동 새로고침 (1초 대기)
                    setTimeout(() => {
                      loadKeywords(1)
                      setMessage(`✅ 문서수 수집 완료! ${result.successCount}개 키워드의 문서수를 수집했습니다.`)
                    }, 1000)
                  } else {
                    console.error('문서수 수집 실패:', result.message)
                  }
                })
                .catch(err => {
                  console.error('자동 문서수 수집 실패:', err)
                  setMessage(`⚠️ 문서수 자동 수집 중 오류가 발생했습니다: ${err.message}`)
                })
            }
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
  }, [filters, itemsPerPage])

  // 문서수 수집 함수
  const collectDocCountsForKeywords = useCallback(async (keywordsToCollect: KeywordData[]) => {
    try {
      console.log(`📄 문서수 수집 API 호출: ${keywordsToCollect.length}개 키워드`)
      
      const response = await fetch('https://0-nkey.pages.dev/api/collect-docs-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({
          keywords: keywordsToCollect.map(kw => ({
            keyword: kw.keyword,
            id: undefined // 키워드 텍스트로 찾기
          }))
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `문서수 수집 실패: ${response.status}`)
      }

      const result = await response.json()
      return result

    } catch (error) {
      console.error('문서수 수집 API 호출 실패:', error)
      throw error
    }
  }, [])

  // 페이지 이동 핸들러
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      loadKeywords(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [totalPages, loadKeywords])

  // 필터 적용 시 초기화
  const handleApplyFilters = useCallback(() => {
    setCurrentPage(1)
    setKeywords([])
    loadKeywords(1)
  }, [loadKeywords])

  // 필터 초기화
  const handleResetFilters = useCallback(() => {
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
    setKeywords([])
    setTimeout(() => loadKeywords(1), 100)
  }, [loadKeywords])

  useEffect(() => {
    loadKeywords(1)
  }, [])

  // 홈 페이지에서 키워드 저장 완료 시 자동 새로고침
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel('keyword-saved')
    
    channel.addEventListener('message', (event) => {
      if (event.data?.type === 'KEYWORD_SAVED') {
        const savedCount = event.data.savedCount || 0;
        const updatedCount = event.data.updatedCount || 0;
        const totalCount = event.data.count || 0;
        
        console.log('💾 키워드 저장 완료 감지, 자동 새로고침:', { savedCount, updatedCount, totalCount })
        
        // 1초 후 새로고침 (저장 완료 대기)
        setTimeout(() => {
          loadKeywords(1)
          let message = '';
          if (savedCount > 0) {
            message = `✅ ${savedCount}개의 새 키워드가 추가되어 총 키워드 수가 증가했습니다.`;
            if (updatedCount > 0) {
              message += ` (기존 키워드 ${updatedCount}개 업데이트)`;
            }
          } else if (updatedCount > 0) {
            message = `✅ 기존 키워드 ${updatedCount}개가 업데이트되었습니다. (총 키워드 수는 변하지 않음)`;
          } else {
            message = `✅ ${totalCount}개의 키워드가 처리되었습니다.`;
          }
          setMessage(message)
        }, 1000)
      }
    })

    return () => {
      channel.close()
    }
  }, [loadKeywords])


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

  // 통계 계산 (현재 로드된 데이터 기반)
  const totalKeywords = totalCount
  const loadedKeywords = keywords
  const totalSearchVolume = loadedKeywords.reduce((sum, k) => sum + (k.avg_monthly_search || 0), 0)
  const avgSearchVolume = loadedKeywords.length > 0 ? Math.round(totalSearchVolume / loadedKeywords.length) : 0
  const totalPcSearch = loadedKeywords.reduce((sum, k) => sum + (k.pc_search || 0), 0)
  const totalMobileSearch = loadedKeywords.reduce((sum, k) => sum + (k.mobile_search || 0), 0)

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
            onClick={() => loadKeywords(currentPage)}
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
              키워드 목록 ({keywords.length.toLocaleString()}개 표시 / 총 {totalCount.toLocaleString()}개)
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
                  {keywords.map((keyword, index) => (
                    <KeywordRow key={keyword.keyword || index} keyword={keyword} index={index} />
                  ))}
              </tbody>
            </table>
          </div>

        {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center space-x-2 flex-wrap">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  첫 페이지
                </button>
                
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  이전
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  다음
                </button>

                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  마지막 페이지
                </button>

                <span className="ml-4 text-sm text-gray-600">
                  페이지 {currentPage} / {totalPages}
                </span>
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
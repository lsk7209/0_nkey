'use client'

import { useState, useEffect } from 'react'

interface KeywordData {
  id: number
  seed: string
  keyword: string
  avg_monthly_search: number
  blog_total: number
  cafe_total: number
  web_total: number
  news_total: number
  all_total: number
  monthly_click_pc: number
  monthly_click_mobile: number
  ctr_pc: number
  ctr_mobile: number
  ad_count: number
  collected_at: string
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function DataPage() {
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    minSearch: 1000, // 총검색량 1000 이상
    maxSearch: 999999999,
    minCafe: 1, // 카페문서수 1 이상
    maxCafe: 999999999,
    minBlog: 0,
    maxBlog: 999999999,
    minWeb: 0,
    maxWeb: 999999999,
    minNews: 0,
    maxNews: 999999999,
    days: 30
  })
  const [autoCollect, setAutoCollect] = useState(false)
  const [collectingDocs, setCollectingDocs] = useState(false)
  const [keywordsWithoutDocCounts, setKeywordsWithoutDocCounts] = useState(0)
  const [autoCollectSettings, setAutoCollectSettings] = useState({
    enabled: false,
    seedCount: 10,
    maxKeywordsPerSeed: 1000,
    interval: 24 // 시간 단위
  })
  const [sortBy, setSortBy] = useState('cafe_asc_search_desc') // 기본 정렬: 카페문서수 오름차순 + 총검색수 내림차순

  const fetchKeywords = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        minSearch: filters.minSearch.toString(),
        maxSearch: filters.maxSearch.toString(),
        minCafe: filters.minCafe.toString(),
        maxCafe: filters.maxCafe.toString(),
        minBlog: filters.minBlog.toString(),
        maxBlog: filters.maxBlog.toString(),
        minWeb: filters.minWeb.toString(),
        maxWeb: filters.maxWeb.toString(),
        minNews: filters.minNews.toString(),
        maxNews: filters.maxNews.toString(),
        days: filters.days.toString(),
        sortBy: sortBy // 동적 정렬 옵션
      })

      const response = await fetch(`/api/keywords?${params}`)
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.')

      const data = await response.json()
      setKeywords(data.keywords)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching keywords:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: number) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const collectDocumentCounts = async () => {
    setCollectingDocs(true)
    try {
      // 문서수가 없는 키워드만 가져오기
      const keywordsWithoutDocCountsParams = new URLSearchParams({
        page: '1',
        limit: '10000', // 충분히 큰 수
        minSearch: filters.minSearch.toString(),
        maxSearch: filters.maxSearch.toString(),
        minCafe: filters.minCafe.toString(),
        maxCafe: filters.maxCafe.toString(),
        minBlog: filters.minBlog.toString(),
        maxBlog: filters.maxBlog.toString(),
        minWeb: filters.minWeb.toString(),
        maxWeb: filters.maxWeb.toString(),
        minNews: filters.minNews.toString(),
        maxNews: filters.maxNews.toString(),
        days: filters.days.toString(),
        sortBy: 'cafe_asc_search_desc'
      })
      
      const keywordsWithoutDocCountsResponse = await fetch(`/api/keywords-without-doc-counts?${keywordsWithoutDocCountsParams}`)
      if (!keywordsWithoutDocCountsResponse.ok) throw new Error('문서수가 없는 키워드 목록을 불러오는데 실패했습니다.')
      
      const keywordsWithoutDocCountsData = await keywordsWithoutDocCountsResponse.json()
      const keywordsToCollect = keywordsWithoutDocCountsData.keywords.map((item: any) => item.keyword)
      
      console.log(`📊 문서수 수집 대상: ${keywordsToCollect.length}개 키워드 (문서수가 없는 키워드만)`)
      
      if (keywordsToCollect.length === 0) {
        alert('문서수가 없는 키워드가 없습니다. 모든 키워드의 문서수가 이미 수집되었습니다.')
        return
      }
      
      const response = await fetch('/api/collect/naver-docs-strict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({ keywords: keywordsToCollect })
      })

      if (!response.ok) {
        throw new Error('문서수 수집에 실패했습니다.')
      }

      const result = await response.json()
      console.log('문서수 수집 결과:', result)
      
      // 데이터 새로고침
      await fetchKeywords()
      
      alert(`문서수 수집 완료: ${result.processed}/${result.total}개 성공`)
    } catch (error) {
      console.error('문서수 수집 에러:', error)
      alert('문서수 수집 중 오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setCollectingDocs(false)
    }
  }

  const runAutoCollect = async () => {
    if (!autoCollectSettings.enabled) {
      alert('자동수집을 먼저 활성화해주세요.')
      return
    }

    if (autoCollectSettings.seedCount < 1 || autoCollectSettings.maxKeywordsPerSeed < 100) {
      alert('시드키워드 개수는 1개 이상, 최대 수집 개수는 100개 이상이어야 합니다.')
      return
    }

    try {
      setCollectingDocs(true)
      
      const response = await fetch('/api/auto-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({
          seedCount: autoCollectSettings.seedCount,
          maxKeywordsPerSeed: autoCollectSettings.maxKeywordsPerSeed
        })
      })

      const result = await response.json()
      
      if (result.success) {
        if (result.jobId) {
          // 백그라운드 작업으로 시작된 경우 - 팝업 없이 바로 페이지 이동
          window.location.href = '/background-jobs'
        } else if (result.summary) {
          // 즉시 완료된 경우 (이전 방식)
          alert(`자동수집 완료!\n시드키워드: ${result.summary.seedKeywords}개\n총 처리: ${result.summary.totalProcessed}개\n신규: ${result.summary.totalNewKeywords}개\n갱신: ${result.summary.totalUpdatedKeywords}개\n패스: ${result.summary.totalSkippedKeywords}개`)
          await fetchKeywords() // 데이터 새로고침
        } else {
          // 백그라운드 작업 페이지로 이동
          window.location.href = '/background-jobs'
        }
      } else {
        alert('자동수집 실패: ' + (result.message || result.error))
      }
    } catch (error) {
      console.error('자동수집 에러:', error)
      alert('자동수집 중 오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setCollectingDocs(false)
    }
  }

  const toggleAutoCollect = async () => {
    try {
      const response = await fetch('/api/auto/collect/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'dev-key'
        },
        body: JSON.stringify({ enabled: !autoCollect })
      })

      if (response.ok) {
        setAutoCollect(!autoCollect)
      }
    } catch (error) {
      console.error('Error toggling auto collect:', error)
    }
  }

  useEffect(() => {
    fetchKeywords()
  }, [pagination.page, filters, sortBy])

  return (
    <div className="space-y-6">
      {/* 필터 섹션 */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">필터 설정</h3>
        <div className="space-y-4">
          {/* 정렬 옵션 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">정렬 옵션</label>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="cafe_asc_search_desc">카페문서수 오름차순 + 총검색수 내림차순 (기본)</option>
              <option value="cafe_desc_search_desc">카페문서수 내림차순 + 총검색수 내림차순</option>
              <option value="search_desc_cafe_asc">총검색수 내림차순 + 카페문서수 오름차순</option>
              <option value="search_desc">총검색수 내림차순만</option>
            </select>
          </div>
          {/* 첫 번째 행: 총검색수, 카페문서수, 블로그문서수 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 총검색수 필터 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">총검색수</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="최소"
                  value={filters.minSearch || ''}
                  onChange={(e) => handleFilterChange('minSearch', parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="self-center text-gray-500 text-sm">~</span>
                <input
                  type="number"
                  placeholder="최대"
                  value={filters.maxSearch === 999999999 ? '' : filters.maxSearch}
                  onChange={(e) => handleFilterChange('maxSearch', parseInt(e.target.value) || 999999999)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* 카페문서수 필터 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">카페문서수</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="최소"
                  value={filters.minCafe || ''}
                  onChange={(e) => handleFilterChange('minCafe', parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="self-center text-gray-500 text-sm">~</span>
                <input
                  type="number"
                  placeholder="최대"
                  value={filters.maxCafe === 999999999 ? '' : filters.maxCafe}
                  onChange={(e) => handleFilterChange('maxCafe', parseInt(e.target.value) || 999999999)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* 블로그문서수 필터 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">블로그문서수</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="최소"
                  value={filters.minBlog || ''}
                  onChange={(e) => handleFilterChange('minBlog', parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="self-center text-gray-500 text-sm">~</span>
                <input
                  type="number"
                  placeholder="최대"
                  value={filters.maxBlog === 999999999 ? '' : filters.maxBlog}
                  onChange={(e) => handleFilterChange('maxBlog', parseInt(e.target.value) || 999999999)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* 두 번째 행: 웹문서수, 뉴스문서수, 수집일 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 웹문서수 필터 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">웹문서수</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="최소"
                  value={filters.minWeb || ''}
                  onChange={(e) => handleFilterChange('minWeb', parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="self-center text-gray-500 text-sm">~</span>
                <input
                  type="number"
                  placeholder="최대"
                  value={filters.maxWeb === 999999999 ? '' : filters.maxWeb}
                  onChange={(e) => handleFilterChange('maxWeb', parseInt(e.target.value) || 999999999)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* 뉴스문서수 필터 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">뉴스문서수</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="최소"
                  value={filters.minNews || ''}
                  onChange={(e) => handleFilterChange('minNews', parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="self-center text-gray-500 text-sm">~</span>
                <input
                  type="number"
                  placeholder="최대"
                  value={filters.maxNews === 999999999 ? '' : filters.maxNews}
                  onChange={(e) => handleFilterChange('maxNews', parseInt(e.target.value) || 999999999)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* 수집일 필터 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">수집일 (일)</label>
              <select
                value={filters.days}
                onChange={(e) => handleFilterChange('days', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>최근 7일</option>
                <option value={30}>최근 30일</option>
                <option value={90}>최근 90일</option>
                <option value={365}>최근 1년</option>
                <option value={999999}>전체</option>
              </select>
            </div>
          </div>
        </div>

        {/* 자동수집 설정 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-md font-semibold text-blue-800 mb-3">자동수집 설정</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">시드키워드 개수</label>
              <input
                type="number"
                min="1"
                max="100"
                value={autoCollectSettings.seedCount}
                onChange={(e) => setAutoCollectSettings(prev => ({ 
                  ...prev, 
                  seedCount: parseInt(e.target.value) || 10 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="시드키워드 개수"
              />
              <p className="text-xs text-gray-500">현재 수집된 키워드 중 검색량이 높은 순서로 시드키워드 선택</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">시드키워드당 최대 수집 개수</label>
              <input
                type="number"
                min="100"
                max="1000"
                value={autoCollectSettings.maxKeywordsPerSeed}
                onChange={(e) => setAutoCollectSettings(prev => ({ 
                  ...prev, 
                  maxKeywordsPerSeed: parseInt(e.target.value) || 1000 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="최대 수집 개수"
              />
              <p className="text-xs text-gray-500">각 시드키워드에서 수집할 연관검색어 최대 개수</p>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">자동수집 활성화:</span>
              <button
                onClick={() => setAutoCollectSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  autoCollectSettings.enabled 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {autoCollectSettings.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              예상 수집량: {(autoCollectSettings.seedCount * Number(autoCollectSettings.maxKeywordsPerSeed)).toLocaleString()}개
            </div>
          </div>
          
          <div className="mt-4 flex justify-center">
            <button
              onClick={runAutoCollect}
              disabled={collectingDocs || !autoCollectSettings.enabled}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                collectingDocs || !autoCollectSettings.enabled
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {collectingDocs ? '🔄 자동수집 중...' : '🚀 자동수집 실행'}
            </button>
          </div>
        </div>

        {/* 필터 초기화 버튼 */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              setFilters({
                minSearch: 0,
                maxSearch: 999999999,
                minCafe: 0,
                maxCafe: 999999999,
                minBlog: 0,
                maxBlog: 999999999,
                minWeb: 0,
                maxWeb: 999999999,
                minNews: 0,
                maxNews: 999999999,
                days: 30
              })
              setPagination(prev => ({ ...prev, page: 1 }))
            }}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">수집된 키워드 데이터</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              총 {pagination.total}개 키워드
            </span>
            <a 
              href="/insights" 
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              📊 인사이트 보기
            </a>
            <button
              onClick={collectDocumentCounts}
              disabled={collectingDocs || keywords.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {collectingDocs ? '문서수 수집 중...' : `문서수 수집 (미수집 ${pagination.total}개)`}
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">자동수집:</span>
              <button
                onClick={toggleAutoCollect}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  autoCollect 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {autoCollect ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* 필터 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              최소 검색량
            </label>
            <input
              type="number"
              value={filters.minSearch}
              onChange={(e) => handleFilterChange('minSearch', parseInt(e.target.value) || 0)}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              최대 카페 문서수
            </label>
            <input
              type="number"
              value={filters.maxCafe}
              onChange={(e) => handleFilterChange('maxCafe', parseInt(e.target.value) || 999999)}
              className="input-field"
              placeholder="999999"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수집일 (일)
            </label>
            <select
              value={filters.days}
              onChange={(e) => handleFilterChange('days', parseInt(e.target.value))}
              className="input-field"
            >
              <option value={7}>7일</option>
              <option value={30}>30일</option>
              <option value={90}>90일</option>
              <option value={365}>1년</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchKeywords}
              className="btn-primary w-full"
            >
              필터 적용
            </button>
          </div>
        </div>

        {/* 테이블 */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">데이터를 불러오는 중...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    키워드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    검색량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    블로그
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    카페
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    웹
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    뉴스
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월클릭수(PC)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월클릭수(M)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월클릭율(PC)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월클릭율(M)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    월평균노출광고수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총 문서수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수집일
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {keywords.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.keyword}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.avg_monthly_search.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.blog_total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.cafe_total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.web_total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.news_total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.monthly_click_pc?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.monthly_click_mobile?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.ctr_pc?.toFixed(2) || 0}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.ctr_mobile?.toFixed(2) || 0}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.ad_count?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.all_total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.collected_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700">
              {pagination.page} / {pagination.totalPages} 페이지
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

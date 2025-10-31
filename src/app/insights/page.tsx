'use client'

import { useState, useEffect } from 'react'

interface InsightKeyword {
  keyword: string
  searchVolume: number
  cafeDocs: number
  blogDocs: number
  webDocs: number
  newsDocs: number
  totalDocs: number
  adCount: number
  cpc: number
  compIndex: number
}

interface InsightData {
  title: string
  description: string
  keywords: InsightKeyword[]
  count: number
}

interface InsightsResponse {
  success: boolean
  insights: {
    cafeInsights: InsightData
    blogInsights: InsightData
    webInsights: InsightData
    newsInsights: InsightData
    totalDocsInsights: InsightData
    adCountInsights: InsightData
  }
  summary: {
    totalKeywords: number
    minSearchVolume: number
    limit: number
    generatedAt: string
  }
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightsResponse['insights'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [minSearchVolume, setMinSearchVolume] = useState(10000)
  const [limit, setLimit] = useState(50) // 50개로 변경

  const fetchInsights = async () => {
    setLoading(true)
    try {
      // keywords API에서 모든 데이터를 가져옴 (페이징 없이)
      const response = await fetch(`/api/keywords?pageSize=10000`, {
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (!response.ok) {
        throw new Error('키워드 데이터 조회에 실패했습니다.')
      }

      const data = await response.json()
      const keywords = data.keywords || []

      // 인사이트 분석 로직
      const insights = analyzeKeywordsForInsights(keywords, minSearchVolume, limit)
      setInsights(insights)
    } catch (error) {
      console.error('인사이트 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }

  // 키워드 데이터를 인사이트로 분석하는 함수
  const analyzeKeywordsForInsights = (keywords: any[], minSearchVolume: number, limit: number) => {
    // 1. 총검색수 많고, 카페수 적음 (카페수 0 제외, 50개)
    const cafeInsights = {
      title: "🔥 카페 잠재력 키워드",
      description: `검색량 ${formatNumber(minSearchVolume)}+ 이고 카페 문서수가 적은 키워드`,
      keywords: keywords
        .filter(k => k.avg_monthly_search >= minSearchVolume && k.cafe_total > 0 && k.cafe_total < 1000)
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.cafe_total + k.blog_total + k.web_total + k.news_total,
          adCount: k.ad_count,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    cafeInsights.count = cafeInsights.keywords.length

    // 2. 총검색수 많고, 블로그문서수 적음 (블로그수 0 제외, 50개)
    const blogInsights = {
      title: "📝 블로그 잠재력 키워드",
      description: `검색량 ${formatNumber(minSearchVolume)}+ 이고 블로그 문서수가 적은 키워드`,
      keywords: keywords
        .filter(k => k.avg_monthly_search >= minSearchVolume && k.blog_total > 0 && k.blog_total < 1000)
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.cafe_total + k.blog_total + k.web_total + k.news_total,
          adCount: k.ad_count,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    blogInsights.count = blogInsights.keywords.length

    // 3. 총검색수 많고, 웹문서수 적음 (웹수 0 제외, 50개)
    const webInsights = {
      title: "🌐 웹 잠재력 키워드",
      description: `검색량 ${formatNumber(minSearchVolume)}+ 이고 웹 문서수가 적은 키워드`,
      keywords: keywords
        .filter(k => k.avg_monthly_search >= minSearchVolume && k.web_total > 0 && k.web_total < 1000)
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.cafe_total + k.blog_total + k.web_total + k.news_total,
          adCount: k.ad_count,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    webInsights.count = webInsights.keywords.length

    // 4. 총검색수 많고, 뉴스 적음 (뉴스수 0 제외, 50개)
    const newsInsights = {
      title: "📰 뉴스 잠재력 키워드",
      description: `검색량 ${formatNumber(minSearchVolume)}+ 이고 뉴스 문서수가 적은 키워드`,
      keywords: keywords
        .filter(k => k.avg_monthly_search >= minSearchVolume && k.news_total > 0 && k.news_total < 100)
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.cafe_total + k.blog_total + k.web_total + k.news_total,
          adCount: k.ad_count,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    newsInsights.count = newsInsights.keywords.length

    // 5. 총검색수 많고, 월광고수 적음 (광고수 0 제외, 50개)
    const adCountInsights = {
      title: "💰 광고 잠재력 키워드",
      description: `검색량 ${formatNumber(minSearchVolume)}+ 이고 월 광고수가 적은 키워드`,
      keywords: keywords
        .filter(k => k.avg_monthly_search >= minSearchVolume && k.ad_count > 0 && k.ad_count < 5)
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.cafe_total + k.blog_total + k.web_total + k.news_total,
          adCount: k.ad_count,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    adCountInsights.count = adCountInsights.keywords.length

    // 빈 totalDocsInsights (호환성을 위해)
    const totalDocsInsights = {
      title: "📊 총문서 인사이트",
      description: "총문서 수 기반 인사이트",
      keywords: [],
      count: 0
    }

    return {
      cafeInsights,
      blogInsights,
      webInsights,
      newsInsights,
      totalDocsInsights,
      adCountInsights
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [])

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}만`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}천`
    }
    return num.toLocaleString()
  }

  const InsightCard = ({ title, description, keywords, count }: InsightData) => (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
          {count}개
        </span>
      </div>
      
      {keywords.length === 0 ? (
        <p className="text-gray-500 text-center py-8">해당 조건에 맞는 키워드가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">키워드</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">검색량</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카페</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">블로그</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">웹</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">뉴스</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총문서</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">광고수</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPC</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {keywords.map((keyword, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                    {keyword.keyword}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(keyword.searchVolume)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {keyword.cafeDocs.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {keyword.blogDocs.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {keyword.webDocs.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {keyword.newsDocs.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {keyword.totalDocs.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {keyword.adCount}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                    {keyword.cpc ? keyword.cpc.toFixed(1) : '0.0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">키워드 인사이트</h1>
          <p className="text-gray-600">골든 키워드 발견을 위한 데이터 분석</p>
        </div>

        {/* 필터 설정 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">필터 설정</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                최소 검색량
              </label>
              <input
                type="number"
                value={minSearchVolume}
                onChange={(e) => setMinSearchVolume(parseInt(e.target.value) || 10000)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                표시 개수
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="20"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchInsights}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '분석 중...' : '인사이트 새로고침'}
              </button>
            </div>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">인사이트 분석 중...</p>
          </div>
        )}

        {/* 인사이트 카드들 */}
        {insights && !loading && (
          <div className="space-y-6">
            <InsightCard {...insights.cafeInsights} />
            <InsightCard {...insights.blogInsights} />
            <InsightCard {...insights.webInsights} />
            <InsightCard {...insights.newsInsights} />
            <InsightCard {...insights.totalDocsInsights} />
            <InsightCard {...insights.adCountInsights} />
          </div>
        )}

        {/* 요약 정보 */}
        {insights && !loading && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">분석 요약</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {insights.cafeInsights.count}
                </div>
                <div className="text-sm text-blue-800">카페 인사이트</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {insights.blogInsights.count}
                </div>
                <div className="text-sm text-green-800">블로그 인사이트</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {insights.webInsights.count}
                </div>
                <div className="text-sm text-purple-800">웹 인사이트</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {insights.newsInsights.count}
                </div>
                <div className="text-sm text-yellow-800">뉴스 인사이트</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {insights.adCountInsights.count}
                </div>
                <div className="text-sm text-red-800">광고 인사이트</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
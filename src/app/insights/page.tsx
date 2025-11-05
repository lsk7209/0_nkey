'use client'

import { useState, useEffect } from 'react'
import type { InsightsResponse } from '@/types/api'
import { handleApiError, logError, getUserFriendlyErrorMessage } from '@/utils/error-handler'

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightsResponse['insights'] | null>(null)
  const [loading, setLoading] = useState(false)
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

      // 인사이트 분석 로직 (검색량 기준 없이 높은 순으로 정렬)
      console.log(`인사이트 분석: 총 ${keywords.length}개 키워드 분석 시작`)

      const insights = analyzeKeywordsForInsights(keywords, limit)
      setInsights(insights)
    } catch (error) {
      console.error('인사이트 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }

  // 키워드 데이터를 인사이트로 분석하는 함수 (검색량 높은 순으로 정렬)
  const analyzeKeywordsForInsights = (keywords: any[], limit: number) => {
    // 카페 문서수 범위 계산 (안전하게)
    const cafeTotals = keywords.map(k => k.cafe_total || 0).filter(v => v > 0)
    const maxCafeTotal = cafeTotals.length > 0 ? Math.min(1000, Math.max(...cafeTotals)) : 0
    
    // 1. 카페 잠재력: 검색량 높고 카페 문서수 낮음 (1-1000개, 검색량 0 제외)
    const cafeInsights = {
      title: "🔥 카페 잠재력 키워드",
      description: `검색량 상위권 + 카페 문서수 낮음 (1-${maxCafeTotal}개)`,
      keywords: keywords
        .filter(k => {
          const cafeDocs = k.cafe_total || 0
          const searchVol = k.avg_monthly_search || 0
          return cafeDocs > 0 && cafeDocs < 1000 && searchVol > 0 // 검색량 0도 제외
        })
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search || 0,
          cafeDocs: k.cafe_total || 0,
          blogDocs: k.blog_total || 0,
          webDocs: k.web_total || 0,
          newsDocs: k.news_total || 0,
          totalDocs: (k.cafe_total || 0) + (k.blog_total || 0) + (k.web_total || 0) + (k.news_total || 0),
          adCount: k.ad_count || 0,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    cafeInsights.count = cafeInsights.keywords.length

    // 블로그 문서수 범위 계산 (안전하게)
    const blogTotals = keywords.map(k => k.blog_total || 0).filter(v => v > 0)
    const maxBlogTotal = blogTotals.length > 0 ? Math.min(1000, Math.max(...blogTotals)) : 0
    
    // 2. 블로그 잠재력: 검색량 높고 블로그 문서수 낮음 (1-1000개, 검색량 0 제외)
    const blogInsights = {
      title: "📝 블로그 잠재력 키워드",
      description: `검색량 상위권 + 블로그 문서수 낮음 (1-${maxBlogTotal}개)`,
      keywords: keywords
        .filter(k => {
          const blogDocs = k.blog_total || 0
          const searchVol = k.avg_monthly_search || 0
          return blogDocs > 0 && blogDocs < 1000 && searchVol > 0 // 검색량 0도 제외
        })
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search || 0,
          cafeDocs: k.cafe_total || 0,
          blogDocs: k.blog_total || 0,
          webDocs: k.web_total || 0,
          newsDocs: k.news_total || 0,
          totalDocs: (k.cafe_total || 0) + (k.blog_total || 0) + (k.web_total || 0) + (k.news_total || 0),
          adCount: k.ad_count || 0,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    blogInsights.count = blogInsights.keywords.length

    // 웹 문서수 범위 계산 (안전하게)
    const webTotals = keywords.map(k => k.web_total || 0).filter(v => v > 0)
    const maxWebTotal = webTotals.length > 0 ? Math.min(1000, Math.max(...webTotals)) : 0
    
    // 3. 웹 잠재력: 검색량 높고 웹 문서수 낮음 (1-1000개, 검색량 0 제외)
    const webInsights = {
      title: "🌐 웹 잠재력 키워드",
      description: `검색량 상위권 + 웹 문서수 낮음 (1-${maxWebTotal}개)`,
      keywords: keywords
        .filter(k => {
          const webDocs = k.web_total || 0
          const searchVol = k.avg_monthly_search || 0
          return webDocs > 0 && webDocs < 1000 && searchVol > 0 // 검색량 0도 제외
        })
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search || 0,
          cafeDocs: k.cafe_total || 0,
          blogDocs: k.blog_total || 0,
          webDocs: k.web_total || 0,
          newsDocs: k.news_total || 0,
          totalDocs: (k.cafe_total || 0) + (k.blog_total || 0) + (k.web_total || 0) + (k.news_total || 0),
          adCount: k.ad_count || 0,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    webInsights.count = webInsights.keywords.length

    // 뉴스 문서수 범위 계산 (안전하게)
    const newsTotals = keywords.map(k => k.news_total || 0).filter(v => v > 0)
    const maxNewsTotal = newsTotals.length > 0 ? Math.min(100, Math.max(...newsTotals)) : 0
    
    // 4. 뉴스 잠재력: 검색량 높고 뉴스 문서수 낮음 (1-100개, 검색량 0 제외)
    const newsInsights = {
      title: "📰 뉴스 잠재력 키워드",
      description: `검색량 상위권 + 뉴스 문서수 낮음 (1-${maxNewsTotal}개)`,
      keywords: keywords
        .filter(k => {
          const newsDocs = k.news_total || 0
          const searchVol = k.avg_monthly_search || 0
          return newsDocs > 0 && newsDocs < 100 && searchVol > 0 // 검색량 0도 제외
        })
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search || 0,
          cafeDocs: k.cafe_total || 0,
          blogDocs: k.blog_total || 0,
          webDocs: k.web_total || 0,
          newsDocs: k.news_total || 0,
          totalDocs: (k.cafe_total || 0) + (k.blog_total || 0) + (k.web_total || 0) + (k.news_total || 0),
          adCount: k.ad_count || 0,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    newsInsights.count = newsInsights.keywords.length

    // 광고수 범위 계산 (안전하게)
    const adCounts = keywords.map(k => k.ad_count || 0)
    const maxAdCount = adCounts.length > 0 ? Math.min(5, Math.max(...adCounts)) : 0
    
    // 5. 광고 잠재력: 검색량 높고 광고수 낮음 (검색량 0 제외)
    const adCountInsights = {
      title: "💰 광고 잠재력 키워드",
      description: `검색량 상위권 + 월 광고수 낮음 (0-${maxAdCount}개)`,
      keywords: keywords
        .filter(k => {
          const adCount = k.ad_count || 0
          const searchVol = k.avg_monthly_search || 0
          return adCount < 5 && searchVol > 0 // 검색량 0도 제외
        })
        .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search || 0,
          cafeDocs: k.cafe_total || 0,
          blogDocs: k.blog_total || 0,
          webDocs: k.web_total || 0,
          newsDocs: k.news_total || 0,
          totalDocs: (k.cafe_total || 0) + (k.blog_total || 0) + (k.web_total || 0) + (k.news_total || 0),
          adCount: k.ad_count || 0,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    adCountInsights.count = adCountInsights.keywords.length

    // 총문서수 범위 계산 (안전하게)
    const totalDocsValues = keywords.map(k => (k.cafe_total || 0) + (k.blog_total || 0) + (k.web_total || 0) + (k.news_total || 0)).filter(v => v > 0)
    const maxTotalDocs = totalDocsValues.length > 0 ? Math.min(5000, Math.max(...totalDocsValues)) : 0
    
    // 6. 총문서 인사이트: 검색량 높고 총 문서수 낮음 (1-5000개, 검색량 0 제외)
    const totalDocsInsights = {
      title: "📊 총문서 인사이트",
      description: `검색량 상위권 + 총 문서수 낮음 (1-${maxTotalDocs}개)`,
      keywords: keywords
        .filter(k => {
          const totalDocs = (k.cafe_total || 0) + (k.blog_total || 0) + (k.web_total || 0) + (k.news_total || 0)
          const searchVol = k.avg_monthly_search || 0
          return totalDocs > 0 && totalDocs < 5000 && searchVol > 0 // 검색량 0도 제외
        })
        .sort((a, b) => {
          const totalA = (a.cafe_total || 0) + (a.blog_total || 0) + (a.web_total || 0) + (a.news_total || 0)
          const totalB = (b.cafe_total || 0) + (b.blog_total || 0) + (b.web_total || 0) + (b.news_total || 0)
          // 총문서수 오름차순 1순위, 검색량 내림차순 2순위
          if (totalA !== totalB) return totalA - totalB
          return b.avg_monthly_search - a.avg_monthly_search
        })
        .slice(0, limit)
        .map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search || 0,
          cafeDocs: k.cafe_total || 0,
          blogDocs: k.blog_total || 0,
          webDocs: k.web_total || 0,
          newsDocs: k.news_total || 0,
          totalDocs: (k.cafe_total || 0) + (k.blog_total || 0) + (k.web_total || 0) + (k.news_total || 0),
          adCount: k.ad_count || 0,
          cpc: 0,
          compIndex: 0
        })),
      count: 0
    }
    totalDocsInsights.count = totalDocsInsights.keywords.length

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정렬 방식
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                🔝 검색량 높은 순
              </div>
              <p className="text-xs text-gray-500 mt-1">각 카테고리별로 검색량 기준 내림차순 정렬</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                표시 개수
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="50"
                min="1"
                max="100"
              />
            </div>
            <div className="md:col-span-2 flex justify-center">
              <button
                onClick={fetchInsights}
                disabled={loading}
                className="w-full max-w-xs bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
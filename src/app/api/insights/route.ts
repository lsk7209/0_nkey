import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'

// 인사이트 데이터 조회 API
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const minSearchVolume = parseInt(url.searchParams.get('minSearchVolume') || '10000')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    console.log(`📊 인사이트 데이터 조회: 최소검색량 ${minSearchVolume}, 제한 ${limit}개`)

    // 모든 키워드 데이터 가져오기
    const result = persistentDB.getKeywords(
      minSearchVolume, // minSearch
      999999999,      // maxSearch
      0,              // minCafe
      999999999,      // maxCafe
      0,              // minBlog
      999999999,      // maxBlog
      0,              // minWeb
      999999999,      // maxWeb
      0,              // minNews
      999999999,      // maxNews
      30,             // days
      1,              // page
      999999,         // limit (모든 데이터 가져오기)
      'search_desc'   // sortBy
    )
    const allKeywords = result.keywords

    console.log(`📈 총 ${allKeywords.length}개 키워드 중 인사이트 분석`)

    // 1. 카페문서수 적고 + 총검색량 많음
    const cafeInsights = allKeywords
      .filter(k => k.cafe_total > 0 && k.cafe_total <= 1000) // 카페문서수 1-1000개
      .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
      .slice(0, limit)

    // 2. 블로그문서수 적고 + 총검색량 많음
    const blogInsights = allKeywords
      .filter(k => k.blog_total > 0 && k.blog_total <= 1000) // 블로그문서수 1-1000개
      .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
      .slice(0, limit)

    // 3. 웹문서수 적고 + 총검색량 많음
    const webInsights = allKeywords
      .filter(k => k.web_total > 0 && k.web_total <= 1000) // 웹문서수 1-1000개
      .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
      .slice(0, limit)

    // 4. 뉴스문서수 적고 + 총검색량 많음
    const newsInsights = allKeywords
      .filter(k => k.news_total > 0 && k.news_total <= 100) // 뉴스문서수 1-100개
      .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
      .slice(0, limit)

    // 5. 총문서수 적고 + 총검색량 많음
    const totalDocsInsights = allKeywords
      .filter(k => {
        const totalDocs = k.blog_total + k.cafe_total + k.web_total + k.news_total
        return totalDocs > 0 && totalDocs <= 2000 // 총문서수 1-2000개
      })
      .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
      .slice(0, limit)

    // 6. 총검색량 많음 + 월평균노출광고수 적음
    const adCountInsights = allKeywords
      .filter(k => k.ad_count > 0 && k.ad_count <= 5) // 광고수 1-5개
      .sort((a, b) => b.avg_monthly_search - a.avg_monthly_search)
      .slice(0, limit)

    const insights = {
      cafeInsights: {
        title: '카페문서수 적고 + 총검색량 많음',
        description: `카페문서수 1-1000개, 총검색량 ${minSearchVolume} 이상`,
        keywords: cafeInsights.map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.blog_total + k.cafe_total + k.web_total + k.news_total,
          adCount: k.ad_count || 0,
          cpc: k.cpc || 0,
          compIndex: k.comp_index || 0
        })),
        count: cafeInsights.length
      },
      blogInsights: {
        title: '블로그문서수 적고 + 총검색량 많음',
        description: `블로그문서수 1-1000개, 총검색량 ${minSearchVolume} 이상`,
        keywords: blogInsights.map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.blog_total + k.cafe_total + k.web_total + k.news_total,
          adCount: k.ad_count || 0,
          cpc: k.cpc || 0,
          compIndex: k.comp_index || 0
        })),
        count: blogInsights.length
      },
      webInsights: {
        title: '웹문서수 적고 + 총검색량 많음',
        description: `웹문서수 1-1000개, 총검색량 ${minSearchVolume} 이상`,
        keywords: webInsights.map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.blog_total + k.cafe_total + k.web_total + k.news_total,
          adCount: k.ad_count || 0,
          cpc: k.cpc || 0,
          compIndex: k.comp_index || 0
        })),
        count: webInsights.length
      },
      newsInsights: {
        title: '뉴스문서수 적고 + 총검색량 많음',
        description: `뉴스문서수 1-100개, 총검색량 ${minSearchVolume} 이상`,
        keywords: newsInsights.map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.blog_total + k.cafe_total + k.web_total + k.news_total,
          adCount: k.ad_count || 0,
          cpc: k.cpc || 0,
          compIndex: k.comp_index || 0
        })),
        count: newsInsights.length
      },
      totalDocsInsights: {
        title: '총문서수 적고 + 총검색량 많음',
        description: `총문서수 1-2000개, 총검색량 ${minSearchVolume} 이상`,
        keywords: totalDocsInsights.map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.blog_total + k.cafe_total + k.web_total + k.news_total,
          adCount: k.ad_count || 0,
          cpc: k.cpc || 0,
          compIndex: k.comp_index || 0
        })),
        count: totalDocsInsights.length
      },
      adCountInsights: {
        title: '총검색량 많음 + 월평균노출광고수 적음',
        description: `광고수 1-5개, 총검색량 ${minSearchVolume} 이상`,
        keywords: adCountInsights.map(k => ({
          keyword: k.keyword,
          searchVolume: k.avg_monthly_search,
          cafeDocs: k.cafe_total,
          blogDocs: k.blog_total,
          webDocs: k.web_total,
          newsDocs: k.news_total,
          totalDocs: k.blog_total + k.cafe_total + k.web_total + k.news_total,
          adCount: k.ad_count || 0,
          cpc: k.cpc || 0,
          compIndex: k.comp_index || 0
        })),
        count: adCountInsights.length
      }
    }

    console.log(`📊 인사이트 분석 완료: 카페 ${cafeInsights.length}개, 블로그 ${blogInsights.length}개, 웹 ${webInsights.length}개, 뉴스 ${newsInsights.length}개, 총문서 ${totalDocsInsights.length}개, 광고수 ${adCountInsights.length}개`)

    return NextResponse.json({
      success: true,
      insights,
      summary: {
        totalKeywords: allKeywords.length,
        minSearchVolume,
        limit,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('❌ 인사이트 데이터 조회 에러:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

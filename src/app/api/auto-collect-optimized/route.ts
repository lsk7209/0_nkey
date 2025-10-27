import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'
import { NaverAdsApi } from '@/lib/naver-api'
import { createNaverOpenApiStrict } from '@/lib/naver-openapi-strict'

// 다중 API 키로 최적화된 배치 자동수집
export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { seedCount = 10, maxKeywordsPerSeed = 1000, batchSize = 5 } = await request.json()
    
    console.log(`🚀 다중 API 키 최적화 자동수집 시작: 시드 ${seedCount}개, 시드당 ${maxKeywordsPerSeed}개, 배치 ${batchSize}개`)

    // 사용되지 않은 키워드 중 검색량 높은 순으로 시드키워드 선택
    const unusedKeywords = persistentDB.getUnusedKeywordsBySearchVolume(seedCount)
    
    if (unusedKeywords.length === 0) {
      return NextResponse.json({
        success: false,
        message: '시드키워드로 사용할 수 있는 키워드가 없습니다. (모든 키워드가 최근 30일 이내에 시드로 사용됨)'
      })
    }

    const seedKeywords = unusedKeywords.slice(0, seedCount)
    console.log(`🌱 선택된 시드키워드 ${seedKeywords.length}개 (검색량 높은 순):`, 
      seedKeywords.map(k => `${k.keyword}(${k.avg_monthly_search.toLocaleString()})`))

    const naverAdsApi = new NaverAdsApi()
    const naverOpenApi = createNaverOpenApiStrict()
    
    const results = []
    let totalNewCount = 0
    let totalUpdatedCount = 0
    let totalSkippedCount = 0

    // 배치 처리로 병렬 수집 최적화
    for (let i = 0; i < seedKeywords.length; i += batchSize) {
      const batch = seedKeywords.slice(i, i + batchSize)
      console.log(`🔄 배치 ${Math.floor(i/batchSize) + 1}/${Math.ceil(seedKeywords.length/batchSize)} 처리: ${batch.length}개 시드키워드`)
      
      // 배치 내 병렬 처리
      const batchPromises = batch.map(async (seedKeyword, batchIndex) => {
        const seedKeywordText = seedKeyword.keyword
        let newCount = 0
        let updatedCount = 0
        let skippedCount = 0
        
        try {
          console.log(`🔍 [배치${Math.floor(i/batchSize) + 1}-${batchIndex + 1}] 시드키워드 처리: "${seedKeywordText}"`)
          
          // 시드키워드 사용 기록 저장
          persistentDB.markSeedAsUsed(seedKeywordText)
          
          // 다중 API 키로 연관검색어 수집
          const relatedKeywords = await naverAdsApi.getRelatedKeywords(seedKeywordText)
          
          // 최대 키워드 수 제한
          const limitedKeywords = relatedKeywords.slice(0, maxKeywordsPerSeed)
          console.log(`📊 "${seedKeywordText}"에서 ${limitedKeywords.length}개 키워드 수집 (최대 ${maxKeywordsPerSeed}개)`)
          
          for (const keywordData of limitedKeywords) {
            const keyword = keywordData.keyword
            
            // 중복 키워드 체크 (30일 기준)
            const existsResult = persistentDB.keywordExists(keyword)
            
            if (existsResult.exists && existsResult.isRecent) {
              // 30일 이내: 패스
              skippedCount++
              continue
            } else if (existsResult.exists && !existsResult.isRecent) {
              // 30일 이후: 갱신
              const keywordId = existsResult.keywordId!
              persistentDB.updateKeyword(keywordId, seedKeywordText, keyword, 'naver-ads')
              persistentDB.insertKeywordMetrics(
                keywordId,
                keywordData.monthly_search_pc || 0,
                keywordData.monthly_search_mob || 0,
                keywordData.avg_monthly_search || 0,
                keywordData.monthly_click_pc || 0,
                keywordData.monthly_click_mobile || 0,
                keywordData.ctr_pc || 0,
                keywordData.ctr_mobile || 0,
                keywordData.ad_count || 0,
                keywordData.cpc || 0,
                keywordData.comp_index || 0
              )
              updatedCount++
            } else {
              // 새 키워드 저장
              const keywordId = persistentDB.insertKeyword(seedKeywordText, keyword)
              persistentDB.insertKeywordMetrics(
                keywordId,
                keywordData.monthly_search_pc || 0,
                keywordData.monthly_search_mob || 0,
                keywordData.avg_monthly_search || 0,
                keywordData.monthly_click_pc || 0,
                keywordData.monthly_click_mobile || 0,
                keywordData.ctr_pc || 0,
                keywordData.ctr_mobile || 0,
                keywordData.ad_count || 0,
                keywordData.cpc || 0,
                keywordData.comp_index || 0
              )
              newCount++
              
              // 다중 API 키로 문서수 수집 (백그라운드, 빠른 지연)
              setTimeout(async () => {
                try {
                  const docCounts = await naverOpenApi.getDocCounts(keyword)
                  persistentDB.insertNaverDocCounts(
                    keywordId,
                    docCounts.blog_total,
                    docCounts.cafe_total,
                    docCounts.web_total,
                    docCounts.news_total
                  )
                  console.log(`📄 문서수 수집 완료: "${keyword}"`)
                } catch (error) {
                  console.error(`❌ 문서수 수집 실패: "${keyword}"`, error)
                }
              }, Math.random() * 1000 + 500) // 0.5-1.5초 랜덤 지연 (다중 키로 최고 속도)
            }
          }
          
          return {
            seedKeyword: seedKeywordText,
            status: 'success',
            newCount,
            updatedCount,
            skippedCount,
            totalProcessed: limitedKeywords.length
          }
          
        } catch (error) {
          console.error(`❌ 배치 시드키워드 처리 실패: "${seedKeywordText}"`, error)
          return {
            seedKeyword: seedKeywordText,
            status: 'error',
            message: (error as Error).message,
            newCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            totalProcessed: 0
          }
        }
      })
      
      // 배치 병렬 실행
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // 배치별 결과 집계
      batchResults.forEach(result => {
        totalNewCount += result.newCount
        totalUpdatedCount += result.updatedCount
        totalSkippedCount += result.skippedCount
      })
      
      console.log(`✅ 배치 ${Math.floor(i/batchSize) + 1} 완료: 신규 ${batchResults.reduce((sum, r) => sum + r.newCount, 0)}개, 갱신 ${batchResults.reduce((sum, r) => sum + r.updatedCount, 0)}개, 패스 ${batchResults.reduce((sum, r) => sum + r.skippedCount, 0)}개`)
      
      // 배치 간 짧은 지연 (다중 키로 최적화)
      if (i + batchSize < seedKeywords.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`🎯 다중 API 키 최적화 자동수집 완료: 총 신규 ${totalNewCount}개, 갱신 ${totalUpdatedCount}개, 패스 ${totalSkippedCount}개`)

    return NextResponse.json({
      success: true,
      message: `다중 API 키 최적화 자동수집 완료`,
      summary: {
        totalSeeds: seedKeywords.length,
        totalNew: totalNewCount,
        totalUpdated: totalUpdatedCount,
        totalSkipped: totalSkippedCount,
        batchSize,
        processingTime: '최적화됨'
      },
      results
    })

  } catch (error: any) {
    console.error('❌ 다중 API 키 최적화 자동수집 에러:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}

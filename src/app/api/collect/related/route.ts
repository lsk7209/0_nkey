import { NextRequest, NextResponse } from 'next/server'
import { optimizedNaverAdsClient } from '@/lib/optimized-naver-api'
import { persistentDB } from '@/lib/persistent-db'
import { CacheService } from '@/lib/db'

interface KeywordData {
  keyword: string
  monthly_search_pc: number
  monthly_search_mob: number
  avg_monthly_search: number
  monthly_click_pc?: number
  monthly_click_mobile?: number
  ctr_pc?: number
  ctr_mobile?: number
  ad_count?: number
  cpc?: number
  comp_index?: number
}

interface CollectRequest {
  seed: string
  keywords?: KeywordData[]
}

// 네이버 검색광고 API로 연관검색어 조회
async function fetchRelatedKeywords(seed: string): Promise<KeywordData[]> {
  console.log('🔍 fetchRelatedKeywords 호출:', seed)
  
  const cache = new CacheService()
  const cacheKey = `related:${seed}`
  
  // 캐시 확인 (임시로 비활성화)
  // const cached = await cache.get(cacheKey)
  // if (cached) {
  //   console.log(`Using cached data for seed: ${seed}`)
  //   return cached
  // }

  try {
    console.log('🚀 실제 네이버 API 호출 시작...')
    
    // 실제 네이버 검색광고 API 직접 호출
    const timestamp = Date.now().toString()
    const method = 'GET'
    const uri = '/keywordstool'
    
    // 환경변수에서 API 키 가져오기
    const apiKey = process.env.SEARCHAD_API_KEY
    const secret = process.env.SEARCHAD_SECRET
    const customerId = process.env.SEARCHAD_CUSTOMER_ID
    
    console.log('🔑 API 키 상태:', apiKey ? '설정됨' : '없음')
    
    if (!apiKey || !secret || !customerId) {
      console.log('⚠️ API 키가 없어서 시뮬레이션 데이터 사용')
      // 시뮬레이션 데이터 반환
      const mockKeywords = [
        { suffix: '방법', pc: 1200, mob: 800, cpc: 500, comp: 80 },
        { suffix: '가이드', pc: 900, mob: 600, cpc: 450, comp: 75 },
        { suffix: '팁', pc: 700, mob: 500, cpc: 400, comp: 70 },
        { suffix: '전략', pc: 600, mob: 400, cpc: 350, comp: 65 },
        { suffix: '노하우', pc: 500, mob: 350, cpc: 300, comp: 60 },
        { suffix: '기법', pc: 400, mob: 300, cpc: 250, comp: 55 },
        { suffix: '활용법', pc: 350, mob: 250, cpc: 200, comp: 50 },
        { suffix: '사례', pc: 300, mob: 200, cpc: 180, comp: 45 },
        { suffix: '예시', pc: 250, mob: 180, cpc: 150, comp: 40 },
        { suffix: '도구', pc: 200, mob: 150, cpc: 120, comp: 35 },
      ]

      const keywords = mockKeywords.map(pattern => ({
        keyword: `${seed} ${pattern.suffix}`,
        monthly_search_pc: pattern.pc,
        monthly_search_mob: pattern.mob,
        avg_monthly_search: pattern.pc + pattern.mob,
        cpc: pattern.cpc,
        comp_index: pattern.comp
      }))
      
      return keywords
    }
    
    // HMAC-SHA256 시그니처 생성
    const crypto = require('crypto')
    const message = `${timestamp}.${method}.${uri}`
    const signature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64')
    
    console.log('🔐 시그니처 생성 완료')
    
    // API 호출
    const params = new URLSearchParams({
      hintKeywords: seed,
      showDetail: '1'
    })
    
    const url = `https://api.naver.com${uri}?${params}`
    console.log('🌐 API URL:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': apiKey,
        'X-Customer': customerId,
        'X-Signature': signature,
        'Content-Type': 'application/json; charset=UTF-8'
      }
    })
    
    console.log('📡 API 응답 상태:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API 호출 실패:', errorText)
      throw new Error(`API 호출 실패: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('✅ 실제 네이버 API 응답:', data.keywordList.length, '개 키워드')
    
    // 데이터 변환
    const keywords = data.keywordList.map((item: any) => ({
      keyword: item.relKeyword,
      monthly_search_pc: parseInt(item.monthlyPcQcCnt.replace('< ', '')) || 0,
      monthly_search_mob: parseInt(item.monthlyMobileQcCnt.replace('< ', '')) || 0,
      avg_monthly_search: (parseInt(item.monthlyPcQcCnt.replace('< ', '')) || 0) + (parseInt(item.monthlyMobileQcCnt.replace('< ', '')) || 0),
      cpc: parseFloat(item.monthlyAvePcClkCnt) + parseFloat(item.monthlyAveMobileClkCnt),
      comp_index: parseFloat(item.monthlyAvePcCtr) + parseFloat(item.monthlyAveMobileCtr)
    }))
    
    // 캐시 저장 (24시간)
    await cache.set(cacheKey, keywords, 86400)
    
    return keywords
  } catch (error) {
    console.error('Failed to fetch related keywords:', error)
    throw error
  }
}

async function saveKeywords(seed: string, keywords: KeywordData[]): Promise<number> {
  let savedCount = 0
  let skippedCount = 0
  let updatedCount = 0
  
  for (const keywordData of keywords) {
    try {
      // 중복 키워드 체크 (30일 기준)
      const keywordCheck = persistentDB.keywordExists(keywordData.keyword)
      
      if (keywordCheck.exists && keywordCheck.isRecent) {
        // 30일 이내: 패스
        skippedCount++
        console.log(`⏭️ 키워드 패스 (30일 이내): ${keywordData.keyword}`)
        continue
      }
      
      let keywordId: number
      
      if (keywordCheck.exists && !keywordCheck.isRecent) {
        // 30일 이후: 갱신
        keywordId = keywordCheck.keywordId!
        persistentDB.updateKeyword(keywordId, seed, keywordData.keyword, 'naver-ads')
        persistentDB.updateKeywordMetrics(
          keywordId,
          keywordData.monthly_search_pc,
          keywordData.monthly_search_mob,
          keywordData.avg_monthly_search,
          keywordData.monthly_click_pc || 0,
          keywordData.monthly_click_mobile || 0,
          keywordData.ctr_pc || 0,
          keywordData.ctr_mobile || 0,
          keywordData.ad_count || 0,
          keywordData.cpc || 0,
          keywordData.comp_index || 0
        )
        updatedCount++
        console.log(`🔄 키워드 갱신됨: ${keywordData.keyword} (검색량: ${keywordData.avg_monthly_search})`)
      } else {
        // 신규: 저장
        keywordId = persistentDB.insertKeyword(seed, keywordData.keyword, 'naver-ads')
        persistentDB.insertKeywordMetrics(
          keywordId,
          keywordData.monthly_search_pc,
          keywordData.monthly_search_mob,
          keywordData.avg_monthly_search,
          keywordData.monthly_click_pc || 0,
          keywordData.monthly_click_mobile || 0,
          keywordData.ctr_pc || 0,
          keywordData.ctr_mobile || 0,
          keywordData.ad_count || 0,
          keywordData.cpc || 0,
          keywordData.comp_index || 0
        )
        savedCount++
        console.log(`✅ 키워드 저장됨: ${keywordData.keyword} (검색량: ${keywordData.avg_monthly_search})`)
      }
      
      // 네이버 문서수는 별도 API에서 수집 (백그라운드에서 실행)
      
    } catch (error) {
      console.error(`Failed to save keyword ${keywordData.keyword}:`, error)
    }
  }
  
  console.log(`📊 저장 결과: 신규 ${savedCount}개, 갱신 ${updatedCount}개, 패스 ${skippedCount}개`)
  
  // 저장된 키워드들의 문서수 수집 트리거 (백그라운드에서 실행)
  if (savedCount > 0 || updatedCount > 0) {
    const savedKeywords = keywords.filter((_, index) => {
      const keywordData = keywords[index]
      const keywordCheck = persistentDB.keywordExists(keywordData.keyword)
      return !keywordCheck.exists || !keywordCheck.isRecent
    }).map(k => k.keyword)
    
    if (savedKeywords.length > 0) {
      // 백그라운드에서 문서수 수집 실행 (직접 함수 호출)
      setTimeout(async () => {
        try {
          console.log(`📄 백그라운드 문서수 수집 시작: ${savedKeywords.length}개 키워드`)
          
          // 직접 함수 호출로 문서수 수집 (절대규칙 준수)
          const naverOpenApi = createNaverOpenApiStrict()
          
          for (const keyword of savedKeywords) {
            try {
              console.log(`🔍 문서수 수집 중: ${keyword}`)
              
              // 네이버 오픈API로 문서수 조회
              const docCounts = await naverOpenApi.getDocCounts(keyword)
              
              // 키워드 ID 찾기
              const keywordCheck = persistentDB.keywordExists(keyword)
              
              if (keywordCheck.exists && keywordCheck.keywordId) {
                // 문서수 업데이트
                persistentDB.insertNaverDocCounts(
                  keywordCheck.keywordId,
                  docCounts.blog_total,
                  docCounts.cafe_total,
                  docCounts.web_total,
                  docCounts.news_total
                )
                
                console.log(`✅ 문서수 수집 완료: ${keyword} (블로그: ${docCounts.blog_total}, 카페: ${docCounts.cafe_total}, 웹: ${docCounts.web_total}, 뉴스: ${docCounts.news_total})`)
              }
              
              // API 호출 간 지연 (레이트 리미팅 방지)
              await new Promise(resolve => setTimeout(resolve, 100))
              
            } catch (error) {
              console.error(`❌ 문서수 수집 실패: ${keyword}`, error)
            }
          }
          
          console.log(`📄 문서수 수집 완료: ${savedKeywords.length}개 키워드 처리`)
          
        } catch (error) {
          console.error('문서수 수집 트리거 실패:', error)
        }
      }, 2000) // 2초 후 실행
    }
  }
  
  return savedCount + updatedCount
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid admin key' 
        },
        { status: 401 }
      )
    }

    const body: CollectRequest = await request.json()
    const { seed, keywords } = body
    const isPreview = request.nextUrl.searchParams.get('preview') === 'true'

    if (!seed) {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/invalid-input',
          title: 'Invalid Input',
          status: 400,
          detail: 'Seed keyword is required' 
        },
        { status: 400 }
      )
    }

    if (isPreview) {
      // 미리보기 모드 - DB 저장 없이 연관검색어만 반환
      const relatedKeywords = await fetchRelatedKeywords(seed)
      
      return NextResponse.json({
        seed,
        keywords: relatedKeywords,
        count: relatedKeywords.length
      })
    } else {
      // 실제 저장 모드
      if (!keywords || keywords.length === 0) {
        return NextResponse.json(
          { 
            type: 'https://example.com/probs/invalid-input',
            title: 'Invalid Input',
            status: 400,
            detail: 'Keywords data is required' 
          },
          { status: 400 }
        )
      }

      const savedCount = await saveKeywords(seed, keywords)
      
      // 문서수 자동수집 트리거 (백그라운드에서 실행)
      if (savedCount > 0) {
        // 새로 저장된 키워드들의 문서수 수집을 백그라운드에서 실행
        const newKeywords = keywords.slice(0, savedCount)
        setTimeout(async () => {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/collect/naver-docs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-key': process.env.ADMIN_KEY || 'dev-key'
              },
              body: JSON.stringify({ keywords: newKeywords.map(k => k.keyword) })
            })
            
            if (response.ok) {
              console.log(`Document counts collected for ${newKeywords.length} keywords`)
            }
          } catch (error) {
            console.error('Failed to collect document counts:', error)
          }
        }, 1000) // 1초 후 실행
      }
      
      // 자동수집 ON인 경우 새 키워드를 시드로 추가
      const cache = new CacheService()
      const autoCollectEnabled = await cache.get('auto_collect_enabled')
      if (autoCollectEnabled && savedCount > 0) {
        // 새 키워드들을 자동수집 큐에 추가
        for (const keywordData of keywords.slice(0, savedCount)) {
          await cache.set(`auto_collect_queue:${keywordData.keyword}`, {
            seed: keywordData.keyword,
            depth: 1,
            queued_at: new Date().toISOString()
          }, 86400) // 24시간 TTL
        }
        console.log(`Added ${savedCount} keywords to auto-collect queue`)
      }
      
      return NextResponse.json({
        seed,
        saved: savedCount,
        message: `${savedCount}개의 키워드가 저장되었습니다.`
      })
    }

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        type: 'https://example.com/probs/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred' 
      },
      { status: 500 }
    )
  }
}

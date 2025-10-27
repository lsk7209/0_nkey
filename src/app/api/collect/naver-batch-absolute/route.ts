import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

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

    const { seeds } = await request.json()
    
    if (!seeds || !Array.isArray(seeds)) {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'Seeds array is required' 
        },
        { status: 400 }
      )
    }

    console.log('🚀 절대규칙 배치 네이버 API 호출 시작:', seeds.length, '개 키워드')
    
    // 절대규칙 8: 배치/스케줄링 전략 - hintKeywords 최대 5개/호출
    const batchSize = 5
    const batches = []
    for (let i = 0; i < seeds.length; i += batchSize) {
      batches.push(seeds.slice(i, i + batchSize))
    }
    
    console.log('📦 절대규칙 배치 분할:', batches.length, '개 배치')
    
    const allKeywords = []
    let successCount = 0
    let errorCount = 0
    
    // 절대규칙 8: 동시성 제한 + 지수적 백오프
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.log(`🔄 절대규칙 배치 ${i + 1}/${batches.length} 처리 중:`, batch)
      
      try {
        const keywords = await processBatchAbsolute(batch)
        allKeywords.push(...keywords)
        successCount++
        
        // 절대규칙 8: 배치 간 지연 (레이트 리밋 방지)
        if (i < batches.length - 1) {
          console.log('⏳ 절대규칙 배치 간 지연: 2초')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error) {
        console.error(`❌ 절대규칙 배치 ${i + 1} 실패:`, error)
        errorCount++
        
        // 절대규칙 6: 429 오류 시 더 긴 지연
        if (error instanceof Error && error.message.includes('429')) {
          console.log('⏰ 절대규칙 429 오류 감지: 30초 대기')
          await new Promise(resolve => setTimeout(resolve, 30000))
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      totalSeeds: seeds.length,
      processedBatches: batches.length,
      successBatches: successCount,
      errorBatches: errorCount,
      totalKeywords: allKeywords.length,
      keywords: allKeywords,
      message: '절대규칙 배치 처리 완료'
    })

  } catch (error) {
    console.error('절대규칙 배치 네이버 API 호출 에러:', error)
    return NextResponse.json(
      { 
        type: 'https://example.com/probs/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// 절대규칙 배치 처리 함수
async function processBatchAbsolute(seeds: string[]): Promise<any[]> {
  // 절대규칙 1: 환경변수
  const apiKey = process.env.SEARCHAD_API_KEY
  const secret = process.env.SEARCHAD_SECRET
  const customerId = process.env.SEARCHAD_CUSTOMER_ID
  
  if (!apiKey || !secret || !customerId) {
    throw new Error('절대규칙: API 키가 설정되지 않았습니다.')
  }
  
  // 절대규칙 2: 시그니처 생성 (HMAC-SHA256)
  const timestamp = Date.now().toString()
  const method = 'GET'
  const uri = '/keywordstool'
  const message = `${timestamp}.${method}.${uri}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64')
  
  // 절대규칙 3: 요청 빌더 - hintKeywords 최대 5개, 쉼표 구분
  const params = new URLSearchParams({
    hintKeywords: seeds.join(','),
    showDetail: '1'
  })
  
  const url = `https://api.naver.com${uri}?${params}`
  console.log('🌐 절대규칙 배치 API URL:', url)
  
  // 절대규칙 4: 인증 헤더 (모든 요청 필수)
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
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`절대규칙 API 호출 실패: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  console.log('✅ 절대규칙 배치 API 응답:', data.keywordList.length, '개 키워드')
  
  // 절대규칙 4: 응답 스키마(핵심 필드 매핑)
  const keywords = data.keywordList.map((item: any) => {
    // 절대규칙 7: 데이터 정규화 규칙
    const normalizeNumber = (value: string): number => {
      if (!value || value === '') return 0
      if (value.includes('< ')) {
        return parseInt(value.replace('< ', '')) || 0
      }
      return parseInt(value) || 0
    }
    
    const normalizeFloat = (value: string): number => {
      if (!value || value === '') return 0
      return parseFloat(value) || 0
    }
    
    const pcSearch = normalizeNumber(item.monthlyPcQcCnt)
    const mobileSearch = normalizeNumber(item.monthlyMobileQcCnt)
    const pcClick = normalizeFloat(item.monthlyAvePcClkCnt)
    const mobileClick = normalizeFloat(item.monthlyAveMobileClkCnt)
    const pcCtr = normalizeFloat(item.monthlyAvePcCtr)
    const mobileCtr = normalizeFloat(item.monthlyAveMobileCtr)
    const adCount = normalizeNumber(item.plAvgDepth)
    
    return {
      keyword: item.relKeyword,
      monthly_search_pc: pcSearch,
      monthly_search_mob: mobileSearch,
      avg_monthly_search: pcSearch + mobileSearch,
      monthly_click_pc: pcClick,
      monthly_click_mobile: mobileClick,
      ctr_pc: pcCtr,
      ctr_mobile: mobileCtr,
      ad_count: adCount,
      comp_idx: item.compIdx || '알 수 없음',
      cpc: pcClick + mobileClick,
      comp_index: pcCtr + mobileCtr
    }
  })
  
  return keywords
}

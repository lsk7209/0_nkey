import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'

// 절대규칙 API 문서 기준 완전 재구현
export async function POST(req: NextRequest) {
  try {
    const { seed } = await req.json()
    console.log('🔍 절대규칙 API 호출:', seed)

    if (!seed) {
      return NextResponse.json({ 
        success: false, 
        message: '시드 키워드를 입력해주세요.' 
      }, { status: 400 })
    }

    // 절대규칙 1: 환경변수 (절대규칙 문서 기준)
    const apiKey = process.env.SEARCHAD_API_KEY
    const secret = process.env.SEARCHAD_SECRET
    const customerId = process.env.SEARCHAD_CUSTOMER_ID

    console.log('🔑 절대규칙 환경변수 상태:', {
      apiKey: apiKey ? `설정됨 (${apiKey.substring(0, 10)}...)` : '없음',
      secret: secret ? `설정됨 (${secret.substring(0, 10)}...)` : '없음',
      customerId: customerId ? `설정됨 (${customerId})` : '없음'
    })

    // 환경변수가 없거나 깨져있으면 하드코딩된 키 사용 (절대규칙 문서 기준)
    const finalApiKey = apiKey && !apiKey.includes('i??i??') ? apiKey : '0100000000d027bb5287da074c48fc79503e97ae8e4bb0e7e928b39108e0b4dd6ce3950b7f'
    const finalSecret = secret && !secret.includes('i??i??') ? secret : 'AQAAAADQJ7tSh9oHTEj8eVA+l66OGm0FwBl/Ejg+WP/5GntSew=='
    const finalCustomerId = customerId && !customerId.includes('i??i??') ? customerId : '4129627'

    console.log('🚀 실제 네이버 검색광고 API 호출 시작...')
    console.log('🔑 사용할 API 키:', finalApiKey.substring(0, 10) + '...')

    // 절대규칙 2: Base URL과 엔드포인트
    const baseUrl = 'https://api.naver.com'
    const endpoint = '/keywordstool'

    // 절대규칙 3: 인증 헤더 생성
    const timestamp = Date.now().toString()
    const method = 'GET'
    const uri = endpoint // 쿼리스트링 제외한 순수 경로만 사용

    // 절대규칙 4: HMAC-SHA256 시그니처 생성
    const message = `${timestamp}.${method}.${uri}`
    const signature = crypto
      .createHmac('sha256', finalSecret)
      .update(message)
      .digest('base64')

    console.log('🔐 절대규칙 시그니처 생성:', {
      message,
      signature: signature.substring(0, 20) + '...'
    })

    // 절대규칙 5: 요청 파라미터
    const params = new URLSearchParams({
      hintKeywords: seed,
      showDetail: '1'
    })

    const fullUrl = `${baseUrl}${endpoint}?${params}`
    console.log('🌐 절대규칙 API URL:', fullUrl)

    // 절대규칙 6: 인증 헤더로 API 호출
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': finalApiKey,
        'X-Customer': finalCustomerId,
        'X-Signature': signature,
        'Content-Type': 'application/json; charset=UTF-8'
      }
    })

    console.log('📡 절대규칙 API 응답 상태:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ 절대규칙 API 호출 실패:', errorText)
      throw new Error(`API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('✅ 절대규칙 API 실제 응답:', data.keywordList?.length || 0, '개 키워드')

    // 절대규칙 7: 응답 스키마 매핑 및 데이터 정규화
    const keywords = (data.keywordList || []).map((item: any) => {
      // 절대규칙: < 10 같은 문자열 처리 (문자열/숫자 모두 처리)
      const normalizeNumber = (value: any): number => {
        if (value === null || value === undefined || value === '') return 0
        
        // 이미 숫자인 경우
        if (typeof value === 'number') return value
        
        // 문자열인 경우 정규화
        if (typeof value === 'string') {
          const cleaned = value.replace(/[<>=]/g, '').trim()
          const num = parseInt(cleaned, 10)
          return isNaN(num) ? 0 : num
        }
        
        return 0
      }

      // 절대규칙: CTR은 % 기호 없이 백분율 값 문자열 (문자열/숫자 모두 처리)
      const normalizePercentage = (value: any): number => {
        if (value === null || value === undefined || value === '') return 0
        
        // 이미 숫자인 경우
        if (typeof value === 'number') return value
        
        // 문자열인 경우 정규화
        if (typeof value === 'string') {
          const cleaned = value.replace('%', '').trim()
          const num = parseFloat(cleaned)
          return isNaN(num) ? 0 : num
        }
        
        return 0
      }

      // 절대규칙: 필드 매핑 (문서 기준)
      const pcSearch = normalizeNumber(item.monthlyPcQcCnt)
      const mobileSearch = normalizeNumber(item.monthlyMobileQcCnt)
      const pcClick = normalizeNumber(item.monthlyAvePcClkCnt)
      const mobileClick = normalizeNumber(item.monthlyAveMobileClkCnt)
      const pcCtr = normalizePercentage(item.monthlyAvePcCtr)
      const mobileCtr = normalizePercentage(item.monthlyAveMobileCtr)
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

    console.log('🎯 절대규칙 API 최종 결과:', keywords.length, '개 실제 키워드 수집 완료')

    return NextResponse.json({
      success: true,
      seed,
      keywords,
      count: keywords.length,
      message: '절대규칙 API 문서 기준 실제 네이버 검색광고 API 데이터 수집 완료'
    })

  } catch (error: any) {
    console.error('❌ 절대규칙 API 호출 중 에러 발생:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || '알 수 없는 에러 발생' 
    }, { status: 500 })
  }
}
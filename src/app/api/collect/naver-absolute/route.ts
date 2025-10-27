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

    const { seed } = await request.json()
    
    if (!seed) {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'Seed keyword is required' 
        },
        { status: 400 }
      )
    }

    console.log('🚀 절대규칙 기준 네이버 API 호출 시작:', seed)
    
    // 절대규칙 1: 환경변수 확인
    const apiKey = process.env.SEARCHAD_API_KEY
    const secret = process.env.SEARCHAD_SECRET
    const customerId = process.env.SEARCHAD_CUSTOMER_ID
    
    console.log('🔑 절대규칙 환경변수 확인:')
    console.log('  SEARCHAD_API_KEY:', apiKey ? '설정됨' : '없음')
    console.log('  SEARCHAD_SECRET:', secret ? '설정됨' : '없음')
    console.log('  SEARCHAD_CUSTOMER_ID:', customerId ? '설정됨' : '없음')
    
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
      
      return NextResponse.json({
        seed,
        keywords,
        count: keywords.length,
        message: '시뮬레이션 데이터 사용 (API 키 없음)'
      })
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
    
    console.log('🔐 절대규칙 시그니처 생성:')
    console.log('  메시지:', message)
    console.log('  시그니처:', signature)
    console.log('  예시: "1696156798000.GET./keywordstool" → Base64')
    
    // 절대규칙 3: 요청 빌더
    const params = new URLSearchParams({
      hintKeywords: seed,
      showDetail: '1'
    })
    
    const url = `https://api.naver.com${uri}?${params}`
    console.log('🌐 절대규칙 API URL:', url)
    
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
    
    console.log('📡 절대규칙 요청 헤더:')
    console.log('  X-Timestamp:', timestamp)
    console.log('  X-API-KEY:', apiKey.substring(0, 10) + '...')
    console.log('  X-Customer:', customerId)
    console.log('  X-Signature:', signature.substring(0, 20) + '...')
    
    console.log('📡 API 응답 상태:', response.status, response.statusText)
    
    // 절대규칙 9: 오류 처리 가이드
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API 호출 실패:', errorText)
      
      if (response.status === 401 || response.status === 403) {
        console.error('🔐 절대규칙 인증 오류: 시그니처/헤더 불일치, 시간 오차 가능')
        return NextResponse.json({
          success: false,
          message: '절대규칙 인증 오류: 시그니처/헤더 불일치, 시간 오차 가능',
          error: errorText,
          status: response.status,
          suggestion: '타임스탬프/메시지 서명 규칙 재검증 필요'
        })
      } else if (response.status === 429) {
        console.error('⏰ 절대규칙 레이트 리밋: 호출 속도 초과')
        return NextResponse.json({
          success: false,
          message: '절대규칙 레이트 리밋: 호출 속도 초과',
          error: errorText,
          status: response.status,
          suggestion: '5분 정지 후 재시도 권고'
        })
      }
      
      return NextResponse.json({
        success: false,
        message: `API 호출 실패: ${response.status}`,
        error: errorText,
        status: response.status
      })
    }
    
    const data = await response.json()
    console.log('✅ 절대규칙 API 응답:', data.keywordList.length, '개 키워드')
    console.log('📊 첫 번째 키워드:', data.keywordList[0]?.relKeyword)
    
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
      
      // 절대규칙 4: 필드 매핑
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
    
    return NextResponse.json({
      seed,
      keywords,
      count: keywords.length,
      message: '절대규칙 기준 네이버 API 호출 성공'
    })

  } catch (error) {
    console.error('절대규칙 네이버 API 호출 에러:', error)
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

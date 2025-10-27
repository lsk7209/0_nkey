import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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

    const seed = request.nextUrl.searchParams.get('seed') || '홍대갈만한곳'
    
    console.log('🧪 실제 네이버 API 테스트 시작:', seed)
    
    // 실제 네이버 검색광고 API 호출
    const timestamp = Date.now().toString()
    const method = 'GET'
    const uri = '/keywordstool'
    
    // 환경변수에서 API 키 가져오기
    const apiKey = process.env.SEARCHAD_API_KEY
    const secret = process.env.SEARCHAD_SECRET
    const customerId = process.env.SEARCHAD_CUSTOMER_ID
    
    console.log('🔑 API 키:', apiKey ? '설정됨' : '없음')
    console.log('🔑 시크릿:', secret ? '설정됨' : '없음')
    console.log('🔑 고객 ID:', customerId ? '설정됨' : '없음')
    
    if (!apiKey || !secret || !customerId) {
      return NextResponse.json({
        success: false,
        message: 'API 키가 설정되지 않았습니다.',
        environment: {
          SEARCHAD_API_KEY: apiKey ? '설정됨' : '없음',
          SEARCHAD_SECRET: secret ? '설정됨' : '없음',
          SEARCHAD_CUSTOMER_ID: customerId ? '설정됨' : '없음'
        }
      })
    }
    
    // HMAC-SHA256 시그니처 생성
    const crypto = require('crypto')
    const message = `${timestamp}.${method}.${uri}`
    const signature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64')
    
    console.log('🔐 시그니처 생성 메시지:', message)
    console.log('🔐 생성된 시그니처:', signature)
    
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
      return NextResponse.json({
        success: false,
        message: `API 호출 실패: ${response.status}`,
        error: errorText,
        status: response.status
      })
    }
    
    const data = await response.json()
    console.log('✅ 실제 네이버 API 응답:', data)
    
    return NextResponse.json({
      success: true,
      seed,
      data,
      message: '실제 네이버 API 호출 성공'
    })

  } catch (error) {
    console.error('실제 네이버 API 테스트 에러:', error)
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

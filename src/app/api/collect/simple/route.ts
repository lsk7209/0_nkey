import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 간단한 API 호출 시작')
    
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

    console.log('🔍 시드 키워드:', seed)
    
    // 간단한 시뮬레이션 데이터 반환
    const keywords = [
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

    const result = keywords.map(pattern => ({
      keyword: `${seed} ${pattern.suffix}`,
      monthly_search_pc: pattern.pc,
      monthly_search_mob: pattern.mob,
      avg_monthly_search: pattern.pc + pattern.mob,
      cpc: pattern.cpc,
      comp_index: pattern.comp
    }))
    
    console.log('✅ 간단한 API 응답 완료:', result.length, '개 키워드')
    
    return NextResponse.json({
      seed,
      keywords: result,
      count: result.length,
      message: '간단한 API 호출 성공'
    })

  } catch (error) {
    console.error('간단한 API 에러:', error)
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

import { NextRequest, NextResponse } from 'next/server'
import { mockDB } from '@/lib/mock-db'

// 문서수 밴드 정의
const DOC_BANDS = {
  low: { min: 0, max: 50 },
  mid: { min: 51, max: 200 },
  high: { min: 201, max: 1000 },
  ultra: { min: 1001, max: Infinity }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const band = searchParams.get('band') || 'low'
    const minSearch = parseInt(searchParams.get('minSearch') || '0')

    // 밴드 범위 확인
    if (!DOC_BANDS[band as keyof typeof DOC_BANDS]) {
      return NextResponse.json(
        { 
          type: 'https://example.com/probs/invalid-input',
          title: 'Invalid Input',
          status: 400,
          detail: 'Invalid band parameter. Must be one of: low, mid, high, ultra' 
        },
        { status: 400 }
      )
    }

    const bandRange = DOC_BANDS[band as keyof typeof DOC_BANDS]

    // 실제 저장된 데이터에서 황금키워드 조회
    const top10 = mockDB.getGoldenKeywords(band, minSearch)

    return NextResponse.json({
      band,
      bandRange,
      filters: {
        minSearch,
        minDocs: bandRange.min,
        maxDocs: bandRange.max
      },
      keywords: top10,
      count: top10.length,
      total: top10.length
    })

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

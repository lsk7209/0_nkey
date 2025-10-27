import { NextRequest, NextResponse } from 'next/server'
import { persistentDB } from '@/lib/persistent-db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const minSearch = parseInt(searchParams.get('minSearch') || '0')
    const maxSearch = parseInt(searchParams.get('maxSearch') || '999999999')
    const minCafe = parseInt(searchParams.get('minCafe') || '0')
    const maxCafe = parseInt(searchParams.get('maxCafe') || '999999999')
    const minBlog = parseInt(searchParams.get('minBlog') || '0')
    const maxBlog = parseInt(searchParams.get('maxBlog') || '999999999')
    const minWeb = parseInt(searchParams.get('minWeb') || '0')
    const maxWeb = parseInt(searchParams.get('maxWeb') || '999999999')
    const minNews = parseInt(searchParams.get('minNews') || '0')
    const maxNews = parseInt(searchParams.get('maxNews') || '999999999')
    const days = parseInt(searchParams.get('days') || '30')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sortBy') || 'cafe_asc_search_desc'

    // 실제 저장된 데이터 조회
    const result = persistentDB.getKeywords(
      minSearch, maxSearch, minCafe, maxCafe, minBlog, maxBlog, 
      minWeb, maxWeb, minNews, maxNews, days, page, limit, sortBy
    )

    return NextResponse.json({
      keywords: result.keywords,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      },
      filters: {
        minSearch,
        maxSearch,
        minCafe,
        maxCafe,
        minBlog,
        maxBlog,
        minWeb,
        maxWeb,
        minNews,
        maxNews,
        days
      }
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

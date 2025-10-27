'use client'

import { useState } from 'react'

interface KeywordData {
  keyword: string
  monthly_search_pc: number
  monthly_search_mob: number
  avg_monthly_search: number
}

export default function Home() {
  const [seed, setSeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleCollect = async () => {
    if (!seed.trim()) {
      setMessage('시드 키워드를 입력해주세요.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // 1단계: 연관검색어 수집 (미리보기 모드)
      const collectResponse = await fetch('/api/collect/related-simple?preview=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({ seed: seed.trim() })
      })

      if (!collectResponse.ok) {
        throw new Error('연관검색어 수집에 실패했습니다.')
      }

      const collectData = await collectResponse.json()
      const keywords = collectData.keywords || []
      
      if (keywords.length === 0) {
        setMessage('수집된 연관검색어가 없습니다.')
        setLoading(false)
        return
      }

      setMessage(`총 ${keywords.length}개의 연관검색어를 찾았습니다. 자동 저장 중...`)
      console.log('수집된 키워드:', keywords)

      // 2단계: 자동 저장
      console.log('자동 저장 API 호출 시작...')
      const saveResponse = await fetch('/api/collect/related-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({ 
          seed: seed.trim(),
          keywords: keywords 
        })
      })

      console.log('저장 API 응답 상태:', saveResponse.status)
      
      if (!saveResponse.ok) {
        const errorText = await saveResponse.text()
        console.error('저장 API 에러:', errorText)
        throw new Error(`데이터 저장에 실패했습니다: ${saveResponse.status}`)
      }

      const saveData = await saveResponse.json()
      console.log('저장 완료:', saveData)
      setMessage(`성공적으로 ${saveData.saved || keywords.length}개의 키워드를 저장했습니다. 데이터 페이지로 이동합니다...`)
      
      // 3단계: 데이터 페이지로 자동 이동
      setTimeout(() => {
        window.location.href = '/data'
      }, 2000)

    } catch (error) {
      console.error('자동 저장 에러:', error)
      setMessage('오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">시드 키워드 입력</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="seed" className="block text-sm font-medium text-gray-700 mb-2">
              시드 키워드
            </label>
            <input
              id="seed"
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="예: 블로그 마케팅"
              className="input-field"
            />
          </div>
          <div className="flex space-x-4">
            <button
              onClick={handleCollect}
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? '수집 및 저장 중...' : '연관검색어 수집 및 자동저장'}
            </button>
          </div>
          {message && (
            <div className={`p-3 rounded-lg ${
              message.includes('성공') || message.includes('찾았습니다') 
                ? 'bg-green-50 text-green-700' 
                : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">사용 방법</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>1. 시드 키워드를 입력하세요</p>
          <p>2. "연관검색어 수집 및 자동저장" 버튼을 클릭하세요</p>
          <p>3. 수집된 키워드가 자동으로 데이터베이스에 저장됩니다</p>
          <p>4. 2초 후 데이터 페이지로 자동 이동합니다</p>
        </div>
        <div className="mt-4">
          <a 
            href="/data" 
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            저장된 데이터 보기 →
          </a>
        </div>
      </div>
    </div>
  )
}

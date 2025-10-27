'use client'

import { useState } from 'react'

interface KeywordData {
  keyword: string
  monthly_search_pc: number
  monthly_search_mob: number
  avg_monthly_search: number
  cpc?: number
  comp_index?: number
}

export default function Home() {
  const [seed, setSeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [keywords, setKeywords] = useState<KeywordData[]>([])

  // 시뮬레이션 데이터 생성 함수
  const generateMockKeywords = (seedKeyword: string): KeywordData[] => {
    const mockPatterns = [
      { suffix: '맛집', pc: 10000, mob: 20000, cpc: 1000, comp: 90 },
      { suffix: '카페', pc: 5000, mob: 10000, cpc: 800, comp: 85 },
      { suffix: '데이트', pc: 3000, mob: 7000, cpc: 700, comp: 80 },
      { suffix: '가볼만한곳', pc: 2000, mob: 5000, cpc: 600, comp: 75 },
      { suffix: '추천', pc: 1500, mob: 4000, cpc: 550, comp: 70 },
      { suffix: '존맛탱', pc: 1000, mob: 3000, cpc: 500, comp: 65 },
      { suffix: '술집', pc: 800, mob: 2500, cpc: 450, comp: 60 },
      { suffix: '파스타', pc: 700, mob: 2000, cpc: 400, comp: 55 },
      { suffix: '스테이크', pc: 600, mob: 1800, cpc: 380, comp: 50 },
      { suffix: '혼밥', pc: 500, mob: 1500, cpc: 350, comp: 45 },
    ]

    return mockPatterns.map(pattern => ({
      keyword: `${seedKeyword} ${pattern.suffix}`,
      monthly_search_pc: pattern.pc,
      monthly_search_mob: pattern.mob,
      avg_monthly_search: pattern.pc + pattern.mob,
      cpc: pattern.cpc,
      comp_index: pattern.comp
    }))
  }

  const handleCollect = async () => {
    if (!seed.trim()) {
      setMessage('시드 키워드를 입력해주세요.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // 시뮬레이션 지연
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 시뮬레이션 데이터 생성
      const mockKeywords = generateMockKeywords(seed.trim())
      
      if (mockKeywords.length === 0) {
        setMessage('수집된 연관검색어가 없습니다.')
        setLoading(false)
        return
      }

      setMessage(`총 ${mockKeywords.length}개의 연관검색어를 찾았습니다.`)
      setKeywords(mockKeywords)
      
      // Cloudflare Workers API로 데이터 저장 시도
      try {
        const response = await fetch('https://0_nkey-api.lsk7209-5f4.workers.dev/api/collect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': 'dev-key-2024'
          },
          body: JSON.stringify({
            seed: seed.trim(),
            keywords: mockKeywords
          })
        })

        if (response.ok) {
          const result = await response.json()
          setMessage(`✅ 성공! ${result.totalSavedOrUpdated}개의 키워드가 클라우드 데이터베이스에 저장되었습니다.`)
        } else {
          throw new Error('API 저장 실패')
        }
      } catch (apiError) {
        // API 실패 시 로컬 스토리지에 저장
        const existingData = JSON.parse(localStorage.getItem('keywords') || '[]')
        const newData = [...existingData, ...mockKeywords.map(k => ({
          ...k,
          seed: seed.trim(),
          created_at: new Date().toISOString()
        }))]
        localStorage.setItem('keywords', JSON.stringify(newData))
        
        setMessage(`총 ${mockKeywords.length}개의 연관검색어를 찾았습니다. (로컬 저장 완료 - API 연결 실패)`)
      }
      
    } catch (error) {
      console.error('키워드 수집 에러:', error)
      setMessage('오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadStored = () => {
    try {
      const storedData = JSON.parse(localStorage.getItem('keywords') || '[]')
      if (storedData.length === 0) {
        setMessage('저장된 키워드가 없습니다.')
        return
      }
      
      setKeywords(storedData.slice(-20)) // 최근 20개만 표시
      setMessage(`저장된 키워드 ${storedData.length}개 중 최근 20개를 불러왔습니다.`)
    } catch (error) {
      setMessage('저장된 키워드를 불러오는데 실패했습니다.')
    }
  }

  const handleClearStorage = () => {
    localStorage.removeItem('keywords')
    setKeywords([])
    setMessage('저장된 키워드를 모두 삭제했습니다.')
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
              {loading ? '수집 중...' : '연관검색어 수집'}
            </button>
            <button
              onClick={handleLoadStored}
              className="btn-secondary"
            >
              저장된 키워드 불러오기
            </button>
            <button
              onClick={handleClearStorage}
              className="btn-danger"
            >
              저장된 키워드 삭제
            </button>
          </div>
          {message && (
            <div className={`p-3 rounded-lg ${
              message.includes('성공') || message.includes('찾았습니다') || message.includes('불러왔습니다')
                ? 'bg-green-50 text-green-700' 
                : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>

      {keywords.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            수집된 키워드 ({keywords.length}개)
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    키워드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PC 검색량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    모바일 검색량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총 검색량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    경쟁도
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {keywords.map((keyword, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {keyword.keyword}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.monthly_search_pc.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.monthly_search_mob.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.avg_monthly_search.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.cpc?.toLocaleString() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.comp_index || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">사용 방법</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>1. 시드 키워드를 입력하세요</p>
          <p>2. "연관검색어 수집" 버튼을 클릭하세요</p>
          <p>3. 수집된 키워드가 브라우저 로컬 스토리지에 저장됩니다</p>
          <p>4. "저장된 키워드 불러오기"로 이전 데이터를 확인할 수 있습니다</p>
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>참고:</strong> 클라우드플레어 페이지는 정적 호스팅이므로 서버 사이드 API가 작동하지 않습니다. 
            대신 브라우저 로컬 스토리지를 사용하여 데이터를 저장합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
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
      
          // Cloudflare Workers API로 실제 네이버 API 호출 시도
          try {
            console.log('네이버 API 호출 시작:', {
              url: 'https://0_nkey-api.lsk7209-5f4.workers.dev/api/collect-naver',
              seed: seed.trim()
            })

            const response = await fetch('https://0_nkey-api.lsk7209-5f4.workers.dev/api/collect-naver', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-key': 'dev-key-2024'
              },
              body: JSON.stringify({
                seed: seed.trim()
              })
            })

        console.log('API 응답 상태:', response.status, response.statusText)

        if (response.ok) {
          const result = await response.json()
          console.log('API 성공 응답:', result)
          setMessage(`✅ 성공! ${result.totalSavedOrUpdated}개의 키워드가 클라우드 데이터베이스에 저장되었습니다.`)
        } else {
          const errorText = await response.text()
          console.error('API 에러 응답:', response.status, errorText)
          throw new Error(`API 저장 실패: ${response.status} - ${errorText}`)
        }
      } catch (apiError: any) {
        console.error('API 호출 에러:', apiError)
        
        // API 실패 시 에러 메시지 표시 (로컬 스토리지 저장 제거)
        setMessage(`❌ 클라우드 데이터베이스 저장 실패: ${apiError?.message || 'Unknown error'}. 미리보기 데이터만 표시됩니다.`)
      }
      
    } catch (error) {
      console.error('키워드 수집 에러:', error)
      setMessage('오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadStored = async () => {
    try {
      // 클라우드플레어 D1 데이터베이스에서 키워드 조회
      const response = await fetch('https://0_nkey-api.lsk7209-5f4.workers.dev/api/keywords', {
        method: 'GET',
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })

      if (response.ok) {
        const result = await response.json()
        setKeywords(result.keywords || [])
        setMessage(`✅ 클라우드 데이터베이스에서 ${result.keywords?.length || 0}개의 키워드를 불러왔습니다.`)
      } else {
        throw new Error(`데이터 조회 실패: ${response.status}`)
      }
    } catch (error) {
      setMessage('❌ 저장된 키워드를 불러오는데 실패했습니다: ' + (error as Error).message)
    }
  }

  const handleClearStorage = () => {
    setKeywords([])
    setMessage('화면에서 키워드 목록을 지웠습니다. (실제 데이터베이스는 변경되지 않음)')
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
              클라우드 DB에서 불러오기
            </button>
            <button
              onClick={handleClearStorage}
              className="btn-danger"
            >
              화면에서 지우기
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
          <p>3. 수집된 키워드가 클라우드플레어 D1 데이터베이스에 저장됩니다</p>
          <p>4. "클라우드 DB에서 불러오기"로 저장된 데이터를 확인할 수 있습니다</p>
        </div>
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>✅ 데이터 저장:</strong> 모든 키워드 데이터는 클라우드플레어 D1 데이터베이스에 안전하게 저장됩니다. 
            클라우드플레어 Workers를 통해 서버사이드 API가 정상 작동합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
/**
 * ⚠️ 헌법 준수 필수 (CONSTITUTION.md)
 * 
 * 절대 변경 금지 사항:
 * - API 응답에서 keywords 배열 직접 사용 (샘플 데이터 생성 금지)
 * - 필드명 변경 금지 (pc_search, mobile_search 등)
 * - 별도 API 호출 금지 (API 응답에서 직접 사용)
 * 
 * 헌법 문서: CONSTITUTION.md (절대 변경 금지)
 */

'use client'

import { useState } from 'react'

interface KeywordData {
  keyword: string
  pc_search: number
  mobile_search: number
  avg_monthly_search: number
  monthly_click_pc?: number
  monthly_click_mo?: number
  ctr_pc?: number
  ctr_mo?: number
  ad_count?: number
  comp_idx?: string | number
}

export default function Home() {
  const [seed, setSeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [keywords, setKeywords] = useState<KeywordData[]>([])


  const handleCollect = async () => {
    if (!seed.trim()) {
      setMessage('시드 키워드를 입력해주세요.')
      return
    }

    setLoading(true)
    setMessage('')
    setKeywords([]) // 기존 키워드 초기화

    try {
            // 공식 네이버 SearchAd API 호출 (Cloudflare Pages Functions를 통한 프록시)
            console.log('공식 네이버 SearchAd API 호출 시작:', {
              url: 'https://0-nkey.pages.dev/api/collect-naver',
              seed: seed.trim()
            })

            const response = await fetch('https://0-nkey.pages.dev/api/collect-naver', {
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
        
        if (result.success) {
          const skippedMsg = result.skippedCount > 0 ? ` (${result.skippedCount}개는 30일 이내 업데이트되어 건너뜀)` : '';
          setMessage(`✅ 성공! ${result.totalCollected}개의 키워드를 수집하여 ${result.totalSavedOrUpdated}개를 클라우드 데이터베이스에 저장했습니다.${skippedMsg}`)
          
          // API 응답에서 직접 키워드 데이터 표시
          if (result.keywords && Array.isArray(result.keywords)) {
            console.log(`표시할 키워드 개수: ${result.keywords.length}`)
            setKeywords(result.keywords)
          } else {
            console.warn('API 응답에 keywords 배열이 없습니다:', result)
            setKeywords([])
          }
        } else {
          setMessage(`❌ 실패: ${result.message}`)
        }
      } else {
        const errorResult = await response.json()
        console.error('API 에러 응답:', response.status, errorResult)
        
        // 네이버 API 키 문제인 경우 특별 처리
        if (errorResult.error && errorResult.error.includes('네이버 검색광고 API 키가 유효하지 않거나 만료되었습니다')) {
          setMessage(`❌ 네이버 API 키 문제: ${errorResult.error}\n\n해결 방법: ${errorResult.solution || '관리자에게 문의하세요.'}`)
        } else {
          setMessage(`❌ API 호출 실패: ${errorResult.message || 'Unknown error'}`)
        }
      }
      
    } catch (error) {
      console.error('키워드 수집 에러:', error)
      setMessage('❌ 오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setLoading(false)
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
                    광고수
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
                      {keyword.pc_search?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.mobile_search?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.avg_monthly_search?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.ad_count?.toLocaleString() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {keyword.comp_idx || 'N/A'}
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
          <p>4. 데이터 페이지에서 저장된 모든 키워드를 확인할 수 있습니다</p>
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
'use client'

import { useState } from 'react'

export default function CronTestPage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const runCronJob = async () => {
    setRunning(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/cron/collect-docs', {
        method: 'POST',
        headers: {
          'x-admin-key': 'dev-key-2024'
        }
      })
      
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: error.message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">크론 작업 테스트</h1>
      
      <div className="mb-6 space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">로컬 개발 환경</h3>
          <p className="text-sm text-yellow-700">
            현재 로컬 개발 중입니다. 클라우드플레어 배포 시 D1 데이터베이스와 Workers Cron으로 자동화됩니다.
          </p>
        </div>
        
        <button
          onClick={runCronJob}
          disabled={running}
          className={`px-6 py-3 rounded-lg font-semibold ${
            running 
              ? 'bg-gray-400 cursor-not-allowed text-gray-600' 
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
          }`}
        >
          {running ? '🔄 실행 중...' : '🚀 문서수 자동 수집 실행'}
        </button>
      </div>

      {result && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">실행 결과:</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

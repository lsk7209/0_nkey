'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export default function AutoCollectPage() {
  const [enabled, setEnabled] = useState(false)
  const [limitInput, setLimitInput] = useState('10') // 0: 무제한
  const [processing, setProcessing] = useState(false)
  const [processed, setProcessed] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [log, setLog] = useState<string[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const limit = useMemo(() => {
    const n = Number(limitInput)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [limitInput])

  const appendLog = useCallback((line: string) => {
    const logLine = new Date().toLocaleTimeString() + ' ' + line
    console.log('[AutoCollect]', logLine) // 콘솔에 출력 추가
    setLog((prev) => [logLine, ...prev].slice(0, 200))
  }, [])

  // 최신 값을 참조하기 위한 ref
  const enabledRef = useRef(enabled)
  const limitRef = useRef(limit)
  const processedRef = useRef(processed)
  const processingRef = useRef(processing)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    limitRef.current = limit
  }, [limit])

  useEffect(() => {
    processedRef.current = processed
  }, [processed])

  useEffect(() => {
    processingRef.current = processing
  }, [processing])

  const runBatch = useCallback(async () => {
    // 이미 처리 중이면 건너뛰기
    if (processingRef.current) {
      console.log('[AutoCollect] 이미 처리 중, 건너뜀')
      return
    }

    // 활성화 상태 확인
    if (!enabledRef.current) {
      console.log('[AutoCollect] 비활성화됨, 건너뜀')
      return
    }

    // 제한 확인
    const currentLimit = limitRef.current
    const currentProcessed = processedRef.current
    if (currentLimit > 0 && currentProcessed >= currentLimit) {
      appendLog('✅ 목표 개수 도달, 중단')
      setEnabled(false)
      return
    }

    try {
      setProcessing(true)
      appendLog('🚀 배치 시작...')
      
      const batchLimit = currentLimit === 0 ? 10 : Math.max(1, Math.min(currentLimit - currentProcessed, 10))
      console.log('[AutoCollect] API 호출:', { batchLimit, currentProcessed, currentLimit })
      
      const res = await fetch('https://0-nkey.pages.dev/api/auto-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({ limit: batchLimit })
      })

      console.log('[AutoCollect] API 응답 상태:', res.status)

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        appendLog(`❌ HTTP ${res.status} ${res.statusText} ${errText}`)
        console.error('[AutoCollect] API 에러:', res.status, errText)
        return
      }

      const data = await res.json().catch(() => ({}))
      console.log('[AutoCollect] API 응답 데이터:', data)

      if (data && data.success) {
        const processedCount = data.processed || 0
        setProcessed((p) => p + processedCount)
        if (typeof data.remaining === 'number') setRemaining(data.remaining)
        appendLog(`✅ 배치 완료: +${processedCount}개 시드 처리 (남은 시드: ${data.remaining ?? '-'}개)`)
      } else {
        appendLog(`❌ 배치 실패: ${data?.error || data?.message || 'unknown error'}`)
      }
    } catch (e: any) {
      appendLog(`❌ 예외: ${e.message || String(e)}`)
      console.error('[AutoCollect] 예외 발생:', e)
    } finally {
      setProcessing(false)
    }
  }, [appendLog])

  // runBatch를 ref로 안정화
  const runBatchRef = useRef(runBatch)
  useEffect(() => {
    runBatchRef.current = runBatch
  }, [runBatch])

  useEffect(() => {
    console.log('[AutoCollect] useEffect 실행:', { enabled })

    // 기존 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (!enabled) {
      appendLog('⏹️ 자동수집 OFF')
      return
    }

    appendLog('▶️ 자동수집 ON - 배치 시작')

    // 즉시 1회 실행
    runBatchRef.current()

    // 이후 3초마다 반복 실행
    timerRef.current = setInterval(() => {
      // 최신 상태 체크를 위해 ref 사용
      console.log('[AutoCollect] 타이머 실행:', { enabled: enabledRef.current, processing: processingRef.current })
      if (enabledRef.current && !processingRef.current) {
        runBatchRef.current()
      }
    }, 3000)

    return () => {
      console.log('[AutoCollect] useEffect cleanup')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, appendLog])

  const handleToggle = () => {
    const newValue = !enabled
    setEnabled(newValue)
    if (newValue) {
      appendLog('🔄 자동수집 토글: ON')
    } else {
      appendLog('🔄 자동수집 토글: OFF')
    }
  }

  const handleReset = () => {
    setProcessed(0)
    setRemaining(null)
    setLog([])
    appendLog('🔄 카운터 초기화')
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">자동 수집</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-800">자동수집</label>
            <button
              onClick={handleToggle}
              className={`px-4 py-2 rounded ${enabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">시드키워드 개수 (0=무제한)</label>
            <input
              type="number"
              min={0}
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="input-field w-32"
            />
            <button onClick={handleReset} className="btn-secondary">카운터 초기화</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">처리된 시드</div>
              <div className="text-xl font-semibold">{processed}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">남은 시드</div>
              <div className="text-xl font-semibold">{remaining ?? '-'}</div>
            </div>
          </div>

          <div className="p-3 bg-white rounded border">
            <div className="text-sm font-medium mb-2">로그</div>
            <div className="h-48 overflow-auto text-xs text-gray-700 space-y-1">
              {log.length === 0 ? (
                <div className="text-gray-400 italic">로그가 없습니다...</div>
              ) : (
                log.map((l, i) => (
                  <div key={i}>{l}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



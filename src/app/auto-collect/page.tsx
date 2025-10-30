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
    setLog((prev) => [new Date().toLocaleTimeString() + ' ' + line, ...prev].slice(0, 200))
  }, [])

  const runBatch = useCallback(async () => {
    try {
      setProcessing(true)
      const res = await fetch('https://0-nkey.pages.dev/api/auto-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({ limit: limit === 0 ? 10 : Math.max(1, Math.min(limit - processed, 10)) })
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        appendLog(`HTTP ${res.status} ${res.statusText} ${errText}`)
      }
      const data = await res.json().catch(() => ({}))
      if (data && data.success) {
        setProcessed((p) => p + (data.processed || 0))
        if (typeof data.remaining === 'number') setRemaining(data.remaining)
        appendLog(`Batch OK: +${data.processed || 0} (remaining: ${data.remaining ?? '-'})`)
      } else {
        appendLog(`Batch Error: ${data?.error || data?.message || 'unknown error'}`)
      }
    } catch (e: any) {
      appendLog(`Batch Exception: ${e.message}`)
    } finally {
      setProcessing(false)
    }
  }, [appendLog, limit, processed])

  const shouldContinue = useMemo(() => {
    if (!enabled) return false
    if (limit === 0) return true // 무제한
    return processed < limit
  }, [enabled, limit, processed])

  useEffect(() => {
    if (!shouldContinue) return
    // 처음 즉시 1회 수행
    runBatch()
    // 이후 주기적으로 반복 수행
    timerRef.current = setInterval(() => {
      if (!processing) runBatch()
    }, 2000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [shouldContinue, runBatch, processing])

  const handleToggle = () => {
    setEnabled((v) => !v)
  }

  const handleReset = () => {
    setProcessed(0)
    setRemaining(null)
    setLog([])
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
              {log.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



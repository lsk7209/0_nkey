'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Service Worker 등록 및 백그라운드 수집 관리
class BackgroundCollector {
  private static instance: BackgroundCollector | null = null
  private worker: ServiceWorker | null = null
  private isRegistered = false

  static getInstance(): BackgroundCollector {
    if (!BackgroundCollector.instance) {
      BackgroundCollector.instance = new BackgroundCollector()
    }
    return BackgroundCollector.instance
  }

  async register(): Promise<boolean> {
    if (this.isRegistered) return true

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })

        this.worker = registration.active || registration.waiting || registration.installing

        // Service Worker 메시지 리스너
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'AUTO_COLLECT_UPDATE') {
            // 백그라운드 수집 상태 업데이트 이벤트 발생
            window.dispatchEvent(new CustomEvent('backgroundCollectUpdate', {
              detail: event.data
            }))
          }
        })

        this.isRegistered = true
        console.log('[BackgroundCollector] Service Worker 등록 완료')
        return true
      }
    } catch (error) {
      console.error('[BackgroundCollector] Service Worker 등록 실패:', error)
    }

    return false
  }

  async startBackgroundCollect(config: { limit: number; concurrent: number }): Promise<void> {
    if (!this.worker) return

    this.worker.postMessage({
      type: 'START_AUTO_COLLECT',
      config
    })
  }

  async stopBackgroundCollect(): Promise<void> {
    if (!this.worker) return

    this.worker.postMessage({
      type: 'STOP_AUTO_COLLECT'
    })
  }

  async getStatus(): Promise<any> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve(null)
        return
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'AUTO_COLLECT_STATUS') {
          navigator.serviceWorker.removeEventListener('message', handleMessage)
          resolve(event.data.status)
        }
      }

      navigator.serviceWorker.addEventListener('message', handleMessage)
      this.worker.postMessage({ type: 'GET_AUTO_COLLECT_STATUS' })

      // 타임아웃
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
        resolve(null)
      }, 5000)
    })
  }
}

export default function AutoCollectPage() {
  // 초기 상태는 false로 시작하고, useEffect에서 localStorage에서 불러옴
  const [enabled, setEnabled] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState(false) // 백그라운드 모드
  const [limitInput, setLimitInput] = useState('10') // 0: 무제한
  const [concurrentInput, setConcurrentInput] = useState('3') // 동시 처리 수
  const [isInitialized, setIsInitialized] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processed, setProcessed] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [swRegistered, setSwRegistered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const backgroundCollectorRef = useRef<BackgroundCollector | null>(null)

  const limit = useMemo(() => {
    const n = Number(limitInput)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [limitInput])

  const concurrent = useMemo(() => {
    const n = Number(concurrentInput)
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3
  }, [concurrentInput])

  const appendLog = useCallback((line: string) => {
    const logLine = new Date().toLocaleTimeString() + ' ' + line
    console.log('[AutoCollect]', logLine) // 콘솔에 출력 추가
    setLog((prev) => [logLine, ...prev].slice(0, 200))
  }, [])

  // 최신 값을 참조하기 위한 ref
  const enabledRef = useRef(enabled)
  const backgroundModeRef = useRef(backgroundMode)
  const limitRef = useRef(limit)
  const concurrentRef = useRef(concurrent)
  const processedRef = useRef(processed)
  const processingRef = useRef(processing)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    backgroundModeRef.current = backgroundMode
  }, [backgroundMode])

  useEffect(() => {
    limitRef.current = limit
  }, [limit])

  useEffect(() => {
    concurrentRef.current = concurrent
  }, [concurrent])

  useEffect(() => {
    processedRef.current = processed
  }, [processed])

  useEffect(() => {
    processingRef.current = processing
  }, [processing])

  // Service Worker 초기화
  useEffect(() => {
    const initServiceWorker = async () => {
      if (typeof window !== 'undefined') {
        const collector = BackgroundCollector.getInstance()
        backgroundCollectorRef.current = collector

        const registered = await collector.register()
        setSwRegistered(registered)

        if (registered) {
          appendLog('✅ Service Worker 등록 완료 - 백그라운드 수집 가능')

          // 백그라운드 수집 이벤트 리스너
          const handleBackgroundUpdate = (event: CustomEvent) => {
            const { status, processedCount, batchResult, remaining, error } = event.detail

            if (status === 'running' && batchResult) {
              setProcessed(processedCount || 0)
              if (typeof remaining === 'number') setRemaining(remaining)
              appendLog(`✅ 백그라운드 배치 완료: +${batchResult.processed}개 시드 (남은: ${remaining ?? '-'}개)`)
            } else if (status === 'stopped') {
              setEnabled(false)
              appendLog('⏹️ 백그라운드 수집 중단됨')
            } else if (status === 'error') {
              appendLog(`❌ 백그라운드 에러: ${error}`)
            }
          }

          window.addEventListener('backgroundCollectUpdate', handleBackgroundUpdate as EventListener)

          return () => {
            window.removeEventListener('backgroundCollectUpdate', handleBackgroundUpdate as EventListener)
          }
        } else {
          appendLog('⚠️ Service Worker 미지원 - 포그라운드 모드만 사용 가능')
        }
      }
    }

    initServiceWorker()
  }, [appendLog])

  const runBatch = useCallback(async () => {
    // 백그라운드 모드에서는 Service Worker가 처리하므로 포그라운드에서만 실행
    if (backgroundModeRef.current) {
      return
    }

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
    const currentProcessed = Number(processedRef.current) || 0
    if (currentLimit > 0 && currentProcessed >= currentLimit) {
      appendLog('✅ 목표 개수 도달, 중단')
      setEnabled(false)
      // localStorage에도 반영
      if (typeof window !== 'undefined') {
        localStorage.setItem('auto-collect-enabled', 'false')
      }
      return
    }

    try {
      setProcessing(true)
      appendLog('🚀 포그라운드 배치 시작...')

      const batchLimit = currentLimit === 0 ? 15 : Math.max(1, Math.min(currentLimit - currentProcessed, 15))
      const concurrentLimit = concurrentRef.current

      console.log('[AutoCollect] API 호출:', { batchLimit, concurrentLimit, currentProcessed, currentLimit })

      const res = await fetch('https://0-nkey.pages.dev/api/auto-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({
          limit: batchLimit,
          concurrent: concurrentLimit
        })
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
        const processedCount = Number(data.processed) || 0
        setProcessed((p) => {
          const current = Number(p) || 0
          const newValue = current + processedCount
          console.log('[AutoCollect] processed 업데이트:', { current, processedCount, newValue })
          return newValue
        })
        if (typeof data.remaining === 'number') setRemaining(data.remaining)
        appendLog(`✅ 포그라운드 배치 완료: +${processedCount}개 시드 처리 (남은 시드: ${data.remaining ?? '-'}개)`)
      } else {
        appendLog(`❌ 배치 실패: ${data?.error || data?.message || 'unknown error'}`)
      }
    } catch (e: any) {
      appendLog(`❌ 예외: ${e.message || String(e)}`)
      console.error('[AutoCollect] 예외 발생:', e)
    } finally {
      console.log('[AutoCollect] finally: processing을 false로 설정')
      setProcessing(false)
    }
  }, [appendLog])

  // runBatch를 ref로 안정화
  const runBatchRef = useRef(runBatch)
  useEffect(() => {
    runBatchRef.current = runBatch
  }, [runBatch])

  useEffect(() => {
    // 초기화가 완료되지 않았으면 대기
    if (!isInitialized) {
      return
    }

    console.log('[AutoCollect] useEffect 실행:', { enabled, backgroundMode })

    // 백그라운드 모드 처리
    if (enabled && backgroundMode && backgroundCollectorRef.current) {
      appendLog('🚀 백그라운드 자동수집 시작')
      backgroundCollectorRef.current.startBackgroundCollect({
        limit: limitRef.current,
        concurrent: concurrentRef.current
      })
      return
    }

    // 백그라운드 모드 중단
    if ((!enabled || !backgroundMode) && backgroundCollectorRef.current) {
      backgroundCollectorRef.current.stopBackgroundCollect()
      if (!enabled) {
        appendLog('⏹️ 백그라운드 자동수집 OFF')
      }
    }

    // 포그라운드 모드 처리
    if (!backgroundMode) {
      // 기존 타이머 정리
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      if (!enabled) {
        appendLog('⏹️ 포그라운드 자동수집 OFF')
        return
      }

      appendLog('▶️ 포그라운드 자동수집 ON - 배치 시작')

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
    }
  }, [enabled, backgroundMode, isInitialized, appendLog])

  const handleToggle = () => {
    const newValue = !enabled
    setEnabled(newValue)
    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('auto-collect-enabled', String(newValue))
    }
    if (newValue) {
      appendLog(`🔄 자동수집 토글: ${backgroundMode ? '백그라운드' : '포그라운드'} 모드로 ON`)
    } else {
      appendLog('🔄 자동수집 토글: OFF')
    }
  }

  const handleBackgroundModeToggle = () => {
    const newValue = !backgroundMode
    setBackgroundMode(newValue)
    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('auto-collect-background-mode', String(newValue))
    }
    appendLog(`🔄 모드 변경: ${newValue ? '백그라운드' : '포그라운드'} 모드`)
  }

  // 초기 마운트 시 localStorage에서 상태 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      const savedEnabled = localStorage.getItem('auto-collect-enabled')
      const savedBackgroundMode = localStorage.getItem('auto-collect-background-mode')
      const savedLimit = localStorage.getItem('auto-collect-limit')
      const savedConcurrent = localStorage.getItem('auto-collect-concurrent')

      if (savedEnabled === 'true') {
        setEnabled(true)
      }
      if (savedBackgroundMode === 'true') {
        setBackgroundMode(true)
      }
      if (savedLimit) {
        setLimitInput(savedLimit)
      }
      if (savedConcurrent) {
        setConcurrentInput(savedConcurrent)
      }
      setIsInitialized(true)
    }
  }, [isInitialized])

  // limitInput 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      localStorage.setItem('auto-collect-limit', limitInput)
    }
  }, [limitInput, isInitialized])

  // concurrentInput 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      localStorage.setItem('auto-collect-concurrent', concurrentInput)
    }
  }, [concurrentInput, isInitialized])

  const handleReset = () => {
    setProcessed(0)
    setRemaining(null)
    setLog([])
    processedRef.current = 0
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
              {enabled ? `${backgroundMode ? '백그라운드' : '포그라운드'} ON` : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-800">모드</label>
            <button
              onClick={handleBackgroundModeToggle}
              disabled={!swRegistered}
              className={`px-4 py-2 rounded text-sm ${
                backgroundMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-orange-600 text-white'
              } ${!swRegistered ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={!swRegistered ? 'Service Worker 미지원 브라우저' : ''}
            >
              {backgroundMode ? '백그라운드 모드' : '포그라운드 모드'}
            </button>
            {!swRegistered && (
              <span className="text-xs text-red-600">백그라운드 모드 미지원</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">시드키워드 개수 (0=무제한)</label>
              <input
                type="number"
                min={0}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                className="input-field w-20"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">동시 처리 수 (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={concurrentInput}
                onChange={(e) => setConcurrentInput(e.target.value)}
                className="input-field w-16"
              />
            </div>
          </div>

          <div className="flex justify-center">
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



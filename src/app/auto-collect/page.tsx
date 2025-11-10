'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AutoCollectResponse } from '@/types/api'
import { handleApiError, logError, getUserFriendlyErrorMessage } from '@/utils/error-handler'

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

        // Service Worker 메시지 리스너 (등록 후 즉시 설정)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'AUTO_COLLECT_UPDATE') {
            // 백그라운드 수집 상태 업데이트 이벤트 발생
            window.dispatchEvent(new CustomEvent('backgroundCollectUpdate', {
              detail: event.data
            }))
          }
        })

        // Service Worker가 완전히 활성화될 때까지 대기
        await navigator.serviceWorker.ready
        
        // 활성화된 worker 가져오기 (active, waiting, installing 순서로 확인)
        this.worker = registration.active || registration.waiting || registration.installing
        
        if (!this.worker) {
          console.warn('[BackgroundCollector] Service Worker가 활성화되지 않았습니다.')
          // 활성화를 기다림
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing || registration.waiting
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  this.worker = newWorker
                  console.log('[BackgroundCollector] Service Worker 활성화 완료')
                }
              })
            }
          })
        } else if (this.worker.state === 'redundant') {
          // redundant 상태면 waiting이나 installing 확인
          this.worker = registration.waiting || registration.installing
          if (this.worker) {
            console.log('[BackgroundCollector] Service Worker redundant 상태 감지, 새로운 worker 사용:', this.worker.state)
          }
        }

        this.isRegistered = true
        console.log('[BackgroundCollector] Service Worker 등록 완료', {
          worker: this.worker ? '활성화됨' : '대기 중',
          state: this.worker?.state
        })
        return true
      }
    } catch (error) {
      console.error('[BackgroundCollector] Service Worker 등록 실패:', error)
    }

    return false
  }

  async startBackgroundCollect(config: { limit: number; concurrent: number; targetKeywords?: number }): Promise<void> {
    console.log('[BackgroundCollector] 백그라운드 수집 시작:', config)
    
    // Service Worker가 활성화되지 않았으면 대기
    if (!this.worker || this.worker.state === 'redundant') {
      console.log('[BackgroundCollector] Service Worker 활성화 대기 중...')
      try {
        const registration = await navigator.serviceWorker.ready
        
        // active, waiting, installing 순서로 확인
        this.worker = registration.active || registration.waiting || registration.installing
        
        if (!this.worker) {
          console.error('[BackgroundCollector] Service Worker를 활성화할 수 없습니다.')
          return
        }
        
        // redundant 상태이거나 installing 상태면 activated 될 때까지 대기
        if (this.worker && (this.worker.state === 'redundant' || this.worker.state === 'installing')) {
          console.log(`[BackgroundCollector] Service Worker 상태: ${this.worker.state}, 활성화 대기...`)
          await new Promise<void>((resolve) => {
            if (!this.worker) {
              resolve()
              return
            }
            
            const stateChangeHandler = () => {
              if (this.worker && (this.worker.state === 'activated' || this.worker.state === 'activating')) {
                this.worker.removeEventListener('statechange', stateChangeHandler)
                resolve()
              } else if (this.worker && this.worker.state === 'redundant') {
                // redundant 상태면 새로운 worker 찾기
                this.worker.removeEventListener('statechange', stateChangeHandler)
                const newRegistration = navigator.serviceWorker.getRegistration()
                newRegistration.then(reg => {
                  this.worker = (reg?.active || reg?.waiting || reg?.installing) ?? null
                  resolve()
                }).catch(() => resolve())
              }
            }
            this.worker.addEventListener('statechange', stateChangeHandler)
            
            // 타임아웃 (10초)
            setTimeout(() => {
              if (this.worker) {
                this.worker.removeEventListener('statechange', stateChangeHandler)
              }
              resolve()
            }, 10000)
          })
        }
      } catch (error) {
        console.error('[BackgroundCollector] Service Worker 준비 실패:', error)
        return
      }
    }

    if (!this.worker || this.worker.state === 'redundant') {
      console.error('[BackgroundCollector] Service Worker가 없거나 redundant 상태입니다.')
      // 재등록 시도
      this.isRegistered = false
      const reRegistered = await this.register()
      if (!reRegistered || !this.worker) {
        console.error('[BackgroundCollector] Service Worker 재등록 실패')
        return
      }
    }

    console.log('[BackgroundCollector] Service Worker에 메시지 전송:', {
      type: 'START_AUTO_COLLECT',
      config,
      workerState: this.worker.state
    })

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
  const [limitInput, setLimitInput] = useState('0') // 0: 무제한
  const [concurrentInput, setConcurrentInput] = useState('20') // 동시 처리 수 (기본값 20 - 5개 API 키 활용)
  const [targetKeywordsInput, setTargetKeywordsInput] = useState('0') // 목표 키워드 수 (0: 무제한)
  const [isInitialized, setIsInitialized] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processed, setProcessed] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [totalKeywords, setTotalKeywords] = useState<number | null>(null) // 전체 키워드 수 (디버깅용)
  const [usedSeeds, setUsedSeeds] = useState<number | null>(null) // 사용된 시드 수 (디버깅용)
  const [totalNewKeywords, setTotalNewKeywords] = useState(0) // 누적된 새로 추가된 키워드 수
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
    return Number.isFinite(n) && n >= 1 && n <= 25 ? n : 20 // 최대값 25, 기본값 20 (5개 API 키 활용)
  }, [concurrentInput])

  const targetKeywords = useMemo(() => {
    const n = Number(targetKeywordsInput)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [targetKeywordsInput])

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
  const targetKeywordsRef = useRef(targetKeywords)
  const processedRef = useRef(processed)
  const processingRef = useRef(processing)
  const totalNewKeywordsRef = useRef(totalNewKeywords)

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
    targetKeywordsRef.current = targetKeywords
  }, [targetKeywords])

  useEffect(() => {
    totalNewKeywordsRef.current = totalNewKeywords
  }, [totalNewKeywords])

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
            const { status, processedCount, batchResult, remaining, error, newKeywordsInBatch, totalNewKeywords, message } = event.detail

            // 목표 달성 알림 처리
            if (status === 'target_reached') {
              const targetMsg = message || `🎯 목표 달성! 총 ${totalNewKeywords || 0}개의 새로운 키워드가 추가되었습니다. - 계속 진행 중...`
              appendLog(targetMsg)
              if (typeof totalNewKeywords === 'number') {
                setTotalNewKeywords(totalNewKeywords)
              }
              // 자동 중단하지 않고 계속 진행
              return
            }

            if (status === 'running' && batchResult) {
              // 처리된 시드 수 업데이트 (Service Worker에서 누적값을 보내므로 그대로 사용)
              if (typeof processedCount === 'number') {
                setProcessed(processedCount)
                console.log('[AutoCollect] 백그라운드 processed 업데이트:', processedCount)
              }
              
              // 남은 시드 수 업데이트 (batchResult에서 가져오거나 remaining 파라미터 사용)
              const remainingValue = batchResult?.remaining ?? remaining
              if (typeof remainingValue === 'number') {
                setRemaining(remainingValue)
                console.log('[AutoCollect] 백그라운드 remaining 업데이트:', remainingValue)
              }
              
              if (typeof batchResult.totalKeywords === 'number') setTotalKeywords(batchResult.totalKeywords)
              if (typeof batchResult.usedSeeds === 'number') setUsedSeeds(batchResult.usedSeeds)
              
              const newKeywords = newKeywordsInBatch || 0
              const totalNew = totalNewKeywords || 0
              
              if (newKeywords > 0 || totalNew > 0) {
                setTotalNewKeywords(totalNew)
                const currentTarget = targetKeywordsRef.current
                appendLog(`✅ 백그라운드 배치 완료: +${batchResult.processed}개 시드 처리, +${newKeywords}개 새로운 키워드 (누적: ${totalNew}개${currentTarget > 0 ? ` / 목표: ${currentTarget}개` : ''}), 남은 시드: ${remainingValue !== undefined ? remainingValue.toLocaleString() : '-'}개`)
              } else {
                appendLog(`✅ 백그라운드 배치 완료: +${batchResult.processed}개 시드 처리, 남은 시드: ${remainingValue !== undefined ? remainingValue.toLocaleString() : '-'}개`)
              }
              
              // 목표 도달 확인 (알림만 표시하고 계속 진행)
              if (batchResult.targetReached) {
                const currentTarget = targetKeywordsRef.current
                appendLog(`🎯 목표 달성! 총 ${totalNew}개의 새로운 키워드가 추가되었습니다. (목표: ${currentTarget}개) - 계속 진행 중...`)
                // 자동 중단하지 않고 계속 진행
              }
            } else if (status === 'waiting') {
              // 남은 시드가 없어 대기 중 (24시간 무한 수집을 위해 계속 재시도)
              appendLog(message || '⏳ 남은 시드가 없습니다. 5분 후 자동으로 재시도합니다...')
              if (typeof remaining === 'number') setRemaining(remaining)
            } else if (status === 'stopped') {
              // 백그라운드 수집이 중단되었지만, 사용자가 직접 끈 것이 아닐 수 있으므로
              // enabled 상태는 유지하고 로그만 남김 (사용자가 토글을 직접 조작할 수 있도록)
              appendLog('⏹️ 백그라운드 수집 중단됨 (사용자에 의한 중단)')
            } else if (status === 'error') {
              appendLog(`❌ 백그라운드 에러: ${error}`)
              // 에러 발생 시에도 enabled 상태는 유지 (사용자가 재시작할 수 있도록)
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

    // 변수 선언을 try 블록 밖으로 이동 (catch 블록에서도 접근 가능하도록)
    const batchLimit = currentLimit === 0 ? 50 : Math.max(1, Math.min(currentLimit - currentProcessed, 50)) // 배치 크기 50 (5개 API 키 활용)
    const concurrentLimit = concurrentRef.current

    try {
      setProcessing(true)
      appendLog('🚀 포그라운드 배치 시작...')

      console.log('[AutoCollect] API 호출:', { batchLimit, concurrentLimit, currentProcessed, currentLimit })

      // 타임아웃 설정 (5분 - 대량 처리 시 시간 필요)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
        console.error('[AutoCollect] API 호출 타임아웃 (5분)')
      }, 300000) // 5분 (대량 처리 시 시간 필요)

      const res = await fetch('https://0-nkey.pages.dev/api/auto-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({
          limit: batchLimit,
          concurrent: concurrentLimit,
          targetKeywords: targetKeywords > 0 ? targetKeywords - totalNewKeywords : 0 // 남은 목표 키워드 수
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('[AutoCollect] API 응답 상태:', res.status)

      if (!res.ok) {
        const apiError = await handleApiError(res)
        logError(new Error(apiError.message), { 
          statusCode: apiError.statusCode,
          batchLimit,
          concurrentLimit 
        })
        appendLog(`❌ ${apiError.message}`)
        return
      }

      const data = await res.json().catch(() => ({})) as AutoCollectResponse
      console.log('[AutoCollect] API 응답 데이터:', data)
      
      // 상세 통계 정보 로깅
      if (data.stats) {
        console.log('[AutoCollect] 📊 배치 처리 통계:', {
          시도한시드수: data.stats.totalAttempted,
          성공률: data.stats.successRate,
          타임아웃: data.stats.timeoutCount,
          API실패: data.stats.apiFailureCount,
          실패한시드목록: data.stats.failedSeeds?.slice(0, 3) || []
        })
      }

      if (data && data.success) {
        const processedCount = Number(data.processed) || 0
        const newKeywordsInBatch = Number(data.totalNewKeywords) || 0
        
        setProcessed((p) => {
          const current = Number(p) || 0
          const newValue = current + processedCount
          console.log('[AutoCollect] processed 업데이트:', { current, processedCount, newValue })
          return newValue
        })
        
        let updatedTotalNewKeywords = 0
        setTotalNewKeywords((prev) => {
          const newTotal = prev + newKeywordsInBatch
          updatedTotalNewKeywords = newTotal
          console.log('[AutoCollect] totalNewKeywords 업데이트:', { prev, newKeywordsInBatch, newTotal })
          return newTotal
        })
        
        // 남은 시드 수 업데이트 (항상 최신 값으로 업데이트)
        if (typeof data.remaining === 'number') {
          setRemaining(data.remaining)
          console.log('[AutoCollect] 포그라운드 remaining 업데이트:', data.remaining)
          // 남은 시드가 0이면 재시도 알림 (24시간 무한 수집을 위해 멈추지 않음)
          if (data.remaining === 0) {
            appendLog('⏳ 남은 시드가 없습니다. 30초 후 자동으로 재시도합니다... (24시간 무한 수집 모드)')
          }
        }
        if (typeof data.totalKeywords === 'number') {
          setTotalKeywords(data.totalKeywords)
          console.log('[AutoCollect] 포그라운드 totalKeywords 업데이트:', data.totalKeywords)
        }
        if (typeof data.usedSeeds === 'number') {
          setUsedSeeds(data.usedSeeds)
          console.log('[AutoCollect] 포그라운드 usedSeeds 업데이트:', data.usedSeeds)
        }
        
              // 목표 도달 확인 (알림만 표시하고 계속 진행)
              if (data.targetReached) {
                appendLog(`🎯 목표 달성! 총 ${updatedTotalNewKeywords}개의 새로운 키워드가 추가되었습니다. (목표: ${targetKeywords}개) - 계속 진행 중...`)
                // 자동 중단하지 않고 계속 진행
              }
              
              if (!data.targetReached) {
          // 상세 통계 정보 포함한 로그
          let logMessage = `✅ 포그라운드 배치 완료: +${processedCount}개 시드 처리, +${newKeywordsInBatch}개 새로운 키워드 (누적: ${updatedTotalNewKeywords}개${targetKeywords > 0 ? ` / 목표: ${targetKeywords}개` : ''})`
          if (data.stats) {
            logMessage += ` (시도: ${data.stats.totalAttempted}개, 성공률: ${data.stats.successRate}`
            if (data.stats.timeoutCount > 0) {
              logMessage += `, 타임아웃: ${data.stats.timeoutCount}개`
            }
            if (data.stats.apiFailureCount > 0) {
              logMessage += `, API실패: ${data.stats.apiFailureCount}개`
            }
            logMessage += ')'
          }
          appendLog(logMessage)
        }
      } else {
        const errorMessage = data?.error || data?.message || '알 수 없는 오류'
        logError(new Error(errorMessage), { action: 'runBatch', data })
        appendLog(`❌ 배치 실패: ${errorMessage}`)
      }
    } catch (e: any) {
      const error = e as Error
      const errorMessage = getUserFriendlyErrorMessage(error)
      
      // 타임아웃이나 네트워크 에러인 경우 재시도 로직
      if (error.name === 'AbortError' || 
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('NetworkError')) {
        logError(error, { action: 'runBatch', batchLimit, concurrentLimit, retryable: true })
        appendLog(`⚠️ 네트워크/타임아웃 에러: ${errorMessage} (다음 배치에서 재시도)`)
      } else {
        logError(error, { action: 'runBatch', batchLimit, concurrentLimit })
        appendLog(`❌ 예외: ${errorMessage}`)
      }
    } finally {
      console.log('[AutoCollect] finally: processing을 false로 설정')
      setProcessing(false)
    }
  }, [appendLog, targetKeywords, totalNewKeywords])

  // runBatch를 ref로 안정화
  const runBatchRef = useRef(runBatch)
  useEffect(() => {
    runBatchRef.current = runBatch
  }, [runBatch])

  // 컴포넌트 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      console.log('[AutoCollect] 컴포넌트 언마운트 cleanup')
      
      // 포그라운드 모드 타이머 정리
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      // 백그라운드 모드 Service Worker 중단
      if (backgroundCollectorRef.current) {
        backgroundCollectorRef.current.stopBackgroundCollect()
      }
    }
  }, []) // 컴포넌트 언마운트 시에만 실행

  // 자동수집 실행 로직
  useEffect(() => {
    // 초기화가 완료되지 않았으면 대기
    if (!isInitialized) {
      return
    }

    console.log('[AutoCollect] useEffect 실행:', { enabled, backgroundMode })

    // cleanup 함수: 상태 변경 시 이전 리소스 정리
    return () => {
      console.log('[AutoCollect] useEffect cleanup - 리소스 정리')
      
      // 포그라운드 모드 타이머 정리
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      // 백그라운드 모드 Service Worker 중단
      if (backgroundCollectorRef.current) {
        backgroundCollectorRef.current.stopBackgroundCollect()
      }
    }
  }, [enabled, backgroundMode, isInitialized])

  // 자동수집 실행 로직 (별도 useEffect로 분리)
  useEffect(() => {
    // 초기화가 완료되지 않았으면 대기
    if (!isInitialized) {
      console.log('[AutoCollect] 초기화 대기 중...', { isInitialized })
      return
    }

    console.log('[AutoCollect] 자동수집 실행 로직 시작:', {
      enabled,
      backgroundMode,
      hasBackgroundCollector: !!backgroundCollectorRef.current,
      limit: limitRef.current,
      concurrent: concurrentRef.current,
      targetKeywords: targetKeywordsRef.current
    })

    // 백그라운드 모드 처리
    if (enabled && backgroundMode && backgroundCollectorRef.current) {
      console.log('[AutoCollect] 백그라운드 모드 시작')
      appendLog('🚀 백그라운드 자동수집 시작')
      backgroundCollectorRef.current.startBackgroundCollect({
        limit: limitRef.current,
        concurrent: concurrentRef.current,
        targetKeywords: targetKeywordsRef.current
      }).catch((error: any) => {
        console.error('[AutoCollect] 백그라운드 수집 시작 실패:', error)
        appendLog(`❌ 백그라운드 수집 시작 실패: ${error.message || '알 수 없는 오류'}`)
      })
      return
    }

    // 백그라운드 모드 중단
    if ((!enabled || !backgroundMode) && backgroundCollectorRef.current) {
      console.log('[AutoCollect] 백그라운드 모드 중단')
      backgroundCollectorRef.current.stopBackgroundCollect()
      if (!enabled) {
        appendLog('⏹️ 백그라운드 자동수집 OFF')
      }
    }

    // 포그라운드 모드 처리
    if (!backgroundMode) {
      if (!enabled) {
        console.log('[AutoCollect] 포그라운드 모드 비활성화')
        appendLog('⏹️ 포그라운드 자동수집 OFF')
        return
      }

      console.log('[AutoCollect] 포그라운드 모드 시작 - 즉시 배치 실행')
      appendLog('▶️ 포그라운드 자동수집 ON - 배치 시작')

      // 즉시 1회 실행
      runBatchRef.current()

      // 이후 3초마다 반복 실행 (속도 최적화)
      timerRef.current = setInterval(() => {
        // 최신 상태 체크를 위해 ref 사용
        console.log('[AutoCollect] 타이머 실행:', { 
          enabled: enabledRef.current, 
          processing: processingRef.current,
          backgroundMode: backgroundModeRef.current
        })
        if (enabledRef.current && !processingRef.current && !backgroundModeRef.current) {
          console.log('[AutoCollect] 타이머에서 배치 실행')
          runBatchRef.current()
        } else {
          console.log('[AutoCollect] 타이머에서 배치 건너뜀:', {
            enabled: enabledRef.current,
            processing: processingRef.current,
            backgroundMode: backgroundModeRef.current
          })
        }
      }, 3000) // 3초 간격 (속도 최적화)

      // cleanup: 타이머 정리
      return () => {
        console.log('[AutoCollect] 포그라운드 모드 cleanup - 타이머 정리')
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
      console.log('[AutoCollect] 초기화 시작 - localStorage에서 상태 불러오기')
      const savedEnabled = localStorage.getItem('auto-collect-enabled')
      const savedBackgroundMode = localStorage.getItem('auto-collect-background-mode')
      const savedLimit = localStorage.getItem('auto-collect-limit')
      const savedConcurrent = localStorage.getItem('auto-collect-concurrent')

      console.log('[AutoCollect] 저장된 상태:', {
        enabled: savedEnabled,
        backgroundMode: savedBackgroundMode,
        limit: savedLimit,
        concurrent: savedConcurrent
      })

      if (savedEnabled === 'true') {
        console.log('[AutoCollect] 자동수집 활성화 상태 복원')
        setEnabled(true)
      } else {
        console.log('[AutoCollect] 자동수집 비활성화 상태 (또는 저장된 값 없음)')
      }
      if (savedBackgroundMode === 'true') {
        console.log('[AutoCollect] 백그라운드 모드 활성화 상태 복원')
        setBackgroundMode(true)
      }
      if (savedLimit) {
        setLimitInput(savedLimit)
      }
      
      // 동시 처리 수 처리 (최대값 25로 제한)
      if (savedConcurrent) {
        const savedConcurrentNum = Number(savedConcurrent)
        // 최대값 25로 제한
        if (savedConcurrentNum > 25) {
          const correctedValue = '25'
          setConcurrentInput(correctedValue)
          localStorage.setItem('auto-collect-concurrent', correctedValue)
          console.log(`[AutoCollect] 동시 처리 수 자동 수정: ${savedConcurrent} → ${correctedValue}`)
        } else if (savedConcurrentNum < 1) {
          // 최소값 1로 제한
          const correctedValue = '20'
          setConcurrentInput(correctedValue)
          localStorage.setItem('auto-collect-concurrent', correctedValue)
          console.log(`[AutoCollect] 동시 처리 수 자동 수정: ${savedConcurrent} → ${correctedValue}`)
        } else {
          setConcurrentInput(savedConcurrent)
        }
      } else {
        // 저장된 값이 없으면 기본값 20 설정 (5개 API 키 활용)
        setConcurrentInput('20')
      }
      
      console.log('[AutoCollect] 초기화 완료 - isInitialized를 true로 설정')
      setIsInitialized(true)
      appendLog('✅ 초기화 완료 - 자동수집 준비됨')
    }
  }, [isInitialized, appendLog])

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
    setTotalNewKeywords(0)
    setLog([])
    processedRef.current = 0
    appendLog('🔄 카운터 초기화')
  }

  const handleCheckServiceWorkerStatus = async () => {
    appendLog('🔍 Service Worker 상태 확인 중...')
    
    if (!backgroundCollectorRef.current) {
      appendLog('❌ Service Worker가 등록되지 않았습니다.')
      return
    }

    try {
      const status = await backgroundCollectorRef.current.getStatus()
      if (status) {
        appendLog(`📊 Service Worker 상태: ${status.enabled ? '✅ 실행 중' : '⏹️ 중지됨'}`)
        appendLog(`📊 처리된 시드: ${status.processedCount || 0}개`)
        appendLog(`📊 설정: ${JSON.stringify(status.config || {})}`)
        
        // 현재 프론트엔드 상태도 함께 표시
        appendLog(`📊 프론트엔드 상태: enabled=${enabled}, backgroundMode=${backgroundMode}, isInitialized=${isInitialized}`)
        appendLog(`📊 프론트엔드 처리된 시드: ${processed}개`)
        appendLog(`📊 남은 시드: ${remaining !== null ? remaining.toLocaleString() : '-'}개`)
        
        if (status.enabled) {
          appendLog('✅ 백그라운드 수집이 실행 중입니다.')
        } else {
          appendLog('⚠️ 백그라운드 수집이 중지되었습니다. 다시 시작하려면 토글을 켜세요.')
        }
      } else {
        appendLog('⚠️ Service Worker 상태를 확인할 수 없습니다.')
      }
    } catch (error: any) {
      const errorMessage = getUserFriendlyErrorMessage(error as Error)
      logError(error as Error, { action: 'checkServiceWorkerStatus' })
      appendLog(`❌ Service Worker 상태 확인 실패: ${errorMessage}`)
    }
  }

  const handleRestartServiceWorker = async () => {
    if (!backgroundCollectorRef.current) {
      appendLog('❌ Service Worker가 등록되지 않았습니다.')
      return
    }

    if (!enabled || !backgroundMode) {
      appendLog('⚠️ 자동수집과 백그라운드 모드를 먼저 켜세요.')
      return
    }

    try {
      appendLog('🔄 Service Worker 재시작 중...')
      // 먼저 중지
      await backgroundCollectorRef.current.stopBackgroundCollect()
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1초 대기
      
      // 다시 시작
      await backgroundCollectorRef.current.startBackgroundCollect({
        limit: limitRef.current,
        concurrent: concurrentRef.current,
        targetKeywords: targetKeywordsRef.current
      })
      appendLog('✅ Service Worker 재시작 완료')
    } catch (error: any) {
      const errorMessage = getUserFriendlyErrorMessage(error as Error)
      logError(error as Error, { action: 'restartServiceWorker' })
      appendLog(`❌ Service Worker 재시작 실패: ${errorMessage}`)
    }
  }

  // 자동수집 강제 재시작 함수 추가
  const handleForceRestart = () => {
    appendLog('🔄 자동수집 강제 재시작...')
    
    // 포그라운드 모드 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    // 백그라운드 모드 중지
    if (backgroundCollectorRef.current) {
      backgroundCollectorRef.current.stopBackgroundCollect()
    }
    
    // 상태 초기화
    setProcessing(false)
    
    // 잠시 대기 후 재시작
    setTimeout(() => {
      if (enabled) {
        if (backgroundMode && backgroundCollectorRef.current) {
          appendLog('🚀 백그라운드 모드 재시작')
          backgroundCollectorRef.current.startBackgroundCollect({
            limit: limitRef.current,
            concurrent: concurrentRef.current,
            targetKeywords: targetKeywordsRef.current
          }).catch((error: any) => {
            appendLog(`❌ 재시작 실패: ${error.message || '알 수 없는 오류'}`)
          })
        } else if (!backgroundMode) {
          appendLog('🚀 포그라운드 모드 재시작')
          runBatchRef.current()
          timerRef.current = setInterval(() => {
            if (enabledRef.current && !processingRef.current && !backgroundModeRef.current) {
              runBatchRef.current()
            }
          }, 3000)
        }
      }
    }, 500)
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">자동 수집</h2>
        <div className="space-y-4">
          {/* 상태 알림 */}
          {!isInitialized && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">⏳ 초기화 중...</p>
            </div>
          )}
          {isInitialized && !enabled && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">⏹️ 자동수집이 꺼져 있습니다. 토글을 켜서 시작하세요.</p>
            </div>
          )}
          {isInitialized && enabled && remaining === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">⏳ 남은 시드가 없습니다. 5분 후 자동으로 재시도합니다... (24시간 무한 수집 모드)</p>
            </div>
          )}
          {isInitialized && enabled && remaining !== null && remaining > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">✅ 자동수집 실행 중 - 남은 시드: {remaining.toLocaleString()}개</p>
            </div>
          )}
          
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-800">자동수집</label>
            <button
              onClick={handleToggle}
              className={`px-4 py-2 rounded ${enabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}
            >
              {enabled ? `${backgroundMode ? '백그라운드' : '포그라운드'} ON` : 'OFF'}
            </button>
            {isInitialized && (
              <span className="text-xs text-gray-500">
                {enabled ? (processing ? '처리 중...' : '대기 중') : '중지됨'}
              </span>
            )}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    <label className="text-sm text-gray-700">동시 처리 수 (1-25)</label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                value={concurrentInput}
                onChange={(e) => setConcurrentInput(e.target.value)}
                className="input-field w-16"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">목표 키워드 수 (0=무제한)</label>
              <input
                type="number"
                min={0}
                value={targetKeywordsInput}
                onChange={(e) => setTargetKeywordsInput(e.target.value)}
                className="input-field w-24"
                placeholder="0"
              />
            </div>
          </div>
          
          {targetKeywords > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                🎯 목표: <strong>{targetKeywords.toLocaleString()}개의 새로운 키워드</strong> 추가
                {totalNewKeywords > 0 && (
                  <> ({totalNewKeywords.toLocaleString()}개 누적 / 진행률: {Math.min(100, Math.round((totalNewKeywords / targetKeywords) * 100))}%)</>
                )}
              </p>
            </div>
          )}

          <div className="flex justify-center gap-2 flex-wrap">
            <button onClick={handleReset} className="btn-secondary">카운터 초기화</button>
            <button onClick={handleForceRestart} className="btn-secondary" disabled={!enabled}>
              자동수집 강제 재시작
            </button>
            {backgroundMode && swRegistered && (
              <>
                <button onClick={handleCheckServiceWorkerStatus} className="btn-secondary">
                  Service Worker 상태 확인
                </button>
                <button onClick={handleRestartServiceWorker} className="btn-secondary">
                  Service Worker 재시작
                </button>
              </>
            )}
          </div>

          <div className={`grid gap-4 ${targetKeywords > 0 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">처리된 시드</div>
              <div className="text-xl font-semibold">{processed}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">남은 시드</div>
              <div className="text-xl font-semibold">{remaining !== null ? remaining.toLocaleString() : '-'}</div>
              {totalKeywords !== null && usedSeeds !== null && (
                <div className="text-xs text-gray-500 mt-1">
                  총 키워드: {totalKeywords.toLocaleString()}개 / 시드 사용: {usedSeeds.toLocaleString()}개
                </div>
              )}
            </div>
            {targetKeywords > 0 && (
              <div className="p-3 bg-blue-50 rounded">
                <div className="text-sm text-gray-600">새로운 키워드</div>
                <div className="text-xl font-semibold text-blue-700">
                  {totalNewKeywords.toLocaleString()} / {targetKeywords.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.min(100, Math.round((totalNewKeywords / targetKeywords) * 100))}% 완료
                </div>
              </div>
            )}
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




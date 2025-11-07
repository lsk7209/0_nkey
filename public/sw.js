// Service Worker for Background Auto Collection
// 백그라운드 자동 수집을 위한 Service Worker
// Version: 2.3 - 상세 통계 로깅 추가 (성공률, 타임아웃, API실패 추적)

let autoCollectInterval = null
let autoCollectConfig = null
let processedCount = 0
let totalNewKeywordsAccumulated = 0 // 누적된 새로 추가된 키워드 수
let consecutiveTimeouts = 0 // 연속 타임아웃 횟수

// Service Worker 메시지 핸들러
self.addEventListener('message', (event) => {
  const { type, config } = event.data
  
  console.log('[SW] 메시지 수신:', { type, config, source: event.source?.constructor?.name || 'unknown' })

  switch (type) {
    case 'START_AUTO_COLLECT':
      console.log('[SW] START_AUTO_COLLECT 메시지 처리 시작')
      startAutoCollect(config)
      break

    case 'STOP_AUTO_COLLECT':
      console.log('[SW] STOP_AUTO_COLLECT 메시지 처리')
      stopAutoCollect()
      break

    case 'GET_AUTO_COLLECT_STATUS':
      console.log('[SW] GET_AUTO_COLLECT_STATUS 메시지 처리')
      sendStatus()
      break
      
    default:
      console.warn('[SW] 알 수 없는 메시지 타입:', type)
  }
})

// 자동 수집 시작
function startAutoCollect(config) {
  console.log('[SW] 자동 수집 시작:', config)

  // 기존 인터벌 정리
  if (autoCollectInterval) {
    clearInterval(autoCollectInterval)
  }

  autoCollectConfig = config
  processedCount = 0
  totalNewKeywordsAccumulated = 0 // 초기화
  consecutiveTimeouts = 0 // 연속 타임아웃 횟수 초기화

  // 즉시 첫 배치 실행
  runBatch()

  // 15초마다 반복 실행 (다중 API 키 활용으로 속도 최적화)
  autoCollectInterval = setInterval(() => {
    runBatch()
  }, 15000) // 15초 간격 (다중 API 키 활용으로 속도 최적화)

  // 시작 상태 알림
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'AUTO_COLLECT_UPDATE',
        status: 'started',
        config,
        processedCount: 0
      })
    })
  })
}

// 자동 수집 중단
function stopAutoCollect() {
  console.log('[SW] 자동 수집 중단')

  if (autoCollectInterval) {
    clearInterval(autoCollectInterval)
    autoCollectInterval = null
  }

  autoCollectConfig = null
  totalNewKeywordsAccumulated = 0 // 초기화

  // 중단 상태 알림
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'AUTO_COLLECT_UPDATE',
        status: 'stopped',
        processedCount
      })
    })
  })
}

// 상태 전송
function sendStatus() {
  const status = {
    enabled: autoCollectInterval !== null,
    config: autoCollectConfig,
    processedCount
  }

  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'AUTO_COLLECT_STATUS',
        status
      })
    })
  })
}

// 배치 실행
async function runBatch() {
  if (!autoCollectConfig) return

  try {
    console.log('[SW] 배치 실행 시작')

           const batchLimit = autoCollectConfig.limit === 0 ? 20 : Math.max(1, Math.min(autoCollectConfig.limit - processedCount, 20)) // 배치 크기 20으로 감소 (안정성 우선)
           const concurrent = autoCollectConfig.concurrent || 10 // 기본값 10으로 감소 (안정성 우선)
    const targetKeywords = autoCollectConfig.targetKeywords || 0
    const remainingTargetKeywords = targetKeywords > 0 ? Math.max(0, targetKeywords - totalNewKeywordsAccumulated) : 0

    console.log('[SW] 배치 실행 준비:', {
      batchLimit,
      concurrent,
      targetKeywords,
      totalNewKeywordsAccumulated,
      remainingTargetKeywords,
      processedCount
    })

    console.log('[SW] API 호출 시작:', {
      url: 'https://0-nkey.pages.dev/api/auto-collect',
      method: 'POST',
      body: {
        limit: batchLimit,
        concurrent: concurrent,
        targetKeywords: remainingTargetKeywords
      }
    })

    let response
    try {
      // 타임아웃 설정 (10분) - 대용량 처리 시간 고려
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
        consecutiveTimeouts++
        console.error(`[SW] API 호출 타임아웃 (10분) - 연속 타임아웃: ${consecutiveTimeouts}회`)
        
        // 연속 타임아웃 3회 이상 시 일시 중단
        if (consecutiveTimeouts >= 3) {
          console.error('[SW] 연속 타임아웃 3회 이상, 자동수집 일시 중단')
          stopAutoCollect()
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'AUTO_COLLECT_UPDATE',
                status: 'error',
                error: '연속 타임아웃으로 인한 자동 중단. API 응답이 너무 느립니다.',
                processedCount
              })
            })
          })
          return
        }
      }, 600000) // 10분으로 증가

      response = await fetch('https://0-nkey.pages.dev/api/auto-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'dev-key-2024'
        },
        body: JSON.stringify({
          limit: batchLimit,
          concurrent: concurrent,
          targetKeywords: remainingTargetKeywords
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      consecutiveTimeouts = 0 // 성공 시 연속 타임아웃 횟수 초기화
      console.log('[SW] API 응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        console.error('[SW] API 호출 실패:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 200)
        })
        return
      }
    } catch (fetchError) {
      console.error('[SW] API 호출 중 에러:', {
        error: fetchError.message,
        stack: fetchError.stack,
        name: fetchError.name,
        isAbort: fetchError.name === 'AbortError'
      })
      
      // 타임아웃이나 네트워크 에러인 경우 재시도 로직으로
      if (fetchError.name === 'AbortError' || 
          fetchError.message.includes('Failed to fetch') ||
          fetchError.message.includes('timeout')) {
        console.log('[SW] 네트워크/타임아웃 에러, 다음 배치에서 재시도')
        
        // 연속 타임아웃이 2회 이상이면 재시도 간격을 늘림
        if (consecutiveTimeouts >= 2) {
          console.log('[SW] 연속 타임아웃 감지, 재시도 간격 증가 (60초 대기)')
          // 다음 배치까지 대기 시간 증가
          return
        }
        
        // 다음 배치에서 자동으로 재시도됨 (인터벌에 의해)
        return
      }
      
      throw fetchError
    }

    let data
    try {
      data = await response.json()
      console.log('[SW] API 응답 데이터:', {
        success: data.success,
        processed: data.processed,
        totalNewKeywords: data.totalNewKeywords,
        remaining: data.remaining,
        message: data.message,
        stats: data.stats || null // 상세 통계 정보
      })
      
      // 상세 통계 정보가 있으면 별도로 로깅
      if (data.stats) {
        console.log('[SW] 📊 배치 처리 통계:', {
          시도한시드수: data.stats.totalAttempted,
          성공률: data.stats.successRate,
          타임아웃: data.stats.timeoutCount,
          API실패: data.stats.apiFailureCount,
          실패한시드목록: data.stats.failedSeeds?.slice(0, 5) || [] // 최대 5개만 표시
        })
      }
    } catch (jsonError) {
      console.error('[SW] JSON 파싱 실패:', {
        error: jsonError.message,
        responseStatus: response?.status,
        responseText: await response.text().catch(() => '')
      })
      return
    }

    if (data.success) {
      const processedInBatch = data.processed || 0
      const newKeywordsInBatch = data.totalNewKeywords || 0
      processedCount += processedInBatch
      totalNewKeywordsAccumulated += newKeywordsInBatch // 누적값 업데이트

      console.log('[SW] 배치 완료:', {
        processedInBatch,
        totalProcessed: processedCount,
        newKeywordsInBatch,
        totalNewKeywordsAccumulated,
        remaining: data.remaining,
        targetKeywords: targetKeywords
      })

      // 진행 상태 알림
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'AUTO_COLLECT_UPDATE',
            status: 'running',
            processedCount,
            newKeywordsInBatch,
            totalNewKeywords: totalNewKeywordsAccumulated, // 누적값 사용
            batchResult: data,
            remaining: data.remaining
          })
        })
      })

      // 제한 도달 시 중단 (null 체크 추가)
      if (autoCollectConfig) {
        // 시드 개수 제한 확인
        if (autoCollectConfig.limit > 0 && processedCount >= autoCollectConfig.limit) {
          console.log('[SW] 시드 목표 개수 도달, 자동 중단')
          stopAutoCollect()
          return
        }
        // 목표 키워드 수 도달 확인 (누적값 기준)
        if (autoCollectConfig.targetKeywords > 0 && totalNewKeywordsAccumulated >= autoCollectConfig.targetKeywords) {
          console.log('[SW] 목표 키워드 수 도달, 자동 중단:', {
            totalNewKeywordsAccumulated,
            targetKeywords: autoCollectConfig.targetKeywords
          })
          stopAutoCollect()
          return
        }
        
        // 남은 시드가 없으면 중단
        if (data.remaining === 0 || data.remaining === null) {
          console.log('[SW] 남은 시드가 없음, 자동 중단:', {
            remaining: data.remaining,
            processedCount,
            totalNewKeywordsAccumulated
          })
          stopAutoCollect()
          return
        }
      }
    }

  } catch (error) {
    console.error('[SW] 배치 실행 에러:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      processedCount,
      hasConfig: !!autoCollectConfig
    })

    // 에러 상태 알림
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'AUTO_COLLECT_UPDATE',
          status: 'error',
          error: error.message || '알 수 없는 에러',
          processedCount,
          errorDetails: {
            name: error.name,
            message: error.message
          }
        })
      })
    }).catch(notifyError => {
      console.error('[SW] 에러 알림 전송 실패:', notifyError)
    })

    // 타임아웃이나 네트워크 에러 시 잠시 대기 후 재시도
    const errorMessage = error.message || ''
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('504') ||
        errorMessage.includes('NetworkError') ||
        error.name === 'TypeError') {
      console.log('[SW] 네트워크 에러 감지, 2분 후 재시도:', errorMessage)
      setTimeout(() => {
        if (autoCollectConfig && autoCollectInterval) {
          console.log('[SW] 네트워크 에러 재시도 시작')
          runBatch() // 재시도
        } else {
          console.log('[SW] 재시도 취소: 자동수집이 중단되었습니다.')
        }
      }, 120000) // 2분 대기
    } else {
      console.log('[SW] 다른 종류의 에러, 계속 진행 (다음 인터벌에서 재시도)')
    }
  }
}

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('[SW] 설치됨')
  self.skipWaiting()
})

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화됨')
  event.waitUntil(self.clients.claim())
})

// 주기적으로 상태 확인 (선택사항)
setInterval(() => {
  if (autoCollectInterval && autoCollectConfig) {
    console.log('[SW] 백그라운드 실행 중:', { 
      processedCount, 
      totalNewKeywordsAccumulated,
      targetKeywords: autoCollectConfig.targetKeywords,
      config: autoCollectConfig 
    })
  }
}, 60000) // 1분마다 로그

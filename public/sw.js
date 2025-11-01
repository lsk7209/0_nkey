// Service Worker for Background Auto Collection
// 백그라운드 자동 수집을 위한 Service Worker

let autoCollectInterval = null
let autoCollectConfig = null
let processedCount = 0

// Service Worker 메시지 핸들러
self.addEventListener('message', (event) => {
  const { type, config } = event.data

  switch (type) {
    case 'START_AUTO_COLLECT':
      startAutoCollect(config)
      break

    case 'STOP_AUTO_COLLECT':
      stopAutoCollect()
      break

    case 'GET_AUTO_COLLECT_STATUS':
      sendStatus()
      break
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

  // 즉시 첫 배치 실행
  runBatch()

  // 60초마다 반복 실행 (백그라운드에서는 더 긴 간격)
  autoCollectInterval = setInterval(() => {
    runBatch()
  }, 60000) // 60초 간격

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

    const batchLimit = autoCollectConfig.limit === 0 ? 5 : Math.max(1, Math.min(autoCollectConfig.limit - processedCount, 5))
    const concurrent = autoCollectConfig.concurrent || 3
    const targetKeywords = autoCollectConfig.targetKeywords || 0
    const currentNewKeywords = processedCount // 임시로 processedCount 사용 (실제로는 별도 추적 필요)

    const response = await fetch('https://0-nkey.pages.dev/api/auto-collect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'dev-key-2024'
      },
      body: JSON.stringify({
        limit: batchLimit,
        concurrent: concurrent,
        targetKeywords: targetKeywords > 0 ? Math.max(0, targetKeywords - currentNewKeywords) : 0
      })
    })

    if (!response.ok) {
      console.error('[SW] API 호출 실패:', response.status)
      return
    }

    const data = await response.json()

    if (data.success) {
      const processedInBatch = data.processed || 0
      const newKeywordsInBatch = data.totalNewKeywords || 0
      processedCount += processedInBatch

      console.log('[SW] 배치 완료:', {
        processedInBatch,
        totalProcessed: processedCount,
        newKeywordsInBatch,
        remaining: data.remaining
      })

      // 진행 상태 알림
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'AUTO_COLLECT_UPDATE',
            status: 'running',
            processedCount,
            newKeywordsInBatch,
            totalNewKeywords: data.totalNewKeywords || 0,
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
        // 목표 키워드 수 도달 확인
        if (autoCollectConfig.targetKeywords > 0 && (data.totalNewKeywords || 0) >= autoCollectConfig.targetKeywords) {
          console.log('[SW] 목표 키워드 수 도달, 자동 중단')
          stopAutoCollect()
          return
        }
      }
    }

  } catch (error) {
    console.error('[SW] 배치 실행 에러:', error)

    // 에러 상태 알림
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'AUTO_COLLECT_UPDATE',
          status: 'error',
          error: error.message,
          processedCount
        })
      })
    })

    // 타임아웃이나 네트워크 에러 시 잠시 대기 후 재시도
    if (error.message.includes('Failed to fetch') || error.message.includes('timeout') || error.message.includes('504')) {
      console.log('[SW] 네트워크 에러, 2분 후 재시도')
      setTimeout(() => {
        runBatch() // 재시도
      }, 120000) // 2분 대기
    }
    // 다른 에러는 계속 진행
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
  if (autoCollectInterval) {
    console.log('[SW] 백그라운드 실행 중:', { processedCount, config: autoCollectConfig })
  }
}, 60000) // 1분마다 로그

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

  // 10초마다 반복 실행 (백그라운드에서는 더 긴 간격)
  autoCollectInterval = setInterval(() => {
    runBatch()
  }, 10000) // 10초 간격

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

    const batchLimit = autoCollectConfig.limit === 0 ? 15 : Math.max(1, Math.min(autoCollectConfig.limit - processedCount, 15))
    const concurrent = autoCollectConfig.concurrent || 3

    const response = await fetch('https://0-nkey.pages.dev/api/auto-collect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'dev-key-2024'
      },
      body: JSON.stringify({
        limit: batchLimit,
        concurrent: concurrent
      })
    })

    if (!response.ok) {
      console.error('[SW] API 호출 실패:', response.status)
      return
    }

    const data = await response.json()

    if (data.success) {
      const processedInBatch = data.processed || 0
      processedCount += processedInBatch

      console.log('[SW] 배치 완료:', {
        processedInBatch,
        totalProcessed: processedCount,
        remaining: data.remaining
      })

      // 진행 상태 알림
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'AUTO_COLLECT_UPDATE',
            status: 'running',
            processedCount,
            batchResult: data,
            remaining: data.remaining
          })
        })
      })

      // 제한 도달 시 중단
      if (autoCollectConfig.limit > 0 && processedCount >= autoCollectConfig.limit) {
        console.log('[SW] 목표 개수 도달, 자동 중단')
        stopAutoCollect()
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

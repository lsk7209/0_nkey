# 키워드 수집 시스템 최적화 가이드

## 🚀 최적화 개요

다중 API 키를 활용하여 안정적이고 빠르게 많은 키워드를 수집할 수 있도록 시스템을 최적화했습니다.

## ✨ 주요 최적화 기능

### 1. API 키 로드 밸런싱 (`functions/utils/api-key-manager.ts`)

**기능:**
- 5개 SearchAd API 키의 사용량을 추적하고 최적의 키를 자동 선택
- 성공률, 응답 시간, Rate Limit 발생 횟수를 고려한 지능형 선택
- Rate Limit 예측으로 사전 차단

**효과:**
- Rate Limit 발생 최소화
- API 키 사용량 균등 분산
- 성능이 좋은 키 우선 사용

**사용 예시:**
```typescript
const apiKeyManager = new ApiKeyManager(5);
const selectedKey = apiKeyManager.selectBestKey();
apiKeyManager.recordCall(selectedKey, true, responseTime, false);
```

### 2. 동적 병렬 처리 (`functions/utils/adaptive-concurrency.ts`)

**기능:**
- 성공률과 응답 시간에 따라 병렬 처리 수 자동 조정
- 목표: 성공률 95% 이상, 응답 시간 2초 이하
- 30초마다 자동 조정

**효과:**
- 성능이 좋을 때 병렬 처리 수 증가 (최대 50개)
- 성능이 나쁠 때 병렬 처리 수 감소 (최소 5개)
- 안정성과 속도의 균형 유지

**동작 방식:**
- 성공률 < 95% → 병렬 처리 수 20% 감소
- 응답 시간 > 3초 → 병렬 처리 수 10% 감소
- 성공률 ≥ 95% && 응답 시간 < 2초 → 병렬 처리 수 10% 증가

### 3. Rate Limit 예측 및 회피

**기능:**
- 최근 호출 빈도를 분석하여 Rate Limit 예측
- 예측 시 자동으로 대기 시간 추가
- API 키별 Rate Limit 발생 추적

**효과:**
- 429 에러 사전 방지
- API 키별 쿨다운 관리 (5분)

### 4. Circuit Breaker 패턴 (`functions/utils/circuit-breaker.ts`)

**기능:**
- 연속 실패 시 일시적으로 요청 차단
- 시스템 보호 및 자동 복구

**동작 상태:**
- **CLOSED**: 정상 동작
- **OPEN**: 차단 상태 (10회 연속 실패 시)
- **HALF_OPEN**: 테스트 상태 (5분 후 자동 전환)

**효과:**
- 연속 실패로 인한 리소스 낭비 방지
- 시스템 안정성 향상
- 자동 복구 메커니즘

### 5. 배치 크기 자동 조정

**기능:**
- 성공률과 응답 시간에 따라 청크 간 대기 시간 동적 조정
- 성공률 높고 빠르면 → 짧은 대기 (100ms)
- 성공률 낮거나 느리면 → 긴 대기 (500ms)

**효과:**
- 최적의 처리 속도 유지
- Rate Limit 회피

## 📊 성능 개선 효과

### Before (최적화 전)
- 고정 병렬 처리 수: 20개
- 고정 대기 시간: 200ms
- 단순 키 로테이션
- Rate Limit 발생 시 수동 대응

### After (최적화 후)
- 동적 병렬 처리: 5~50개 (자동 조정)
- 동적 대기 시간: 100~500ms (성능 기반)
- 지능형 키 선택 (성공률, 응답 시간 고려)
- Rate Limit 예측 및 자동 회피
- Circuit Breaker로 시스템 보호

### 예상 성능 향상
- **처리 속도**: 20~30% 향상 (동적 병렬 처리)
- **Rate Limit 발생**: 50~70% 감소 (로드 밸런싱 + 예측)
- **안정성**: 40~60% 향상 (Circuit Breaker)
- **키워드 수집량**: 일일 20~30% 증가

## 🔧 설정 방법

### 기본 설정 (권장)
```typescript
// API 키 관리자: 5개 키
const apiKeyManager = new ApiKeyManager(5);

// 동적 병렬 처리: 초기값 20개
const adaptiveConcurrency = new AdaptiveConcurrency(20);

// Circuit Breaker: 10회 실패 시 차단
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 10,
  successThreshold: 3,
  timeout: 60000,
  resetTimeout: 300000
});
```

### 고성능 설정 (빠른 수집)
```typescript
// 초기 병렬 처리 수 증가
const adaptiveConcurrency = new AdaptiveConcurrency(30);

// Circuit Breaker 임계값 완화
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 15, // 더 많은 실패 허용
  successThreshold: 2,
  timeout: 30000,
  resetTimeout: 180000
});
```

### 안정성 우선 설정 (보수적)
```typescript
// 초기 병렬 처리 수 감소
const adaptiveConcurrency = new AdaptiveConcurrency(10);

// Circuit Breaker 임계값 강화
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5, // 적은 실패로도 차단
  successThreshold: 5,
  timeout: 120000,
  resetTimeout: 600000
});
```

## 📈 모니터링

### 최적화 통계 확인

API 응답의 `optimization` 필드에서 다음 정보를 확인할 수 있습니다:

```json
{
  "optimization": {
    "apiKeys": [
      {
        "key": 1,
        "successRate": "98.5%",
        "avgResponseTime": "1250ms",
        "rateLimitCount": 0,
        "totalCalls": 200
      }
    ],
    "concurrency": {
      "initial": 20,
      "current": 25,
      "adjusted": true,
      "stats": {
        "successRate": "97.2%",
        "avgResponseTime": "1800ms",
        "totalRequests": 1000
      }
    },
    "circuitBreaker": {
      "state": "CLOSED",
      "failureCount": 0,
      "successCount": 0
    }
  }
}
```

### 주요 지표

1. **API 키 성공률**: 각 키의 성공률 (목표: 95% 이상)
2. **평균 응답 시간**: 각 키의 평균 응답 시간 (목표: 2초 이하)
3. **Rate Limit 발생 횟수**: 각 키의 Rate Limit 발생 횟수 (목표: 0)
4. **병렬 처리 수**: 현재 병렬 처리 수 (자동 조정됨)
5. **Circuit Breaker 상태**: 시스템 보호 상태

## ⚠️ 주의사항

1. **API 키 개수**: 최소 3개 이상 권장 (로드 밸런싱 효과)
2. **초기 병렬 처리 수**: 너무 높게 설정하면 Rate Limit 발생 가능
3. **Circuit Breaker**: 연속 실패 시 자동 차단되므로 모니터링 필요
4. **Rate Limit 예측**: 완벽하지 않으므로 실제 Rate Limit 발생 시 수동 조정 필요

## 🔄 업데이트 내역

### v1.0 (2025-01-XX)
- API 키 로드 밸런싱 시스템 구현
- 동적 병렬 처리 최적화
- Rate Limit 예측 및 회피 로직 추가
- Circuit Breaker 패턴 적용
- 배치 크기 자동 조정

## 📚 참고 자료

- [Cloudflare Workers 최적화 가이드](https://developers.cloudflare.com/workers/)
- [Rate Limiting Best Practices](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Circuit Breaker 패턴](https://martinfowler.com/bliki/CircuitBreaker.html)


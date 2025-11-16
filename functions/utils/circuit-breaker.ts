/**
 * Circuit Breaker 패턴 구현
 * 연속 실패 시 일시적으로 요청 차단하여 시스템 보호
 */

export enum CircuitState {
  CLOSED = 'CLOSED',      // 정상 동작
  OPEN = 'OPEN',          // 차단 상태
  HALF_OPEN = 'HALF_OPEN' // 테스트 상태
}

interface CircuitBreakerConfig {
  failureThreshold: number;      // 실패 임계값 (기본: 5회)
  successThreshold: number;      // 성공 임계값 (기본: 2회)
  timeout: number;               // 차단 시간 (기본: 60초)
  resetTimeout: number;          // 리셋 시간 (기본: 300초)
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      successThreshold: config?.successThreshold ?? 2,
      timeout: config?.timeout ?? 60000,
      resetTimeout: config?.resetTimeout ?? 300000
    };
  }

  /**
   * 요청 실행 (Circuit Breaker 적용)
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 상태 확인
    if (this.state === CircuitState.OPEN) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      
      // 리셋 시간 경과 시 HALF_OPEN으로 전환
      if (timeSinceFailure >= this.config.resetTimeout) {
        console.log('🔄 Circuit Breaker: OPEN → HALF_OPEN (리셋 시간 경과)');
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        // 아직 차단 상태
        throw new Error(`Circuit Breaker OPEN: ${Math.ceil((this.config.resetTimeout - timeSinceFailure) / 1000)}초 후 재시도 가능`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 성공 처리
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // HALF_OPEN에서 성공 임계값 도달 시 CLOSED로 전환
      if (this.successCount >= this.config.successThreshold) {
        console.log('✅ Circuit Breaker: HALF_OPEN → CLOSED (정상 복구)');
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // CLOSED 상태에서는 실패 카운트 리셋
      this.failureCount = 0;
    }
  }

  /**
   * 실패 처리
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.successCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      // HALF_OPEN에서 실패 시 즉시 OPEN으로 전환
      console.log('❌ Circuit Breaker: HALF_OPEN → OPEN (테스트 실패)');
      this.state = CircuitState.OPEN;
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      // CLOSED에서 실패 임계값 도달 시 OPEN으로 전환
      console.log(`🚨 Circuit Breaker: CLOSED → OPEN (연속 실패 ${this.failureCount}회)`);
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * 현재 상태 조회
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 수동 리셋
   */
  reset(): void {
    console.log('🔄 Circuit Breaker: 수동 리셋');
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }
}


/**
 * 동적 병렬 처리 최적화 시스템
 * 성공률과 응답 시간에 따라 자동으로 병렬 처리 수를 조정
 */

interface ConcurrencyStats {
  currentConcurrency: number;
  successRate: number;
  avgResponseTime: number;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  lastAdjustment: number;
}

export class AdaptiveConcurrency {
  private stats: ConcurrencyStats;
  private readonly minConcurrency: number = 5;
  private readonly maxConcurrency: number = 50;
  private readonly adjustmentInterval: number = 30000; // 30초마다 조정
  private readonly targetSuccessRate: number = 0.95; // 95% 목표 성공률
  private readonly targetResponseTime: number = 2000; // 2초 목표 응답 시간

  constructor(initialConcurrency: number = 20) {
    this.stats = {
      currentConcurrency: Math.max(this.minConcurrency, Math.min(this.maxConcurrency, initialConcurrency)),
      successRate: 1.0,
      avgResponseTime: 0,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      lastAdjustment: Date.now()
    };
  }

  /**
   * 현재 병렬 처리 수 조회
   */
  getCurrentConcurrency(): number {
    return this.stats.currentConcurrency;
  }

  /**
   * 요청 결과 기록 및 자동 조정
   */
  recordRequest(success: boolean, responseTime: number): void {
    this.stats.totalRequests++;
    
    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.failureCount++;
    }

    // 응답 시간 평균 업데이트 (지수 이동 평균)
    if (responseTime > 0) {
      this.stats.avgResponseTime = this.stats.avgResponseTime === 0
        ? responseTime
        : this.stats.avgResponseTime * 0.9 + responseTime * 0.1;
    }

    // 성공률 계산
    this.stats.successRate = this.stats.totalRequests > 0
      ? this.stats.successCount / this.stats.totalRequests
      : 1.0;

    // 주기적으로 병렬 처리 수 조정
    const now = Date.now();
    if (now - this.stats.lastAdjustment >= this.adjustmentInterval) {
      this.adjustConcurrency();
      this.stats.lastAdjustment = now;
    }
  }

  /**
   * 병렬 처리 수 자동 조정
   */
  private adjustConcurrency(): void {
    const { successRate, avgResponseTime, currentConcurrency } = this.stats;
    
    // 성공률이 낮으면 병렬 처리 수 감소
    if (successRate < this.targetSuccessRate) {
      const newConcurrency = Math.max(
        this.minConcurrency,
        Math.floor(currentConcurrency * 0.8)
      );
      console.log(`📉 병렬 처리 수 감소: ${currentConcurrency} → ${newConcurrency} (성공률: ${(successRate * 100).toFixed(1)}%)`);
      this.stats.currentConcurrency = newConcurrency;
      return;
    }

    // 응답 시간이 길면 병렬 처리 수 감소
    if (avgResponseTime > this.targetResponseTime * 1.5) {
      const newConcurrency = Math.max(
        this.minConcurrency,
        Math.floor(currentConcurrency * 0.9)
      );
      console.log(`📉 병렬 처리 수 감소: ${currentConcurrency} → ${newConcurrency} (평균 응답 시간: ${avgResponseTime.toFixed(0)}ms)`);
      this.stats.currentConcurrency = newConcurrency;
      return;
    }

    // 성공률이 높고 응답 시간이 짧으면 병렬 처리 수 증가
    if (successRate >= this.targetSuccessRate && avgResponseTime < this.targetResponseTime) {
      const newConcurrency = Math.min(
        this.maxConcurrency,
        Math.floor(currentConcurrency * 1.1)
      );
      if (newConcurrency > currentConcurrency) {
        console.log(`📈 병렬 처리 수 증가: ${currentConcurrency} → ${newConcurrency} (성공률: ${(successRate * 100).toFixed(1)}%, 응답 시간: ${avgResponseTime.toFixed(0)}ms)`);
        this.stats.currentConcurrency = newConcurrency;
      }
    }
  }

  /**
   * 통계 조회
   */
  getStats(): ConcurrencyStats {
    return { ...this.stats };
  }

  /**
   * 수동으로 병렬 처리 수 설정
   */
  setConcurrency(concurrency: number): void {
    this.stats.currentConcurrency = Math.max(
      this.minConcurrency,
      Math.min(this.maxConcurrency, concurrency)
    );
  }
}


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
  private readonly maxConcurrency: number = 30; // 타임아웃 감소를 위해 최대값 감소 (50 → 30)
  private readonly adjustmentInterval: number = 20000; // 20초마다 조정 (더 빠른 반응)
  private readonly targetSuccessRate: number = 0.90; // 90% 목표 성공률 (타임아웃 고려하여 완화)
  private readonly targetResponseTime: number = 60000; // 60초 목표 응답 시간 (타임아웃 고려하여 증가)

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
    
    // 타임아웃 발생률 계산 (응답 시간이 4분 이상이면 타임아웃 위험)
    const timeoutRisk = avgResponseTime > 240000; // 4분 이상이면 타임아웃 위험
    
    // 성공률이 낮거나 타임아웃 위험이 있으면 병렬 처리 수 감소
    if (successRate < this.targetSuccessRate || timeoutRisk) {
      const reductionFactor = timeoutRisk ? 0.7 : 0.8; // 타임아웃 위험이 있으면 더 많이 감소
      const newConcurrency = Math.max(
        this.minConcurrency,
        Math.floor(currentConcurrency * reductionFactor)
      );
      const reason = timeoutRisk ? `타임아웃 위험 (응답: ${(avgResponseTime / 1000).toFixed(1)}초)` : `성공률: ${(successRate * 100).toFixed(1)}%`;
      console.log(`📉 병렬 처리 수 감소: ${currentConcurrency} → ${newConcurrency} (${reason})`);
      this.stats.currentConcurrency = newConcurrency;
      return;
    }

    // 응답 시간이 목표 시간보다 길면 병렬 처리 수 감소
    if (avgResponseTime > this.targetResponseTime) {
      const newConcurrency = Math.max(
        this.minConcurrency,
        Math.floor(currentConcurrency * 0.9)
      );
      console.log(`📉 병렬 처리 수 감소: ${currentConcurrency} → ${newConcurrency} (평균 응답 시간: ${(avgResponseTime / 1000).toFixed(1)}초)`);
      this.stats.currentConcurrency = newConcurrency;
      return;
    }

    // 성공률이 높고 응답 시간이 짧으면 병렬 처리 수 증가 (보수적으로)
    if (successRate >= this.targetSuccessRate && avgResponseTime < this.targetResponseTime * 0.8) {
      const newConcurrency = Math.min(
        this.maxConcurrency,
        Math.floor(currentConcurrency * 1.05) // 증가율 감소 (1.1 → 1.05)
      );
      if (newConcurrency > currentConcurrency) {
        console.log(`📈 병렬 처리 수 증가: ${currentConcurrency} → ${newConcurrency} (성공률: ${(successRate * 100).toFixed(1)}%, 응답 시간: ${(avgResponseTime / 1000).toFixed(1)}초)`);
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


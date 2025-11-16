/**
 * API 키 로드 밸런싱 및 사용량 추적 시스템
 * 다중 API 키를 효율적으로 활용하여 Rate Limit 회피 및 성능 최적화
 */

interface ApiKeyStats {
  keyIndex: number;
  successCount: number;
  failureCount: number;
  rateLimitCount: number;
  lastUsed: number;
  avgResponseTime: number;
  totalCalls: number;
}

export class ApiKeyManager {
  private stats: Map<number, ApiKeyStats> = new Map();
  private readonly maxKeys: number;
  private readonly cooldownTime: number = 5 * 60 * 1000; // 5분 쿨다운

  constructor(maxKeys: number) {
    this.maxKeys = maxKeys;
    // 초기화: 모든 키의 통계 초기화
    for (let i = 0; i < maxKeys; i++) {
      this.stats.set(i, {
        keyIndex: i,
        successCount: 0,
        failureCount: 0,
        rateLimitCount: 0,
        lastUsed: 0,
        avgResponseTime: 0,
        totalCalls: 0
      });
    }
  }

  /**
   * 사용 가능한 최적의 API 키 선택
   * - Rate Limit에 걸리지 않은 키 우선
   * - 성공률이 높은 키 우선
   * - 최근 사용하지 않은 키 우선
   */
  selectBestKey(): number {
    const now = Date.now();
    const availableKeys: Array<{ index: number; score: number }> = [];

    for (let i = 0; i < this.maxKeys; i++) {
      const stat = this.stats.get(i)!;
      
      // Rate Limit 쿨다운 중인 키 제외
      if (stat.rateLimitCount > 0 && (now - stat.lastUsed) < this.cooldownTime) {
        continue;
      }

      // 점수 계산: 성공률 + 최근 사용 안 함 보너스
      const successRate = stat.totalCalls > 0 
        ? stat.successCount / stat.totalCalls 
        : 1.0; // 아직 사용 안 한 키는 높은 점수
      
      const timeSinceLastUse = now - stat.lastUsed;
      const freshnessBonus = Math.min(timeSinceLastUse / 60000, 1.0); // 최대 1분 보너스
      
      const score = successRate * 0.7 + freshnessBonus * 0.3;
      
      availableKeys.push({ index: i, score });
    }

    if (availableKeys.length === 0) {
      // 모든 키가 쿨다운 중이면 가장 오래 전에 사용한 키 선택
      let oldestKey = 0;
      let oldestTime = Infinity;
      for (let i = 0; i < this.maxKeys; i++) {
        const stat = this.stats.get(i)!;
        if (stat.lastUsed < oldestTime) {
          oldestTime = stat.lastUsed;
          oldestKey = i;
        }
      }
      return oldestKey;
    }

    // 점수가 높은 순으로 정렬하여 최고 점수 키 선택
    availableKeys.sort((a, b) => b.score - a.score);
    return availableKeys[0].index;
  }

  /**
   * API 호출 결과 기록
   */
  recordCall(keyIndex: number, success: boolean, responseTime: number, isRateLimit: boolean = false): void {
    const stat = this.stats.get(keyIndex);
    if (!stat) return;

    stat.totalCalls++;
    stat.lastUsed = Date.now();

    if (isRateLimit) {
      stat.rateLimitCount++;
    } else if (success) {
      stat.successCount++;
      // 응답 시간 평균 업데이트 (지수 이동 평균)
      stat.avgResponseTime = stat.avgResponseTime === 0
        ? responseTime
        : stat.avgResponseTime * 0.8 + responseTime * 0.2;
    } else {
      stat.failureCount++;
    }
  }

  /**
   * 키의 현재 상태 조회
   */
  getKeyStats(keyIndex: number): ApiKeyStats | undefined {
    return this.stats.get(keyIndex);
  }

  /**
   * 모든 키의 통계 조회
   */
  getAllStats(): ApiKeyStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Rate Limit 예측 (최근 호출 빈도 기반)
   */
  predictRateLimit(keyIndex: number): boolean {
    const stat = this.stats.get(keyIndex);
    if (!stat) return false;

    // 최근 1분간 호출이 너무 많으면 Rate Limit 예측
    const recentCalls = stat.totalCalls;
    const callsPerMinute = recentCalls / Math.max(1, (Date.now() - stat.lastUsed) / 60000);
    
    // 네이버 API 제한: 초당 약 10회 (보수적으로 5회로 설정)
    return callsPerMinute > 300; // 분당 300회 = 초당 5회
  }
}


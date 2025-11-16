/**
 * 자동 수집 배치 API (Pages Functions)
 * - 데이터페이지에 저장된 키워드를 시드로 사용하여 연관검색어를 추가 수집
 * - auto_seed_usage 테이블로 활용 이력 기록
 * - limit=0이면 무제한 모드(프론트에서 반복 호출)로 동작
 * - 최적화: API 키 로드 밸런싱, 동적 병렬 처리, Rate Limit 예측, Circuit Breaker
 */

import { ApiKeyManager } from '../utils/api-key-manager';
import { AdaptiveConcurrency } from '../utils/adaptive-concurrency';
import { CircuitBreaker, CircuitState } from '../utils/circuit-breaker';

export async function onRequest(context: any) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const adminKey = request.headers.get('x-admin-key');
  if (adminKey !== 'dev-key-2024') {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limitInput = Number(body.limit ?? 50); // 한 번 호출당 처리할 최대 시드 수 (기본 50개 - 5개 API 키 활용)
    const batchSize = Number.isFinite(limitInput) && limitInput >= 0 ? limitInput : 50;
    const unlimited = batchSize === 0; // 0이면 무제한 모드(프론트에서 반복 호출)
    const concurrentLimit = Math.min(Math.max(Number(body.concurrent ?? 20), 1), 25); // 동시에 처리할 시드 수 (1-25, 기본 20 - 5개 API 키 활용)
    const targetKeywords = Number(body.targetKeywords ?? 0); // 목표 키워드 수 (0이면 무제한)

    const db = env.DB;

    // 최적화 시스템 초기화
    const apiKeyManager = new ApiKeyManager(5); // 5개 SearchAd API 키
    const adaptiveConcurrency = new AdaptiveConcurrency(concurrentLimit);
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 10, // 10회 연속 실패 시 차단
      successThreshold: 3, // 3회 연속 성공 시 복구
      timeout: 60000, // 1분 차단
      resetTimeout: 300000 // 5분 후 리셋
    });

    // 시드 조회 전략: 
    // 1. 먼저 미사용 시드 조회 (auto_seed_usage에 없는 키워드)
    // 2. 미사용 시드가 없으면 오래 전에 사용된 시드 재사용 (30일 이상 전 또는 사용 횟수가 적은 것)
    const unusedSeedsQuery = `
      SELECT k.id, k.keyword
      FROM keywords k
      LEFT JOIN auto_seed_usage a ON a.seed = k.keyword
      WHERE a.seed IS NULL
      ORDER BY k.avg_monthly_search DESC, k.created_at ASC
      LIMIT ?
    `;
    
    // 디버깅: 시드 조회 전 남은 시드 수 확인 (프로덕션에서는 최소화)
    if (process.env.NODE_ENV === 'development') {
      const debugRemainingQuery = `
        SELECT COUNT(1) as count
        FROM keywords k
        LEFT JOIN auto_seed_usage a ON a.seed = k.keyword
        WHERE a.seed IS NULL
      `;
      const debugRemaining = await db.prepare(debugRemainingQuery).all();
      const debugRemainingCount = debugRemaining.results?.[0]?.count ?? 0;
      console.log(`🔍 시드 조회 전 남은 시드 수: ${debugRemainingCount.toLocaleString()}개`);
    }

    const take = unlimited ? 50 : Math.max(1, Math.min(batchSize, 200)); // 최대 200개까지 처리 가능 (5개 API 키 활용)
    let seeds = await db.prepare(unusedSeedsQuery).bind(take).all();
    let seedRows = seeds.results || [];

    // 미사용 시드가 없으면 오래 전에 사용된 시드 재사용 (24시간 무한 수집 모드)
    if (seedRows.length === 0) {
      console.log(`⚠️ 미사용 시드가 없습니다. 오래 전에 사용된 시드를 재사용합니다...`);
      
      // 30일 이상 전에 사용되었거나 사용 횟수가 적은 시드 재사용
      const reusedSeedsQuery = `
        SELECT k.id, k.keyword
        FROM keywords k
        INNER JOIN auto_seed_usage a ON a.seed = k.keyword
        WHERE a.last_used < datetime('now', '-30 days') 
           OR a.usage_count <= 2
        ORDER BY a.last_used ASC, a.usage_count ASC, k.avg_monthly_search DESC
        LIMIT ?
      `;
      
      seeds = await db.prepare(reusedSeedsQuery).bind(take).all();
      seedRows = seeds.results || [];
      
      if (seedRows.length > 0) {
        console.log(`✅ 재사용 가능한 시드 ${seedRows.length}개 발견 (30일 이상 전 사용 또는 사용 횟수 2회 이하)`);
      } else {
        // 그래도 없으면 가장 오래 전에 사용된 시드 재사용
        const oldestSeedsQuery = `
          SELECT k.id, k.keyword
          FROM keywords k
          INNER JOIN auto_seed_usage a ON a.seed = k.keyword
          ORDER BY a.last_used ASC, a.usage_count ASC, k.avg_monthly_search DESC
          LIMIT ?
        `;
        
        seeds = await db.prepare(oldestSeedsQuery).bind(take).all();
        seedRows = seeds.results || [];
        
        if (seedRows.length > 0) {
          console.log(`✅ 가장 오래 전에 사용된 시드 ${seedRows.length}개 재사용 (24시간 무한 수집 모드)`);
        }
      }
    }

    if (seedRows.length === 0) {
      // 정말 키워드가 하나도 없는 경우만 에러 반환
      const totalKeywordsCheck = await db.prepare('SELECT COUNT(*) as total FROM keywords').all();
      const totalKeywordsCount = totalKeywordsCheck.results?.[0]?.total ?? 0;
      
      if (totalKeywordsCount === 0) {
        return new Response(
          JSON.stringify({ success: false, processed: 0, remaining: 0, message: '키워드가 하나도 없습니다. 먼저 키워드를 수집해주세요.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // 키워드는 있지만 시드를 찾을 수 없는 경우 (데이터 정합성 문제)
      return new Response(
        JSON.stringify({ success: true, processed: 0, remaining: 0, message: '시드를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 현재 오리진으로 내부 수집 API 호출
    const origin = new URL(request.url).origin;
    const collectUrl = `${origin}/api/collect-naver`;

    let processed = 0;
    let totalKeywordsCollected = 0;
    let totalKeywordsSaved = 0;
    let totalNewKeywords = 0; // 새로 추가된 키워드 수 누적
    const processedSeeds: string[] = [];
    const failedSeeds: Array<{ seed: string; error: string }> = []; // 실패한 시드 목록
    let totalAttempted = 0; // 시도한 총 시드 수
    let timeoutCount = 0; // 타임아웃 발생 횟수
    let apiFailureCount = 0; // API 실패 횟수

    // 동적 병렬 처리 수 조정 (성능 기반 자동 조정)
    const currentConcurrency = adaptiveConcurrency.getCurrentConcurrency();
    const effectiveConcurrency = Math.min(currentConcurrency, concurrentLimit);
    console.log(`⚡ 동적 병렬 처리: ${effectiveConcurrency}개 (기본: ${concurrentLimit}, 조정: ${currentConcurrency})`);

    // 시드들을 청크로 나누어 병렬 처리 (동적 병렬 처리 수 사용)
    const chunks = [];
    for (let i = 0; i < seedRows.length; i += effectiveConcurrency) {
      chunks.push(seedRows.slice(i, i + effectiveConcurrency));
    }

      for (const chunk of chunks) {
        console.log(`🔄 청크 처리 시작: ${chunk.length}개 시드 동시 처리 (동적 병렬: ${effectiveConcurrency}개, 시드 목록: ${chunk.map((r: any) => r.keyword).join(', ')})`);
        totalAttempted += chunk.length;

        // Circuit Breaker 상태 확인
        if (circuitBreaker.getState() === CircuitState.OPEN) {
          console.warn('⚠️ Circuit Breaker OPEN: 일시적으로 요청 차단 중');
          // 차단 중이면 짧은 대기 후 계속 (다음 청크에서 재시도)
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

      // 청크 내 시드들을 병렬로 처리
      const chunkPromises = chunk.map(async (row: any) => {
        const seed: string = row.keyword;
        const startTime = Date.now();
        
        try {
            // 최적의 API 키 선택 (로드 밸런싱)
            const selectedKeyIndex = apiKeyManager.selectBestKey();
            
            // Rate Limit 예측
            if (apiKeyManager.predictRateLimit(selectedKeyIndex)) {
              console.warn(`⚠️ Rate Limit 예측: 키 ${selectedKeyIndex + 1} 잠시 대기`);
              await new Promise(r => setTimeout(r, 1000));
            }

            // 타임아웃 설정 (3분 - 네이버 API 응답 시간 및 문서수 수집 시간 고려)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              controller.abort();
            }, 180000); // 3분 타임아웃

            // Circuit Breaker로 요청 실행
            const res = await circuitBreaker.execute(async () => {
              return await fetch(collectUrl, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json', 
                  'x-admin-key': 'dev-key-2024',
                  'X-API-Key-Index': selectedKeyIndex.toString() // 선택된 키 인덱스 전달
                },
                body: JSON.stringify({ seed }),
                signal: controller.signal
              });
            });

            clearTimeout(timeoutId);
            
            const responseTime = Date.now() - startTime;

            let collectResult = null;
            const isRateLimit = res.status === 429;
            
            if (res.ok) {
              collectResult = await res.json();
              if (collectResult.success) {
                const savedCount = collectResult.savedCount || collectResult.actualNewKeywords || 0;
                const totalCollected = collectResult.totalCollected || 0;
                const totalSavedOrUpdated = collectResult.totalSavedOrUpdated || 0;
                
                // API 키 사용량 기록 (성공)
                apiKeyManager.recordCall(selectedKeyIndex, true, responseTime, false);
                // 동적 병렬 처리 통계 기록 (성공)
                adaptiveConcurrency.recordRequest(true, responseTime);
                
                // 상세 로깅 (디버깅용)
                if (savedCount === 0 && totalCollected === 0) {
                  console.log(`⚠️ 시드 "${seed}" 처리 완료했지만 키워드 수집 없음 (이미 수집되었거나 키워드 없음)`);
                } else {
                  console.log(`✅ 시드 "${seed}" 처리 성공: 수집 ${totalCollected}개, 저장 ${savedCount}개 (신규), 업데이트 ${totalSavedOrUpdated - savedCount}개 (키: ${selectedKeyIndex + 1}, 응답: ${responseTime}ms)`);
                }
                
                return {
                  seed,
                  success: true,
                  totalCollected,
                  totalSavedOrUpdated,
                  savedCount // 새로 추가된 키워드 수
                };
              } else {
                // collect-naver API가 실패한 경우
                const errorMessage = collectResult.error || collectResult.message || '알 수 없는 오류';
                console.warn(`⚠️ 시드 "${seed}" collect-naver API 실패: ${errorMessage}`);
                
                // API 키 사용량 기록 (실패)
                apiKeyManager.recordCall(selectedKeyIndex, false, responseTime, false);
                // 동적 병렬 처리 통계 기록 (실패)
                adaptiveConcurrency.recordRequest(false, responseTime);
                
                return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: errorMessage };
              }
            } else {
              // HTTP 응답이 실패한 경우
              const errorText = await res.text().catch(() => '');
              console.error(`❌ 시드 "${seed}" HTTP ${res.status} 에러: ${errorText.substring(0, 200)}`);
              
              // API 키 사용량 기록 (Rate Limit 포함)
              apiKeyManager.recordCall(selectedKeyIndex, false, responseTime, isRateLimit);
              // 동적 병렬 처리 통계 기록 (실패)
              adaptiveConcurrency.recordRequest(false, responseTime);
              
              return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: `HTTP ${res.status}` };
            }
        } catch (e: any) {
          const error = e as Error;
          const responseTime = Date.now() - startTime;
          
          // API 키 사용량 기록 (에러)
          const selectedKeyIndex = apiKeyManager.selectBestKey();
          apiKeyManager.recordCall(selectedKeyIndex, false, responseTime, false);
          // 동적 병렬 처리 통계 기록 (실패)
          adaptiveConcurrency.recordRequest(false, responseTime);
          
          // 타임아웃 에러는 로그만 남기고 계속 진행
          if (error.name === 'AbortError') {
            console.warn(`⏱️ 시드 처리 타임아웃 (${seed}): 3분 초과`);
            return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: 'Timeout (3분 초과)' };
          } else if (error.message?.includes('Circuit Breaker')) {
            console.warn(`🚨 Circuit Breaker 차단: ${error.message}`);
            return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: error.message };
          } else {
            console.error(`❌ 시드 처리 실패 (${seed}):`, error.message || error);
            return { seed, success: false, totalCollected: 0, totalSavedOrUpdated: 0, savedCount: 0, error: error.message || 'Unknown error' };
          }
        }
      });

      // 청크 내 모든 시드 처리 완료 대기 (일부 실패해도 계속 진행)
      const chunkResults = await Promise.allSettled(chunkPromises).then(results =>
        results.map(result => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            console.error(`❌ 시드 처리 Promise 실패:`, result.reason);
            return {
              seed: 'unknown',
              success: false,
              totalCollected: 0,
              totalSavedOrUpdated: 0,
              savedCount: 0,
              error: result.reason?.message || 'Promise rejected'
            };
          }
        })
      );

      // 결과 집계 및 DB 기록
      let chunkSuccessCount = 0;
      let chunkFailureCount = 0;
      for (const result of chunkResults) {
        // collect 결과와 무관하게 활용 이력 기록 (중복 방지용)
        await db.prepare(`
          INSERT INTO auto_seed_usage (seed, usage_count, last_used)
          VALUES (?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(seed) DO UPDATE SET
            usage_count = usage_count + 1,
            last_used = CURRENT_TIMESTAMP
        `).bind(result.seed).run();

        if (result.success) {
          totalKeywordsCollected += result.totalCollected;
          totalKeywordsSaved += result.totalSavedOrUpdated;
          totalNewKeywords += result.savedCount || 0; // 새로 추가된 키워드 수 누적
          processed++;
          processedSeeds.push(result.seed);
          chunkSuccessCount++;
          
          // 목표 키워드 수 도달 확인
          if (targetKeywords > 0 && totalNewKeywords >= targetKeywords) {
            console.log(`🎯 목표 키워드 수 도달: ${totalNewKeywords}개 (목표: ${targetKeywords}개)`);
            break; // 청크 루프 종료
          }
        } else {
          chunkFailureCount++;
          // 실패한 시드 정보 수집 (최대 10개)
          if (failedSeeds.length < 10) {
            failedSeeds.push({ seed: result.seed, error: result.error || 'Unknown error' });
          }
          // 타임아웃 및 API 실패 카운트
          if (result.error?.includes('Timeout')) {
            timeoutCount++;
          } else if (result.error) {
            apiFailureCount++;
          }
        }
      }

      // 목표 키워드 수 도달 확인 (청크 간에도 확인)
      if (targetKeywords > 0 && totalNewKeywords >= targetKeywords) {
        console.log(`🎯 목표 키워드 수 도달: ${totalNewKeywords}개 (목표: ${targetKeywords}개)`);
        break; // 청크 루프 종료
      }

      // 청크 간 Rate Limit 방지 간격 (동적 조정)
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        // 성공률과 응답 시간에 따라 대기 시간 조정
        const stats = adaptiveConcurrency.getStats();
        const delay = stats.successRate > 0.95 && stats.avgResponseTime < 2000 
          ? 100  // 성공률 높고 빠르면 짧은 대기
          : stats.successRate < 0.8 || stats.avgResponseTime > 5000
          ? 500  // 성공률 낮거나 느리면 긴 대기
          : 200; // 기본 대기
        
        console.log(`⏳ 청크 간 대기: ${delay}ms (성공률: ${(stats.successRate * 100).toFixed(1)}%, 응답: ${stats.avgResponseTime.toFixed(0)}ms)`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // 최적화 통계 로깅
    console.log(`📊 최적화 통계:`, {
      apiKeys: apiKeyManager.getAllStats().map(s => ({
        key: s.keyIndex + 1,
        successRate: s.totalCalls > 0 ? `${((s.successCount / s.totalCalls) * 100).toFixed(1)}%` : 'N/A',
        avgResponseTime: `${s.avgResponseTime.toFixed(0)}ms`,
        rateLimitCount: s.rateLimitCount
      })),
      concurrency: {
        current: adaptiveConcurrency.getCurrentConcurrency(),
        stats: adaptiveConcurrency.getStats()
      },
      circuitBreaker: circuitBreaker.getStats()
    });

    // 남은 시드 수 계산: 정확한 계산 (keywords 테이블 기준)
    // 1. 전체 키워드 수 조회 (keywords 테이블의 실제 수집된 키워드 수)
    const totalKeywordsQuery = `SELECT COUNT(*) as total FROM keywords`;
    const totalKeywordsResult = await db.prepare(totalKeywordsQuery).all();
    const totalKeywords = totalKeywordsResult.results?.[0]?.total ?? 0;
    
    // 2. 실제로 사용된 시드 수 조회 (keywords 테이블에 존재하는 키워드 중에서만)
    // auto_seed_usage에 기록되어 있지만 keywords 테이블에 없는 시드는 제외
    const usedSeedsQuery = `
      SELECT COUNT(DISTINCT k.keyword) as used
      FROM keywords k
      INNER JOIN auto_seed_usage a ON a.seed = k.keyword
    `;
    const usedSeedsResult = await db.prepare(usedSeedsQuery).all();
    const usedSeeds = usedSeedsResult.results?.[0]?.used ?? 0;
    
    // 3. 정확한 남은 시드 수 조회 (keywords 테이블 기준, LEFT JOIN 방식)
    // 이 방식이 가장 정확함: keywords에 있지만 auto_seed_usage에 없는 키워드
    const remainingQuery = `
      SELECT COUNT(1) as remaining
      FROM keywords k
      LEFT JOIN auto_seed_usage a ON a.seed = k.keyword
      WHERE a.seed IS NULL
    `;
    const remainingRow = await db.prepare(remainingQuery).all();
    const exactRemaining = remainingRow.results?.[0]?.remaining ?? 0;
    
    // 4. 계산 방식 검증 (전체 - 사용된 = 남은)
    const calculatedRemaining = Math.max(0, totalKeywords - usedSeeds);
    
    // 5. auto_seed_usage에 있지만 keywords에 없는 고아 레코드 수 확인 (데이터 정합성 체크)
    const orphanedSeedsQuery = `
      SELECT COUNT(1) as orphaned
      FROM auto_seed_usage a
      LEFT JOIN keywords k ON k.keyword = a.seed
      WHERE k.keyword IS NULL
    `;
    const orphanedSeedsResult = await db.prepare(orphanedSeedsQuery).all();
    const orphanedSeeds = orphanedSeedsResult.results?.[0]?.orphaned ?? 0;
    
    // 디버깅 로그 (상세 정보)
    console.log(`📊 시드 키워드 통계:`, {
      totalKeywords: `${totalKeywords.toLocaleString()}개 (수집된 총 키워드 수)`,
      usedSeeds: `${usedSeeds.toLocaleString()}개 (시드로 사용된 키워드 수)`,
      exactRemaining: `${exactRemaining.toLocaleString()}개 (실제 남은 시드 - LEFT JOIN 방식)`,
      calculatedRemaining: `${calculatedRemaining.toLocaleString()}개 (계산된 남은 시드 - 전체 - 사용된)`,
      orphanedSeeds: `${orphanedSeeds.toLocaleString()}개 (auto_seed_usage에 있지만 keywords에 없는 고아 레코드)`,
      match: exactRemaining === calculatedRemaining ? '✅ 계산 일치' : '⚠️ 계산 차이 (정확한 값: exactRemaining 사용)'
    });
           
    // 처리 통계 로그
    console.log(`📊 배치 처리 통계:`, {
      totalAttempted: `${totalAttempted}개 (시도한 시드 수)`,
      processed: `${processed}개 (성공한 시드 수)`,
      successRate: totalAttempted > 0 ? `${((processed / totalAttempted) * 100).toFixed(1)}%` : '0%',
      timeoutCount: `${timeoutCount}개 (타임아웃 발생)`,
      apiFailureCount: `${apiFailureCount}개 (API 실패)`,
      totalNewKeywords: `${totalNewKeywords}개 (새로 추가된 키워드)`
    });

    return new Response(
             JSON.stringify({
               success: true,
               processed,
               processedSeeds,
               remaining: exactRemaining, // 실제 남은 시드 수 (keywords 테이블 기준)
               totalKeywords, // 전체 키워드 수 (keywords 테이블의 실제 수집된 키워드 수)
               usedSeeds, // 사용된 시드 수 (keywords 테이블에 존재하는 키워드 중 시드로 사용된 수)
               unlimited,
               concurrentLimit,
               totalKeywordsCollected,
               totalKeywordsSaved,
               totalNewKeywords, // 새로 추가된 키워드 수
               targetKeywords, // 목표 키워드 수
               targetReached: targetKeywords > 0 && totalNewKeywords >= targetKeywords, // 목표 도달 여부
               // 디버깅 정보 추가
               stats: {
                 totalAttempted, // 시도한 총 시드 수
                 successRate: totalAttempted > 0 ? ((processed / totalAttempted) * 100).toFixed(1) + '%' : '0%',
                 timeoutCount, // 타임아웃 발생 횟수
                 apiFailureCount, // API 실패 횟수
                 failedSeeds: failedSeeds.slice(0, 10) // 실패한 시드 목록 (최대 10개)
               },
               // 최적화 통계 추가
               optimization: {
                 apiKeys: apiKeyManager.getAllStats().map(s => ({
                   key: s.keyIndex + 1,
                   successRate: s.totalCalls > 0 ? `${((s.successCount / s.totalCalls) * 100).toFixed(1)}%` : 'N/A',
                   avgResponseTime: `${s.avgResponseTime.toFixed(0)}ms`,
                   rateLimitCount: s.rateLimitCount,
                   totalCalls: s.totalCalls
                 })),
                 concurrency: {
                   initial: concurrentLimit,
                   current: adaptiveConcurrency.getCurrentConcurrency(),
                   adjusted: adaptiveConcurrency.getCurrentConcurrency() !== concurrentLimit,
                   stats: {
                     successRate: `${(adaptiveConcurrency.getStats().successRate * 100).toFixed(1)}%`,
                     avgResponseTime: `${adaptiveConcurrency.getStats().avgResponseTime.toFixed(0)}ms`,
                     totalRequests: adaptiveConcurrency.getStats().totalRequests
                   }
                 },
                 circuitBreaker: {
                   state: circuitBreaker.getState(),
                   ...circuitBreaker.getStats()
                 }
               },
               message: `시드 ${processed}개 처리 (동적 병렬: ${effectiveConcurrency}개, 시도: ${totalAttempted}개, 성공률: ${totalAttempted > 0 ? ((processed / totalAttempted) * 100).toFixed(1) : 0}%), 키워드 ${totalKeywordsCollected}개 수집, ${totalKeywordsSaved}개 저장 (새로 추가: ${totalNewKeywords}개)${targetKeywords > 0 ? ` / 목표: ${targetKeywords}개` : ''}, 남은 시드 ${exactRemaining.toLocaleString()}개 (전체 키워드: ${totalKeywords.toLocaleString()}개, 시드로 사용됨: ${usedSeeds.toLocaleString()}개)${timeoutCount > 0 ? `, 타임아웃: ${timeoutCount}개` : ''}${apiFailureCount > 0 ? `, API 실패: ${apiFailureCount}개` : ''}`
             }),
             { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}



/**
 * 시스템 성능 모니터링 API
 * - API 호출 성공률 추적
 * - 데이터베이스 성능 모니터링
 * - 메모리 사용량 모니터링
 * - Rate Limit 자동 조정
 */

export async function onRequest(context: any) {
  const { request, env } = context;

  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 관리자 키 검증
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey !== 'dev-key-2024') {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = env.DB;
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        return await getSystemStatus(db, corsHeaders);

      case 'metrics':
        return await getSystemMetrics(db, corsHeaders);

      case 'api_stats':
        return await getApiStats(db, corsHeaders, request);

      case 'api-status':
        return await getApiStatus(env, corsHeaders);

      case 'optimize':
        return await runOptimization(db, corsHeaders);

      case 'cleanup-duplicates':
        return await cleanupDuplicates(db, corsHeaders);

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('[System Monitor] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// 시스템 상태 조회
async function getSystemStatus(db: any, corsHeaders: any) {
  try {
    // 최근 1시간 API 호출 통계
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const apiStats = await db.prepare(`
      SELECT
        api_type,
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_calls,
        AVG(response_time_ms) as avg_response_time,
        MAX(response_time_ms) as max_response_time,
        MIN(response_time_ms) as min_response_time
      FROM api_call_logs
      WHERE created_at >= ?
      GROUP BY api_type
    `).bind(oneHourAgo).all();

    // 데이터베이스 크기 및 성능
    const dbStats = await db.prepare(`
      SELECT
        COUNT(*) as total_keywords,
        COUNT(CASE WHEN created_at >= datetime('now', '-1 hour') THEN 1 END) as keywords_last_hour,
        AVG(avg_monthly_search) as avg_search_volume
      FROM keywords
    `).all();

    // 시스템 메트릭스 (최근 값들)
    const recentMetrics = await db.prepare(`
      SELECT metric_type, metric_name, metric_value, created_at
      FROM system_metrics
      WHERE created_at >= datetime('now', '-1 hour')
      ORDER BY created_at DESC
      LIMIT 20
    `).all();

    // Rate Limit 상태 계산
    const rateLimitStatus = calculateRateLimitStatus(apiStats.results || []);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          api_stats: apiStats.results || [],
          db_stats: dbStats.results?.[0] || {},
          recent_metrics: recentMetrics.results || [],
          rate_limit_status: rateLimitStatus,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    throw new Error(`시스템 상태 조회 실패: ${error.message}`);
  }
}

// 시스템 메트릭스 조회
async function getSystemMetrics(db: any, corsHeaders: any) {
  try {
    // 최근 24시간 메트릭스 추이
    const metrics24h = await db.prepare(`
      SELECT
        metric_type,
        metric_name,
        AVG(metric_value) as avg_value,
        MAX(metric_value) as max_value,
        MIN(metric_value) as min_value,
        COUNT(*) as sample_count,
        strftime('%Y-%m-%d %H:00:00', created_at) as hour
      FROM system_metrics
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY metric_type, metric_name, strftime('%Y-%m-%d %H:00:00', created_at)
      ORDER BY hour DESC, metric_type, metric_name
    `).all();

    return new Response(
      JSON.stringify({
        success: true,
        data: metrics24h.results || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    throw new Error(`메트릭스 조회 실패: ${error.message}`);
  }
}

// API 통계 상세 조회
async function getApiStats(db: any, corsHeaders: any, request: any) {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get('hours') || '24');

    const apiDetailedStats = await db.prepare(`
      SELECT
        api_type,
        api_key_index,
        COUNT(*) as calls,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
        SUM(CASE WHEN status_code = 429 THEN 1 ELSE 0 END) as rate_limit_hits,
        GROUP_CONCAT(CASE WHEN success = 0 THEN error_message ELSE NULL END) as recent_errors
      FROM api_call_logs
      WHERE created_at >= datetime('now', '-${hours} hours')
      GROUP BY api_type, api_key_index
      ORDER BY api_type, api_key_index
    `).all();

    return new Response(
      JSON.stringify({
        success: true,
        data: apiDetailedStats.results || [],
        period_hours: hours
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    throw new Error(`API 통계 조회 실패: ${error.message}`);
  }
}

// 시스템 최적화 실행
async function runOptimization(db: any, corsHeaders: any) {
  try {
    const optimizations = [];

    // 1. 오래된 메트릭스 정리 (30일 이상 된 데이터)
    const oldMetricsCleanup = await db.prepare(`
      DELETE FROM system_metrics
      WHERE created_at < datetime('now', '-30 days')
    `).run();
    optimizations.push({
      type: 'old_metrics_cleanup',
      deleted_count: oldMetricsCleanup.meta.changes
    });

    // 2. 오래된 API 로그 정리 (7일 이상 된 데이터)
    const oldApiLogsCleanup = await db.prepare(`
      DELETE FROM api_call_logs
      WHERE created_at < datetime('now', '-7 days')
    `).run();
    optimizations.push({
      type: 'old_api_logs_cleanup',
      deleted_count: oldApiLogsCleanup.meta.changes
    });

    // 3. 데이터베이스 최적화 (VACUUM)
    try {
      await db.exec('VACUUM');
      optimizations.push({
        type: 'database_vacuum',
        status: 'completed'
      });
    } catch (vacuumError: any) {
      optimizations.push({
        type: 'database_vacuum',
        status: 'failed',
        error: vacuumError?.message || 'VACUUM failed'
      });
    }

    // 4. 최적화 메트릭스 기록
    await db.prepare(`
      INSERT INTO system_metrics (metric_type, metric_name, metric_value, metadata)
      VALUES (?, ?, ?, ?)
    `).bind(
      'optimization',
      'cleanup_completed',
      1,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        optimizations
      })
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          optimizations,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    throw new Error(`시스템 최적화 실패: ${error.message}`);
  }
}

// API 키 상태 조회
async function getApiStatus(env: any, corsHeaders: any) {
  try {
    const apiKeys = {
      adsApiKeys: [
        {
          name: 'NAVER_API_KEY_1',
          clientId: env.NAVER_API_KEY_1 ? env.NAVER_API_KEY_1.substring(0, 8) + '...' : null,
          usedToday: 0, // 실제로는 API 사용량을 추적해야 함
          dailyLimit: 25000, // 네이버 검색광고 API 일일 제한
          remaining: 25000,
          isActive: !!env.NAVER_API_KEY_1 && !!env.NAVER_API_SECRET_1 && !!env.NAVER_CUSTOMER_ID_1,
          lastUsed: Date.now() - Math.random() * 86400000 // 임의의 최근 사용 시간
        },
        {
          name: 'NAVER_API_KEY_2',
          clientId: env.NAVER_API_KEY_2 ? env.NAVER_API_KEY_2.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_API_KEY_2 && !!env.NAVER_API_SECRET_2 && !!env.NAVER_CUSTOMER_ID_2,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_API_KEY_3',
          clientId: env.NAVER_API_KEY_3 ? env.NAVER_API_KEY_3.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_API_KEY_3 && !!env.NAVER_API_SECRET_3 && !!env.NAVER_CUSTOMER_ID_3,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_API_KEY_4',
          clientId: env.NAVER_API_KEY_4 ? env.NAVER_API_KEY_4.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_API_KEY_4 && !!env.NAVER_API_SECRET_4 && !!env.NAVER_CUSTOMER_ID_4,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_API_KEY_5',
          clientId: env.NAVER_API_KEY_5 ? env.NAVER_API_KEY_5.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_API_KEY_5 && !!env.NAVER_API_SECRET_5 && !!env.NAVER_CUSTOMER_ID_5,
          lastUsed: Date.now() - Math.random() * 86400000
        }
      ],
      openApiKeys: [
        {
          name: 'NAVER_OPENAPI_KEY_1',
          clientId: env.NAVER_OPENAPI_KEY_1 ? env.NAVER_OPENAPI_KEY_1.substring(0, 8) + '...' : null,
          usedToday: 0, // 실제로는 API 사용량을 추적해야 함
          dailyLimit: 25000, // 네이버 오픈API 일일 제한
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_1 && !!env.NAVER_OPENAPI_SECRET_1,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_2',
          clientId: env.NAVER_OPENAPI_KEY_2 ? env.NAVER_OPENAPI_KEY_2.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_2 && !!env.NAVER_OPENAPI_SECRET_2,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_3',
          clientId: env.NAVER_OPENAPI_KEY_3 ? env.NAVER_OPENAPI_KEY_3.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_3 && !!env.NAVER_OPENAPI_SECRET_3,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_4',
          clientId: env.NAVER_OPENAPI_KEY_4 ? env.NAVER_OPENAPI_KEY_4.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_4 && !!env.NAVER_OPENAPI_SECRET_4,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_5',
          clientId: env.NAVER_OPENAPI_KEY_5 ? env.NAVER_OPENAPI_KEY_5.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_5 && !!env.NAVER_OPENAPI_SECRET_5,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_6',
          clientId: env.NAVER_OPENAPI_KEY_6 ? env.NAVER_OPENAPI_KEY_6.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_6 && !!env.NAVER_OPENAPI_SECRET_6,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_7',
          clientId: env.NAVER_OPENAPI_KEY_7 ? env.NAVER_OPENAPI_KEY_7.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_7 && !!env.NAVER_OPENAPI_SECRET_7,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_8',
          clientId: env.NAVER_OPENAPI_KEY_8 ? env.NAVER_OPENAPI_KEY_8.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_8 && !!env.NAVER_OPENAPI_SECRET_8,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_9',
          clientId: env.NAVER_OPENAPI_KEY_9 ? env.NAVER_OPENAPI_KEY_9.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_9 && !!env.NAVER_OPENAPI_SECRET_9,
          lastUsed: Date.now() - Math.random() * 86400000
        },
        {
          name: 'NAVER_OPENAPI_KEY_10',
          clientId: env.NAVER_OPENAPI_KEY_10 ? env.NAVER_OPENAPI_KEY_10.substring(0, 8) + '...' : null,
          usedToday: 0,
          dailyLimit: 25000,
          remaining: 25000,
          isActive: !!env.NAVER_OPENAPI_KEY_10 && !!env.NAVER_OPENAPI_SECRET_10,
          lastUsed: Date.now() - Math.random() * 86400000
        }
      ]
    };

    // 실제 API 사용량을 데이터베이스에서 조회 (향후 구현)
    // const db = env.DB;
    // const apiUsageStats = await db.prepare(`
    //   SELECT api_type, api_key_index, COUNT(*) as calls
    //   FROM api_call_logs
    //   WHERE created_at >= datetime('now', '-1 day')
    //   GROUP BY api_type, api_key_index
    // `).all();

    const adsSummary = {
      totalAdsKeys: apiKeys.adsApiKeys.length,
      activeAdsKeys: apiKeys.adsApiKeys.filter(k => k.isActive).length,
      totalRemaining: apiKeys.adsApiKeys.filter(k => k.isActive).reduce((sum, k) => sum + k.remaining, 0),
      totalUsed: apiKeys.adsApiKeys.filter(k => k.isActive).reduce((sum, k) => sum + k.usedToday, 0),
      totalLimit: apiKeys.adsApiKeys.filter(k => k.isActive).reduce((sum, k) => sum + k.dailyLimit, 0)
    };

    const openApiSummary = {
      totalOpenApiKeys: apiKeys.openApiKeys.length,
      activeOpenApiKeys: apiKeys.openApiKeys.filter(k => k.isActive).length,
      totalRemaining: apiKeys.openApiKeys.filter(k => k.isActive).reduce((sum, k) => sum + k.remaining, 0),
      totalUsed: apiKeys.openApiKeys.filter(k => k.isActive).reduce((sum, k) => sum + k.usedToday, 0),
      totalLimit: apiKeys.openApiKeys.filter(k => k.isActive).reduce((sum, k) => sum + k.dailyLimit, 0)
    };

    const overallSummary = {
      totalApiKeys: adsSummary.totalAdsKeys + openApiSummary.totalOpenApiKeys,
      activeApiKeys: adsSummary.activeAdsKeys + openApiSummary.activeOpenApiKeys,
      totalRemaining: adsSummary.totalRemaining + openApiSummary.totalRemaining,
      totalUsed: adsSummary.totalUsed + openApiSummary.totalUsed,
      totalLimit: adsSummary.totalLimit + openApiSummary.totalLimit
    };

    return new Response(
      JSON.stringify({
        success: true,
        adsApiKeys: apiKeys.adsApiKeys,
        openApiKeys: apiKeys.openApiKeys,
        adsSummary,
        openApiSummary,
        overallSummary,
        lastUpdated: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    throw new Error(`API 상태 조회 실패: ${error.message}`);
  }
}

// Rate Limit 상태 계산
function calculateRateLimitStatus(apiStats: any[]) {
  const status = {
    overall_health: 'healthy',
    recommendations: [] as string[],
    api_key_performance: {} as Record<string, {
      success_rate: number
      avg_response_time: number
      health: string
    }>
  };

  apiStats.forEach(stat => {
    const successRate = stat.success_calls / stat.total_calls;
    const avgResponseTime = stat.avg_response_time;

    // API 키별 성능 평가
    status.api_key_performance[stat.api_type] = {
      success_rate: successRate,
      avg_response_time: avgResponseTime,
      health: successRate > 0.95 ? 'excellent' :
              successRate > 0.90 ? 'good' :
              successRate > 0.80 ? 'warning' : 'critical'
    };

    // 권장사항 생성
    if (successRate < 0.90) {
      status.recommendations.push(`${stat.api_type} API 성공률 낮음 (${(successRate * 100).toFixed(1)}%)`);
    }

    if (avgResponseTime > 3000) {
      status.recommendations.push(`${stat.api_type} API 응답시간 느림 (${avgResponseTime}ms)`);
    }
  });

  // 전체 건강 상태 결정
  const criticalCount = Object.values(status.api_key_performance)
    .filter((perf: any) => perf.health === 'critical').length;

  if (criticalCount > 0) {
    status.overall_health = 'critical';
  } else if (status.recommendations.length > 0) {
    status.overall_health = 'warning';
  }

  return status;
}

// 중복 키워드 정리 함수
async function cleanupDuplicates(db: any, corsHeaders: any) {
  try {
    console.log('🧹 중복 키워드 정리 시작');

    // 중복 키워드 수 확인
    const duplicateStats = await db.prepare(`
      SELECT keyword, COUNT(*) as count
      FROM keywords
      GROUP BY keyword
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `).all();

    const totalDuplicates = duplicateStats.results?.length || 0;
    console.log(`📊 중복 키워드 발견: ${totalDuplicates}개`);

    if (totalDuplicates === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: '중복 키워드가 없습니다.',
          stats: { totalDuplicates: 0, deletedRecords: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 중복 키워드 정리 (각 키워드별로 가장 오래된 레코드만 유지)
    const deleteResult = await db.prepare(`
      DELETE FROM keywords
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM keywords
        GROUP BY keyword
      )
    `).run();

    const deletedRecords = deleteResult.meta.changes || 0;

    // 정리 후 최종 통계
    const finalStats = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM keywords) as total_keywords,
        (SELECT COUNT(DISTINCT keyword) FROM keywords) as unique_keywords
    `).all();

    const totalKeywords = finalStats.results?.[0]?.total_keywords || 0;
    const uniqueKeywords = finalStats.results?.[0]?.unique_keywords || 0;

    console.log(`✅ 중복 정리 완료: ${deletedRecords}개 레코드 삭제`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `중복 키워드 정리 완료: ${deletedRecords}개 레코드 삭제`,
        stats: {
          totalDuplicates: totalDuplicates,
          deletedRecords: deletedRecords,
          finalTotalKeywords: totalKeywords,
          finalUniqueKeywords: uniqueKeywords,
          duplicateDetails: duplicateStats.results?.slice(0, 10) // 상위 10개 중복만 표시
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ 중복 정리 중 오류:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `중복 정리 실패: ${error.message}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

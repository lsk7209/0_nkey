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

      case 'optimize':
        return await runOptimization(db, corsHeaders);

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

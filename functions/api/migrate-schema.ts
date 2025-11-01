// 스키마 마이그레이션 API - pc_search, mobile_search 컬럼 추가
export async function onRequest(context: any) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key');
    if (!adminKey || adminKey !== 'dev-key-2024') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const db = env.DB;
    const results: string[] = [];

    // 1. pc_search 컬럼 추가 (없는 경우)
    try {
      await db.prepare(`
        ALTER TABLE keywords ADD COLUMN pc_search INTEGER DEFAULT 0
      `).run();
      results.push('✅ pc_search 컬럼 추가 성공');
    } catch (e: any) {
      if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
        results.push('⚠️ pc_search 컬럼이 이미 존재함');
      } else {
        results.push(`❌ pc_search 컬럼 추가 실패: ${e.message}`);
      }
    }

    // 2. mobile_search 컬럼 추가 (없는 경우)
    try {
      await db.prepare(`
        ALTER TABLE keywords ADD COLUMN mobile_search INTEGER DEFAULT 0
      `).run();
      results.push('✅ mobile_search 컬럼 추가 성공');
    } catch (e: any) {
      if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
        results.push('⚠️ mobile_search 컬럼이 이미 존재함');
      } else {
        results.push(`❌ mobile_search 컬럼 추가 실패: ${e.message}`);
      }
    }

    // 3. 기존 데이터 마이그레이션
    try {
      const update1 = await db.prepare(`
        UPDATE keywords SET pc_search = monthly_search_pc 
        WHERE pc_search IS NULL OR pc_search = 0
      `).run();
      results.push(`✅ pc_search 데이터 마이그레이션 완료: ${(update1 as any).meta?.changes || 0}개 행 업데이트`);
    } catch (e: any) {
      results.push(`⚠️ pc_search 데이터 마이그레이션 실패: ${e.message}`);
    }

    try {
      const update2 = await db.prepare(`
        UPDATE keywords SET mobile_search = monthly_search_mob 
        WHERE mobile_search IS NULL OR mobile_search = 0
      `).run();
      results.push(`✅ mobile_search 데이터 마이그레이션 완료: ${(update2 as any).meta?.changes || 0}개 행 업데이트`);
    } catch (e: any) {
      results.push(`⚠️ mobile_search 데이터 마이그레이션 실패: ${e.message}`);
    }

    // 4. 인덱스 추가 (없는 경우)
    try {
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_keywords_pc_search ON keywords(pc_search)
      `).run();
      results.push('✅ pc_search 인덱스 생성 완료');
    } catch (e: any) {
      results.push(`⚠️ pc_search 인덱스 생성 실패: ${e.message}`);
    }

    try {
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_keywords_mobile_search ON keywords(mobile_search)
      `).run();
      results.push('✅ mobile_search 인덱스 생성 완료');
    } catch (e: any) {
      results.push(`⚠️ mobile_search 인덱스 생성 실패: ${e.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '스키마 마이그레이션 완료',
        results,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Migration Error',
        message: error?.message || 'Unknown error',
        stack: error?.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}


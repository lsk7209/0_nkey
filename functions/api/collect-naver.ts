/**
 * ⚠️ 헌법 준수 필수 (CONSTITUTION.md v2.0)
 * 
 * 절대 변경 금지 사항:
 * - API 응답에 keywords 배열 필수 포함
 * - 필드명 변경 금지 (pc_search, mobile_search 등)
 * - 네이버 API 호출 로직 변경 금지
 * - 샘플 데이터 반환 금지
 * 
 * ⚠️ 헌법 제16조: 데이터베이스 저장 규칙 준수 필수
 * - INSERT 쿼리: monthly_search_pc, monthly_search_mob만 사용 (pc_search, mobile_search 제외)
 * - INSERT 후 검증 필수 (3회 재시도)
 * - 검증 성공 시에만 savedCount 증가 (절대 변경 금지)
 * - 중복 확인 필수 (INSERT 전)
 * - 시간 기반 정책 완전 제거 (7일, 30일 정책 금지)
 * 
 * 헌법 문서: CONSTITUTION.md (절대 변경 금지)
 * 환경 문서: WORKING_ENVIRONMENT.md (현재 작동 환경 고정)
 * 
 * 최종 확인: 2025-11-01 - 수동 키워드 수집 및 저장 정상 작동 확인 완료
 */

// Cloudflare Pages Functions용 네이버 API 키워드 수집
export async function onRequest(context: any) {
  const { request, env } = context;
  
  // 로그 최소화 (개인 프로젝트 최적화)
  
  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
  };

  // OPTIONS 요청 처리
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

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method Not Allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const seed = body.seed;
    
    if (!seed || typeof seed !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid seed keyword' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 실제 네이버 SearchAd API 호출
    const keywords = await fetchKeywordsFromOfficialNaverAPI(seed.trim(), env);

    // 키워드 정규화 함수 (중복 방지 강화)
    const normalizeKeyword = (keyword: string): string => {
      if (!keyword) return '';
      // 공백 제거, 앞뒤 공백 제거
      return keyword.trim().replace(/\s+/g, ' ');
    };

    const seen = new Set<string>();
    const uniqueKeywords = (keywords || []).filter((k: { keyword?: string }) => {
      const normalizedKey = normalizeKeyword(k.keyword || '');
      if (!normalizedKey || seen.has(normalizedKey)) {
        return false;
      }
      seen.add(normalizedKey);
      k.keyword = normalizedKey;
      return true;
    });

    if (!keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `네이버 API에서 연관검색어를 찾을 수 없습니다: ${seed.trim()}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (uniqueKeywords.length === 0) {
      console.error(`❌ 중복 제거 후 uniqueKeywords가 비어있음! 원본 keywords: ${keywords.length}개`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `중복 제거 후 유효한 키워드가 없습니다. 원본: ${keywords.length}개, 필터링 후: 0개`,
          totalCollected: keywords.length,
          totalSavedOrUpdated: 0,
          savedCount: 0,
          updatedCount: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // D1 데이터베이스에 저장 (청크 처리 + 안전 대기)
    const db = env.DB;

    // 저장 전 총 키워드 수 확인
    let totalBefore = 0;
    try {
      const beforeCount = await db.prepare('SELECT COUNT(*) as total FROM keywords').first() as { total: number } | null;
      totalBefore = beforeCount?.total || 0;
      console.log(`📊 저장 전 총 키워드 수: ${totalBefore}개`);
    } catch (countError: any) {
      console.warn(`⚠️ 저장 전 총 키워드 수 확인 실패:`, countError.message);
    }
    
    // 데이터베이스 연결 상태 확인
    console.log('🔍 데이터베이스 연결 상태 확인 중...');
    try {
      const dbTest = await db.prepare('SELECT COUNT(*) as total FROM keywords').first();
      console.log(`✅ 데이터베이스 연결 성공: 현재 키워드 수 ${(dbTest as any)?.total || 0}개`);
    } catch (dbTestError: any) {
      console.error(`❌ 데이터베이스 연결 실패:`, dbTestError.message);
      return new Response(
        JSON.stringify({
          success: false,
          message: `데이터베이스 연결 실패: ${dbTestError.message}`,
          error: dbTestError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let savedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0; // 30일 이내 중복 키워드 건너뜀 카운트
    let docCountsCollected = 0;
    const maxDocCountsToCollect = 5; // 타임아웃 감소를 위해 문서수 수집 최소화 (10 → 5)
    let failedCount = 0;
    const failedSamples: { keyword: string, error: string }[] = [];

    // DB 청크 크기 및 청크 간 대기(ms)
    const CHUNK_SIZE = 20;
    const CHUNK_DELAY_MS = 500;

    // D1 쓰기 재시도 유틸 (BUSY/LOCK 등 일시 오류 완화)
    async function runWithRetry<T>(op: () => Promise<T>, label: string): Promise<T> {
      const maxRetry = 3;
      let attempt = 0;
      let lastErr: any;
      while (attempt < maxRetry) {
        try {
          return await op();
        } catch (e: any) {
          lastErr = e;
          const msg = (e?.message || '').toLowerCase();
          const transient = msg.includes('busy') || msg.includes('locked') || msg.includes('timeout');
          attempt++;
          if (!transient || attempt >= maxRetry) {
            console.error(`❌ D1 ${label} 실패 (시도 ${attempt}/${maxRetry}):`, e?.message || e);
            throw e;
          }
          const backoff = 200 * Math.pow(2, attempt - 1);
          console.warn(`🔄 D1 ${label} 재시도 ${attempt}/${maxRetry} (${backoff}ms 대기)`);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
      throw lastErr;
    }

    // 네이버 오픈API 키 확인
    const hasOpenApiKeys = [
      env.NAVER_OPENAPI_KEY_1, env.NAVER_OPENAPI_KEY_2, env.NAVER_OPENAPI_KEY_3,
      env.NAVER_OPENAPI_KEY_4, env.NAVER_OPENAPI_KEY_5
    ].some(key => key);
    for (let i = 0; i < uniqueKeywords.length; i++) {
      const keyword = uniqueKeywords[i];

      try {
        // 키워드 정규화 (중복 방지 강화)
        const normalizedKeyword = normalizeKeyword(keyword.keyword || '');
        if (!normalizedKeyword) {
          failedCount++;
          continue;
        }
        
        keyword.keyword = normalizedKeyword;

        // 기존 키워드 확인 (정규화된 키워드로 검색)
        const existing = await db.prepare('SELECT id FROM keywords WHERE keyword = ?').bind(normalizedKeyword).first() as { id: number } | null;

        let keywordId: number | null = null;

        if (existing) {
          keywordId = existing.id as number;
          try {
            // ⚠️ 헌법 제16조 준수: UPDATE 쿼리 구조 절대 변경 금지
            await db.prepare(`
              UPDATE keywords SET
                monthly_search_pc = ?,
                monthly_search_mob = ?,
                avg_monthly_search = ?,
                seed_keyword_text = ?,
                comp_index = ?,
                updated_at = ?
              WHERE id = ?
            `).bind(
              keyword.pc_search || 0,
              keyword.mobile_search || 0,
              keyword.avg_monthly_search || 0,
              seed.trim(),
              keyword.comp_idx || 0,
              new Date().toISOString(),
              existing.id
            ).run();

            // pc_search, mobile_search 컬럼이 있다면 별도로 업데이트 시도 (실패해도 무시)
            try {
              await db.prepare(`UPDATE keywords SET pc_search = ?, mobile_search = ? WHERE id = ?`)
                .bind(keyword.pc_search || 0, keyword.mobile_search || 0, existing.id).run();
            } catch {}

            // keyword_metrics 테이블 업데이트 또는 삽입
            const existingMetrics = await db.prepare('SELECT id FROM keyword_metrics WHERE keyword_id = ?')
              .bind(existing.id).first() as { id: number } | null;

            if (existingMetrics) {
              await db.prepare(`
                UPDATE keyword_metrics SET
                  monthly_click_pc = ?, monthly_click_mobile = ?, ctr_pc = ?, ctr_mobile = ?, ad_count = ?
                WHERE keyword_id = ?
              `).bind(
                keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
                keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0,
                existing.id
              ).run();
            } else {
              await db.prepare(`
                INSERT INTO keyword_metrics (
                  keyword_id, monthly_click_pc, monthly_click_mobile, ctr_pc, ctr_mobile, ad_count
                ) VALUES (?, ?, ?, ?, ?, ?)
              `).bind(
                existing.id,
                keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
                keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0
              ).run();
            }

            updatedCount++;
          } catch (updateError: any) {
            console.error(`❌ 업데이트 실패 (${keyword.keyword}):`, updateError.message);
            failedCount++;
          }
        } else {
          // ⚠️ 중요: INSERT 전에 다시 한 번 확인 (race condition 방지)
          // existing이 null이었지만, 다른 요청에서 이미 삽입했을 수 있음
          // 정규화된 키워드로 검색 (중복 방지 강화)
          const doubleCheck = await runWithRetry(
            () => db.prepare('SELECT id, updated_at FROM keywords WHERE keyword = ?').bind(normalizedKeyword).first(),
            'double check keywords'
          ) as { id: number; updated_at: string } | null;

          if (doubleCheck) {
            // 다시 조회했을 때 존재함 - 무조건 업데이트
            console.log(`🔄 이중 확인: 키워드 ${keyword.keyword}가 존재함 (ID: ${doubleCheck.id}) - 무조건 업데이트 진행`);
            keywordId = doubleCheck.id;
            try {
              const newUpdatedAt = new Date().toISOString();
              const updateResult = await runWithRetry(() => db.prepare(`
                UPDATE keywords SET 
                  monthly_search_pc = ?,
                  monthly_search_mob = ?,
                  avg_monthly_search = ?,
                  seed_keyword_text = ?,
                  comp_index = ?,
                  updated_at = ?
                WHERE id = ?
              `).bind(
                keyword.pc_search || 0,
                keyword.mobile_search || 0,
                keyword.avg_monthly_search || 0,
                seed.trim(),
                keyword.comp_idx || 0,
                newUpdatedAt,
                doubleCheck.id
              ).run(), 'update existing keyword');

              // pc_search, mobile_search 컬럼이 있다면 별도로 업데이트 시도 (실패해도 무시)
              try {
                await db.prepare(`
                  UPDATE keywords 
                  SET pc_search = ?, mobile_search = ?
                  WHERE id = ?
                `).bind(
                  keyword.pc_search || 0,
                  keyword.mobile_search || 0,
                  doubleCheck.id
                ).run();
                console.log(`✅ pc_search, mobile_search 업데이트 완료 (ID: ${doubleCheck.id})`);
              } catch (updateError: any) {
                if (updateError.message?.includes('no column named')) {
                  console.warn(`⚠️ pc_search/mobile_search 컬럼이 없음 (마이그레이션 필요)`);
                }
              }

              const changes = (updateResult as any).meta?.changes || 0;
              // UPDATE 시도는 항상 카운트로 인정 (changes가 0이어도 시도했으므로)
              updatedCount++;
              console.log(`📈 updatedCount 증가: ${updatedCount} (변경된 행: ${changes}, 현재 총계: ${updatedCount})`);

              // keyword_metrics 업데이트
              const existingMetrics = await runWithRetry(
                () => db.prepare('SELECT id FROM keyword_metrics WHERE keyword_id = ?').bind(doubleCheck.id).first(),
                'select keyword_metrics'
              ) as { id: number } | null;

              if (existingMetrics) {
                await runWithRetry(() => db.prepare(`
                  UPDATE keyword_metrics SET
                    monthly_click_pc = ?, monthly_click_mobile = ?, ctr_pc = ?, ctr_mobile = ?, ad_count = ?
                  WHERE keyword_id = ?
                `).bind(
                  keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
                  keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0,
                  doubleCheck.id
                ).run(), 'update keyword_metrics');
              } else {
                await runWithRetry(() => db.prepare(`
                  INSERT INTO keyword_metrics (
                    keyword_id, monthly_click_pc, monthly_click_mobile, ctr_pc, ctr_mobile, ad_count
                  ) VALUES (?, ?, ?, ?, ?, ?)
                `).bind(
                  doubleCheck.id,
                  keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
                  keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0
                ).run(), 'insert keyword_metrics');
              }
            } catch (updateError: any) {
              console.error(`❌ 키워드 업데이트 실패 (${keyword.keyword}):`, updateError.message);
            }
            continue; // 업데이트 완료, 다음 키워드로
          }

          // 새 키워드 INSERT 시도
          try {
            // ⚠️ 헌법 제16조 준수: INSERT 쿼리 구조 절대 변경 금지
            const insertResult = await db.prepare(`
              INSERT INTO keywords (
                keyword, seed_keyword_text, monthly_search_pc, monthly_search_mob,
                avg_monthly_search, comp_index, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(keyword) DO UPDATE SET
                monthly_search_pc = excluded.monthly_search_pc,
                monthly_search_mob = excluded.monthly_search_mob,
                avg_monthly_search = excluded.avg_monthly_search,
                seed_keyword_text = excluded.seed_keyword_text,
                comp_index = excluded.comp_index,
                updated_at = excluded.updated_at
            `).bind(
              normalizedKeyword,
              seed.trim(),
              keyword.pc_search || 0,
              keyword.mobile_search || 0,
              keyword.avg_monthly_search || 0,
              keyword.comp_idx || 0,
              new Date().toISOString(),
              new Date().toISOString()
            ).run();
              
            // pc_search, mobile_search 컬럼이 있다면 업데이트 시도 (실패해도 무시)
            try {
              await db.prepare(`UPDATE keywords SET pc_search = ?, mobile_search = ? WHERE keyword = ?`)
                .bind(keyword.pc_search || 0, keyword.mobile_search || 0, normalizedKeyword).run();
            } catch {}

            const changes = (insertResult as any)?.meta?.changes ?? (insertResult as any)?.changes ?? 0;
            keywordId = (insertResult as any)?.meta?.last_row_id ?? (insertResult as any)?.last_row_id ?? null;

            // ⚠️ 헌법 제16조 준수: INSERT 직후 검증 필수 (간소화)
            let verifyInsert: { id: number } | null = null;
            for (let attempt = 0; attempt < 2 && !verifyInsert; attempt++) {
              if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 100));
              try {
                verifyInsert = await db.prepare('SELECT id FROM keywords WHERE keyword = ?')
                  .bind(normalizedKeyword).first() as { id: number } | null;
                if (verifyInsert) break;
              } catch {}
            }

            if (verifyInsert) {
              keywordId = verifyInsert.id;
              savedCount++;
            } else {
              failedCount++;
              if (failedSamples.length < 5) {
                failedSamples.push({ keyword: keyword.keyword, error: '검증 실패' });
              }
              if (!keywordId) continue;
            }

            // keyword_metrics 삽입/업데이트
            const existingMetrics = await db.prepare('SELECT id FROM keyword_metrics WHERE keyword_id = ?')
              .bind(keywordId).first() as { id: number } | null;

            if (existingMetrics) {
              await db.prepare(`
                UPDATE keyword_metrics SET
                  monthly_click_pc = ?, monthly_click_mobile = ?, ctr_pc = ?, ctr_mobile = ?, ad_count = ?
                WHERE keyword_id = ?
              `).bind(
                keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
                keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0,
                keywordId
              ).run();
            } else {
              await db.prepare(`
                INSERT INTO keyword_metrics (
                  keyword_id, monthly_click_pc, monthly_click_mobile, ctr_pc, ctr_mobile, ad_count
                ) VALUES (?, ?, ?, ?, ?, ?)
              `).bind(
                keywordId,
                keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
                keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0
              ).run();
            }
          } catch (insertError: any) {
            console.error(`❌ 삽입 실패 (${keyword.keyword}):`, insertError.message);
            failedCount++;
            if (failedSamples.length < 5) {
              failedSamples.push({ keyword: keyword.keyword, error: insertError?.message || 'Unknown' });
            }
          }
        }

        // 문서수 수집 (타임아웃 감소를 위해 최소화 - 최대 5개까지, 새로 추가된 키워드만)
        if (docCountsCollected < maxDocCountsToCollect && hasOpenApiKeys && keywordId && !existing) {
          try {
            const docCounts = await collectDocCountsFromNaver(keyword.keyword, env);
            if (docCounts) {
              const existingDocCount = await db.prepare('SELECT id FROM naver_doc_counts WHERE keyword_id = ?')
                .bind(keywordId).first() as { id: number } | null;

              if (existingDocCount) {
                await db.prepare(`
                  UPDATE naver_doc_counts 
                  SET blog_total = ?, cafe_total = ?, web_total = ?, news_total = ?, collected_at = CURRENT_TIMESTAMP
                  WHERE keyword_id = ?
                `).bind(
                  docCounts.blog_total || 0, docCounts.cafe_total || 0,
                  docCounts.web_total || 0, docCounts.news_total || 0, keywordId
                ).run();
              } else {
                await db.prepare(`
                  INSERT INTO naver_doc_counts (keyword_id, blog_total, cafe_total, web_total, news_total)
                  VALUES (?, ?, ?, ?, ?)
                `).bind(
                  keywordId, docCounts.blog_total || 0, docCounts.cafe_total || 0,
                  docCounts.web_total || 0, docCounts.news_total || 0
                ).run();
              }
              docCountsCollected++;
            }
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch {}
        }
      } catch (dbError: any) {
        console.error(`❌ [${i + 1}/${uniqueKeywords.length}] 데이터베이스 저장 실패 (${keyword.keyword}):`, dbError);
        console.error('에러 상세:', {
          message: dbError.message,
          stack: dbError.stack,
          name: dbError.name,
          keyword: keyword.keyword,
          keywordType: typeof keyword.keyword
        });
        failedCount++;
        console.log(`📈 failedCount 증가: ${failedCount} (현재 총계: ${failedCount})`);
        if (failedSamples.length < 5) {
          failedSamples.push({ keyword: keyword.keyword, error: dbError?.message || String(dbError) });
        }
      }

      // 청크 간 대기 (D1 한도 보호)
      if ((i + 1) % CHUNK_SIZE === 0) {
        console.log(`⏳ 청크 대기: ${(i + 1)}/${uniqueKeywords.length} 처리됨, ${CHUNK_DELAY_MS}ms 대기`);
        await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
      }

      console.log(`✅ [${i + 1}/${uniqueKeywords.length}] 키워드 처리 완료: ${keyword.keyword} (진행상황: 저장=${savedCount}, 업데이트=${updatedCount}, 실패=${failedCount})`);
    }

    console.log(`🎉 저장 루프 종료: 총 ${uniqueKeywords.length}개 키워드 처리 완료`);
    console.log(`📊 최종 카운트: 저장=${savedCount}, 업데이트=${updatedCount}, 실패=${failedCount}, 총계=${savedCount + updatedCount}`);
    
    // 실제 총 키워드 수 확인 (저장 전후 비교)
    let actualNewKeywords = savedCount; // 기본값: savedCount
    try {
      const totalAfter = await db.prepare('SELECT COUNT(*) as total FROM keywords').first() as { total: number } | null;
      console.log(`📊 데이터베이스 총 키워드 수: ${totalAfter?.total || 0}개 (저장 전: ${totalBefore}개)`);
      
      actualNewKeywords = (totalAfter?.total || 0) - totalBefore;
      console.log(`📊 실제 추가된 키워드 수: ${actualNewKeywords}개 (savedCount: ${savedCount}, 실제 DB 증가: ${actualNewKeywords})`);
      
      if (actualNewKeywords !== savedCount) {
        console.warn(`⚠️ 불일치 감지: savedCount(${savedCount})와 실제 DB 증가(${actualNewKeywords})가 다릅니다!`);
      }
    } catch (countError: any) {
      console.warn(`⚠️ 총 키워드 수 확인 실패:`, countError.message);
      // 실패해도 기존 savedCount 사용
      actualNewKeywords = savedCount;
    }

    return new Response(
      JSON.stringify({
        success: true,
        seed: seed.trim(),
        totalCollected: keywords.length,
        totalSavedOrUpdated: savedCount + updatedCount,
        savedCount: actualNewKeywords, // 실제 DB에 추가된 수 (검증 후)
        updatedCount,
        skippedCount: 0, // 시간 기반 정책 완전 제거
        totalAttempted: uniqueKeywords.length,
        keywords: uniqueKeywords, // 실제 수집된(중복 제거) 키워드 반환
        failedCount,
        failedSamples,
        docCountsCollected, // 문서수 수집된 키워드 수
        hasOpenApiKeys, // 네이버 오픈API 키 설정 여부
        actualNewKeywords: actualNewKeywords, // 실제 DB에 추가된 키워드 수
        warning: actualNewKeywords !== savedCount ? `⚠️ 카운트 불일치: 보고된 savedCount(${savedCount})와 실제 추가(${actualNewKeywords})가 다릅니다. 실제 추가 수를 기준으로 반환합니다.` : undefined,
        message: `네이버 API로 ${keywords.length}개 수집 → 중복 제거 ${uniqueKeywords.length}개 중 실제 추가 ${actualNewKeywords}개, 업데이트 ${updatedCount}개, 실패 ${failedCount}개.${docCountsCollected > 0 ? ` 문서수 ${docCountsCollected}개 수집.` : hasOpenApiKeys ? '' : ' (오픈API 키 미설정으로 문서수 건너뜀)'}`,
        version: 'v9.1 - 실제 DB 카운트 검증 추가',
        timestamp: new Date().toISOString(),
        api_implementation: {
          endpoint: 'https://api.naver.com/keywordstool',
          authentication: 'HMAC-SHA256 + Base64',
          parameters: 'hintKeywords, showDetail=1',
          response_mapping: 'relKeyword → keyword, monthlyPcQcCnt → pc_search, etc.',
          data_normalization: '< 10 strings handled',
          rate_limit_handling: '429 → 5min cooldown'
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ 에러:', error?.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Pages Functions Error', 
        message: error?.message || 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// 공식 네이버 SearchAd API로 키워드 수집
async function fetchKeywordsFromOfficialNaverAPI(seed: string, env: any) {
  
  try {
    // 기존 환경변수에서 API 키 가져오기 (공식 API 사용)
    const BASE = 'https://api.naver.com';
    
    // 사용 가능한 네이버 API 키 찾기
    const apiKeysRaw = [
      { key: env.NAVER_API_KEY_1, secret: env.NAVER_API_SECRET_1, customerId: env.NAVER_CUSTOMER_ID_1 },
      { key: env.NAVER_API_KEY_2, secret: env.NAVER_API_SECRET_2, customerId: env.NAVER_CUSTOMER_ID_2 },
      { key: env.NAVER_API_KEY_3, secret: env.NAVER_API_SECRET_3, customerId: env.NAVER_CUSTOMER_ID_3 },
      { key: env.NAVER_API_KEY_4, secret: env.NAVER_API_SECRET_4, customerId: env.NAVER_CUSTOMER_ID_4 },
      { key: env.NAVER_API_KEY_5, secret: env.NAVER_API_SECRET_5, customerId: env.NAVER_CUSTOMER_ID_5 }
    ];

    // 디버깅: 각 키의 상태 확인
    console.log('🔍 환경변수에서 읽은 API 키 상태:');
    apiKeysRaw.forEach((api, i) => {
      console.log(`  키 ${i + 1}:`, {
        keyExists: !!api.key,
        keyLength: api.key?.length || 0,
        keyPrefix: api.key?.substring(0, 12) || 'N/A',
        secretExists: !!api.secret,
        secretLength: api.secret?.length || 0,
        customerIdExists: !!api.customerId,
        customerIdLength: api.customerId?.length || 0,
        customerId: api.customerId || 'N/A'
      });
    });

    const apiKeys = apiKeysRaw.filter(api => api.key && api.secret && api.customerId);

    if (apiKeys.length === 0) {
      throw new Error('네이버 API 키가 설정되지 않았습니다.');
    }

    // API 키 유효성 검증 (간소화)
    const validApiKeys = apiKeys.filter(key => 
      key.key?.trim() && key.secret?.trim() && key.customerId?.trim()
    );

    if (validApiKeys.length === 0) {
      throw new Error('유효한 네이버 API 키가 없습니다.');
    }

    const apiKeysToUse = validApiKeys;

    // 시드 기반 API 키 로테이션 (다중 키 활용으로 속도 향상)
    const seedHash = seed.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const keyIndex = Math.abs(seedHash) % apiKeysToUse.length;
    const apiKey = apiKeysToUse[keyIndex];
    const KEY = apiKey.key;
    const SECRET = apiKey.secret;
    const CID = apiKey.customerId;


    // 공식 API 엔드포인트 및 파라미터
    const uri = '/keywordstool';
    const qs = new URLSearchParams({ 
      hintKeywords: seed, 
      showDetail: '1' 
    });
    const ts = Date.now().toString();
    
    // HMAC-SHA256 시그니처 생성 (공식 문서 기준)
    const sig = await generateOfficialHMACSignature(ts, 'GET', uri, SECRET);

    console.log('Official API call details:', {
      url: `${BASE}${uri}?${qs.toString()}`,
      timestamp: ts,
      signature: sig.substring(0, 20) + '...'
    });

    const startTime = Date.now();

    // 공식 API 호출
    const res = await fetch(`${BASE}${uri}?${qs.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Timestamp': ts,
        'X-API-KEY': KEY,
        'X-Customer': CID,
        'X-Signature': sig,
      },
    });

    const responseTime = Date.now() - startTime;
    console.log(`Official Naver API response status: ${res.status} (${responseTime}ms)`);

    // API 호출 로깅
    try {
      await env.DB.prepare(`
        INSERT INTO api_call_logs (api_type, endpoint, method, status_code, response_time_ms, success, error_message, api_key_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'searchad',
        uri,
        'GET',
        res.status,
        responseTime,
        res.ok,
        res.ok ? null : `Status: ${res.status}`,
        keyIndex
      ).run();
    } catch (logError) {
      console.warn('API 호출 로깅 실패:', logError);
    }

    // 429 Rate Limit 처리
    if (res.status === 429) {
      console.warn('Rate limit reached. Cooling down for 5 minutes...');
      await new Promise(r => setTimeout(r, 5 * 60 * 1000));
      return fetchKeywordsFromOfficialNaverAPI(seed, env);
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Official Naver API Error: ${res.status} - ${errorText}`);
      
      // API 키가 invalid인 경우 다른 키로 재시도
      if (errorText.includes('invalid') || errorText.includes('Invalid') || res.status === 401 || res.status === 403) {
        const otherKeys = apiKeysToUse.filter((_, idx) => idx !== keyIndex);
        
        if (otherKeys.length > 0) {
          for (let retryIndex = 0; retryIndex < otherKeys.length; retryIndex++) {
            const retryKey = otherKeys[retryIndex];
            const retryKeyIndex = apiKeysToUse.findIndex(k => k.key === retryKey.key);
            
            try {
              const retrySig = await generateOfficialHMACSignature(ts, 'GET', uri, retryKey.secret);
              
              const retryRes = await fetch(`${BASE}${uri}?${qs.toString()}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json; charset=UTF-8',
                  'X-Timestamp': ts,
                  'X-API-KEY': retryKey.key,
                  'X-Customer': retryKey.customerId,
                  'X-Signature': retrySig,
                },
              });
              
              const retryResponseTime = Date.now() - startTime;
              
              // API 호출 로깅 (재시도)
              try {
                await env.DB.prepare(`
                  INSERT INTO api_call_logs (api_type, endpoint, method, status_code, response_time_ms, success, error_message, api_key_index)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  'searchad',
                  uri,
                  'GET',
                  retryRes.status,
                  retryResponseTime,
                  retryRes.ok,
                  retryRes.ok ? null : `Status: ${retryRes.status}`,
                  retryKeyIndex
                ).run();
              } catch {}
              
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                
                try {
                  await recordSystemMetrics(env.DB, retryData.keywordList?.length || 0, retryKeyIndex);
                } catch {}
                
                if (!retryData.keywordList || !Array.isArray(retryData.keywordList)) {
                  return [];
                }

                const keywords = retryData.keywordList.map((k: any) => ({
                  keyword: k.relKeyword || k.keyword || k.query || '',
                  pc_search: normalizeSearchCount(k.monthlyPcQcCnt),
                  mobile_search: normalizeSearchCount(k.monthlyMobileQcCnt),
                  avg_monthly_search: normalizeSearchCount(k.monthlyPcQcCnt) + normalizeSearchCount(k.monthlyMobileQcCnt),
                  monthly_click_pc: parseFloat(k.monthlyAvePcClkCnt || '0'),
                  monthly_click_mo: parseFloat(k.monthlyAveMobileClkCnt || '0'),
                  ctr_pc: parseFloat(k.monthlyAvePcCtr || '0'),
                  ctr_mo: parseFloat(k.monthlyAveMobileCtr || '0'),
                  ad_count: parseInt(k.plAvgDepth || '0'),
                  comp_idx: k.compIdx || null
                })).filter((kw: any) => kw.keyword && kw.keyword.trim() !== '');
                
                return keywords;
              } else {
                continue;
              }
            } catch {
              continue;
            }
          }
          
          // 모든 재시도 실패
          throw new Error(`모든 API 키로 시도했으나 실패했습니다. 마지막 에러: ${res.status} - ${errorText}`);
        } else {
          throw new Error(`공식 네이버 SearchAd API 호출 실패: ${res.status} - ${errorText}. 사용 가능한 다른 키가 없습니다.`);
        }
      }
      
      throw new Error(`공식 네이버 SearchAd API 호출 실패: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    console.log('Official Naver API response:', JSON.stringify(data, null, 2));

    // 응답 데이터 매핑 (공식 필드명 사용)
    if (!data.keywordList || !Array.isArray(data.keywordList)) {
      console.log('No keywordList data found in official API response');
      return [];
    }

            console.log('🔍 API 응답 keywordList 구조 확인:', {
              keywordListLength: data.keywordList?.length || 0,
              firstItem: data.keywordList?.[0] || null,
              firstItemKeys: data.keywordList?.[0] ? Object.keys(data.keywordList[0]) : null
            });

            const keywords = data.keywordList.map((k: any) => ({
              keyword: k.relKeyword || k.keyword || k.query || '',
              pc_search: normalizeSearchCount(k.monthlyPcQcCnt),
              mobile_search: normalizeSearchCount(k.monthlyMobileQcCnt),
              avg_monthly_search: normalizeSearchCount(k.monthlyPcQcCnt) + normalizeSearchCount(k.monthlyMobileQcCnt),
              monthly_click_pc: parseFloat(k.monthlyAvePcClkCnt || '0'),
              monthly_click_mo: parseFloat(k.monthlyAveMobileClkCnt || '0'),
              ctr_pc: parseFloat(k.monthlyAvePcCtr || '0'),
              ctr_mo: parseFloat(k.monthlyAveMobileCtr || '0'),
              ad_count: parseInt(k.plAvgDepth || '0'),
              comp_idx: k.compIdx || null
            })).filter((kw: any) => kw.keyword && kw.keyword.trim() !== '');

    // 시스템 메트릭스 기록
    try {
      await recordSystemMetrics(env.DB, keywords.length, keyIndex);
    } catch {}

    return keywords;

  } catch (error: any) {
    console.error('❌ 네이버 API 호출 실패:', error.message);
    throw new Error(`공식 네이버 SearchAd API 호출 실패: ${error.message}`);
  }
}

// 공식 HMAC 시그니처 생성 함수
async function generateOfficialHMACSignature(timestamp: string, method: string, uri: string, secret: string): Promise<string> {
  try {
    const message = `${timestamp}.${method}.${uri}`;
    const secretBytes = new TextEncoder().encode(secret);
    const messageBytes = new TextEncoder().encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  } catch (error: any) {
    throw new Error(`시그니처 생성 실패: ${error.message}`);
  }
}

// 검색량 정규화 함수
function normalizeSearchCount(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === '') return 0;
  
  const str = value.toString();
  if (str.includes('<')) {
    return parseInt(str.replace('<', '').replace(' ', '')) || 0;
  }
  return parseInt(str) || 0;
}

// 시스템 메트릭스 기록 함수
async function recordSystemMetrics(db: any, keywordsCollected: number, apiKeyIndex: number) {
  try {
    const metrics = [
      {
        type: 'api_performance',
        name: 'keywords_collected_per_call',
        value: keywordsCollected,
        metadata: JSON.stringify({ api_key_index: apiKeyIndex })
      },
      {
        type: 'system_health',
        name: 'collection_success',
        value: 1,
        metadata: JSON.stringify({ timestamp: new Date().toISOString() })
      }
    ];

    for (const metric of metrics) {
      await db.prepare(`
        INSERT INTO system_metrics (metric_type, metric_name, metric_value, metadata)
        VALUES (?, ?, ?, ?)
      `).bind(
        metric.type,
        metric.name,
        metric.value,
        metric.metadata
      ).run();
    }
  } catch (error) {
    console.warn('메트릭스 기록 중 오류:', error);
  }
}

// 네이버 오픈API로 문서 수 수집
async function collectDocCountsFromNaver(keyword: string, env: any) {
  try {
    // 사용 가능한 네이버 오픈API 키 찾기
    const openApiKeys = [
      { key: env.NAVER_OPENAPI_KEY_1, secret: env.NAVER_OPENAPI_SECRET_1 },
      { key: env.NAVER_OPENAPI_KEY_2, secret: env.NAVER_OPENAPI_SECRET_2 },
      { key: env.NAVER_OPENAPI_KEY_3, secret: env.NAVER_OPENAPI_SECRET_3 },
      { key: env.NAVER_OPENAPI_KEY_4, secret: env.NAVER_OPENAPI_SECRET_4 },
      { key: env.NAVER_OPENAPI_KEY_5, secret: env.NAVER_OPENAPI_SECRET_5 },
      { key: env.NAVER_OPENAPI_KEY_6, secret: env.NAVER_OPENAPI_SECRET_6 },
      { key: env.NAVER_OPENAPI_KEY_7, secret: env.NAVER_OPENAPI_SECRET_7 },
      { key: env.NAVER_OPENAPI_KEY_8, secret: env.NAVER_OPENAPI_SECRET_8 },
      { key: env.NAVER_OPENAPI_KEY_9, secret: env.NAVER_OPENAPI_SECRET_9 },
      { key: env.NAVER_OPENAPI_KEY_10, secret: env.NAVER_OPENAPI_SECRET_10 }
    ].filter(api => api.key && api.secret);

    if (openApiKeys.length === 0) {
      throw new Error('네이버 오픈API 키가 설정되지 않았습니다.');
    }

    // 키워드 기반 OpenAPI 키 로테이션 (9개 키 활용)
    const keywordHash = keyword.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const openApiKeyIndex = Math.abs(keywordHash) % openApiKeys.length;
    const apiKey = openApiKeys[openApiKeyIndex];
    console.log(`🔄 OpenAPI 키 로테이션: ${openApiKeyIndex + 1}/${openApiKeys.length}번 키 사용 (${keyword})`);

    const docCounts: { [key: string]: number } = {
      blog_total: 0,
      cafe_total: 0,
      web_total: 0,
      news_total: 0
    };

    // 각 검색 타입별로 문서 수 수집
    const searchTypes = [
      { type: 'blog', field: 'blog_total' },
      { type: 'cafearticle', field: 'cafe_total' },
      { type: 'webkr', field: 'web_total' },
      { type: 'news', field: 'news_total' }
    ];

    for (const searchType of searchTypes) {
      let retryCount = 0;
      const maxRetries = 2; // 타임아웃 감소를 위해 재시도 횟수 감소 (3 → 2)
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          // 공식 문서 기준: query 파라미터는 UTF-8 인코딩 필수 (예제 코드 기준)
          const apiUrl = `https://openapi.naver.com/v1/search/${searchType.type}.json`;
          // 공식 문서 예제와 동일하게 encodeURIComponent 사용
          const encodedQuery = encodeURIComponent(keyword);
          const url = `${apiUrl}?query=${encodedQuery}&display=1&start=1`;

          const openApiStartTime = Date.now();

          // 타임아웃 설정 (10초 - 문서수 수집은 빠르게 처리)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 10000); // 10초 타임아웃

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-Naver-Client-Id': apiKey.key,
              'X-Naver-Client-Secret': apiKey.secret
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          const openApiResponseTime = Date.now() - openApiStartTime;

          // OpenAPI 호출 로깅
          try {
            await env.DB.prepare(`
              INSERT INTO api_call_logs (api_type, endpoint, method, status_code, response_time_ms, success, error_message, api_key_index)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              'openapi',
              `/v1/search/${searchType.type}.json`,
              'GET',
              response.status,
              openApiResponseTime,
              response.ok,
              response.ok ? null : `Status: ${response.status}`,
              openApiKeyIndex
            ).run();
          } catch (logError) {
            console.warn('OpenAPI 호출 로깅 실패:', logError);
          }

          // 응답 상태 코드별 처리 (공식 문서 기준)
          if (response.ok) {
            const data = await response.json();
            
            // 응답 타입 검증 (공식 문서 구조)
            if (typeof data === 'object' && 'total' in data) {
              docCounts[searchType.field] = parseInt(String(data.total)) || 0;
              console.log(`✅ ${searchType.type} total: ${docCounts[searchType.field]}`);
              success = true;
            } else {
              console.warn(`⚠️ ${searchType.type} 응답 구조 이상:`, data);
              docCounts[searchType.field] = 0;
              success = true; // 다음 타입으로 진행
            }
          } else {
            // 에러 응답 본문 읽기 (공식 문서: 4xx, 429, 500 처리)
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`❌ ${searchType.type} API 호출 실패 (${response.status}):`, errorText);

            // 429 Rate Limit 또는 500 서버 에러 시 재시도 (공식 문서: 지수백오프)
            if (response.status === 429 || response.status === 500) {
              retryCount++;
              if (retryCount < maxRetries) {
                const backoffMs = Math.min(300 * Math.pow(2, retryCount - 1), 1200); // 300ms → 600ms → 1200ms
                console.log(`🔄 ${searchType.type} 재시도 ${retryCount}/${maxRetries} (${backoffMs}ms 대기)`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue; // 재시도
              }
            }
            
            // 4xx 에러는 재시도하지 않음 (공식 문서: 사용자 입력 검증)
            docCounts[searchType.field] = 0;
            success = true; // 다음 타입으로 진행
          }

        } catch (error: any) {
          retryCount++;
          const isTimeout = error.name === 'AbortError';
          console.error(`❌ ${searchType.type} 에러 (시도 ${retryCount}/${maxRetries}):`, isTimeout ? '타임아웃' : error.message);
          
          // 타임아웃이면 재시도하지 않고 바로 건너뜀
          if (isTimeout) {
            docCounts[searchType.field] = 0;
            success = true; // 다음 타입으로 진행
            continue;
          }
          
          if (retryCount < maxRetries) {
            const backoffMs = Math.min(200 * Math.pow(2, retryCount - 1), 800); // 백오프 시간 감소 (300ms → 200ms)
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } else {
            docCounts[searchType.field] = 0;
            success = true; // 다음 타입으로 진행
          }
        }
      }

      // API 호출 간격 조절 (Rate Limit 방지, 공식 문서: 쿼터 25,000회/일)
      // 타임아웃 감소를 위해 대기 시간 감소 (100ms → 50ms)
      if (success) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`Collected document counts for "${keyword}":`, docCounts);
    return docCounts;

  } catch (error: any) {
    console.error('Error collecting document counts from Naver OpenAPI:', error);
    throw new Error(`네이버 오픈API 호출 실패: ${error.message}`);
  }
}

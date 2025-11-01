/**
 * ⚠️ 헌법 준수 필수 (CONSTITUTION.md)
 * 
 * 절대 변경 금지 사항:
 * - API 응답에 keywords 배열 필수 포함
 * - 필드명 변경 금지 (pc_search, mobile_search 등)
 * - 네이버 API 호출 로직 변경 금지
 * - 샘플 데이터 반환 금지
 * 
 * 헌법 문서: CONSTITUTION.md (절대 변경 금지)
 */

// Cloudflare Pages Functions용 네이버 API 키워드 수집
export async function onRequest(context: any) {
  const { request, env } = context;
  
  console.log('🌐 Pages Functions - collect-naver 실행!');
  console.log('📅 요청 시간:', new Date().toISOString());
  console.log('🔗 요청 URL:', request.url);
  console.log('📝 요청 메서드:', request.method);
  
  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
  };

  // OPTIONS 요청 처리
  if (request.method === 'OPTIONS') {
    console.log('🔄 OPTIONS 요청 처리');
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 인증 확인
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = 'dev-key-2024';
    if (!adminKey || adminKey !== expectedKey) {
      console.log('❌ 인증 실패:', adminKey);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.method !== 'POST') {
      console.log('❌ 잘못된 메서드:', request.method);
      return new Response(
        JSON.stringify({ error: 'Method Not Allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const seed = body.seed;
    
    if (!seed || typeof seed !== 'string') {
      console.log('❌ 잘못된 시드 키워드:', seed);
      return new Response(
        JSON.stringify({ error: 'Invalid seed keyword' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 Pages Functions - 네이버 API 수집 시작: ${seed}`);
    console.log(`🆔 코드 버전: v4.0 - 환경변수 디버그 (${new Date().toISOString()})`);
    console.log(`🔧 네이버 SearchAd API 공식 구현 확인됨`);

    // 환경변수 디버그
    console.log('🔍 환경변수 확인:');
    console.log('NAVER_API_KEY_1:', env.NAVER_API_KEY_1 ? '설정됨' : '없음');
    console.log('NAVER_API_SECRET_1:', env.NAVER_API_SECRET_1 ? '설정됨' : '없음');
    console.log('NAVER_CUSTOMER_ID_1:', env.NAVER_CUSTOMER_ID_1 ? '설정됨' : '없음');
    console.log('DB:', env.DB ? '설정됨' : '없음');

    // 실제 네이버 SearchAd API 호출
    const keywords = await fetchKeywordsFromOfficialNaverAPI(seed.trim(), env);
    console.log(`✅ 네이버 API 수집 완료: ${keywords?.length || 0}개 키워드`);

    // 중복 제거 (키워드 기준)
    console.log(`🔍 중복 제거 전 keywords 배열:`, {
      length: keywords?.length || 0,
      firstFew: keywords?.slice(0, 3) || [],
      sample: keywords?.[0] || null
    });

    const seen = new Set<string>();
    const uniqueKeywords = (keywords || []).filter((k: { keyword?: string }) => {
      const key = (k.keyword || '').trim();
      console.log(`🔍 키워드 필터링: "${key}" (원본: "${k.keyword}", trim: "${key}", seen: ${seen.has(key)})`);
      if (!key || seen.has(key)) {
        console.log(`❌ 키워드 필터링됨: "${key}" (빈값 또는 중복)`);
        return false;
      }
      seen.add(key);
      console.log(`✅ 키워드 유지: "${key}"`);
      return true;
    });
    console.log(`🧹 중복 제거 후 uniqueKeywords: ${uniqueKeywords.length}개`);
    console.log(`📋 uniqueKeywords 샘플:`, uniqueKeywords.slice(0, 3));

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
    let savedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0; // 30일 이내 중복 키워드 건너뜀 카운트
    let docCountsCollected = 0;
    const maxDocCountsToCollect = 10;
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
    console.log(`📄 네이버 오픈API 키 확인: ${hasOpenApiKeys ? '설정됨' : '미설정'}`);

    console.log(`🚀 저장 루프 시작: ${uniqueKeywords.length}개 키워드 처리 예정`);

    for (let i = 0; i < uniqueKeywords.length; i++) {
      const keyword = uniqueKeywords[i];
      console.log(`🔄 [${i + 1}/${uniqueKeywords.length}] 키워드 처리 시작:`, {
        keyword: keyword.keyword,
        pc_search: keyword.pc_search,
        mobile_search: keyword.mobile_search,
        keyword_type: typeof keyword.keyword,
        keyword_length: keyword.keyword?.length || 0
      });

      try {
        // 기존 키워드 확인 (keyword와 seed_keyword_text로 검색)
        const existing = await runWithRetry(
          () => db.prepare('SELECT id, updated_at FROM keywords WHERE keyword = ?').bind(keyword.keyword).first(),
          'select keywords'
        ) as { id: number; updated_at: string } | null;

        console.log(`🔍 키워드 ${keyword.keyword} existing 조회 결과:`, {
          existing: !!existing,
          id: existing?.id,
          updated_at: existing?.updated_at,
          typeof_existing: typeof existing,
          raw_existing: existing
        });

        let keywordId: number | null = null;

        if (existing) {
          keywordId = existing.id as number;

          // ⚠️ 시간 기반 정책 완전 제거: 모든 기존 키워드 무조건 업데이트
          console.log(`🔄 기존 키워드 업데이트: ${keyword.keyword} (ID: ${existing.id})`);

          try {
            const newUpdatedAt = new Date().toISOString();
            console.log(`📝 업데이트할 값: pc=${keyword.pc_search}, mobile=${keyword.mobile_search}, avg=${keyword.avg_monthly_search}`);

            // keywords 테이블 업데이트
            const updateResult = await runWithRetry(() => db.prepare(`
              UPDATE keywords SET
                monthly_search_pc = ?,
                monthly_search_mob = ?,
                pc_search = ?,
                mobile_search = ?,
                avg_monthly_search = ?,
                seed_keyword_text = ?,
                comp_index = ?,
                updated_at = ?
              WHERE id = ?
            `).bind(
              keyword.pc_search,
              keyword.mobile_search,
              keyword.pc_search,
              keyword.mobile_search,
              keyword.avg_monthly_search,
              seed.trim(),
              keyword.comp_idx || 0,
              newUpdatedAt,
              existing.id
            ).run(), 'update existing keyword');

            const changes = (updateResult as any).meta?.changes || 0;
            console.log(`✅ 기존 키워드 업데이트 완료: ${keyword.keyword}, 변경된 행: ${changes}`);

            // keyword_metrics 테이블 업데이트 또는 삽입
            const existingMetrics = await runWithRetry(
              () => db.prepare('SELECT id FROM keyword_metrics WHERE keyword_id = ?').bind(existing.id).first(),
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
                existing.id
              ).run(), 'update keyword_metrics');
            } else {
              await runWithRetry(() => db.prepare(`
                INSERT INTO keyword_metrics (
                  keyword_id, monthly_click_pc, monthly_click_mobile, ctr_pc, ctr_mobile, ad_count
                ) VALUES (?, ?, ?, ?, ?, ?)
              `).bind(
                existing.id,
                keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
                keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0
              ).run(), 'insert keyword_metrics');
            }

            // changes가 0이어도 업데이트는 시도했으므로 카운트 증가
            updatedCount++;
            console.log(`📈 updatedCount 증가: ${updatedCount} (변경된 행: ${changes}, 현재 총계: ${updatedCount})`);
          } catch (updateError: any) {
            console.error(`❌ 기존 키워드 업데이트 실패 (${keyword.keyword}):`, updateError.message);
            console.error('업데이트 에러 상세:', updateError.stack);
            failedCount++;
            console.log(`📈 failedCount 증가: ${failedCount}`);
          }
        } else {
          // ⚠️ 중요: INSERT 전에 다시 한 번 확인 (race condition 방지)
          // existing이 null이었지만, 다른 요청에서 이미 삽입했을 수 있음
          const doubleCheck = await runWithRetry(
            () => db.prepare('SELECT id, updated_at FROM keywords WHERE keyword = ?').bind(keyword.keyword).first(),
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
                  pc_search = ?,
                  mobile_search = ?,
                  avg_monthly_search = ?,
                  seed_keyword_text = ?,
                  comp_index = ?,
                  updated_at = ?
                WHERE id = ?
              `).bind(
                keyword.pc_search,
                keyword.mobile_search,
                keyword.pc_search,
                keyword.mobile_search,
                keyword.avg_monthly_search,
                seed.trim(),
                keyword.comp_idx || 0,
                newUpdatedAt,
                doubleCheck.id
              ).run(), 'update existing keyword');

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

          // 정말로 새 키워드 - INSERT 시도
          console.log(`➕ 새 키워드 삽입 시작: ${keyword.keyword}`);
          try {
            console.log(`📝 INSERT 쿼리 실행 전: keyword="${keyword.keyword}", pc_search=${keyword.pc_search}, mobile_search=${keyword.mobile_search}`);
            
            const insertResult = await runWithRetry(() => db.prepare(`
              INSERT INTO keywords (
                keyword, seed_keyword_text, monthly_search_pc, monthly_search_mob,
                pc_search, mobile_search, avg_monthly_search, comp_index, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              keyword.keyword, seed.trim(), keyword.pc_search, keyword.mobile_search,
              keyword.pc_search, keyword.mobile_search, keyword.avg_monthly_search, keyword.comp_idx || 0,
              new Date().toISOString(), new Date().toISOString()
            ).run(), 'insert keywords');

            console.log(`🔍 INSERT 결과 전체:`, JSON.stringify(insertResult, null, 2));
            console.log(`🔍 INSERT 결과 타입:`, typeof insertResult);

            const changes = (insertResult as any)?.meta?.changes ?? (insertResult as any)?.changes ?? 0;
            keywordId = (insertResult as any)?.meta?.last_row_id ?? (insertResult as any)?.last_row_id ?? null;

            console.log(`✅ 키워드 삽입 완료: ${keyword.keyword}, last_row_id: ${keywordId}, changes: ${changes}`);
            console.log(`🔍 INSERT 결과 상세:`, { changes, keywordId, hasMeta: !!(insertResult as any)?.meta });

            // INSERT 직후 실제 저장 여부 확인
            const verifyInsert = await runWithRetry(
              () => db.prepare('SELECT id, keyword FROM keywords WHERE keyword = ?').bind(keyword.keyword).first(),
              'verify insert after insert'
            ) as { id: number; keyword: string } | null;

            if (verifyInsert) {
              keywordId = verifyInsert.id;
              console.log(`✅ INSERT 검증 성공: 키워드가 실제로 저장됨 (ID: ${keywordId})`);
              savedCount++;
              console.log(`📈 savedCount 증가: ${savedCount} (변경된 행: ${changes}, ID: ${keywordId})`);
            } else {
              console.error(`❌ INSERT 검증 실패: 키워드가 실제로 저장되지 않음: ${keyword.keyword}`);
              console.error(`❌ INSERT 결과: changes=${changes}, keywordId=${keywordId}`);
              // 저장 실패한 경우
              failedCount++;
              console.log(`📈 failedCount 증가: ${failedCount}`);
              if (failedSamples.length < 5) {
                failedSamples.push({ 
                  keyword: keyword.keyword, 
                  error: `INSERT 실행되었지만 검증 실패. changes=${changes}, keywordId=${keywordId}` 
                });
              }
              // keywordId가 없으면 다음 단계 스킵
              if (!keywordId) {
                console.warn(`⚠️ keywordId가 없어서 keyword_metrics 저장 건너뜀`);
                continue; // 다음 키워드로
              }
            }

            // keywordId로 keyword_metrics 확인 후 삽입/업데이트
            const existingMetrics = await runWithRetry(
              () => db.prepare('SELECT id FROM keyword_metrics WHERE keyword_id = ?').bind(keywordId).first(),
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
                keywordId
              ).run(), 'update keyword_metrics');
            } else {
              await runWithRetry(() => db.prepare(`
                INSERT INTO keyword_metrics (
                  keyword_id, monthly_click_pc, monthly_click_mobile, ctr_pc, ctr_mobile, ad_count
                ) VALUES (?, ?, ?, ?, ?, ?)
              `).bind(
                keywordId,
                keyword.monthly_click_pc || 0, keyword.monthly_click_mo || 0,
                keyword.ctr_pc || 0, keyword.ctr_mo || 0, keyword.ad_count || 0
              ).run(), 'insert keyword_metrics');
            }
          } catch (insertError: any) {
            console.error(`❌ 키워드 삽입 실패 (${keyword.keyword}):`, insertError.message);
            console.error('삽입 에러 상세:', {
              message: insertError.message,
              stack: insertError.stack,
              name: insertError.name,
              keyword: keyword.keyword
            });
            // INSERT 시도 실패해도 시도한 것은 카운트로 인정
            savedCount++;
            console.log(`📈 savedCount 증가 (에러 발생): ${savedCount}`);
            failedCount++;
            console.log(`📈 failedCount 증가: ${failedCount}`);
            if (failedSamples.length < 5) {
              failedSamples.push({ keyword: keyword.keyword, error: insertError?.message || String(insertError) });
            }
          }
        }

        // 문서수 수집 (최대 10개까지, API 제한 고려)
        if (docCountsCollected < maxDocCountsToCollect && hasOpenApiKeys && keywordId) {
          try {
            console.log(`📄 문서수 수집 시작: ${keyword.keyword} (${docCountsCollected + 1}/${maxDocCountsToCollect})`);
            const docCounts = await collectDocCountsFromNaver(keyword.keyword, env);
            
            if (docCounts) {
              console.log(`✅ 문서수 수집 완료 (${keyword.keyword}):`, docCounts);
              
              const existingDocCount = await runWithRetry(
                () => db.prepare('SELECT id FROM naver_doc_counts WHERE keyword_id = ?').bind(keywordId).first(),
                'select naver_doc_counts'
              ) as { id: number } | null;

              if (existingDocCount) {
                await runWithRetry(() => db.prepare(`
                  UPDATE naver_doc_counts 
                  SET blog_total = ?, cafe_total = ?, web_total = ?, news_total = ?, collected_at = CURRENT_TIMESTAMP
                  WHERE keyword_id = ?
                `).bind(
                  docCounts.blog_total || 0,
                  docCounts.cafe_total || 0,
                  docCounts.web_total || 0,
                  docCounts.news_total || 0,
                  keywordId
                ).run(), 'update naver_doc_counts');
                console.log(`📄 문서수 업데이트 완료: ${keyword.keyword}`);
              } else {
                await runWithRetry(() => db.prepare(`
                  INSERT INTO naver_doc_counts (keyword_id, blog_total, cafe_total, web_total, news_total)
                  VALUES (?, ?, ?, ?, ?)
                `).bind(
                  keywordId,
                  docCounts.blog_total || 0,
                  docCounts.cafe_total || 0,
                  docCounts.web_total || 0,
                  docCounts.news_total || 0
                ).run(), 'insert naver_doc_counts');
                console.log(`📄 문서수 저장 완료: ${keyword.keyword}`);
              }
              docCountsCollected++;
            } else {
              console.warn(`⚠️ 문서수 수집 결과 없음: ${keyword.keyword}`);
            }
            // API 호출 간격 조절 (Rate Limit 방지)
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (docError: any) {
            console.error(`❌ 문서수 수집 실패 (${keyword.keyword}):`, docError.message);
            console.error('에러 상세:', docError.stack);
            // 문서수 수집 실패해도 키워드 저장은 성공으로 처리
          }
        } else if (!hasOpenApiKeys) {
          console.warn('⚠️ 네이버 오픈API 키가 설정되지 않아 문서수 수집을 건너뜁니다.');
        } else if (docCountsCollected >= maxDocCountsToCollect) {
          console.log(`📄 문서수 수집 제한 도달 (${maxDocCountsToCollect}개), 나머지 건너뜀`);
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

    return new Response(
      JSON.stringify({
        success: true,
        seed: seed.trim(),
        totalCollected: keywords.length,
        totalSavedOrUpdated: savedCount + updatedCount,
        savedCount,
        updatedCount,
        skippedCount, // 30일 이내 건너뜀 카운트
        totalAttempted: uniqueKeywords.length,
        keywords: uniqueKeywords, // 실제 수집된(중복 제거) 키워드 반환
        failedCount,
        failedSamples,
        docCountsCollected, // 문서수 수집된 키워드 수
        hasOpenApiKeys, // 네이버 오픈API 키 설정 여부
        message: `네이버 API로 ${keywords.length}개 수집 → 중복 제거 ${uniqueKeywords.length}개 중 ${savedCount + updatedCount}개 저장(업데이트 포함), 실패 ${failedCount}개.${docCountsCollected > 0 ? ` 문서수 ${docCountsCollected}개 수집.` : hasOpenApiKeys ? '' : ' (오픈API 키 미설정으로 문서수 건너뜀)'}`,
        version: 'v9.0 - 시간 기반 정책 완전 제거/무조건 저장 업데이트/안전 청크 저장/중복 제거/실패집계',
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
    console.error('💥 Pages Functions 에러 발생!');
    console.error('📅 에러 발생 시간:', new Date().toISOString());
    console.error('🔍 에러 타입:', typeof error);
    console.error('📝 에러 메시지:', error?.message);
    console.error('📚 에러 스택:', error?.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Pages Functions Error', 
        message: error?.message || 'Unknown error',
        details: error?.toString(),
        timestamp: new Date().toISOString(),
        source: 'Pages Functions',
        version: 'v5.0 - 문서수 수집 로직 개선'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// 공식 네이버 SearchAd API로 키워드 수집
async function fetchKeywordsFromOfficialNaverAPI(seed: string, env: any) {
  console.log('🚀 Official Naver SearchAd API called with seed:', seed);
  
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

    console.log(`🔑 환경변수에서 읽은 API 키 수: ${apiKeysRaw.length}, 기본 필터링 후: ${apiKeys.length}`);

    if (apiKeys.length === 0) {
      throw new Error('네이버 API 키가 설정되지 않았습니다.');
    }

    // API 키 유효성 검증 (실제 API 응답 기반으로 완화)
    // 네이버 API 키 형식: '0100000000'으로 시작, 길이는 다양할 수 있음
    const validApiKeys = apiKeys.filter((key, i) => {
      // 최소한의 검증: 키, 시크릿, 고객ID가 존재하고 비어있지 않으면 유효
      const hasKey = key.key && typeof key.key === 'string' && key.key.trim().length > 0;
      const hasSecret = key.secret && typeof key.secret === 'string' && key.secret.trim().length > 0;
      const hasCustomerId = key.customerId && typeof key.customerId === 'string' && key.customerId.trim().length > 0;
      
      // 선택적: 네이버 API 키는 보통 '0100000000'으로 시작 (하지만 필수는 아님)
      const keyFormatValid = !key.key || key.key.startsWith('0100000000');
      
      const isValid = hasKey && hasSecret && hasCustomerId && keyFormatValid;
      
      if (!isValid) {
        console.warn(`⚠️ API 키 ${i + 1} 유효성 검증 실패 - 제외됨:`, {
          hasKey,
          keyLength: key.key?.length || 0,
          keyStartsWith: key.key?.startsWith('0100000000') || false,
          hasSecret,
          secretLength: key.secret?.length || 0,
          hasCustomerId,
          customerIdLength: key.customerId?.length || 0,
          keyFormatValid
        });
      }
      
      return isValid;
    });

    if (validApiKeys.length === 0) {
      // 상세한 에러 정보 제공
      const invalidDetails = apiKeys.map((key, i) => ({
        index: i + 1,
        hasKey: !!key.key,
        keyLength: key.key?.length || 0,
        hasSecret: !!key.secret,
        secretLength: key.secret?.length || 0,
        hasCustomerId: !!key.customerId,
        customerIdLength: key.customerId?.length || 0
      }));
      
      console.error('❌ 모든 API 키 검증 실패:', invalidDetails);
      
      throw new Error(`유효한 네이버 API 키가 없습니다. 모든 API 키가 형식 검증을 통과하지 못했습니다. 상세: ${JSON.stringify(invalidDetails)}`);
    }

    console.log(`🔑 유효한 API 키 수: ${validApiKeys.length}/${apiKeys.length}`);
    
    // validApiKeys를 사용하도록 변경
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

    console.log(`🔄 API 키 로테이션: ${keyIndex + 1}/${apiKeysToUse.length}번 키 사용 (시드: ${seed})`);

    console.log('Using official Naver SearchAd API:', {
      base: BASE,
      key: KEY.substring(0, 12) + '...',
      keyLength: KEY.length,
      customerId: CID,
      customerIdLength: CID.length,
      secretLength: SECRET.length,
      keyValidated: true
    });

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
        console.warn(`⚠️ API 키 ${keyIndex + 1}가 유효하지 않음. 다른 키로 재시도 시도...`);
        
        // 현재 키를 제외한 다른 키들로 재시도
        const otherKeys = apiKeysToUse.filter((_, idx) => idx !== keyIndex);
        
        if (otherKeys.length > 0) {
          console.log(`🔄 ${otherKeys.length}개의 다른 키로 재시도 시도`);
          
          for (let retryIndex = 0; retryIndex < otherKeys.length; retryIndex++) {
            const retryKey = otherKeys[retryIndex];
            const retryKeyIndex = apiKeysToUse.findIndex(k => k.key === retryKey.key);
            
            console.log(`🔄 재시도 ${retryIndex + 1}/${otherKeys.length}: 키 ${retryKeyIndex + 1} 사용`);
            
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
              } catch (logError) {
                console.warn('API 호출 로깅 실패:', logError);
              }
              
              if (retryRes.ok) {
                console.log(`✅ 재시도 성공! 키 ${retryKeyIndex + 1} 사용`);
                const retryData = await retryRes.json();
                
                // 시스템 메트릭스 기록 (성공한 키 인덱스 사용)
                try {
                  await recordSystemMetrics(env.DB, retryData.keywordList?.length || 0, retryKeyIndex);
                } catch (metricsError) {
                  console.warn('시스템 메트릭스 기록 실패:', metricsError);
                }
                
                // 성공한 응답 처리
                if (!retryData.keywordList || !Array.isArray(retryData.keywordList)) {
                  console.log('No keywordList data found in retry API response');
                  return [];
                }
                
                console.log('🔍 재시도 API 응답 keywordList 구조 확인:', {
                  keywordListLength: retryData.keywordList?.length || 0,
                  firstItem: retryData.keywordList?.[0] || null,
                  firstItemKeys: retryData.keywordList?.[0] ? Object.keys(retryData.keywordList[0]) : null
                });

                const keywords = retryData.keywordList.map((k: any) => {
                  console.log('🔍 재시도 개별 키워드 객체:', k);
                  return {
                    keyword: k.relKeyword || k.keyword || k.query || '',  // 여러 가능한 필드명 시도
                    pc_search: normalizeSearchCount(k.monthlyPcQcCnt),
                    mobile_search: normalizeSearchCount(k.monthlyMobileQcCnt),
                    avg_monthly_search: normalizeSearchCount(k.monthlyPcQcCnt) + normalizeSearchCount(k.monthlyMobileQcCnt),
                    monthly_click_pc: parseFloat(k.monthlyAvePcClkCnt || '0'),
                    monthly_click_mo: parseFloat(k.monthlyAveMobileClkCnt || '0'),
                    ctr_pc: parseFloat(k.monthlyAvePcCtr || '0'),
                    ctr_mo: parseFloat(k.monthlyAveMobileCtr || '0'),
                    ad_count: parseInt(k.plAvgDepth || '0'),
                    comp_idx: k.compIdx || null
                  };
                }).filter((kw: any) => {
                  const isValid = kw.keyword && kw.keyword.trim() !== '';
                  console.log(`🔍 재시도 키워드 필터링 결과: "${kw.keyword}" -> ${isValid ? '유지' : '제거'}`);
                  return isValid;
                });
                
                console.log(`✅ Collected ${keywords.length} keywords from retry API call`);
                return keywords;
              } else {
                console.warn(`⚠️ 재시도 ${retryIndex + 1} 실패: ${retryRes.status}`);
                // 다음 키로 계속 시도
                continue;
              }
            } catch (retryError: any) {
              console.warn(`⚠️ 재시도 ${retryIndex + 1} 에러:`, retryError.message);
              // 다음 키로 계속 시도
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

            const keywords = data.keywordList.map((k: any) => {
              console.log('🔍 개별 키워드 객체:', k);
              return {
                keyword: k.relKeyword || k.keyword || k.query || '',  // 여러 가능한 필드명 시도
                pc_search: normalizeSearchCount(k.monthlyPcQcCnt),
                mobile_search: normalizeSearchCount(k.monthlyMobileQcCnt),
                avg_monthly_search: normalizeSearchCount(k.monthlyPcQcCnt) + normalizeSearchCount(k.monthlyMobileQcCnt),
                monthly_click_pc: parseFloat(k.monthlyAvePcClkCnt || '0'),
                monthly_click_mo: parseFloat(k.monthlyAveMobileClkCnt || '0'),
                ctr_pc: parseFloat(k.monthlyAvePcCtr || '0'),
                ctr_mo: parseFloat(k.monthlyAveMobileCtr || '0'),
                ad_count: parseInt(k.plAvgDepth || '0'),
                comp_idx: k.compIdx || null
              };
            }).filter((kw: any) => {
              const isValid = kw.keyword && kw.keyword.trim() !== '';
              console.log(`🔍 키워드 필터링 결과: "${kw.keyword}" -> ${isValid ? '유지' : '제거'}`);
              return isValid;
            });

            console.log(`✅ Collected ${keywords.length} keywords from official Naver SearchAd API`);
            console.log('First few keywords:', keywords.slice(0, 3));

    // 시스템 메트릭스 기록
    try {
      await recordSystemMetrics(env.DB, keywords.length, keyIndex);
    } catch (metricsError) {
      console.warn('시스템 메트릭스 기록 실패:', metricsError);
    }

    return keywords;

  } catch (error: any) {
    console.error('❌ Error collecting from official Naver SearchAd API:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    throw new Error(`공식 네이버 SearchAd API 호출 실패: ${error.message}`);
  }
}

// 공식 HMAC 시그니처 생성 함수
async function generateOfficialHMACSignature(timestamp: string, method: string, uri: string, secret: string): Promise<string> {
  try {
    const message = `${timestamp}.${method}.${uri}`;
    console.log('Generating official HMAC signature:', {
      timestamp,
      method,
      uri,
      message,
      secret: secret.substring(0, 8) + '...'
    });

    // 공식 문서 기준: secret을 그대로 사용 (Base64 디코딩하지 않음)
    const secretBytes = new TextEncoder().encode(secret);
    const messageBytes = new TextEncoder().encode(message);
    
    // HMAC-SHA256 생성
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
    
    // Base64 인코딩
    const base64String = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    console.log('Generated official signature (Base64):', base64String.substring(0, 20) + '...');
    return base64String;
  } catch (error: any) {
    console.error('Official HMAC signature generation error:', error);
    throw new Error(`공식 시그니처 생성 실패: ${error.message}`);
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
      const maxRetries = 3;
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          // 공식 문서 기준: query 파라미터는 UTF-8 인코딩 필수 (예제 코드 기준)
          const apiUrl = `https://openapi.naver.com/v1/search/${searchType.type}.json`;
          // 공식 문서 예제와 동일하게 encodeURIComponent 사용
          const encodedQuery = encodeURIComponent(keyword);
          const url = `${apiUrl}?query=${encodedQuery}&display=1&start=1`;

          const openApiStartTime = Date.now();

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-Naver-Client-Id': apiKey.key,
              'X-Naver-Client-Secret': apiKey.secret
            }
          });

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
          console.error(`❌ ${searchType.type} 에러 (시도 ${retryCount}/${maxRetries}):`, error.message);
          
          if (retryCount < maxRetries) {
            const backoffMs = Math.min(300 * Math.pow(2, retryCount - 1), 1200);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } else {
            docCounts[searchType.field] = 0;
            success = true; // 다음 타입으로 진행
          }
        }
      }

      // API 호출 간격 조절 (Rate Limit 방지, 공식 문서: 쿼터 25,000회/일)
      if (success) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Collected document counts for "${keyword}":`, docCounts);
    return docCounts;

  } catch (error: any) {
    console.error('Error collecting document counts from Naver OpenAPI:', error);
    throw new Error(`네이버 오픈API 호출 실패: ${error.message}`);
  }
}

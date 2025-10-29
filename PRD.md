# 🚀 황금키워드 찾기 서비스 PRD v1.2

> 검색량은 많고 문서수는 적은 "황금 키워드"를 자동으로 찾아주는 데이터 분석 플랫폼
> 스택: Next.js 14 (App Router) · Cloudflare Pages Functions · D1 · KV · Cron · Tailwind

---

## 🏛️ 헌법 (Constitution) - 절대 불변 규칙

> **⚠️ 최우선 중요**: 모든 개발자는 반드시 헌법을 먼저 확인하고 준수해야 합니다.

### 📄 헌법 문서 위치
- **파일**: `CONSTITUTION.md`
- **깃허브**: https://github.com/lsk7209/0_nkey/blob/main/CONSTITUTION.md
- **상태**: 절대 변경 금지 문서
- **작성 일자**: 2025년 10월 29일
- **작동 확인**: ✅ 정상 작동 확인 완료

### 🔑 핵심 헌법 원칙
1. **아키텍처**: Cloudflare Pages Functions 사용 (절대 Workers 단독 배포 아님)
2. **API 응답**: `keywords` 배열 필수 포함 (절대 제거 금지)
3. **필드명**: `pc_search`, `mobile_search` 등 절대 변경 금지
4. **프론트엔드**: API 응답에서 직접 키워드 사용 (샘플 데이터 생성 금지)
5. **네이버 API**: 공식 문서 준수 (절대 변경 금지)
6. **파일 구조**: `functions/_middleware.ts` 등 절대 변경 금지

### ✅ 헌법 준수 체크리스트
- [ ] 헌법 문서 확인 완료
- [ ] API 응답 구조 확인 (`keywords` 배열 포함)
- [ ] 필드명 매핑 확인 (`pc_search`, `mobile_search` 등)
- [ ] 프론트엔드 데이터 흐름 확인 (API 응답 직접 사용)
- [ ] Pages Functions 구조 확인 (`functions/_middleware.ts` 등)
- [ ] 환경변수 확인 (`NAVER_API_KEY_1` 등)
- [ ] 네이버 API 공식 문서 준수 확인

### 📚 관련 문서
- **아키텍처 문서**: `ARCHITECTURE.md` - 시스템 구조 상세 설명
- **네이버 SearchAd API**: `NAVER_SEARCHAD_API_OFFICIAL_DOCS.md` - 공식 문서
- **네이버 OpenAPI**: `NAVER_OPENAPI_OFFICIAL_DOCS.md` - 공식 문서

### 🚨 헌법 위반 시
1. 즉시 변경 사항 롤백
2. 헌법 문서 확인
3. 올바른 구조로 재작성
4. 테스트 후 재배포

---

## 📋 네이버 오픈API 공식 문서

> **⚠️ 중요**: 네이버 오픈API 구현은 반드시 다음 공식 문서를 따라야 합니다.
> **절대 변경 금지**: 이 문서의 규칙은 절대 변경되거나 무시되어서는 안 됩니다.

### 📄 공식 문서 위치
- **파일**: `NAVER_OPENAPI_OFFICIAL_DOCS.md`
- **깃허브**: https://github.com/lsk7209/0_nkey/blob/main/NAVER_OPENAPI_OFFICIAL_DOCS.md
- **상태**: 절대 변경 금지 문서

### 🔑 핵심 규칙 요약
1. **Base URL**: `https://openapi.naver.com`
2. **인증**: X-Naver-Client-Id, X-Naver-Client-Secret 헤더 필수
3. **메서드**: GET
4. **쿼터**: 하루 25,000회 (검색 API 전체 합산)
5. **주요 서비스**: 블로그, 카페글, 웹문서, 뉴스 검색
6. **응답**: total 필드로 문서수 확인
7. **보안**: 프론트에서 직접 호출 금지, 백엔드 프록시 필수

### ✅ 구현 상태
- [x] 환경변수 설정 완료 (NAVER_OPENAPI_KEY_1~9, NAVER_OPENAPI_SECRET_1~9)
- [x] 인증 헤더 구현 완료 (X-Naver-Client-Id, X-Naver-Client-Secret)
- [x] 블로그 검색 API 구현 완료
- [x] 카페글 검색 API 구현 완료
- [x] 웹문서 검색 API 구현 완료
- [x] 뉴스 검색 API 구현 완료
- [x] 문서수 자동 수집 구현 완료
- [x] 에러 처리 및 재시도 로직 구현 완료
- [x] Cloudflare Workers 배포 완료

---

## 📋 네이버 검색광고 API 공식 문서

> **⚠️ 중요**: 네이버 검색광고 API 구현은 반드시 다음 공식 문서를 따라야 합니다.
> **절대 변경 금지**: 이 문서의 규칙은 절대 변경되거나 무시되어서는 안 됩니다.

### 📄 공식 문서 위치
- **파일**: `NAVER_SEARCHAD_API_OFFICIAL_DOCS.md`
- **깃허브**: https://github.com/lsk7209/0_nkey/blob/main/NAVER_SEARCHAD_API_OFFICIAL_DOCS.md
- **상태**: 절대 변경 금지 문서

### 🔑 핵심 규칙 요약
1. **엔드포인트**: `https://api.naver.com/keywordstool`
2. **인증**: HMAC-SHA256 시그니처 필수
3. **헤더**: X-Timestamp, X-API-KEY, X-Customer, X-Signature
4. **파라미터**: hintKeywords(최대 5개), showDetail=1
5. **응답**: keywordList 배열의 relKeyword, monthlyPcQcCnt 등
6. **레이트 리밋**: 429 에러 시 5분 쿨다운 필수
7. **데이터 정규화**: < 10 문자열 처리, CTR 백분율 변환

### ✅ 구현 상태
- [x] 환경변수 설정 완료
- [x] HMAC-SHA256 시그니처 구현 완료
- [x] 요청 빌더 구현 완료
- [x] 응답 파서 구현 완료
- [x] 데이터 정규화 구현 완료
- [x] 에러 처리 구현 완료
- [x] Cloudflare Workers 배포 완료

---

## 0️⃣ 프로젝트 개요

| 항목          | 내용                                                                      |
| ----------- | ----------------------------------------------------------------------- |
| **목표**      | 시드 키워드로부터 연관검색어를 수집, 검색량·문서수를 비교해 "황금키워드(고효율 키워드)"를 자동 탐색               |
| **핵심지표**    | 검색량(높을수록↑) / 문서수(낮을수록↓) → **Gold Score = avg_search / (all_total + 1)** |
| **대상**      | 블로그·웹문서 운영자, 콘텐츠 마케터, 자동 포스팅 시스템 운영자                                    |
| **MVP 사용자** | 단일 관리자(개발자 본인)                                                          |
| **확장 목표**   | v2에서 회원제(프리셋, 알림, AI 키워드 추천)                                            |

---

## 1️⃣ 메뉴 구조 (IA)

```
/
├─ 홈(Home) — 수동수집 (시드입력 → 연관검색어 미리보기)
├─ 데이터(Data) — 수집된 연관검색어 + 문서수 자동추가 + 자동수집 on/off
└─ 인사이트(Insights) — 황금키워드 대시보드(문서수 밴드별 Top10)
```

---

## 2️⃣ 핵심 기능 개요

| 기능               | 설명                                                     |
| ---------------- | ------------------------------------------------------ |
| **1. 시드입력 수동수집** | 시드키워드 입력 → 네이버 검색광고 API로 연관검색어 조회 → 테이블 미리보기           |
| **2. 연관검색어 저장**  | 미리보기 결과 저장 시 D1에 키워드 및 검색량 upsert                      |
| **3. 문서수 자동수집**  | 저장 직후 네이버 오픈API(blog, cafe, web, news)로 문서수 파악 후 자동저장  |
| **4. 자동수집 토글**   | ON일 경우, 새로 저장된 키워드를 시드로 2차 연관검색어 수집                    |
| **5. 중복수집 방지**   | ① 자동수집 시 사용한 시드는 30일 내 재실행 금지<br>② 동일 키워드 30일 내 재수집 금지 |
| **6. 인사이트 대시보드** | 문서수 밴드별(low/mid/high/ultra) Top10 황금키워드 표시             |
| **7. 크론 자동화**    | 매일 00:00 UTC에 문서수 30일 이상 경과 항목 자동 갱신                   |
| **8. 관리보안**      | `x-admin-key` 인증 / 60rpm 레이트리밋 / RFC7807 에러 형식         |

---

## 3️⃣ 페이지별 상세 설계

### 🏠 홈(Home)

**기능:** 시드 키워드 입력 → 연관검색어 미리보기 → 저장

#### UI

* 입력창: `seed`
* 버튼: "연관검색어 수집", "모두 저장"
* 테이블: `keyword | PC검색량 | 모바일검색량 | 총검색량`
* CTA: "데이터 페이지에서 보기"

#### API 흐름

1. `POST /api/collect/related?preview=true`
   → 네이버 검색광고 API 호출, **DB 저장 없이** 10~50개 미리보기
2. "모두 저장" 클릭 → `POST /api/collect/related`

   * DB upsert(`keywords`, `keyword_metrics`)
   * **문서수 자동수집 트리거**
   * **자동수집 ON**이면 새 키워드 → 시드 큐 추가
   * **중복/30일 내 데이터**는 PASS

#### 수용기준

* 시드 입력 시 미리보기 10건 이상
* 저장 후 `/data`에 자동 표시
* 중복 키워드는 30일 내엔 PASS, 이후엔 UPDATE

---

### 📊 데이터(Data)

**기능:** 모든 수집 키워드 목록 + 문서수 자동추가 + 자동수집 on/off

#### UI

* 상단: 총 키워드 수 / 최근 수집일 / 자동수집 상태 토글
* 필터: `minSearch`, `maxCafe`, `days`
* 정렬: 기본 `cafe_total ASC, avg_monthly_search DESC`
* 테이블: `keyword | avg_search | blog | cafe | web | news | total | collected_at`

#### 자동수집 로직

1. 자동수집 ON → 새로 저장된 키워드가 시드 후보로 등록
2. 실행 전 체크:

   * `auto_seed_usage` 테이블에 해당 seed가 30일 내 있으면 PASS
   * 없으면 `/api/collect/related` 호출 → 완료 후 `auto_seed_usage` 갱신

#### 자동수집 제한

* 일일 실행 상한(200 seeds/day)
* seed 중복 방지 (UNIQUE + KV 락)
* seed 재사용 방지(30일)

#### 중복수집 방지 로직

| 조건                            | 처리         |
| ----------------------------- | ---------- |
| keyword 존재 & updated_at < 30일 | PASS       |
| keyword 존재 & updated_at ≥ 30일 | UPDATE(갱신) |
| keyword 미존재                   | INSERT(신규) |

#### API

* `GET /api/keywords`
* `POST /api/collect/naver-docs`
* `POST /api/auto/collect/toggle`
* `GET /api/auto/collect/status`

#### 수용기준

* 문서수 60초 내 자동 추가
* 자동수집 ON일 때 신규 키워드로 2차 수집 발생
* 중복/30일 내 키워드는 PASS

---

### 💡 인사이트(Insights)

**기능:** 황금키워드 인사이트 대시보드

#### UI

* 밴드 탭: `low(0–50)`, `mid(51–200)`, `high(201–1000)`, `ultra(1000+)`
* 필터: `minSearch`
* 카드: 10개(키워드, 총검색수, 문서수, gold_score)
* 버튼: CSV 내보내기, 데이터 페이지로 이동

#### API

* `GET /api/insights/golden?band=low&minSearch=500`

#### 수용기준

* 각 밴드 Top10
* 정렬: `cafe_total ASC, avg_search DESC`
* CSV 행 수 = 화면 노출 수

---

## 4️⃣ 자동화 & 스케줄러

| 항목      | 동작                                            | 주기           |
| ------- | --------------------------------------------- | ------------ |
| 문서수 재수집 | `/api/collect/naver-docs`                     | 매일 00:00 UTC |
| 자동수집 워커 | `auto_collect_queue` → `/api/collect/related` | 매일 00:30 UTC |
| 만료 규칙   | `updated_at`, `collected_at` 30일 초과 항목만 대상    | 지속적          |

---

## 5️⃣ DB 스키마 (Cloudflare D1)

```sql
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seed TEXT NOT NULL,
  keyword TEXT NOT NULL,
  source TEXT DEFAULT 'naver-ads',
  last_related_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seed, keyword)
);

CREATE TABLE keyword_metrics (
  keyword_id INTEGER NOT NULL REFERENCES keywords(id),
  monthly_search_pc INTEGER,
  monthly_search_mob INTEGER,
  avg_monthly_search INTEGER GENERATED ALWAYS AS (COALESCE(monthly_search_pc,0)+COALESCE(monthly_search_mob,0)) VIRTUAL,
  cpc REAL,
  comp_index REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(keyword_id)
);

CREATE TABLE naver_doc_counts (
  keyword_id INTEGER NOT NULL REFERENCES keywords(id),
  blog_total INTEGER DEFAULT 0,
  cafe_total INTEGER DEFAULT 0,
  web_total INTEGER DEFAULT 0,
  news_total INTEGER DEFAULT 0,
  all_total INTEGER GENERATED ALWAYS AS (COALESCE(blog_total,0)+COALESCE(cafe_total,0)+COALESCE(web_total,0)+COALESCE(news_total,0)) VIRTUAL,
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(keyword_id)
);

CREATE TABLE auto_seed_usage (
  seed TEXT PRIMARY KEY,
  last_auto_collect_at DATETIME NOT NULL,
  depth INTEGER DEFAULT 1,
  note TEXT
);

CREATE TABLE collect_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT,
  type TEXT,
  status TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doc_cafe ON naver_doc_counts(cafe_total, all_total);
CREATE INDEX idx_metrics_avg ON keyword_metrics(avg_monthly_search);
```

---

## 6️⃣ KV 구조

| 키                       | 내용              | TTL   |
| ----------------------- | --------------- | ----- |
| `related:{seed}`        | 연관검색어 결과 캐시     | 24h   |
| `docs:{keyword}`        | 문서수 결과 캐시       | 24h   |
| `golden:{band}`         | 인사이트 캐시         | 12h   |
| `auto:seed:lock:{seed}` | 자동수집 중복 락       | 10min |
| `dup:kw:lock:{keyword}` | 키워드 단건 upsert 락 | 60s   |

---

## 7️⃣ 주요 API 요약

| Endpoint                            | Method | 설명                         |
| ----------------------------------- | ------ | -------------------------- |
| `/api/collect/related?preview=true` | POST   | 미리보기 (DB 미저장)              |
| `/api/collect/related`              | POST   | 키워드 수집 + 저장 + 문서수 트리거      |
| `/api/collect/naver-docs`           | POST   | 문서수(blog,cafe,web,news) 수집 |
| `/api/keywords`                     | GET    | 필터/정렬/페이지 기반 목록            |
| `/api/insights/golden`              | GET    | 밴드별 황금키워드 Top10            |
| `/api/auto/collect/toggle`          | POST   | 자동수집 on/off                |
| `/api/auto/collect/status`          | GET    | 자동수집 상태 조회                 |
| `/api/health`                       | GET    | 시스템 상태 점검                  |

---

## 8️⃣ 중복수집/자동수집 정책 (핵심 로직)

| 항목              | 조건                                           | 처리     |
| --------------- | -------------------------------------------- | ------ |
| **자동수집 재실행 방지** | `auto_seed_usage.last_auto_collect_at` ≤ 30일 | PASS   |
| **중복키워드 방지**    | `keyword_metrics.updated_at` ≤ 30일           | PASS   |
| **문서수 갱신**      | `naver_doc_counts.collected_at` > 30일        | UPDATE |
| **자동수집 락**      | KV(`auto:seed:lock:{seed}`) 존재               | 대기/스킵  |

---

## 9️⃣ 수용 기준(통합 테스트)

✅ 시드 입력 후 미리보기 테이블 표시
✅ 저장 시 중복 키워드 30일 내 PASS
✅ 자동수집 ON 상태에서 새 키워드 시드로 2차 수집
✅ 자동수집 시 이미 사용한 시드는 30일간 재실행 금지
✅ 인사이트 페이지 밴드별 Top10 정렬 정확
✅ 크론 실행 후 30일 이상된 문서수 갱신

---

## 🔟 성능 / 보안 / 운영

| 구분           | 기준                                        |
| ------------ | ----------------------------------------- |
| **성능**       | `/data` 렌더 ≤ 1.5s (1000행), API 응답 ≤ 300ms |
| **보안**       | 모든 POST 요청 `x-admin-key` 필수               |
| **API 제한**   | 60req/min/IP                              |
| **로그**       | `collect_logs` + RFC7807                  |
| **Cron 안정성** | KV 락 멱등키 + 200 seed/day 제한                |

---

## 11️⃣ 향후 확장 계획 (v2)

| 기능    | 설명                              |
| ----- | ------------------------------- |
| 회원제   | Supabase Auth / 사용자별 프리셋 저장     |
| 알림    | 조건형 알림(예: "검색수>1000 & 카페문서<50") |
| AI 추천 | GPT 기반 "키워드 군집/제목 생성기"          |
| 수익화   | AdSense + Affiliate CTA 삽입      |

---

✅ **요약 한줄**

> **시드→연관검색어→DB저장→문서수자동→30일중복방지→2차자동수집→Top10대시보드**
> 완전한 자동 "황금키워드 인사이트" 시스템

---

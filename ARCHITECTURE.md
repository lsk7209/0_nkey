# 🏗️ 아키텍처 문서 (Architecture Document)

> **⚠️ 중요**: 이 문서는 현재 작동하는 시스템의 아키텍처를 설명합니다.  
> 헌법(`CONSTITUTION.md`)을 먼저 확인하세요.

---

## 📐 시스템 아키텍처 개요

### 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frontend (Next.js)                                  │   │
│  │  - src/app/page.tsx                                  │   │
│  │  - API 호출: https://0-nkey.pages.dev/api/*         │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages Functions (functions/)                        │   │
│  │  - _middleware.ts (라우팅)                           │   │
│  │  - api/collect-naver.ts (네이버 API 수집)           │   │
│  │  - api/keywords.ts (키워드 조회)                     │   │
│  │  - api/test.ts (테스트)                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Cloudflare D1 Database                              │   │
│  │  - keywords 테이블                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Naver APIs                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Naver SearchAd API                                  │   │
│  │  - https://api.naver.com/keywordstool               │   │
│  │  - HMAC-SHA256 인증                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Naver OpenAPI                                       │   │
│  │  - https://openapi.naver.com/v1/search/*            │   │
│  │  - X-Naver-Client-Id/Secret 인증                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 데이터 흐름 (Data Flow)

### 1. 키워드 수집 흐름

```
사용자 입력 (시드 키워드)
    ↓
프론트엔드: POST /api/collect-naver
    ↓
Pages Functions: functions/api/collect-naver.ts
    ├─ Admin Key 인증 확인
    ├─ 네이버 SearchAd API 호출
    │   ├─ HMAC-SHA256 시그니처 생성
    │   ├─ https://api.naver.com/keywordstool 호출
    │   └─ 응답 파싱 및 매핑
    ├─ D1 데이터베이스 저장 (upsert)
    └─ 응답 반환 (keywords 배열 포함)
    ↓
프론트엔드: API 응답에서 keywords 직접 사용
    ├─ setKeywords(result.keywords)
    └─ 테이블 표시
```

### 2. 키워드 조회 흐름

```
사용자: "클라우드 DB에서 불러오기" 버튼 클릭
    ↓
프론트엔드: GET /api/keywords
    ↓
Pages Functions: functions/api/keywords.ts
    ├─ Admin Key 인증 확인
    ├─ D1 데이터베이스 조회
    └─ 응답 반환 (keywords 배열)
    ↓
프론트엔드: 키워드 목록 표시
```

---

## 📁 파일 구조

### Pages Functions 구조

```
functions/
├── _middleware.ts              # 라우팅 미들웨어 (절대 변경 금지)
│   └── API 요청을 적절한 핸들러로 라우팅
│
└── api/
    ├── collect-naver.ts        # 네이버 API 키워드 수집 (절대 변경 금지)
    │   ├── onRequest()         # Pages Functions 진입점
    │   ├── fetchKeywordsFromOfficialNaverAPI()  # 네이버 API 호출
    │   ├── generateOfficialHMACSignature()      # HMAC 시그니처 생성
    │   └── normalizeSearchCount()               # 검색량 정규화
    │
    ├── keywords.ts             # 키워드 조회 (절대 변경 금지)
    │   └── onRequest()         # D1에서 키워드 조회
    │
    └── test.ts                 # 테스트 API (절대 변경 금지)
        └── onRequest()         # 버전 확인용
```

### 프론트엔드 구조

```
src/
└── app/
    └── page.tsx                # 홈 페이지 (절대 변경 금지)
        ├── handleCollect()     # 키워드 수집 핸들러
        ├── handleLoadStored()  # 저장된 키워드 조회
        └── KeywordData 인터페이스 정의
```

---

## 🔐 인증 구조

### 1. Admin Key 인증

**위치**: 모든 Pages Functions (`functions/api/*.ts`)

```typescript
const adminKey = request.headers.get('x-admin-key');
const expectedKey = env.ADMIN_KEY || 'dev-key-2024';
if (!adminKey || adminKey !== expectedKey) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401 }
  );
}
```

**절대 변경 금지**:
- ❌ 인증 로직 제거
- ❌ 헤더명 변경 (`x-admin-key`)
- ❌ 인증 키 하드코딩 (환경변수 사용 필수)

### 2. 네이버 SearchAd API 인증

**위치**: `functions/api/collect-naver.ts`

```typescript
// HMAC-SHA256 시그니처 생성
const message = `${timestamp}.${method}.${uri}`;
const sig = await generateOfficialHMACSignature(ts, 'GET', uri, SECRET);

// 인증 헤더
headers: {
  'X-Timestamp': ts,
  'X-API-KEY': KEY,
  'X-Customer': CID,
  'X-Signature': sig
}
```

**절대 변경 금지**:
- ❌ 시그니처 메시지 형식 변경
- ❌ 헤더명 변경
- ❌ 알고리즘 변경 (HMAC-SHA256)

---

## 💾 데이터베이스 구조

### D1 데이터베이스 스키마

```sql
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  pc_search INTEGER,
  mobile_search INTEGER,
  avg_monthly_search INTEGER,
  monthly_click_pc REAL,
  monthly_click_mo REAL,
  ctr_pc REAL,
  ctr_mo REAL,
  ad_count INTEGER,
  comp_idx TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**절대 변경 금지**:
- ❌ 컬럼명 변경
- ❌ 컬럼 타입 변경
- ❌ 필수 컬럼 제거

---

## 🌐 API 엔드포인트 상세

### 1. POST /api/collect-naver

**목적**: 네이버 SearchAd API로 키워드 수집

**요청**:
```json
{
  "seed": "홍대갈만한곳"
}
```

**응답**:
```json
{
  "success": true,
  "seed": "홍대갈만한곳",
  "totalCollected": 36,
  "totalSavedOrUpdated": 36,
  "savedCount": 0,
  "updatedCount": 36,
  "keywords": [
    {
      "keyword": "홍대갈만한곳 맛집",
      "pc_search": 10000,
      "mobile_search": 20000,
      "avg_monthly_search": 30000,
      "monthly_click_pc": 52.8,
      "monthly_click_mo": 389.4,
      "ctr_pc": 2.86,
      "ctr_mo": 4.45,
      "ad_count": 15,
      "comp_idx": "높음"
    }
  ],
  "message": "네이버 API로 36개의 연관검색어를 수집하여 36개를 저장했습니다.",
  "version": "v4.0 - 환경변수 디버그",
  "timestamp": "2025-10-29T07:00:00.000Z"
}
```

**절대 변경 금지**:
- ❌ `keywords` 배열 제거
- ❌ 응답 구조 변경
- ❌ 필드명 변경

### 2. GET /api/keywords

**목적**: 저장된 키워드 조회

**응답**:
```json
{
  "success": true,
  "keywords": [
    {
      "keyword": "홍대갈만한곳 맛집",
      "pc_search": 10000,
      "mobile_search": 20000,
      "avg_monthly_search": 30000,
      ...
    }
  ],
  "total": 36,
  "message": "36개의 키워드를 조회했습니다."
}
```

---

## 🔧 환경변수 구조

### Cloudflare Pages 환경변수

| 환경변수명 | 설명 | 필수 |
|----------|------|-----|
| `ADMIN_KEY` | Admin 인증 키 | ✅ |
| `NAVER_API_KEY_1` ~ `NAVER_API_KEY_5` | 네이버 SearchAd API 키 | ✅ |
| `NAVER_API_SECRET_1` ~ `NAVER_API_SECRET_5` | 네이버 SearchAd API Secret | ✅ |
| `NAVER_CUSTOMER_ID_1` ~ `NAVER_CUSTOMER_ID_5` | 네이버 SearchAd Customer ID | ✅ |
| `DB` | D1 데이터베이스 바인딩 (자동) | ✅ |

**절대 변경 금지**:
- ❌ 환경변수명 변경
- ❌ 환경변수 구조 변경

---

## 📊 데이터 매핑

### 네이버 API → 내부 구조 매핑

| 네이버 API 필드 | 내부 필드명 | 변환 로직 |
|--------------|----------|---------|
| `relKeyword` | `keyword` | 직접 매핑 |
| `monthlyPcQcCnt` | `pc_search` | `normalizeSearchCount()` |
| `monthlyMobileQcCnt` | `mobile_search` | `normalizeSearchCount()` |
| - | `avg_monthly_search` | `pc_search + mobile_search` |
| `monthlyAvePcClkCnt` | `monthly_click_pc` | `parseFloat()` |
| `monthlyAveMobileClkCnt` | `monthly_click_mo` | `parseFloat()` |
| `monthlyAvePcCtr` | `ctr_pc` | `parseFloat()` |
| `monthlyAveMobileCtr` | `ctr_mo` | `parseFloat()` |
| `plAvgDepth` | `ad_count` | `parseInt()` |
| `compIdx` | `comp_idx` | 직접 매핑 |

**절대 변경 금지**:
- ❌ 매핑 로직 변경
- ❌ 필드명 변경

---

## 🚀 배포 프로세스

### 1. 빌드 프로세스

```
GitHub Push
    ↓
Cloudflare Pages 빌드 시작
    ├─ npm clean-install
    ├─ npx @cloudflare/next-on-pages@1
    │   └─ Next.js 빌드 (next build)
    └─ Pages Functions 빌드
    ↓
배포 완료
```

### 2. 배포 전 체크리스트

- [ ] 헌법 문서 확인 (`CONSTITUTION.md`)
- [ ] Pages Functions 파일 확인 (`functions/_middleware.ts` 등)
- [ ] API 응답 구조 확인 (`keywords` 배열 포함)
- [ ] 환경변수 확인 (`NAVER_API_KEY_1` 등)
- [ ] 프론트엔드 데이터 흐름 확인 (API 응답 직접 사용)

---

## 🔍 디버깅 가이드

### 1. 환경변수 확인

**Pages Functions에서 확인**:
```typescript
console.log('NAVER_API_KEY_1:', env.NAVER_API_KEY_1 ? '설정됨' : '없음');
console.log('DB:', env.DB ? '설정됨' : '없음');
```

### 2. API 응답 확인

**프론트엔드 콘솔에서 확인**:
```javascript
console.log('API 응답:', result);
console.log('keywords 배열:', result.keywords);
console.log('키워드 개수:', result.keywords?.length);
```

### 3. 네이버 API 호출 확인

**Pages Functions 로그에서 확인**:
- `Official Naver API response status: 200`
- `Official Naver API response: {...}`

---

## 📝 핵심 원칙

### 1. 단일 진실의 원천 (Single Source of Truth)

- **API 응답**: `keywords` 배열은 API 응답에서만 가져옴
- **프론트엔드**: 샘플 데이터 생성 금지
- **데이터베이스**: D1에 저장된 실제 데이터만 사용

### 2. Pages Functions 우선

- **모든 API 로직**: Pages Functions에서 처리
- **Workers 사용 금지**: 별도 Workers 배포 금지
- **프론트엔드**: 직접 네이버 API 호출 금지

### 3. 헌법 준수

- **모든 변경**: 헌법 문서 확인 필수
- **헌법 위반**: 즉시 롤백
- **새로운 기능**: 헌법 업데이트 필요 시 별도 문서 작성

---

**마지막 업데이트**: 2025년 10월 29일  
**아키텍처 버전**: v1.0  
**상태**: ✅ 정상 작동 확인 완료


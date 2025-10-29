# 🏛️ 헌법 (Constitution) - 절대 불변 규칙

> **⚠️ 경고**: 이 문서는 **절대 변하지 않는 규칙**입니다.  
> 이 규칙을 변경하거나 무시하면 시스템이 작동하지 않게 됩니다.  
> **2025년 10월 29일** 현재 작동하는 환경을 기반으로 작성되었습니다.

---

## 📜 헌법 제1조: 아키텍처 구조

### 1.1 클라우드플레어 Pages Functions 아키텍처

**절대 변경 금지**:
- **배포 플랫폼**: Cloudflare Pages (절대 Workers 단독 배포 아님)
- **Functions 디렉토리**: `functions/` (절대 변경 금지)
- **Middleware 파일**: `functions/_middleware.ts` (절대 변경 금지)
- **API 엔드포인트**: Pages Functions 사용 (`functions/api/`)

**절대 금지 사항**:
- ❌ `functions/api/` 디렉토리 구조 변경
- ❌ `functions/_middleware.ts` 삭제 또는 구조 변경
- ❌ Pages Functions를 Workers로 변경
- ❌ 프론트엔드에서 별도 Workers URL 호출

---

## 📜 헌법 제2조: API 엔드포인트 구조

### 2.1 필수 API 엔드포인트

**절대 변경 금지 엔드포인트**:

| 엔드포인트 | 파일 위치 | 설명 | 절대 변경 금지 |
|----------|----------|------|--------------|
| `/api/collect-naver` | `functions/api/collect-naver.ts` | 네이버 SearchAd API 키워드 수집 | ✅ |
| `/api/keywords` | `functions/api/keywords.ts` | 키워드 조회 | ✅ |
| `/api/test` | `functions/api/test.ts` | 테스트 API | ✅ |

**절대 금지 사항**:
- ❌ 엔드포인트 경로 변경 (`/api/collect-naver` → 다른 경로)
- ❌ 파일 위치 변경 (`functions/api/collect-naver.ts` → 다른 위치)
- ❌ 엔드포인트 삭제

---

## 📜 헌법 제3조: API 응답 구조

### 3.1 `/api/collect-naver` 응답 구조

**절대 변경 금지 응답 필드**:

```typescript
{
  success: true,                    // 절대 변경 금지
  seed: string,                     // 절대 변경 금지
  totalCollected: number,           // 절대 변경 금지
  totalSavedOrUpdated: number,      // 절대 변경 금지
  savedCount: number,               // 절대 변경 금지
  updatedCount: number,             // 절대 변경 금지
  keywords: Array<{                 // 절대 변경 금지 - 프론트엔드가 직접 사용
    keyword: string,
    pc_search: number,
    mobile_search: number,
    avg_monthly_search: number,
    monthly_click_pc?: number,
    monthly_click_mo?: number,
    ctr_pc?: number,
    ctr_mo?: number,
    ad_count?: number,
    comp_idx?: string | number
  }>,
  message: string,                  // 절대 변경 금지
  version: string,                  // 절대 변경 금지
  timestamp: string                  // 절대 변경 금지
}
```

**절대 금지 사항**:
- ❌ `keywords` 배열 제거 또는 이름 변경
- ❌ 키워드 객체 필드명 변경 (`pc_search`, `mobile_search` 등)
- ❌ 응답 구조 변경 (샘플 데이터 반환 등)

---

## 📜 헌법 제4조: 데이터 필드명 매핑

### 4.1 네이버 SearchAd API 필드 매핑

**절대 변경 금지 필드명**:

| 네이버 API 필드 | 내부 필드명 | 설명 | 절대 변경 금지 |
|--------------|----------|------|--------------|
| `relKeyword` | `keyword` | 연관키워드 | ✅ |
| `monthlyPcQcCnt` | `pc_search` | PC 검색량 | ✅ |
| `monthlyMobileQcCnt` | `mobile_search` | 모바일 검색량 | ✅ |
| `monthlyPcQcCnt + monthlyMobileQcCnt` | `avg_monthly_search` | 총 검색량 | ✅ |
| `monthlyAvePcClkCnt` | `monthly_click_pc` | PC 월평균 클릭수 | ✅ |
| `monthlyAveMobileClkCnt` | `monthly_click_mo` | 모바일 월평균 클릭수 | ✅ |
| `monthlyAvePcCtr` | `ctr_pc` | PC CTR | ✅ |
| `monthlyAveMobileCtr` | `ctr_mo` | 모바일 CTR | ✅ |
| `plAvgDepth` | `ad_count` | 광고수 | ✅ |
| `compIdx` | `comp_idx` | 경쟁도 | ✅ |

**절대 금지 사항**:
- ❌ 필드명 변경 (`pc_search` → `pcSearch` 등)
- ❌ 필드 추가/제거
- ❌ 데이터 타입 변경 (number → string 등)

---

## 📜 헌법 제5조: 프론트엔드 데이터 흐름

### 5.1 키워드 수집 흐름

**절대 변경 금지 흐름**:

```
1. 사용자 입력 (시드 키워드)
   ↓
2. POST /api/collect-naver
   - URL: https://0-nkey.pages.dev/api/collect-naver (절대 변경 금지)
   - Headers: { 'Content-Type': 'application/json', 'x-admin-key': 'dev-key-2024' }
   ↓
3. API 응답에서 keywords 배열 직접 사용
   - result.keywords 바로 setKeywords() 호출 (절대 변경 금지)
   ↓
4. 테이블 표시
   - keywords 배열을 직접 순회하여 표시 (절대 변경 금지)
```

**절대 금지 사항**:
- ❌ API 응답 무시하고 별도 API 호출 (`/api/keywords` 등)
- ❌ 샘플 데이터 생성 또는 표시
- ❌ 키워드 개수 제한 (전체 표시 필수)
- ❌ 캐싱 또는 로컬 스토리지 사용

### 5.2 프론트엔드 인터페이스

**절대 변경 금지 인터페이스** (`src/app/page.tsx`):

```typescript
interface KeywordData {
  keyword: string              // 절대 변경 금지
  pc_search: number           // 절대 변경 금지
  mobile_search: number       // 절대 변경 금지
  avg_monthly_search: number   // 절대 변경 금지
  monthly_click_pc?: number   // 절대 변경 금지
  monthly_click_mo?: number   // 절대 변경 금지
  ctr_pc?: number             // 절대 변경 금지
  ctr_mo?: number             // 절대 변경 금지
  ad_count?: number           // 절대 변경 금지
  comp_idx?: string | number  // 절대 변경 금지
}
```

**절대 금지 사항**:
- ❌ 인터페이스 필드명 변경
- ❌ 필드 타입 변경
- ❌ 필드 추가/제거

---

## 📜 헌법 제6조: 네이버 API 호출 규칙

### 6.1 네이버 SearchAd API 호출

**절대 변경 금지 규칙** (`functions/api/collect-naver.ts`):

```typescript
// 절대 변경 금지: Base URL
const BASE = 'https://api.naver.com';

// 절대 변경 금지: 엔드포인트
const uri = '/keywordstool';

// 절대 변경 금지: 파라미터
const qs = new URLSearchParams({ 
  hintKeywords: seed,    // 절대 변경 금지
  showDetail: '1'        // 절대 변경 금지
});

// 절대 변경 금지: 인증 헤더
headers: {
  'Content-Type': 'application/json; charset=UTF-8',
  'X-Timestamp': ts,
  'X-API-KEY': KEY,
  'X-Customer': CID,
  'X-Signature': sig
}
```

**절대 금지 사항**:
- ❌ Base URL 변경 (`https://api.naver.com`)
- ❌ 엔드포인트 변경 (`/keywordstool`)
- ❌ 파라미터 변경 (`hintKeywords`, `showDetail`)
- ❌ 인증 헤더 변경
- ❌ 샘플 데이터 반환

### 6.2 HMAC 시그니처 생성

**절대 변경 금지 로직**:

```typescript
// 절대 변경 금지: 시그니처 메시지 형식
const message = `${timestamp}.${method}.${uri}`;

// 절대 변경 금지: HMAC-SHA256 알고리즘
const cryptoKey = await crypto.subtle.importKey(
  'raw',
  secretBytes,
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);

// 절대 변경 금지: Base64 인코딩
const base64String = btoa(String.fromCharCode(...new Uint8Array(signature)));
```

**절대 금지 사항**:
- ❌ 시그니처 메시지 형식 변경
- ❌ 알고리즘 변경 (HMAC-SHA256)
- ❌ 인코딩 방식 변경 (Base64)

---

## 📜 헌법 제7조: 환경변수 구조

### 7.1 필수 환경변수

**절대 변경 금지 환경변수명**:

| 환경변수명 | 설명 | 절대 변경 금지 |
|----------|------|--------------|
| `NAVER_API_KEY_1` ~ `NAVER_API_KEY_5` | 네이버 SearchAd API 키 | ✅ |
| `NAVER_API_SECRET_1` ~ `NAVER_API_SECRET_5` | 네이버 SearchAd API Secret | ✅ |
| `NAVER_CUSTOMER_ID_1` ~ `NAVER_CUSTOMER_ID_5` | 네이버 SearchAd Customer ID | ✅ |
| `ADMIN_KEY` | Admin 인증 키 | ✅ |
| `DB` | D1 데이터베이스 바인딩 | ✅ |

**절대 금지 사항**:
- ❌ 환경변수명 변경
- ❌ 환경변수 구조 변경
- ❌ 하드코딩 (환경변수 대신)

---

## 📜 헌법 제8조: 데이터베이스 스키마

### 8.1 키워드 테이블 스키마

**절대 변경 금지 컬럼명**:

```sql
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,              -- 절대 변경 금지
  pc_search INTEGER,                  -- 절대 변경 금지
  mobile_search INTEGER,              -- 절대 변경 금지
  avg_monthly_search INTEGER,        -- 절대 변경 금지
  monthly_click_pc REAL,             -- 절대 변경 금지
  monthly_click_mo REAL,             -- 절대 변경 금지
  ctr_pc REAL,                       -- 절대 변경 금지
  ctr_mo REAL,                       -- 절대 변경 금지
  ad_count INTEGER,                  -- 절대 변경 금지
  comp_idx TEXT,                     -- 절대 변경 금지
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**절대 금지 사항**:
- ❌ 컬럼명 변경
- ❌ 컬럼 타입 변경
- ❌ 컬럼 추가/제거 (기존 컬럼 기준)

---

## 📜 헌법 제9조: 파일 구조

### 9.1 절대 변경 금지 파일 위치

**Pages Functions**:
- `functions/_middleware.ts` - 라우팅 미들웨어 (절대 변경 금지)
- `functions/api/collect-naver.ts` - 네이버 API 수집 (절대 변경 금지)
- `functions/api/keywords.ts` - 키워드 조회 (절대 변경 금지)
- `functions/api/test.ts` - 테스트 API (절대 변경 금지)

**프론트엔드**:
- `src/app/page.tsx` - 홈 페이지 (절대 변경 금지 - 데이터 흐름)

**설정 파일**:
- `wrangler.toml` - Cloudflare Pages 설정 (절대 변경 금지)

**절대 금지 사항**:
- ❌ 파일 위치 변경
- ❌ 파일 삭제
- ❌ 파일명 변경

---

## 📜 헌법 제10조: 버전 관리

### 10.1 헌법 버전

**현재 헌법 버전**: `v1.0`  
**작성 일자**: `2025년 10월 29일`  
**작동 확인 상태**: ✅ 정상 작동

### 10.2 헌법 변경 절차

**절대 변경 금지**:
- ❌ 헌법 문서 직접 수정 금지
- ❌ 헌법 규칙 무시 금지
- ❌ 헌법 없이 개발 금지

**헌법 변경이 필요한 경우**:
1. 새로운 헌법 버전 작성 (`CONSTITUTION_v2.md`)
2. 기존 헌법과 비교 문서 작성
3. 전체 시스템 재테스트
4. 승인 후 새 헌법 적용

---

## 📜 헌법 제11조: 예외 처리

### 11.1 헌법 위반 시 처리

**헌법 위반 감지 시**:
1. 즉시 변경 사항 롤백
2. 헌법 문서 확인
3. 올바른 구조로 재작성
4. 테스트 후 재배포

**헌법 보호 조치**:
- 모든 변경 사항은 헌법 문서와 대조
- CI/CD에서 헌법 검증 자동화 권장
- 코드 리뷰 시 헌법 준수 확인 필수

---

## 📜 헌법 제12조: 네이버 API 공식 문서 준수

### 12.1 네이버 SearchAd API 문서

**절대 변경 금지 문서**:
- `NAVER_SEARCHAD_API_OFFICIAL_DOCS.md` - 절대 변경 금지
- 이 문서의 모든 규칙 준수 필수

**절대 금지 사항**:
- ❌ 공식 문서 무시
- ❌ 공식 문서와 다른 구현
- ❌ 비공식 API 사용

### 12.2 네이버 OpenAPI 문서

**절대 변경 금지 문서**:
- `NAVER_OPENAPI_OFFICIAL_DOCS.md` - 절대 변경 금지
- 이 문서의 모든 규칙 준수 필수

---

## 📜 헌법 제13조: 배포 프로세스

### 13.1 배포 전 체크리스트

**절대 변경 금지 체크리스트**:

- [ ] 헌법 문서 확인 완료
- [ ] API 응답 구조 확인 (`keywords` 배열 포함)
- [ ] 필드명 매핑 확인 (`pc_search`, `mobile_search` 등)
- [ ] 프론트엔드 데이터 흐름 확인 (API 응답 직접 사용)
- [ ] Pages Functions 구조 확인 (`functions/_middleware.ts` 등)
- [ ] 환경변수 확인 (`NAVER_API_KEY_1` 등)
- [ ] 네이버 API 공식 문서 준수 확인

**절대 금지 사항**:
- ❌ 체크리스트 없이 배포
- ❌ 헌법 규칙 무시하고 배포

---

## 📜 헌법 제14조: 테스트 규칙

### 14.1 필수 테스트 항목

**절대 변경 금지 테스트**:

1. **API 응답 테스트**:
   - `keywords` 배열이 응답에 포함되는지 확인
   - 필드명이 정확한지 확인 (`pc_search`, `mobile_search` 등)

2. **프론트엔드 테스트**:
   - API 응답에서 직접 키워드 표시되는지 확인
   - 샘플 데이터 표시되지 않는지 확인

3. **네이버 API 테스트**:
   - 실제 네이버 API 호출되는지 확인
   - 샘플 데이터 반환되지 않는지 확인

**절대 금지 사항**:
- ❌ 테스트 없이 배포
- ❌ 샘플 데이터로 테스트

---

## 📜 헌법 제15조: 문서화

### 15.1 필수 문서

**절대 변경 금지 문서**:
- `CONSTITUTION.md` - 이 문서 (절대 변경 금지)
- `PRD.md` - 프로젝트 요구사항 문서
- `NAVER_SEARCHAD_API_OFFICIAL_DOCS.md` - 네이버 SearchAd API 문서
- `NAVER_OPENAPI_OFFICIAL_DOCS.md` - 네이버 OpenAPI 문서

**절대 금지 사항**:
- ❌ 문서 삭제
- ❌ 문서 무시
- ❌ 문서 없이 개발

---

## 🏛️ 헌법 선언

이 헌법은 **2025년 10월 29일** 현재 정상 작동하는 시스템을 기반으로 작성되었습니다.

**헌법 준수 서약**:
- ✅ 모든 개발자는 이 헌법을 준수해야 합니다.
- ✅ 헌법 위반 시 즉시 롤백해야 합니다.
- ✅ 헌법 변경은 반드시 문서화되어야 합니다.

**헌법 보호 기간**: 무기한 (변경 금지)

---

**마지막 업데이트**: 2025년 10월 29일  
**헌법 버전**: v1.0  
**상태**: ✅ 정상 작동 확인 완료


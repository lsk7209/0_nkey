# 📊 현재 개발 상태 (Current Development State)

> **⚠️ 복구용 문서**: 이 문서는 현재 정상 작동하는 개발 상태를 기록한 것입니다.  
> 개발 중 문제가 발생하거나 원상복귀가 필요할 때 이 문서를 참조하세요.  
> **2025년 1월 XX일** 현재 상태 기준

---

## 🎯 현재 작동 상태 요약

### ✅ 정상 작동 중인 기능

1. **수동 키워드 수집** (`src/app/page.tsx`)
   - 네이버 SearchAd API를 통한 키워드 수집
   - D1 데이터베이스 저장 및 업데이트
   - 중복 제거 및 검증 로직 정상 작동

2. **자동 키워드 수집** (`src/app/auto-collect/page.tsx`)
   - 백그라운드 자동 수집 (Service Worker)
   - 목표 키워드 수 설정 가능
   - 시드 키워드 관리 및 사용 이력 추적

3. **데이터 조회 페이지** (`src/app/data/page.tsx`)
   - 페이지네이션 구현 완료 (50개/페이지)
   - 필터링 기능 (검색량, 문서수 등)
   - 정렬 기능 (카페 문서수 오름차순 + 검색량 내림차순)

4. **인사이트 페이지** (`src/app/insights/page.tsx`)
   - 카페/블로그/웹/뉴스 잠재력 키워드 분석
   - 광고 잠재력 키워드 분석
   - 총문서 인사이트 분석

---

## 🔧 최근 변경 사항 (2025-01-XX)

### 1. 자동수집 남은 시드 수 계산 로직 수정

**파일**: `functions/api/auto-collect.ts`

**변경 내용**:
- 기존: `LEFT JOIN` + `WHERE a.seed IS NULL` 방식으로 부정확한 계산
- 수정: `전체 키워드 수 - 사용된 시드 수` 방식으로 정확한 계산

**코드 구조**:
```typescript
// 1. 전체 키워드 수 조회
const totalKeywordsQuery = `SELECT COUNT(*) as total FROM keywords`;
const totalKeywords = totalKeywordsResult.results?.[0]?.total ?? 0;

// 2. 실제로 사용된 시드 수 조회 (keywords 테이블에 존재하는 키워드 중에서만)
const usedSeedsQuery = `
  SELECT COUNT(DISTINCT k.keyword) as used
  FROM keywords k
  INNER JOIN auto_seed_usage a ON a.seed = k.keyword
`;
const usedSeeds = usedSeedsResult.results?.[0]?.used ?? 0;

// 3. 남은 시드 수 계산
const actualRemaining = Math.max(0, totalKeywords - usedSeeds);
```

**API 응답에 추가된 필드**:
- `totalKeywords`: 전체 키워드 수 (디버깅용)
- `usedSeeds`: 사용된 시드 수 (디버깅용)
- `remaining`: 정확한 남은 시드 수

**프론트엔드 표시** (`src/app/auto-collect/page.tsx`):
- "남은 시드" 카드에 전체/사용 수 표시
- 예: "전체: 1,984개 / 사용: 709개"

**커밋**: `f21e6f7` (2025-01-XX)

---

### 2. 데이터 페이지 Pagination 구현

**파일**: `src/app/data/page.tsx`

**설정 값**:
- `itemsPerPage`: 50 (페이지당 표시 개수)
- `excludeZeroDocs`: 'true' (기본값, 문서수 0인 키워드 제외)

**정렬 규칙** (`functions/api/keywords.ts`):
```sql
ORDER BY 
  COALESCE(ndc.cafe_total, 0) ASC,  -- 1순위: 카페 문서수 오름차순
  k.avg_monthly_search DESC          -- 2순위: 총 검색량 내림차순
```

**Pagination UI**:
- "첫 페이지", "이전", 페이지 번호, "다음", "마지막 페이지" 버튼
- 페이지 번호는 최대 10개씩 표시
- 현재 페이지 하이라이트

**제거된 기능**:
- ❌ 무한 스크롤 (완전 제거)
- ❌ "스크롤하여 더 많은 키워드를 불러올 수 있습니다" 메시지

---

### 3. 인사이트 페이지 필터링 개선

**파일**: `src/app/insights/page.tsx`

**개선 사항**:
1. **안전한 범위 계산**
   - 빈 배열에 대한 `Math.max()` 에러 방지
   - 최대값을 1000으로 제한하여 의미 있는 설명 생성

2. **검색량 0 제외**
   - 모든 인사이트 필터에서 `avg_monthly_search > 0` 조건 추가
   - 검색량이 0인 키워드는 분석 대상에서 제외

3. **Null/Undefined 안전 처리**
   - 모든 숫자 필드에 `|| 0` 적용
   - 안전한 데이터 접근 보장

**구현된 인사이트**:
- 🔥 카페 잠재력 키워드: 검색량 상위권 + 카페 문서수 낮음 (1-{maxCafeTotal}개)
- 📝 블로그 잠재력 키워드: 검색량 상위권 + 블로그 문서수 낮음 (1-{maxBlogTotal}개)
- 🌐 웹 잠재력 키워드: 검색량 상위권 + 웹 문서수 낮음 (1-{maxWebTotal}개)
- 📰 뉴스 잠재력 키워드: 검색량 상위권 + 뉴스 문서수 낮음 (1-{maxNewsTotal}개)
- 📊 총문서 인사이트: 총 문서수 1-4999개, 총 문서수 오름차순 + 검색량 내림차순
- 💰 광고 잠재력 키워드: 검색량 상위권 + 광고 수 낮음

---

## 📁 주요 파일 및 설정

### API 엔드포인트

| 엔드포인트 | 파일 | 현재 상태 |
|----------|------|----------|
| `/api/collect-naver` | `functions/api/collect-naver.ts` | ✅ 정상 |
| `/api/keywords` | `functions/api/keywords.ts` | ✅ 정상 |
| `/api/auto-collect` | `functions/api/auto-collect.ts` | ✅ 정상 (최근 수정) |
| `/api/keywords-delete` | `functions/api/keywords-delete.ts` | ✅ 정상 |
| `/api/migrate-schema` | `functions/api/migrate-schema.ts` | ✅ 정상 |

### 프론트엔드 페이지

| 페이지 | 파일 | 현재 상태 |
|--------|------|----------|
| 홈 (수동 수집) | `src/app/page.tsx` | ✅ 정상 |
| 데이터 조회 | `src/app/data/page.tsx` | ✅ 정상 (Pagination) |
| 자동 수집 | `src/app/auto-collect/page.tsx` | ✅ 정상 (최근 수정) |
| 인사이트 | `src/app/insights/page.tsx` | ✅ 정상 (필터링 개선) |

### Service Worker

| 파일 | 용도 | 현재 상태 |
|------|------|----------|
| `public/sw.js` | 백그라운드 자동 수집 | ✅ 정상 |

---

## 🔍 데이터베이스 상태

### 현재 데이터베이스 통계 (예상)

- **전체 키워드 수**: 약 1,984개
- **사용된 시드 수**: 약 709개 (예상)
- **남은 시드 수**: 약 1,275개 (예상)

### 테이블 구조

- `keywords`: 키워드 메인 테이블
- `naver_doc_counts`: 네이버 문서수 카운트
- `keyword_metrics`: 키워드 메트릭
- `auto_seed_usage`: 시드 키워드 사용 이력

---

## 🔄 복구 시 체크리스트

### 자동수집 남은 시드 수 계산 로직 복구

1. **파일**: `functions/api/auto-collect.ts`
2. **위치**: 약 157-193줄
3. **복구 방법**:
   ```typescript
   // 정확한 계산 방식
   const totalKeywords = await db.prepare('SELECT COUNT(*) as total FROM keywords').all();
   const usedSeeds = await db.prepare(`
     SELECT COUNT(DISTINCT k.keyword) as used
     FROM keywords k
     INNER JOIN auto_seed_usage a ON a.seed = k.keyword
   `).all();
   const actualRemaining = Math.max(0, totalKeywords - usedSeeds);
   ```

### 데이터 페이지 Pagination 복구

1. **파일**: `src/app/data/page.tsx`
2. **설정 확인**:
   - `itemsPerPage`: 50
   - `excludeZeroDocs`: 'true' (기본값)
3. **정렬 확인**: `functions/api/keywords.ts`에서 정렬 규칙 확인

### 인사이트 페이지 필터링 복구

1. **파일**: `src/app/insights/page.tsx`
2. **확인 사항**:
   - 모든 필터에 `searchVol > 0` 조건 포함
   - 안전한 범위 계산 (`Math.max(...)` 전에 빈 배열 체크)
   - 모든 숫자 필드에 `|| 0` 적용

---

## 📝 주의 사항

### 변경 시 주의할 점

1. **자동수집 남은 시드 수 계산**
   - ❌ `LEFT JOIN` + `WHERE a.seed IS NULL` 방식 사용 금지 (부정확함)
   - ✅ `전체 키워드 수 - 사용된 시드 수` 방식 사용 필수

2. **데이터 페이지 정렬**
   - ❌ 정렬 순서 변경 시 사용자 혼란 가능
   - ✅ 변경 시 사용자에게 공지 필요

3. **인사이트 필터링**
   - ❌ 검색량 0인 키워드 포함 시 의미 없는 결과
   - ✅ 모든 필터에 `searchVol > 0` 조건 필수

---

## 🚀 배포 상태

### 최근 배포

- **커밋**: `f21e6f7`
- **변경 내용**: 자동수집 남은 시드 수 계산 로직 수정
- **배포 플랫폼**: Cloudflare Pages (GitHub Actions 자동 배포)
- **배포 URL**: https://0-nkey.pages.dev

---

## 📚 참고 문서

- `CONSTITUTION.md`: 절대 불변 규칙
- `WORKING_ENVIRONMENT.md`: 작동 환경 고정 문서
- `ENVIRONMENT_SETUP.md`: 환경 설정 가이드

---

**문서 작성일**: 2025년 1월 XX일  
**마지막 업데이트**: 2025년 1월 XX일  
**상태**: ✅ 정상 작동 중


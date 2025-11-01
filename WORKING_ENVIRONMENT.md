# ✅ 작동 환경 고정 문서 (Working Environment Lock)

> **⚠️ 절대 변경 금지**: 이 문서는 현재 정상 작동하는 환경 설정을 기록한 것입니다.  
> 이 설정을 변경하면 시스템이 작동하지 않게 됩니다.  
> **2025년 11월 1일** 현재 상태 기준

---

## 🔒 고정된 환경 설정

### 1. 데이터베이스 저장 로직 (2025-11-01 고정)

#### ✅ 작동하는 INSERT 쿼리 구조

```sql
INSERT INTO keywords (
  keyword, seed_keyword_text, monthly_search_pc, monthly_search_mob,
  avg_monthly_search, comp_index, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

**고정된 특징**:
- ✅ `monthly_search_pc`, `monthly_search_mob` 사용 (필수)
- ✅ `pc_search`, `mobile_search`는 INSERT에서 제외 (컬럼이 없을 수 있음)
- ✅ 8개 컬럼만 사용 (절대 변경 금지)

#### ✅ 작동하는 검증 로직

```typescript
// INSERT 직후 3회 재시도 검증
let verifyInsert = null;
let verifyAttempts = 0;
const maxVerifyAttempts = 3;

while (!verifyInsert && verifyAttempts < maxVerifyAttempts) {
  verifyAttempts++;
  await new Promise(resolve => setTimeout(resolve, 100 * verifyAttempts));
  
  verifyInsert = await db.prepare('SELECT id, keyword FROM keywords WHERE keyword = ?')
    .bind(keyword.keyword)
    .first();
  
  if (verifyInsert) break;
}

// 검증 성공 시에만 savedCount 증가
if (verifyInsert) {
  savedCount++;
} else {
  failedCount++;
}
```

**고정된 특징**:
- ✅ 3회 재시도 검증 (절대 변경 금지)
- ✅ 점진적 대기 (100ms, 200ms, 300ms)
- ✅ 검증 성공 시에만 카운트 증가 (절대 변경 금지)

#### ✅ 작동하는 중복 확인 로직

```typescript
// INSERT 전 중복 확인
const existingCheck = await db.prepare('SELECT id FROM keywords WHERE keyword = ?')
  .bind(keyword.keyword)
  .first();

if (existingCheck) {
  updatedCount++;
  continue; // INSERT 스킵
}
```

**고정된 특징**:
- ✅ INSERT 전 중복 확인 (절대 변경 금지)
- ✅ 중복 발견 시 업데이트로 처리 (절대 변경 금지)
- ✅ 시간 기반 정책 없음 (절대 변경 금지)

#### ✅ 작동하는 UPDATE 쿼리 구조

```sql
UPDATE keywords SET
  monthly_search_pc = ?,
  monthly_search_mob = ?,
  avg_monthly_search = ?,
  seed_keyword_text = ?,
  comp_index = ?,
  updated_at = ?
WHERE id = ?
```

**고정된 특징**:
- ✅ `monthly_search_pc`, `monthly_search_mob` 사용 (필수)
- ✅ `pc_search`, `mobile_search`는 별도 UPDATE 시도 (실패해도 무시)

---

### 2. 시간 기반 정책 완전 제거 (2025-11-01 고정)

#### ✅ 작동하는 정책

**절대 변경 금지**:
- ✅ 모든 기존 키워드 무조건 업데이트
- ✅ 모든 새 키워드 무조건 저장
- ❌ 시간 기반 건너뛰기 정책 없음 (완전 제거됨)

**제거된 정책**:
- ❌ `daysSinceUpdate < 7` 제거됨
- ❌ `daysSinceUpdate < 30` 제거됨
- ❌ `skippedCount` 증가 로직 제거됨

---

### 3. 데이터베이스 컬럼 호환성 (2025-11-01 고정)

#### ✅ 작동하는 호환성 규칙

**필수 컬럼** (반드시 있어야 함):
- `monthly_search_pc` (INTEGER)
- `monthly_search_mob` (INTEGER)

**선택적 컬럼** (있으면 사용, 없으면 무시):
- `pc_search` (INTEGER) - 마이그레이션 후 사용
- `mobile_search` (INTEGER) - 마이그레이션 후 사용

**고정된 특징**:
- ✅ 선택적 컬럼이 없어도 저장 가능
- ✅ 선택적 컬럼 UPDATE 실패해도 전체 저장 성공 처리

---

### 4. API 응답 구조 (2025-11-01 고정)

#### ✅ 작동하는 응답 구조

```typescript
{
  success: true,
  seed: string,
  totalCollected: number,
  totalSavedOrUpdated: number,  // savedCount + updatedCount
  savedCount: number,            // 검증 성공한 키워드 수
  updatedCount: number,           // 업데이트된 키워드 수
  failedCount: number,            // 검증 실패한 키워드 수
  skippedCount: 0,               // 항상 0 (시간 정책 제거됨)
  totalAttempted: number,        // uniqueKeywords.length
  keywords: Array<{              // 실제 수집된 키워드
    keyword: string,
    pc_search: number,
    mobile_search: number,
    avg_monthly_search: number,
    ...
  }>,
  failedSamples: Array<{         // 실패한 키워드 샘플 (최대 5개)
    keyword: string,
    error: string
  }>,
  message: string,
  version: string,
  timestamp: string
}
```

**고정된 특징**:
- ✅ `savedCount`는 검증 성공 시에만 증가
- ✅ `failedCount`는 검증 실패 시 증가
- ✅ `skippedCount`는 항상 0 (시간 정책 없음)

---

### 5. 저장 루프 구조 (2025-11-01 고정)

#### ✅ 작동하는 루프 구조

```typescript
for (let i = 0; i < uniqueKeywords.length; i++) {
  const keyword = uniqueKeywords[i];
  
  // 1. 기존 키워드 확인
  const existing = await db.prepare('SELECT id, updated_at FROM keywords WHERE keyword = ?')
    .bind(keyword.keyword)
    .first();
  
  if (existing) {
    // 2. 기존 키워드 업데이트 (시간 정책 없음)
    // UPDATE 실행...
    updatedCount++;
  } else {
    // 3. 새 키워드 저장
    // INSERT 실행...
    // 4. INSERT 후 검증
    const verifyInsert = await db.prepare('SELECT id, keyword FROM keywords WHERE keyword = ?')
      .bind(keyword.keyword)
      .first();
    
    if (verifyInsert) {
      savedCount++;
    } else {
      failedCount++;
    }
  }
}
```

**고정된 특징**:
- ✅ 중복 확인 → 업데이트 또는 INSERT
- ✅ INSERT 후 검증 필수
- ✅ 검증 성공 시에만 카운트 증가

---

## 🔒 고정된 파일 구조

### 필수 파일 위치 (절대 변경 금지)

| 파일 | 경로 | 설명 |
|------|------|------|
| 키워드 수집 API | `functions/api/collect-naver.ts` | 네이버 API 키워드 수집 및 저장 |
| 키워드 조회 API | `functions/api/keywords.ts` | 키워드 데이터 조회 |
| 키워드 삭제 API | `functions/api/keywords-delete.ts` | 전체 키워드 삭제 |
| 마이그레이션 API | `functions/api/migrate-schema.ts` | 스키마 마이그레이션 |
| 홈 페이지 | `src/app/page.tsx` | 수동 키워드 수집 UI |
| 데이터 페이지 | `src/app/data/page.tsx` | 키워드 데이터 조회 UI |
| 헌법 문서 | `CONSTITUTION.md` | 절대 불변 규칙 |
| 환경 문서 | `WORKING_ENVIRONMENT.md` | 이 문서 |

---

## 🔒 고정된 코드 패턴

### 패턴 1: INSERT 쿼리 (절대 변경 금지)

```typescript
// ✅ 올바른 패턴
const insertResult = await db.prepare(`
  INSERT INTO keywords (
    keyword, seed_keyword_text, monthly_search_pc, monthly_search_mob,
    avg_monthly_search, comp_index, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  keyword.keyword,
  seed.trim(),
  keyword.pc_search || 0,
  keyword.mobile_search || 0,
  keyword.avg_monthly_search || 0,
  keyword.comp_idx || 0,
  new Date().toISOString(),
  new Date().toISOString()
).run();

// ❌ 잘못된 패턴 (컬럼이 없을 수 있음)
INSERT INTO keywords (..., pc_search, mobile_search, ...)
```

### 패턴 2: 검증 로직 (절대 변경 금지)

```typescript
// ✅ 올바른 패턴
const verifyInsert = await db.prepare('SELECT id, keyword FROM keywords WHERE keyword = ?')
  .bind(keyword.keyword)
  .first();

if (verifyInsert) {
  savedCount++;  // 검증 성공 시에만 증가
} else {
  failedCount++; // 검증 실패 시 실패 카운트
}

// ❌ 잘못된 패턴
savedCount++;  // 검증 없이 증가 (금지)
```

### 패턴 3: 중복 확인 (절대 변경 금지)

```typescript
// ✅ 올바른 패턴
const existingCheck = await db.prepare('SELECT id FROM keywords WHERE keyword = ?')
  .bind(keyword.keyword)
  .first();

if (existingCheck) {
  updatedCount++;
  continue; // INSERT 스킵
}
// INSERT 진행...

// ❌ 잘못된 패턴
// 중복 확인 없이 바로 INSERT (금지)
```

---

## 📊 현재 작동 상태 (2025-11-01)

### ✅ 확인 완료 사항

- [x] 수동 키워드 수집 정상 작동
- [x] 데이터베이스 저장 정상 작동
- [x] INSERT 후 검증 정상 작동
- [x] 중복 확인 정상 작동
- [x] 시간 기반 정책 완전 제거 확인
- [x] 선택적 컬럼(pc_search, mobile_search) 없어도 저장 가능 확인

### 🔒 고정된 버전 정보

- **작동 확인 일자**: 2025년 11월 1일
- **저장 로직 버전**: v9.0 (검증 강화 버전)
- **헌법 버전**: v2.0
- **상태**: ✅ 정상 작동

---

## ⚠️ 변경 금지 체크리스트

### 절대 변경 금지 항목

- [ ] INSERT 쿼리에 pc_search, mobile_search 포함 금지
- [ ] 검증 로직 제거 금지
- [ ] 검증 없이 savedCount 증가 금지
- [ ] 시간 기반 정책 추가 금지
- [ ] 중복 확인 로직 제거 금지
- [ ] 필수 컬럼 제거 금지

### 변경 시 필수 사항

1. **헌법 문서 확인** (`CONSTITUTION.md`)
2. **이 문서 확인** (`WORKING_ENVIRONMENT.md`)
3. **전체 테스트 실행**
4. **작동 확인 후 커밋**

---

**문서 작성일**: 2025년 11월 1일  
**마지막 확인**: 2025년 11월 1일  
**상태**: ✅ 정상 작동 확인 완료


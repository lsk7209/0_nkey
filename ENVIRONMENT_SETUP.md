# Cloudflare 환경 설정 확인

현재 프로젝트는 **Cloudflare Pages** 환경에서 실행됩니다.

## 🏗️ 아키텍처

### 1. Cloudflare Pages
- **호스팅**: Next.js 정적 사이트
- **Functions**: `functions/` 폴더의 Pages Functions 사용
- **배포**: GitHub 연동 자동 배포

### 2. Cloudflare D1 데이터베이스
- **바인딩**: `env.DB`
- **설정**: `wrangler.toml`의 `[[d1_databases]]`
- **데이터베이스 ID**: `c48f0714-2a98-4b65-8c11-6e8ed118efdc`
- **데이터베이스명**: `0_nkey_db`

### 3. Scheduled Functions (Cron)
- **파일**: `functions/_cron.ts`
- **Export**: `onScheduled` 함수
- **설정**: Cloudflare Dashboard → Scheduled Triggers
- **작동 방식**: 브라우저 없이 자동 실행

### 4. Pages Functions (API 엔드포인트)
- **위치**: `functions/api/` 폴더
- **라우팅**: `functions/_middleware.ts`에서 처리
- **D1 접근**: `env.DB`를 통해 접근

## ✅ 환경 확인 체크리스트

### Pages 설정
- [x] `functions/` 폴더 존재
- [x] `functions/_middleware.ts` 존재
- [x] `wrangler.toml`에 Pages 설정

### D1 데이터베이스
- [x] `wrangler.toml`에 D1 바인딩 설정
- [x] 모든 Functions에서 `env.DB` 사용
- [x] 데이터베이스 ID 설정됨

### Scheduled Functions
- [x] `functions/_cron.ts` 파일 존재
- [x] `onScheduled` export 존재
- [x] Cloudflare Dashboard에서 Scheduled Trigger 설정됨
- [x] Cron expression 설정됨 (`*/10 * * * *`)

### API Functions
- [x] `functions/api/auto-collect.ts` - 자동 수집 API
- [x] `functions/api/collect-naver.ts` - 네이버 API 호출
- [x] `functions/api/keywords.ts` - 키워드 조회
- [x] 모든 API가 `env.DB` 사용

## 🔧 설정 파일

### wrangler.toml
```toml
name = "0_nkey"
compatibility_date = "2024-01-01"
pages_build_output_dir = "out"

[[d1_databases]]
binding = "DB"
database_name = "0_nkey_db"
database_id = "c48f0714-2a98-4b65-8c11-6e8ed118efdc"
```

### 함수 구조
```
functions/
├── _cron.ts              # Scheduled Function (Cron)
├── _middleware.ts        # 라우팅 미들웨어
└── api/
    ├── auto-collect.ts   # 자동 수집 API
    ├── collect-naver.ts  # 네이버 API 호출
    ├── keywords.ts       # 키워드 조회
    └── ...
```

## 📊 작동 방식

### 일반 API 요청
1. 브라우저 → `https://0-nkey.pages.dev/api/...`
2. `_middleware.ts`가 요청을 라우팅
3. 해당 API Function 실행
4. `env.DB`로 D1 접근
5. 응답 반환

### Scheduled Cron 실행
1. Cloudflare 스케줄러가 시간마다 트리거
2. `functions/_cron.ts`의 `onScheduled` 함수 실행
3. `env.DB`로 미사용 시드 조회
4. 내부 API 호출로 키워드 수집
5. 결과를 D1에 저장

## ⚠️ 주의사항

1. **Workers vs Pages Functions**
   - 현재 환경은 **Cloudflare Pages Functions** 사용
   - 별도의 Workers 배포 불필요
   - 모든 로직은 `functions/` 폴더에 있음

2. **환경 변수**
   - Cloudflare Dashboard → Pages → Settings → Environment Variables
   - D1 바인딩은 `wrangler.toml`에서 설정

3. **Scheduled Functions**
   - Pages Functions에서 지원됨
   - Dashboard에서 Scheduled Triggers 설정 필요
   - `functions/_cron.ts` 파일 필요

## 🎯 확인 방법

### 1. 로그 확인
```
Cloudflare Dashboard → Workers & Pages → 0_nkey → Logs
```

### 2. D1 데이터 확인
```sql
-- Wrangler CLI
wrangler d1 execute 0_nkey_db --command="SELECT COUNT(*) FROM keywords"
```

### 3. Cron 실행 확인
```
Dashboard → Logs → [Cron] 접두사로 검색
```

## ✅ 최종 확인

현재 설정은 **Cloudflare Pages 환경**에 맞게 구성되어 있습니다:
- ✅ Pages Functions 사용
- ✅ D1 데이터베이스 바인딩
- ✅ Scheduled Functions (Cron)
- ✅ 모든 API가 Pages Functions로 구현

별도의 Workers 배포는 필요 없습니다.


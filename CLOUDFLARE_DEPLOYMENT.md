# 클라우드플레어 데이터베이스 & 크론 설정 가이드

## 🗄️ 클라우드플레어 D1 데이터베이스 설정

### 1. D1 데이터베이스 생성

```bash
# Wrangler CLI 설치 (이미 설치되어 있다면 생략)
npm install -g wrangler

# 로그인
wrangler login

# D1 데이터베이스 생성
wrangler d1 create 0_nkey_db
```

### 2. 데이터베이스 ID 업데이트

생성된 데이터베이스 ID를 `wrangler.toml`에 업데이트:

```toml
[[d1_databases]]
binding = "DB"
database_name = "0_nkey_db"
database_id = "your-actual-database-id-here"  # 여기에 실제 ID 입력
```

### 3. 스키마 적용

```bash
# 스키마 적용
wrangler d1 execute 0_nkey_db --file=./schema.sql
```

## ⏰ 클라우드플레어 Workers 크론 설정

### 1. Workers 배포

```bash
# 크론 Workers 배포
wrangler deploy --config wrangler.toml
```

### 2. 크론 트리거 설정 확인

`wrangler.toml`에서 크론 설정이 올바른지 확인:

```toml
[[triggers]]
crons = ["0 2 * * *"]  # 매일 02:00 UTC에 실행
```

### 3. 크론 작업 테스트

```bash
# 수동으로 크론 작업 실행
curl -X POST https://your-worker-domain.workers.dev/cron/auto-collect
```

## 🔧 환경 변수 설정

### 1. 클라우드플레어 대시보드에서 설정

#### **API Workers (0_nkey-api) 설정**:
1. **Workers & Pages** → **0_nkey-api** → **Settings** → **Variables**
2. 다음 환경 변수들을 **하나씩 추가**:

```
변수명: ADMIN_KEY
값: dev-key-2024

변수명: NAVER_CLIENT_ID  
값: your-naver-client-id

변수명: NAVER_CLIENT_SECRET
값: your-naver-client-secret

변수명: NAVER_API_KEY_1
값: your-first-api-key

변수명: NAVER_API_KEY_2
값: your-second-api-key

변수명: NAVER_API_KEY_3
값: your-third-api-key

변수명: NAVER_API_KEY_4
값: your-fourth-api-key

변수명: NAVER_API_KEY_5
값: your-fifth-api-key
```

#### **크론 Workers (0_nkey-workers) 설정**:
1. **Workers & Pages** → **0_nkey-workers** → **Settings** → **Variables**
2. 위와 동일한 환경 변수들을 **하나씩 추가**

### 2. 로컬 개발용 .env 파일

```bash
# .env.local
ADMIN_KEY=dev-key-2024
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
```

## 📊 API 엔드포인트

### 키워드 수집
```
POST /api/collect
Headers: x-admin-key: dev-key-2024
Body: {
  "seed": "블로그 마케팅",
  "keywords": [...]
}
```

### 키워드 조회
```
GET /api/keywords?page=1&limit=50
Headers: x-admin-key: dev-key-2024
```

### 헬스 체크
```
GET /api/health
```

### 크론 작업
```
POST /cron/auto-collect    # 자동 수집
POST /cron/cleanup         # 정리 작업
```

## 🚀 배포 순서

1. **D1 데이터베이스 생성 및 스키마 적용**
2. **wrangler.toml에 데이터베이스 ID 업데이트**
3. **환경 변수 설정**
4. **Workers 배포**
5. **Pages 재배포 (functions 폴더 포함)**

## 🔍 모니터링

### 로그 확인
```bash
# Workers 로그 확인
wrangler tail

# D1 쿼리 로그 확인
wrangler d1 execute 0_nkey_db --command="SELECT * FROM collect_logs ORDER BY created_at DESC LIMIT 10"
```

### 데이터베이스 상태 확인
```bash
# 테이블 목록 확인
wrangler d1 execute 0_nkey_db --command="SELECT name FROM sqlite_master WHERE type='table'"

# 키워드 수 확인
wrangler d1 execute 0_nkey_db --command="SELECT COUNT(*) as total FROM keywords"
```

## ⚠️ 주의사항

1. **데이터베이스 ID**: `wrangler.toml`의 `database_id`를 실제 생성된 ID로 반드시 업데이트
2. **환경 변수**: 민감한 정보는 클라우드플레어 대시보드에서 설정
3. **크론 실행**: 처음 배포 후 수동으로 한 번 실행하여 정상 작동 확인
4. **API 키**: 네이버 API 키가 유효한지 확인

## 🆘 문제 해결

### 일반적인 문제들

1. **데이터베이스 연결 실패**
   - `database_id`가 올바른지 확인
   - 스키마가 적용되었는지 확인

2. **크론 작업이 실행되지 않음**
   - `wrangler.toml`의 크론 설정 확인
   - Workers가 정상 배포되었는지 확인

3. **API 인증 실패**
   - `ADMIN_KEY` 환경 변수 확인
   - 요청 헤더에 `x-admin-key` 포함 확인
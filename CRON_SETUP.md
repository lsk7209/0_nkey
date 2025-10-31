# 자동 수집 크론 작업 설정 가이드

브라우저 없이도 자동으로 키워드를 수집하는 시스템 설정 방법입니다.

## 📋 설정 단계

### 1. Cloudflare Dashboard에서 Scheduled Triggers 설정

1. **Cloudflare Dashboard** 접속
2. **Workers & Pages** → **0_nkey** 프로젝트 선택
3. **Settings** → **Functions** → **Scheduled Triggers** 이동
4. **Create Trigger** 클릭

### 2. 크론 표현식 설정

**권장 설정:**
- **Cron Expression**: `*/10 * * * *` (10분마다 실행)
- **Path**: `/` (빈 값 또는 `/`)

**다른 옵션:**
- `*/5 * * * *` - 5분마다 (빠른 수집, API 제한 주의)
- `*/15 * * * *` - 15분마다 (안정적인 수집)
- `*/30 * * * *` - 30분마다 (느린 수집)
- `0 */1 * * *` - 1시간마다
- `0 */2 * * *` - 2시간마다

### 3. 함수 확인

`functions/_cron.ts` 파일이 존재하는지 확인:
- 파일 위치: `functions/_cron.ts`
- Export 함수: `onScheduled`

### 4. 배포

변경사항을 GitHub에 푸시하면 자동 배포됩니다:
```bash
git add functions/_cron.ts
git commit -m "feat: 자동 수집 크론 작업 추가"
git push origin main
```

## 🔍 작동 방식

1. **크론 트리거**: 설정한 시간마다 자동 실행
2. **미사용 시드 조회**: `auto_seed_usage` 테虽有블에 없는 키워드 조회
3. **자동 수집**: 각 시드 키워드로 연관검색어 수집
4. **DB 저장**: 수집된 키워드를 D1 데이터베이스에 저장
5. **사용 기록**: `auto_seed_usage` 테이블에 기록하여 중복 방지

## 📊 모니터링

### 로그 확인

1. **Cloudflare Dashboard** → **Workers & Pages** → **0_nkey** → **Logs**
2. `[Cron]` 접두사로 시작하는 로그 확인

### 데이터베이스 로그 확인

```sql
SELECT * FROM collect_logs 
WHERE keyword = 'AUTO_COLLECT_CRON' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 수집 현황 확인

- **데이터 페이지**: `/data`에서 키워드 수 증가 확인
- **자동수집 페이지**: `/auto-collect`에서 처리된 시드 확인

## ⚙️ 설정 변경

### 크론 주기 변경

Cloudflare Dashboard → Scheduled Triggers → 기존 트리거 편집

### 한 번에 처리할 시드 수 변경

`functions/_cron.ts` 파일의 `limit: 10` 값 수정:
```typescript
body: JSON.stringify({ limit: 10 }) // 이 값을 변경
```

### 크론 작업 비활성화

Cloudflare Dashboard → Scheduled Triggers → 트리거 삭제 또는 비활성화

## 🛠️ 문제 해결

### 크론이 실행되지 않는 경우

1. **Scheduled Triggers 설정 확인**
   - 트리거가 생성되어 있는지 확인
   - Cron expression이 올바른지 확인

2. **함수 파일 확인**
   - `functions/_cron.ts` 파일이 존재하는지 확인
   - `onScheduled` 함수가 export되어 있는지 확인

3. **로그 확인**
   - Cloudflare Dashboard → Logs에서 에러 메시지 확인

### API 호출 실패

1. **환경 변수 확인**
   - `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 설정 확인
   - `x-admin-key`가 올바른지 확인

2. **Rate Limit**
   - 너무 짧은 간격으로 설정했는지 확인
   - 최소 10분 간격 권장

## 📝 주의사항

1. **API 제한**: 네이버 API의 Rate Limit을 고려하여 적절한 간격 설정
2. **비용**: 크론 작업이 많을수록 Cloudflare Functions 실행 횟수 증가
3. **데이터베이스**: D1 데이터베이스의 Lors limit 고려

## 🎯 권장 설정

- **초기 설정**: `*/10 * * * *` (10분마다)
- **안정화 후**: `*/30 * * * *` (30분마다)
- **한 번에 처리**: 10개 시드 (API 제한 고려)

## ✅ 확인 체크리스트

- [ ] `functions/_cron.ts` 파일 생성됨
- [ ] Cloudflare Dashboard에서 Scheduled Trigger 생성됨
- [ ] Cron expression 설정됨
- [ ] 환경 변수 설정됨
- [ ] 첫 실행 후 로그 확인
- [ ] 데이터베이스에 키워드가 수집되는지 확인


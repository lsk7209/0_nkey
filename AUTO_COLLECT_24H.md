# 24시간 자동수집 가이드

## 🎯 개요

24시간 쉬지 않고 자동으로 키워드를 수집하는 시스템입니다. 여러 방법을 조합하여 안정적으로 작동합니다.

## 🔄 작동 방식

### 1. Cloudflare Cron (서버 사이드) - 주요 방법
- **위치**: `functions/_cron.ts`
- **실행 주기**: 5분마다 (설정 가능)
- **특징**: 브라우저가 없어도 자동 실행
- **처리량**: 한 번에 50개 시드 처리
- **설정**: Cloudflare Dashboard → Pages → 0_nkey → Settings → Functions → Scheduled Triggers

**크론 표현식 설정:**
```
*/5 * * * *  (5분마다 실행)
```

### 2. Service Worker (백그라운드 모드)
- **위치**: `public/sw.js`
- **실행 주기**: 30초마다
- **특징**: 브라우저가 열려있을 때만 작동
- **처리량**: 한 번에 50개 시드 처리

### 3. 포그라운드 모드
- **위치**: `src/app/auto-collect/page.tsx`
- **실행 주기**: 3초마다
- **특징**: 브라우저가 열려있을 때만 작동
- **처리량**: 한 번에 50개 시드 처리

## ✅ 설정 방법

### 1. Cloudflare Cron 설정 (필수)

1. **Cloudflare Dashboard** 접속
2. **Workers & Pages** → **0_nkey** 프로젝트 선택
3. **Settings** → **Functions** → **Scheduled Triggers** 이동
4. **Create Trigger** 클릭
5. **Cron Expression**: `*/5 * * * *` 입력
6. **Path**: `/` (빈 값)
7. **Save** 클릭

### 2. 브라우저 접속 시 자동 시작

- 자동수집 페이지(`/auto-collect`)에 접속하면 자동으로 시작됩니다
- 기본값: 자동수집 활성화 (24시간 무한 수집 모드)
- 브라우저가 열려있을 때는 Service Worker 또는 포그라운드 모드로 작동

## 📊 모니터링

### Cloudflare Dashboard 로그 확인

1. **Workers & Pages** → **0_nkey** → **Logs**
2. `[Cron]` 접두사로 시작하는 로그 확인
3. 성공/실패 여부 확인

### 데이터베이스 로그 확인

```sql
SELECT * FROM collect_logs 
WHERE keyword = 'AUTO_COLLECT_CRON' 
ORDER BY created_at DESC 
LIMIT 20;
```

### 자동수집 페이지 확인

- URL: `https://0-nkey.pages.dev/auto-collect`
- 처리된 시드 수 확인
- 남은 시드 수 확인
- 로그 확인

## 🔧 문제 해결

### 자동수집이 작동하지 않는 경우

1. **Cloudflare Cron 확인**
   - Dashboard에서 Scheduled Triggers 설정 확인
   - 로그에서 `[Cron]` 메시지 확인
   - 최근 실행 시간 확인

2. **브라우저 자동수집 확인**
   - `/auto-collect` 페이지 접속
   - 자동수집 토글이 ON인지 확인
   - 브라우저 콘솔(F12)에서 `[AutoCollect]` 로그 확인

3. **남은 시드 확인**
   - 남은 시드가 0이면 새로운 키워드를 추가해야 함
   - 하지만 24시간 모드에서는 자동으로 재시도함

### 크론이 실행되지 않는 경우

1. **Scheduled Triggers 설정 확인**
   - Cron Expression이 올바른지 확인
   - Path가 올바른지 확인

2. **함수 파일 확인**
   - `functions/_cron.ts` 파일 존재 확인
   - `onScheduled` 함수 export 확인

3. **배포 확인**
   - 최근 배포가 완료되었는지 확인
   - GitHub에 푸시되었는지 확인

## 🎯 최적 설정

### 24시간 무한 수집을 위한 권장 설정

1. **Cloudflare Cron**: `*/5 * * * *` (5분마다)
2. **브라우저 자동수집**: 기본값 활성화
3. **시드 키워드 개수**: 0 (무제한)
4. **목표 키워드 수**: 0 (무제한)
5. **동시 처리 수**: 20 (5개 API 키 활용)

## 📈 성능

- **크론 작업**: 5분마다 50개 시드 처리
- **일일 처리량**: 약 14,400개 시드 (5분 × 288회 × 50개)
- **브라우저 모드**: 추가로 처리 (브라우저가 열려있을 때)

## ⚠️ 주의사항

1. **API 제한**: 네이버 API 제한을 고려하여 동시 처리 수 조정
2. **데이터베이스**: 대량 수집 시 D1 데이터베이스 용량 확인
3. **비용**: Cloudflare Pages Functions 사용량 확인


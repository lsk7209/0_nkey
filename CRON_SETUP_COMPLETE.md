# 백엔드 자동 수집 설정 완료 가이드

## ✅ 현재 상태

백엔드에서 **사이트 접속 없이도 자동으로 키워드를 수집**하는 시스템이 구현되어 있습니다.

### 구현된 기능
- ✅ Cloudflare Scheduled Functions (`functions/_cron.ts`)
- ✅ 브라우저 없이 자동 실행
- ✅ 타임아웃 최적화 적용 (30개 배치, 15개 동시 처리)
- ✅ 24시간 무한 수집 모드

## 🔧 Cloudflare Dashboard 설정 필요

**중요**: 코드는 준비되었지만, Cloudflare Dashboard에서 Scheduled Trigger를 설정해야 작동합니다.

### 설정 방법

1. **Cloudflare Dashboard 접속**
   - https://dash.cloudflare.com

2. **프로젝트 선택**
   - **Workers & Pages** → **0-nkey** 프로젝트 선택

3. **Scheduled Triggers 설정**
   - **Settings** 탭 클릭
   - **Functions** 섹션으로 스크롤
   - **Scheduled Triggers** 섹션 찾기

4. **Trigger 생성**
   - **Create Trigger** 또는 **Add Trigger** 클릭
   - **Cron Expression**: `*/5 * * * *` 입력 (5분마다 실행)
   - **Path**: 빈 값 또는 `/` (기본값)
   - **Save** 클릭

### 권장 Cron 표현식

| 표현식 | 설명 | 권장도 |
|--------|------|--------|
| `*/5 * * * *` | 5분마다 | ⭐⭐⭐ 권장 (빠른 수집) |
| `*/10 * * * *` | 10분마다 | ⭐⭐ 안정적 |
| `*/15 * * * *` | 15분마다 | ⭐ 보수적 |

## 📊 작동 방식

### 실행 흐름

1. **Cloudflare Cron 트리거**
   - 설정한 시간마다 자동 실행
   - 브라우저와 무관하게 작동

2. **자동 수집 실행**
   - `functions/_cron.ts`의 `onScheduled` 함수 실행
   - `/api/auto-collect` API 호출
   - 30개 시드 처리 (동시 처리 15개)

3. **결과 저장**
   - 수집된 키워드를 D1 데이터베이스에 저장
   - 로그를 `collect_logs` 테이블에 기록

### 처리량

- **배치 크기**: 30개 시드/회
- **동시 처리**: 15개
- **실행 주기**: 5분마다 (설정에 따라)
- **일일 처리량**: 약 8,640개 시드 (5분마다 실행 시)

## 🔍 모니터링

### Cloudflare Dashboard에서 확인

1. **Workers & Pages** → **0-nkey** → **Logs**
2. `[Cron]` 접두사로 시작하는 로그 확인
3. 성공/실패 여부 확인

### 로그 예시

```
[Cron] Scheduled event triggered: */5 * * * *, scheduledTime: 1234567890
[Cron] Starting auto collect (24-hour mode)...
[Cron] Auto collect completed: 30 seeds processed, 450 keywords saved, 772580 seeds remaining
[Cron] Auto collect finished: 30 seeds, 450 keywords saved, 772580 remaining (24-hour mode)
```

### 데이터베이스에서 확인

```sql
-- 최근 크론 실행 로그 확인
SELECT * FROM collect_logs 
WHERE keyword = 'AUTO_COLLECT_CRON' 
ORDER BY created_at DESC 
LIMIT 10;
```

## ⚠️ 문제 해결

### Cron이 실행되지 않는 경우

1. **Scheduled Trigger 확인**
   - Cloudflare Dashboard에서 Trigger가 설정되어 있는지 확인
   - Cron 표현식이 올바른지 확인

2. **함수 파일 확인**
   - `functions/_cron.ts` 파일이 존재하는지 확인
   - `onScheduled` 함수가 export되어 있는지 확인

3. **배포 확인**
   - 최신 코드가 배포되었는지 확인
   - GitHub Actions 배포 상태 확인

### 로그가 없는 경우

- Cloudflare Dashboard → Logs에서 확인
- `[Cron]` 접두사로 필터링
- 최근 24시간 로그 확인

## 🎯 최적화 설정

현재 최적화된 설정:
- ✅ 배치 크기: 30개 (타임아웃 감소)
- ✅ 동시 처리: 15개 (타임아웃 감소)
- ✅ 타임아웃: 5분
- ✅ 재시도: 자동 (다음 Cron에서)

## 📝 요약

1. **코드 준비 완료**: `functions/_cron.ts` 구현됨
2. **설정 필요**: Cloudflare Dashboard에서 Scheduled Trigger 설정
3. **자동 실행**: 설정 후 브라우저 없이 자동 실행
4. **모니터링**: Cloudflare Dashboard Logs에서 확인 가능

**다음 단계**: Cloudflare Dashboard에서 Scheduled Trigger를 설정하세요!


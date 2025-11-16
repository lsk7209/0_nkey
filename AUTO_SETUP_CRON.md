# 크론 자동 설정 가이드

## ⚠️ 중요 안내

**Cloudflare Pages의 Scheduled Functions는 API로 자동 설정할 수 없습니다.** Dashboard에서 수동으로 설정해야 합니다.

하지만 **별도의 Cloudflare Workers를 사용**하면 코드로 크론을 설정할 수 있습니다.

## 🎯 방법 1: Dashboard에서 수동 설정 (권장)

### 빠른 설정 (1분)

1. **Cloudflare Dashboard 접속**
   - https://dash.cloudflare.com

2. **프로젝트 선택**
   - **Workers & Pages** → **0-nkey** 선택

3. **Scheduled Triggers 설정**
   - **Settings** 탭 → **Functions** 섹션
   - **Scheduled Triggers** → **Create Trigger**
   - **Cron Expression**: `*/5 * * * *` 입력
   - **Path**: 빈 값 또는 `/`
   - **Save** 클릭

✅ **완료!** 이제 5분마다 자동으로 실행됩니다.

## 🚀 방법 2: 별도 Workers로 크론 설정 (자동화 가능)

별도의 Workers를 만들어서 크론을 설정하면 코드로 관리할 수 있습니다.

### 설정 방법

1. **Workers 생성**
   ```bash
   wrangler init cron-worker
   cd cron-worker
   ```

2. **wrangler.toml 설정**
   ```toml
   name = "0-nkey-cron"
   main = "src/index.ts"
   compatibility_date = "2024-01-01"
   
   [triggers]
   crons = ["*/5 * * * *"]  # 5분마다 실행
   ```

3. **Worker 코드 작성**
   ```typescript
   export default {
     async scheduled(event, env, ctx) {
       // Pages API 호출
       await fetch('https://0-nkey.pages.dev/api/auto-collect', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-admin-key': 'dev-key-2024'
         },
         body: JSON.stringify({
           limit: 30,
           concurrent: 15,
           targetKeywords: 0
         })
       });
     }
   };
   ```

4. **배포**
   ```bash
   wrangler deploy
   ```

## 📋 현재 상태

- ✅ `functions/_cron.ts` 파일 준비 완료
- ✅ 최적화된 설정 적용 (30개 배치, 15개 동시 처리)
- ⚠️ Scheduled Trigger 설정 필요 (Dashboard에서)

## 🔍 확인 방법

설정 후 Cloudflare Dashboard → Logs에서 확인:
- `[Cron]` 접두사로 시작하는 로그
- 5분마다 실행되는지 확인

## 💡 추천

**가장 빠른 방법**: Dashboard에서 수동 설정 (1분 소요)
- 코드는 이미 준비되어 있음
- Dashboard에서만 Trigger 추가하면 됨


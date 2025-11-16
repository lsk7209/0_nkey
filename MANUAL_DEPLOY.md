# 수동 배포 가이드

## 🚀 자동 배포가 실패한 경우

GitHub Actions 자동 배포가 실패하거나 작동하지 않는 경우, 다음 방법으로 수동 배포할 수 있습니다.

## 방법 1: GitHub Actions에서 수동 실행

1. **GitHub 저장소 접속**: https://github.com/lsk7209/0_nkey
2. **Actions 탭** 클릭
3. **"Deploy to Cloudflare Pages"** 워크플로우 선택
4. **"Run workflow"** 버튼 클릭
5. 브랜치 선택: `main`
6. **"Run workflow"** 클릭

## 방법 2: Wrangler CLI로 직접 배포

### 사전 준비

1. **Wrangler CLI 설치** (이미 설치되어 있다면 생략)
```bash
npm install -g wrangler
```

2. **Cloudflare 로그인**
```bash
wrangler login
```

3. **프로젝트 빌드**
```bash
npm install
npm run build
```

### 배포 실행

```bash
# Cloudflare Pages에 배포
npx wrangler pages deploy out --project-name=0-nkey
```

또는

```bash
# package.json의 스크립트 사용
npm run deploy:pages
```

## 방법 3: Cloudflare Dashboard에서 배포

1. **Cloudflare Dashboard 접속**: https://dash.cloudflare.com
2. **Workers & Pages** → **0-nkey** 선택
3. **"Upload assets"** 또는 **"Deployments"** 탭에서 수동 업로드
4. 빌드된 `out` 폴더의 내용을 업로드

## ⚠️ 주의사항

### 빌드 전 확인
- `npm run build`가 성공하는지 확인
- `out` 폴더가 생성되는지 확인
- TypeScript 오류가 없는지 확인

### 환경 변수 확인
수동 배포 시에도 환경 변수가 설정되어 있어야 합니다:
- Cloudflare Dashboard → **Workers & Pages** → **0-nkey** → **Settings** → **Environment variables**

필수 환경 변수:
- `NAVER_API_KEY_1` ~ `NAVER_API_KEY_5`
- `NAVER_API_SECRET_1` ~ `NAVER_API_SECRET_5`
- `NAVER_CUSTOMER_ID_1` ~ `NAVER_CUSTOMER_ID_5`
- `NAVER_OPENAPI_KEY_1` ~ `NAVER_OPENAPI_KEY_10` (선택)
- `NAVER_OPENAPI_SECRET_1` ~ `NAVER_OPENAPI_SECRET_10` (선택)

## 🔍 배포 확인

배포 완료 후 다음 URL에서 확인:
- **배포 사이트**: https://0-nkey.pages.dev
- **API 테스트**: https://0-nkey.pages.dev/api/auto-collect

## 📞 문제 해결

### 빌드 실패
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 빌드 재시도
npm run build
```

### 배포 실패
- Cloudflare API 토큰 확인
- 프로젝트 이름 확인 (`0-nkey`)
- 빌드 출력 디렉토리 확인 (`out`)

### Functions 작동 안 함
- `functions/` 폴더가 올바르게 배포되었는지 확인
- Cloudflare Dashboard → **Functions** 탭에서 확인


# 배포 체크리스트

## 🔍 배포 전 확인 사항

### 1. Git 상태 확인
- [ ] 모든 변경사항 커밋됨
- [ ] 충돌 없음
- [ ] rebase/merge 진행 중 아님

### 2. 코드 검증
- [ ] TypeScript 컴파일 오류 없음
- [ ] ESLint 경고 확인 (치명적 오류 없음)
- [ ] 빌드 성공 (`npm run build`)

### 3. GitHub Actions 설정
- [ ] `.github/workflows/deploy.yml` 존재
- [ ] Secrets 설정됨:
  - [ ] `CLOUDFLARE_API_TOKEN`
  - [ ] `CLOUDFLARE_ACCOUNT_ID`

### 4. Cloudflare Pages 설정
- [ ] 프로젝트 이름: `0-nkey`
- [ ] 빌드 명령: `npm run build`
- [ ] 빌드 출력 디렉토리: `out`
- [ ] 환경 변수 설정됨

## 🚀 배포 프로세스

### 자동 배포 (권장)
```bash
# 1. 변경사항 커밋
git add .
git commit -m "feat: 변경사항 설명"

# 2. 푸시 (자동 배포 트리거)
git push origin main
```

### 수동 배포
1. GitHub 저장소 → Actions 탭
2. "Deploy to Cloudflare Pages" 선택
3. "Run workflow" 클릭

## ⚠️ 문제 해결

### 배포가 멈추는 경우

#### 1. Git 충돌 해결
```bash
# rebase 중단
git rebase --abort

# 최신 코드 가져오기
git fetch origin main
git pull origin main

# 충돌 해결 후 다시 푸시
git add .
git commit -m "fix: 충돌 해결"
git push origin main
```

#### 2. 빌드 실패
- 로컬에서 빌드 테스트: `npm run build`
- 빌드 오류 확인 및 수정
- TypeScript 오류 확인: `npx tsc --noEmit`

#### 3. Secrets 미설정
- GitHub 저장소 → Settings → Secrets and variables → Actions
- `CLOUDFLARE_API_TOKEN` 추가
- `CLOUDFLARE_ACCOUNT_ID` 추가

#### 4. Cloudflare 인증 실패
- API 토큰 권한 확인 (Pages:Edit 필요)
- Account ID 확인

## 📊 배포 상태 확인

### GitHub Actions
- 저장소 → Actions 탭
- 최근 워크플로우 실행 상태 확인
- 각 단계별 로그 확인

### Cloudflare Dashboard
- Workers & Pages → 0-nkey
- Deployments 탭에서 배포 이력 확인

## ✅ 배포 완료 확인

1. **배포 URL 접속**: https://0-nkey.pages.dev
2. **기능 테스트**: 각 페이지 정상 작동 확인
3. **API 테스트**: `/api/auto-collect` 등 API 엔드포인트 확인


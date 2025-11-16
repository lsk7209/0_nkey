# GitHub 자동 배포 가이드

## 🚀 개요

이 프로젝트는 GitHub Actions를 통해 Cloudflare Pages에 자동으로 배포됩니다.

## 📋 배포 워크플로우

### 1. 자동 배포 트리거

다음 상황에서 자동 배포가 실행됩니다:

- **main/master 브랜치에 push** → 자동 배포
- **수동 실행** → GitHub Actions에서 "Deploy to Cloudflare Pages" 워크플로우 수동 실행 가능
- **Pull Request** → 빌드 체크만 수행 (배포하지 않음)

### 2. 배포 프로세스

```
1. 코드 체크아웃
   ↓
2. Node.js 설정 (v18)
   ↓
3. 의존성 설치 (npm ci)
   ↓
4. 린터 실행 (경고만, 에러로 실패하지 않음)
   ↓
5. Next.js 빌드 (production 모드)
   ↓
6. 빌드 출력 확인
   ↓
7. Cloudflare Pages 배포
   ↓
8. 배포 완료 알림
```

## 🔧 설정 방법

### 1. GitHub Secrets 설정

GitHub 저장소의 **Settings** → **Secrets and variables** → **Actions**에서 다음 시크릿을 추가하세요:

#### 필수 시크릿

```
CLOUDFLARE_API_TOKEN
- 설명: Cloudflare API 토큰
- 생성 방법:
  1. Cloudflare Dashboard → My Profile → API Tokens
  2. "Create Token" 클릭
  3. "Edit Cloudflare Workers" 템플릿 선택
  4. 권한 설정:
     - Account: Cloudflare Pages:Edit
     - Account: Account:Read
     - Zone: Zone:Read
  5. 토큰 생성 후 복사하여 GitHub Secrets에 추가

CLOUDFLARE_ACCOUNT_ID
- 설명: Cloudflare 계정 ID
- 찾는 방법:
  1. Cloudflare Dashboard → 우측 사이드바 하단
  2. "Account ID" 복사
  3. GitHub Secrets에 추가
```

### 2. Cloudflare Pages 프로젝트 생성

1. **Cloudflare Dashboard** 접속
2. **Workers & Pages** → **Pages** → **Create a project**
3. **Connect to Git** 선택
4. GitHub 저장소 선택
5. 프로젝트 이름: `0-nkey`
6. 프로덕션 브랜치: `main` 또는 `master`
7. 빌드 설정:
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
   - **Root directory**: `/` (기본값)

### 3. 환경 변수 설정 (Cloudflare Pages)

Cloudflare Dashboard → **Workers & Pages** → **0-nkey** → **Settings** → **Environment variables**에서 설정:

#### 프로덕션 환경 변수

```
NAVER_API_KEY_1=your-api-key-1
NAVER_API_SECRET_1=your-api-secret-1
NAVER_CUSTOMER_ID_1=your-customer-id-1
NAVER_API_KEY_2=your-api-key-2
NAVER_API_SECRET_2=your-api-secret-2
NAVER_CUSTOMER_ID_2=your-customer-id-2
... (최대 5개까지)

NAVER_OPENAPI_KEY_1=your-openapi-key-1
NAVER_OPENAPI_SECRET_1=your-openapi-secret-1
... (최대 10개까지)
```

## 📊 배포 상태 확인

### GitHub Actions에서 확인

1. GitHub 저장소 → **Actions** 탭
2. 최근 워크플로우 실행 상태 확인
3. 각 단계별 로그 확인 가능

### Cloudflare Dashboard에서 확인

1. **Workers & Pages** → **0-nkey**
2. **Deployments** 탭에서 배포 이력 확인
3. 각 배포의 상세 정보 확인 가능

## 🔍 문제 해결

### 배포 실패 시

#### 1. 빌드 실패

**증상**: "Build Next.js" 단계에서 실패

**해결 방법**:
```bash
# 로컬에서 빌드 테스트
npm ci
npm run build

# 빌드 오류 확인 및 수정
```

#### 2. Cloudflare 인증 실패

**증상**: "Deploy to Cloudflare Pages" 단계에서 인증 오류

**해결 방법**:
- `CLOUDFLARE_API_TOKEN`이 올바른지 확인
- 토큰 권한이 충분한지 확인 (Pages:Edit 필요)
- `CLOUDFLARE_ACCOUNT_ID`가 올바른지 확인

#### 3. 빌드 출력 디렉토리 없음

**증상**: "Check build output" 단계에서 실패

**해결 방법**:
- `next.config.js`에서 `output: 'export'` 설정 확인
- `out` 디렉토리가 생성되는지 확인

### 배포는 성공했지만 사이트가 작동하지 않음

#### 1. 환경 변수 확인

- Cloudflare Dashboard에서 환경 변수가 올바르게 설정되었는지 확인
- Pages Functions에서 `env` 객체로 접근 가능한지 확인

#### 2. Functions 확인

- `functions/` 폴더의 파일들이 올바르게 배포되었는지 확인
- Cloudflare Dashboard → **Functions** 탭에서 확인

#### 3. D1 데이터베이스 확인

- `wrangler.toml`의 데이터베이스 ID가 올바른지 확인
- 데이터베이스가 생성되고 스키마가 적용되었는지 확인

## 🎯 배포 최적화

### 빌드 캐싱

워크플로우에서 자동으로 npm 캐시를 사용하여 빌드 시간을 단축합니다.

### 병렬 실행

빌드와 배포가 분리되어 있어 더 빠른 피드백을 받을 수 있습니다.

### PR 체크

Pull Request에서는 배포하지 않고 빌드만 확인하여 불필요한 배포를 방지합니다.

## 📝 배포 알림

배포가 완료되면 GitHub Actions에서 자동으로 요약을 생성합니다:

- 배포 URL
- 배포 시간
- 커밋 정보
- 브랜치 정보

## ⚠️ 주의사항

1. **환경 변수**: 민감한 정보는 GitHub Secrets가 아닌 Cloudflare Dashboard에서 설정
2. **빌드 시간**: 빌드는 약 2-5분 소요될 수 있습니다
3. **배포 시간**: 배포는 약 1-3분 소요될 수 있습니다
4. **Rate Limit**: GitHub Actions의 무료 플랜 제한 확인

## 🔄 수동 배포

필요시 수동으로 배포할 수 있습니다:

```bash
# 로컬에서 빌드
npm run build

# Cloudflare Pages에 배포
npx wrangler pages deploy out --project-name=0-nkey
```

또는 GitHub Actions에서 "Deploy to Cloudflare Pages" 워크플로우를 수동으로 실행할 수 있습니다.

## 📚 참고 자료

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages Action](https://github.com/cloudflare/pages-action)


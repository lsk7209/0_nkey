# 0_nkey - 키워드 수집 도구

클라우드플레어 Pages Functions와 D1 데이터베이스를 사용하는 키워드 수집 및 분석 도구입니다.

## 🏛️ 헌법 (Constitution) - 절대 불변 규칙

> **⚠️ 최우선 중요**: 모든 개발자는 반드시 헌법을 먼저 확인하고 준수해야 합니다.

**헌법 문서**: [`CONSTITUTION.md`](./CONSTITUTION.md) - 절대 변경 금지 문서  
**아키텍처 문서**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) - 시스템 구조 상세 설명

### 핵심 헌법 원칙
1. Cloudflare Pages Functions 아키텍처 (절대 Workers 단독 배포 아님)
2. API 응답에 `keywords` 배열 필수 포함
3. 필드명 절대 변경 금지 (`pc_search`, `mobile_search` 등)
4. 프론트엔드에서 API 응답 직접 사용 (샘플 데이터 생성 금지)

## 🚀 기능

- **시드 키워드 기반 연관검색어 수집**: 네이버 SearchAd API로 실제 연관검색어 수집
- **Cloudflare D1 데이터베이스 저장**: 서버사이드 데이터베이스에 안전하게 저장
- **네이버 OpenAPI 통합**: 블로그, 카페, 웹, 뉴스 문서수 자동 수집
- **실시간 데이터 표시**: API 응답에서 직접 키워드 데이터 표시
- **반응형 UI**: 모바일과 데스크톱에서 모두 사용 가능

## 🛠️ 기술 스택

- **Next.js 14**: React 기반 프레임워크
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **클라우드플레어 페이지**: 정적 호스팅

## 📦 설치 및 실행

### 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### 빌드

```bash
# 프로덕션 빌드
npm run build
```

## 🌐 배포

이 프로젝트는 클라우드플레어 페이지에 최적화되어 있습니다:

1. **GitHub에 푸시**
2. **클라우드플레어 페이지에서 GitHub 연결**
3. **빌드 설정**:
   - 빌드 명령: `npm run build`
   - 출력 디렉토리: `out`

## 📱 사용 방법

1. **키워드 수집**:
   - 메인 페이지에서 시드 키워드 입력
   - "연관검색어 수집" 버튼 클릭
   - 수집된 키워드가 로컬 스토리지에 저장됨

2. **데이터 관리**:
   - 데이터 페이지에서 저장된 키워드 조회
   - JSON 파일로 데이터 내보내기
   - 필요시 전체 데이터 삭제

## 🛠️ 기술 스택

- **Next.js 14**: React 기반 프레임워크 (App Router)
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **Cloudflare Pages Functions**: 서버사이드 API 로직
- **Cloudflare D1**: 서버사이드 SQL 데이터베이스
- **네이버 SearchAd API**: 연관검색어 수집
- **네이버 OpenAPI**: 문서수 수집

## ⚠️ 주의사항

- **헌법 준수 필수**: 모든 개발 시 [`CONSTITUTION.md`](./CONSTITUTION.md) 확인 필수
- **Pages Functions**: 서버사이드 API는 Pages Functions에서 처리됩니다
- **D1 데이터베이스**: 데이터는 Cloudflare D1에 안전하게 저장됩니다
- **네이버 API 쿼터**: 네이버 API 호출 제한을 확인하세요

## 🔧 개발 정보

- **프로젝트 구조**: Next.js App Router 사용
- **스타일링**: Tailwind CSS
- **타입 체킹**: TypeScript
- **빌드 최적화**: SWC 컴파일러 사용

## 📄 라이선스

이 프로젝트는 개인 사용을 위한 도구입니다.
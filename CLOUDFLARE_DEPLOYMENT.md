# 클라우드플레어 배포 가이드

## 🚀 배포 계획

### **1. 호스팅: Cloudflare Pages**
- Next.js 앱을 Cloudflare Pages에 배포
- 자동 빌드 및 배포 설정

### **2. 데이터베이스: Cloudflare D1**
- SQLite 기반 서버리스 데이터베이스
- 로컬 JSON 파일을 D1 테이블로 마이그레이션

### **3. 크론: Cloudflare Workers Cron Triggers**
- 매일 새벽 2시 자동 문서수 수집
- Workers에서 D1 데이터베이스 직접 접근

## 📋 마이그레이션 체크리스트

### **데이터베이스 마이그레이션**
- [ ] `persistent-db.ts` → D1 클라이언트로 변경
- [ ] JSON 파일 → SQL 테이블 스키마 생성
- [ ] 데이터 마이그레이션 스크립트 작성

### **크론 작업 마이그레이션**
- [ ] `/api/cron/collect-docs` → Workers Cron Trigger로 변경
- [ ] 환경변수 설정 (Cloudflare Secrets)
- [ ] Rate Limiting 최적화

### **환경변수 설정**
- [ ] 네이버 검색광고 API 키
- [ ] 네이버 오픈API 키
- [ ] 관리자 키

## 🔧 현재 로컬 개발 상태

✅ **완료된 기능**
- 네이버 검색광고 API 연동 (절대규칙 준수)
- 네이버 오픈API 연동 (절대규칙 준수)
- 자동 키워드 수집 및 저장
- 문서수 자동 수집 (크론 작업)
- 데이터 정렬 (카페문서수 오름차순 + 검색량 내림차순)
- 중복 키워드 방지 (30일 규칙)

🔄 **로컬 개발 중**
- Rate Limiting 최적화
- 에러 처리 개선
- UI/UX 개선

📋 **클라우드플레어 배포 준비**
- D1 데이터베이스 스키마 설계
- Workers Cron 설정
- 환경변수 관리

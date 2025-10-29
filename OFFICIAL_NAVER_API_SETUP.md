# 공식 네이버 SearchAd API 설정 가이드

## ✅ 완전 전환 완료

이제 시스템이 **공식 네이버 SearchAd API**를 사용합니다.

## 🔧 환경변수 설정

Cloudflare Pages 환경변수에 다음을 추가하세요:

### 필수 환경변수
```
SEARCHAD_BASE=https://api.naver.com
SEARCHAD_API_KEY=your_access_license_key
SEARCHAD_SECRET=your_secret_key
SEARCHAD_CUSTOMER_ID=your_customer_id
```

## 📋 공식 API 사양

### 엔드포인트
- **Base URL**: `https://api.naver.com`
- **Endpoint**: `GET /keywordstool`
- **Query**: `hintKeywords=<키워드>&showDetail=1`

### 인증 헤더 (모두 필수)
- `X-Timestamp`: 현재 시간(ms)
- `X-API-KEY`: Access License
- `X-Customer`: Customer ID
- `X-Signature`: base64(HMAC_SHA256(secret, "{timestamp}.{METHOD}.{URI}"))

### 응답 데이터 매핑
- `relKeyword` → keyword
- `monthlyPcQcCnt` → pc_search
- `monthlyMobileQcCnt` → mobile_search
- `monthlyAvePcClkCnt` → monthly_click_pc
- `monthlyAveMobileClkCnt` → monthly_click_mo
- `monthlyAvePcCtr` → ctr_pc
- `monthlyAveMobileCtr` → ctr_mo
- `plAvgDepth` → ad_count
- `compIdx` → comp_idx

## 🚀 주요 개선사항

1. **✅ 비공식 API 호출 완전 제거**
2. **✅ 공식 네이버 SearchAd API 사용**
3. **✅ 올바른 인증 헤더 구현**
4. **✅ 429 Rate Limit 처리 (5분 쿨다운)**
5. **✅ `< 10` 문자열 정규화**
6. **✅ 공식 필드명 매핑**
7. **✅ 환경변수 기반 키 관리**

## 🔍 테스트 방법

1. 환경변수 설정 후 배포
2. 시드 키워드 입력
3. "연관검색어 수집" 버튼 클릭
4. 실제 네이버 API 데이터 확인

## 📚 참고 문서

- [네이버 SearchAd API 공식 문서](https://naver.github.io/searchad-apidoc/)
- [RelKwdStat API 가이드](https://www.dinolabs.ai/392)

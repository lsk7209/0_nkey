# 다중 API 키 설정 가이드

## 🔑 환경변수 설정

`.env.local` 파일에 다음 환경변수들을 추가하세요:

```bash
# 기본 API 키 (필수)
NAVER_CLIENT_ID=CjG3EpGT1B0Hg59qS4Yg
NAVER_CLIENT_SECRET=SXc9V2Ng68

# 추가 API 키들 (선택사항 - 속도 향상을 위해 권장)
NAVER_CLIENT_ID_2=your_second_client_id
NAVER_CLIENT_SECRET_2=your_second_client_secret

NAVER_CLIENT_ID_3=your_third_client_id
NAVER_CLIENT_SECRET_3=your_third_client_secret

NAVER_CLIENT_ID_4=your_fourth_client_id
NAVER_CLIENT_SECRET_4=your_fourth_client_secret

NAVER_CLIENT_ID_5=your_fifth_client_id
NAVER_CLIENT_SECRET_5=your_fifth_client_secret
```

## 🚀 성능 향상 효과

### **단일 키 vs 다중 키**

| 키 개수 | Rate Limit | 처리 속도 | 429 에러 |
|---------|------------|-----------|----------|
| 1개     | 25,000/일  | 기본      | 자주 발생 |
| 5개     | 125,000/일 | 5배 빠름  | 거의 없음 |

### **실제 성능 개선**

- **API 호출 간격**: 500ms → 200ms (2.5배 빠름)
- **Rate Limit 회피**: 키 순환으로 429 에러 최소화
- **병렬 처리**: 여러 키로 동시 처리 가능

## 📊 사용 예시

### **현재 로그 출력**
```
🔑 다중 API 키 로드: 5개 키 사용 가능
🔍 네이버 오픈API 호출: /v1/search/blog.json (시도 1/3, 키: CjG3EpGT...)
🔍 네이버 오픈API 호출: /v1/search/cafearticle.json (시도 1/3, 키: AbCdEfGh...)
```

### **키 순환 방식**
- 키1 → 키2 → 키3 → 키4 → 키5 → 키1 (순환)
- 각 API 호출마다 다른 키 사용
- Rate Limit 분산으로 안정성 확보

## ⚠️ 주의사항

1. **네이버 정책 준수**: 각 키는 개별 계정에서 발급받아야 함
2. **키 관리**: 환경변수로 안전하게 관리
3. **모니터링**: 각 키의 사용량 추적 권장

## 🔧 테스트 방법

1. 환경변수 설정 후 서버 재시작
2. 크론 테스트 페이지에서 실행: `http://localhost:3002/cron-test`
3. 로그에서 키 순환 확인
4. 처리 속도 개선 확인

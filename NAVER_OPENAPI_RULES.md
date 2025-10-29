# 네이버 오픈API 문서수 API 규칙 (절대 변경 금지)

## 🚨 중요: 이 문서의 내용은 절대 변경되거나 무시되어서는 안 됩니다.

## 1. 공통 인증

- **Base**: `https://openapi.naver.com`
- **Auth Header**
    - `X-Naver-Client-Id: <CLIENT_ID>`
    - `X-Naver-Client-Secret: <CLIENT_SECRET>`
- **메서드**: `GET`
- **쿼터**: 하루 25,000회 (검색 API 전체 합산)
- HTTPS 필수 / 프론트에서 직접 호출 금지(백엔드 프록시 추천)

---

## 2. 주요 서비스별 엔드포인트 & 파라미터

| 서비스 | Endpoint(JSON) | 필수 파라미터 | 선택 파라미터 | 정렬옵션 | 최대값 |
| --- | --- | --- | --- | --- | --- |
| **블로그** | `/v1/search/blog.json` | `query` | `display`(1~100), `start`(1~1000), `sort=sim/date` | sim/date | display 100 |
| **뉴스** | `/v1/search/news.json` | `query` | `display`, `start`, `sort=sim/date` | sim/date | display 100 |
| **책** | `/v1/search/book.json` | `query` | `display`, `start`, `sort=sim/date` | sim/date | display 100 |
| **백과사전** | `/v1/search/encyc.json` | `query` | `display`, `start` | - | display 100 |
| **지식iN** | `/v1/search/kin.json` | `query` | `display`, `start` | - | display 100 |
| **쇼핑** | `/v1/search/shop.json` | `query` | `display`, `start`, `sort=sim/date/asc/dsc` | sim/date/asc/dsc | display 100 |
| **웹문서** | `/v1/search/webkr.json` | `query` | `display`, `start` | - | display 100 |
| **카페글** | `/v1/search/cafearticle.json` | `query` | `display`, `start`, `sort=sim/date` | sim/date | display 100 |
| **지역** | `/v1/search/local.json` | `query` | `display`(1~5), `start`(1~5), `sort=random/comment` | random/comment | display 5 |
| **이미지** | `/v1/search/image` | `query` | `display`(1~100), `start`, `sort=sim/date`, `filter=all/large/medium/small` | sim/date | display 100 |
| **전문자료** | `/v1/search/doc.json` | `query` | `display`, `start` | - | display 100 |
| **오타변환** | `/v1/search/errata.json` | `query` | - | - | - |
| **성인검색어 판별** | `/v1/search/adult.json` | `query` | - | - | - |
| **문서(Document)** | `/v1/search/documents.json` | `query` | `display`, `start` | - | display 100 |

> start는 최대 1000까지, display는 API별 상한 참고.
> 
> 
> `sim` = 정확도순, `date` = 최신순.

---

## 3. 응답 공통 구조

```json
{
  "lastBuildDate": "Tue, 02 Oct 2025 10:00:00 +0900",
  "total": 12345,
  "start": 1,
  "display": 10,
  "items": [
    {
      "title": "검색결과 제목",
      "link": "https://...",
      "description": "요약 (HTML <b>태그 포함 가능)",
      "bloggername": "...",
      "bloggerlink": "...",
      "postdate": "20251001"
    }
  ]
}
```

> 이미지·쇼핑 등 일부 API는 thumbnail, price 등 추가 필드 포함.
> 
> 
> HTML `<b>` 태그 제거 처리 필요(XSS 주의).

---

## 4. 개발 아키텍처 (권장)

1. **프론트엔드**
    - 검색 입력 → 내부 API 호출 (직접 Client Secret 노출 금지)
2. **백엔드 프록시**
    - 파라미터 검증 후 Naver API 호출
    - 키는 환경변수 관리
    - 결과 표준화(JSON) 후 반환
3. **보안**
    - 키를 서버에만 저장
    - CORS 정책 제어
    - 레이트리밋 & 캐싱

---

## 5. 캐싱 & 페이징 전략

- **Key**: `query|sort|page|pageSize`
- **TTL**: 10~30분 (실시간성 필요 시 5분)
- `start = 1 + (page-1)*pageSize`, 단 `start<=1000`
- 25,000회/일 사용량 모니터링 (80% 도달 시 알림)

---

## 6. 에러/리트라이 가이드

- 4xx → 사용자 입력 검증
- 429/500 → 지수백오프 (300ms → 600ms → 1200ms)
- API 응답 불가 시 캐시된 데이터 반환

---

## 7. 타입 예시 (TypeScript)

```tsx
export type NaverItem = {
  title: string;
  link: string;
  description: string;
  bloggername?: string;
  bloggerlink?: string;
  postdate?: string;
  thumbnail?: string;
};

export type NaverSearchResponse = {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverItem[];
};
```

---

## 8. 통합 검색 표준 응답(예시)

```json
{
  "query": "AI 그림책",
  "results": {
    "blog": [...],
    "news": [...],
    "book": [...],
    "kin": [...],
    "shop": [...]
  }
}
```

---

## 9. 테스트 체크리스트

- [ ]  한글/영문/특수문자 검색어 UTF-8 인코딩
- [ ]  `display` 최대/최소값 테스트
- [ ]  `start > 1000` 차단
- [ ]  정렬 옵션(sid/date 등) 정상 작동
- [ ]  `<b>` 태그 제거 후 렌더링
- [ ]  네트워크 장애 시 재시도/캐시 확인
- [ ]  호출 한도 초과 시 graceful fallback

---

## 10. 빠른 예제 (Node.js/Next.js)

```tsx
const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent('AI 그림책')}&display=20`;
const res = await fetch(url, {
  headers: {
    'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID!,
    'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET!
  }
});
const data = await res.json();
```

---

## 11. 문서수 수집 전용 규칙

### **문서수 수집 목적**
키워드별로 다음 문서 수를 수집:
- **블로그**: `/v1/search/blog.json`
- **카페글**: `/v1/search/cafearticle.json`  
- **웹문서**: `/v1/search/webkr.json`
- **뉴스**: `/v1/search/news.json`

### **문서수 수집 파라미터**
```javascript
const params = {
  query: keyword,           // 검색 키워드
  display: 1,               // 문서 수만 필요하므로 최소값
  start: 1                 // 시작 위치
};
```

### **문서수 수집 응답 처리**
```javascript
const docCounts = {
  blog_total: parseInt(data.total) || 0,
  cafe_total: parseInt(data.total) || 0,
  web_total: parseInt(data.total) || 0,
  news_total: parseInt(data.total) || 0
};
```

### **API 호출 간격**
- 각 API 호출 간 100ms 대기 (Rate Limit 방지)
- 실패 시 해당 서비스는 0으로 설정

---

### ✅ 활용 팁

- **통합검색형**: 여러 API를 순차 호출 후 `Promise.all()`로 합쳐서 반환.
- **분리형**: 각 서비스별 별도 탭 구성 시 캐싱 TTL 다르게 설정.
- **트래픽 절감**: 인기 키워드/카테고리 사전 수집(DB 저장) → 실시간 호출 감소.

---

## ⚠️ 절대 규칙

1. **Base URL은 절대 변경하지 않음**: `https://openapi.naver.com`만 사용
2. **인증 헤더는 절대 변경하지 않음**: `X-Naver-Client-Id`, `X-Naver-Client-Secret`만 사용
3. **엔드포인트는 절대 변경하지 않음**: `/v1/search/{service}.json` 형식만 사용
4. **응답 구조는 절대 변경하지 않음**: `total`, `items` 등 공식 필드명만 사용
5. **쿼터 제한은 절대 무시하지 않음**: 하루 25,000회 제한 준수
6. **HTTPS는 절대 필수**: HTTP 사용 금지
7. **프론트엔드 직접 호출 금지**: 백엔드 프록시를 통해서만 호출

이 규칙을 위반하면 네이버 오픈API가 작동하지 않습니다.

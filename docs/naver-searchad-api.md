# 네이버 검색광고 API 개발문서 (절대규칙)

> ⚠️ **절대규칙**: 이 문서는 절대규칙 문서입니다. 반드시 이 규격에 맞게 구현해야 합니다.

## 1) 엔드포인트

- **Base URL:** `https://api.naver.com`
- **GET /keywordstool** — 키워드 도구(RelKwdStat). 힌트 키워드를 넣으면 연관키워드와 지표 반환.

## 2) 인증 헤더 (모든 요청 필수)

- `X-Timestamp`: 현재 시간(Epoch ms)
- `X-API-KEY`: 발급된 Access License
- `X-Customer`: 광고계정 Customer ID
- `X-Signature`: **HMAC-SHA256(secret, "{timestamp}.{METHOD}.{URI}")** → Base64 인코딩
    
    예: 메시지 `"1696156798000.GET./keywordstool"` 서명 후 Base64.

> 구현 팁: URI에는 쿼리스트링 제외하고 순수 경로만 사용. 타임스탬프는 헤더 값과 동일해야 함.

## 3) 요청 파라미터

| Param | Type | 필수 | 설명 |
| --- | --- | --- | --- |
| `hintKeywords` | string | ✔ | 기준 키워드(최대 5개, 쉼표 구분) |
| `showDetail` | `0`/`1` | 권장 | `1`로 설정 시 클릭수·CTR·경쟁·광고수 등 상세 지표 포함 |
| `siteId` | string |  | 특정 사이트 기준 추천(옵션) |
| `biztpId` | string |  | 업종 기준 추천(옵션) |
| `month` | string |  | 시즌 월(옵션) |
| `event` | string |  | 시즌 테마(옵션) |

## 4) 응답 스키마(핵심 필드 매핑)

`keywordList` 배열의 각 객체에서 아래 값을 사용:

| 요구 컬럼(우리) | 응답 필드(네이버) | 설명 |
| --- | --- | --- |
| **키워드** | `relKeyword` | 연관키워드 텍스트 |
| **PC 검색수** | `monthlyPcQcCnt` | 최근 한 달 PC 검색수(문자열, `< 10` 가능) |
| **모바일 검색수** | `monthlyMobileQcCnt` | 최근 한 달 모바일 검색수(문자열, `< 10` 가능) |
| **월평균 클릭수(PC)** | `monthlyAvePcClkCnt` | 최근 한 달 평균 광고 클릭수(PC) |
| **월평균 클릭수(모바일)** | `monthlyAveMobileClkCnt` | 최근 한 달 평균 광고 클릭수(모바일) |
| **PC CTR** | `monthlyAvePcCtr` | 최근 한 달 평균 클릭률(PC, %값 문자열) |
| **모바일 CTR** | `monthlyAveMobileCtr` | 최근 한 달 평균 클릭률(모바일, %값 문자열) |
| **광고수** | `plAvgDepth` | 평균 노출 광고 개수(PC 통합검색 기준) |
| (참고: 경쟁) | `compIdx` | 경쟁 정도(낮음/중간/높음) |

## 5) 요청/응답 예시

### 예시 요청 (GET)

```
GET /keywordstool?hintKeywords=%EA%B0%95%EC%9B%90%EB%8F%84%ED%92%80%EB%B9%8C%EB%9D%BC&showDetail=1
Host: api.naver.com
Content-Type: application/json; charset=UTF-8
X-Timestamp: 1696156798000
X-API-KEY: {ACCESS_LICENSE}
X-Customer: {CUSTOMER_ID}
X-Signature: {BASE64_HMAC_SHA256}
```

### 예시 응답 (발췌)

```json
{
  "keywordList": [
    {
      "relKeyword": "강원도풀빌라",
      "monthlyPcQcCnt": "1890",
      "monthlyMobileQcCnt": "9280",
      "monthlyAvePcClkCnt": "52.8",
      "monthlyAveMobileClkCnt": "389.4",
      "monthlyAvePcCtr": "2.86",
      "monthlyAveMobileCtr": "4.45",
      "plAvgDepth": "15",
      "compIdx": "높음"
    }
  ]
}
```

## 6) 레이트 리밋 / 429 대응

- RelKwdStat(키워드 도구)는 타 오퍼레이션 대비 호출 속도가 1/5~1/6 수준으로 제한될 수 있음.
- 계정(Customer) + 호출 IP 기준으로 속도 제한이 적용될 수 있음.
- 429(Too Many Requests) 발생 시 다른 API 대비 5~6배 긴 sleep 후 재시도, 수 초 내 대량 재시도 금지, 5분 정지 후 재개 권고.

## 7) 데이터 정규화 규칙

- 모든 수치가 문자열로 반환될 수 있음. `< 10` 같은 문자열은 기호 제거 후 숫자 변환 필요.
- PC/모바일 합계 지표가 필요하면 `monthlyPcQcCnt + monthlyMobileQcCnt`로 계산(CTR은 합산이 아닌 비율이므로 주의).
- 소수/퍼센트: CTR은 `%` 기호 없이 백분율 값 문자열(예: `"2.86"` → 2.86%).

## 8) 배치/스케줄링 전략

- hintKeywords 최대 5개/호출 → 다량 키워드는 5개 단위 배치로 병렬/직렬 처리.
- RelKwdStat는 속도 제한이 엄격하므로 동시성 제한 + 지수적 백오프 적용. 429 연속 시 최소 5분 쿨다운.
- 캐시: 동일 키워드는 단기간 값 변동이 크지 않으므로 단기 캐시(예: 수시간~1일) 후 만료.

## 9) 오류 처리 가이드

- 401/403: 시그니처/헤더 불일치, 시간 오차 가능 → 타임스탬프/메시지 서명 규칙 재검증.
- 429: 호출 속도 초과 → 슬립 연장, 동시성 축소, 5분 정지 후 재시도.

## v0.dev 구현 체크리스트

1. **환경변수**
   - `SEARCHAD_BASE=https://api.naver.com`
   - `SEARCHAD_API_KEY`
   - `SEARCHAD_SECRET`
   - `SEARCHAD_CUSTOMER_ID`

2. **시그니처 유틸**
   - `sign(timestamp, method, uri, secret) -> base64(HMAC_SHA256(secret, "{ts}.{method}.{uri}"))`

3. **요청 빌더**
   - `GET /keywordstool?hints=...&showDetail=1`
   - 헤더: `X-Timestamp`, `X-API-KEY`, `X-Customer`, `X-Signature`

4. **응답 파서(매핑/정규화)**
   - 컬럼 맵: `relKeyword`→키워드, `monthlyPcQcCnt`→PC 검색수, `monthlyMobileQcCnt`→모바일 검색수
   - `< 10` 문자열 정규화, 숫자/소수 변환

5. **배치 러너**
   - 입력 키워드 N개 → 5개 단위 청크로 순회 호출
   - 429 시 백오프(공지 권고 수치), 에러 카운트/로그

6. **결과 스키마 (DB/CSV)**
   - `keyword, pc_search, mobile_search, monthly_click_pc, monthly_click_mo, ctr_pc, ctr_mo, ad_count, comp_idx, raw_json, fetched_at`
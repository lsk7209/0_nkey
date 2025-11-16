# Wrangler Observability 설정 가이드

## ✅ 설정 완료

모든 Wrangler 구성 파일에 Observability 설정이 추가되었습니다.

## 📋 설정 내용

### 로그 설정 (활성화됨)
- **enabled**: `true` - 로그 활성화
- **head_sampling_rate**: `1` - 모든 요청 로깅 (100%)
- **persist**: `true` - 로그 영구 저장
- **invocation_logs**: `true` - 함수 호출 로그 활성화

### 추적 설정 (비활성화됨)
- **enabled**: `false` - 추적 비활성화 (성능 최적화)
- **persist**: `true` - 추적 데이터 영구 저장 (활성화 시)
- **head_sampling_rate**: `1` - 샘플링 비율

## 📁 적용된 파일

### 1. 메인 프로젝트 (`wrangler.toml`)
- Cloudflare Pages 프로젝트 설정
- 모든 Pages Functions에 적용

### 2. Cron Worker (`cron-worker/wrangler.toml`)
- 별도 Workers 프로젝트 설정
- 크론 작업 로그 활성화

## 🔍 로그 확인 방법

### Cloudflare Dashboard
1. **Workers & Pages** → 프로젝트 선택
2. **Logs** 탭 클릭
3. 실시간 로그 확인

### Wrangler CLI
```bash
# 실시간 로그 스트리밍
wrangler tail

# 특정 Worker 로그
wrangler tail 0-nkey-cron
```

## 📊 로그 수준

현재 설정:
- **모든 요청 로깅**: `head_sampling_rate = 1` (100%)
- **함수 호출 로그**: 활성화
- **로그 영구 저장**: 활성화

## ⚙️ 설정 변경 방법

### 로그 샘플링 비율 조정
```toml
[observability.logs]
head_sampling_rate = 0.5  # 50%만 로깅 (비용 절감)
```

### 추적 활성화
```toml
[observability.traces]
enabled = true  # 추적 활성화
```

## 💡 최적화 팁

### 비용 최적화
- 로그가 많으면 `head_sampling_rate`를 낮춰서 샘플링
- 예: `0.1` (10%만 로깅)

### 성능 최적화
- 추적은 비활성화 상태 유지 (현재 설정)
- 필요 시에만 활성화

## 📝 설정 파일 예시

```toml
# Observability 설정 (로그 및 추적)
[observability]
enabled = false
head_sampling_rate = 1

[observability.logs]
enabled = true
head_sampling_rate = 1
persist = true
invocation_logs = true

[observability.traces]
enabled = false
persist = true
head_sampling_rate = 1
```

## ✅ 배포 상태

- ✅ 메인 프로젝트: 설정 추가 완료
- ✅ Cron Worker: 설정 추가 및 배포 완료
- ✅ GitHub: 커밋 및 푸시 완료

## 🔄 다음 배포 시

모든 새로운 배포에서 자동으로 이 설정이 적용됩니다:
- GitHub Actions 자동 배포
- Wrangler CLI 수동 배포

## 📚 참고 자료

- [Cloudflare Observability 문서](https://developers.cloudflare.com/workers/observability/)
- [Wrangler 설정 문서](https://developers.cloudflare.com/workers/wrangler/configuration/)


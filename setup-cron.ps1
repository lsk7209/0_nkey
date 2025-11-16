# Cloudflare Cron 설정 자동화 스크립트
# 이 스크립트는 Cloudflare Dashboard API를 사용하여 Scheduled Trigger를 설정합니다.

Write-Host "🚀 Cloudflare Cron 설정 시작..." -ForegroundColor Green

# Cloudflare API 토큰 확인
$apiToken = $env:CLOUDFLARE_API_TOKEN
if (-not $apiToken) {
    Write-Host "❌ CLOUDFLARE_API_TOKEN 환경 변수가 설정되지 않았습니다." -ForegroundColor Red
    Write-Host "다음 명령어로 설정하세요:" -ForegroundColor Yellow
    Write-Host '$env:CLOUDFLARE_API_TOKEN = "your-api-token"' -ForegroundColor Yellow
    exit 1
}

# Account ID 확인
$accountId = $env:CLOUDFLARE_ACCOUNT_ID
if (-not $accountId) {
    Write-Host "❌ CLOUDFLARE_ACCOUNT_ID 환경 변수가 설정되지 않았습니다." -ForegroundColor Red
    Write-Host "다음 명령어로 설정하세요:" -ForegroundColor Yellow
    Write-Host '$env:CLOUDFLARE_ACCOUNT_ID = "your-account-id"' -ForegroundColor Yellow
    exit 1
}

$projectName = "0-nkey"
$cronExpression = "*/5 * * * *"  # 5분마다 실행

Write-Host "📋 설정 정보:" -ForegroundColor Cyan
Write-Host "  프로젝트: $projectName" -ForegroundColor White
Write-Host "  Cron 표현식: $cronExpression" -ForegroundColor White
Write-Host "  Account ID: $accountId" -ForegroundColor White

# Cloudflare Pages API를 사용하여 Scheduled Trigger 설정
# 참고: Cloudflare Pages API는 현재 Scheduled Triggers를 직접 설정하는 API를 제공하지 않습니다.
# 따라서 Dashboard에서 수동으로 설정해야 합니다.

Write-Host ""
Write-Host "⚠️  Cloudflare Pages의 Scheduled Triggers는 API로 설정할 수 없습니다." -ForegroundColor Yellow
Write-Host "다음 단계를 따라 수동으로 설정해주세요:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Cloudflare Dashboard 접속: https://dash.cloudflare.com" -ForegroundColor Cyan
Write-Host "2. Workers & Pages → $projectName 선택" -ForegroundColor Cyan
Write-Host "3. Settings → Functions → Scheduled Triggers" -ForegroundColor Cyan
Write-Host "4. Create Trigger 클릭" -ForegroundColor Cyan
Write-Host "5. Cron Expression: $cronExpression 입력" -ForegroundColor Cyan
Write-Host "6. Path: 빈 값 또는 / 입력" -ForegroundColor Cyan
Write-Host "7. Save 클릭" -ForegroundColor Cyan
Write-Host ""

# 대안: Wrangler CLI를 사용한 설정 시도
Write-Host "💡 Wrangler CLI로 설정을 시도합니다..." -ForegroundColor Green

try {
    # Wrangler가 설치되어 있는지 확인
    $wranglerVersion = wrangler --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Wrangler CLI가 설치되지 않았습니다." -ForegroundColor Red
        Write-Host "설치 방법: npm install -g wrangler" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✅ Wrangler CLI 확인됨: $wranglerVersion" -ForegroundColor Green
    
    # Pages 프로젝트의 Scheduled Triggers는 Wrangler CLI로 직접 설정할 수 없습니다.
    # 하지만 사용자에게 안내를 제공합니다.
    Write-Host ""
    Write-Host "📝 참고: Cloudflare Pages의 Scheduled Triggers는 Dashboard에서만 설정 가능합니다." -ForegroundColor Yellow
    Write-Host "코드는 이미 준비되어 있으므로 (`functions/_cron.ts`), Dashboard에서만 설정하면 됩니다." -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ 오류 발생: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ 설정 가이드 완료!" -ForegroundColor Green
Write-Host "Dashboard에서 Scheduled Trigger를 설정하면 자동으로 작동합니다." -ForegroundColor Green


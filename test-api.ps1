# API 테스트 스크립트 (PowerShell)
# 사용법: .\test-api.ps1 "봉천동맛집"

param(
    [string]$seed = "봉천동맛집"
)

Write-Host "🧪 API 테스트 시작: $seed" -ForegroundColor Cyan

# API 호출
$response = Invoke-WebRequest -Uri "https://0-nkey.pages.dev/api/collect-naver" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
    } `
    -Body (@{
        seed = $seed
    } | ConvertTo-Json) `
    -UseBasicParsing

$result = $response.Content | ConvertFrom-Json

Write-Host "`n📊 API 응답 결과:" -ForegroundColor Green
Write-Host "  - success: $($result.success)"
Write-Host "  - totalCollected: $($result.totalCollected)"
Write-Host "  - totalSavedOrUpdated: $($result.totalSavedOrUpdated)"
Write-Host "  - savedCount: $($result.savedCount)"
Write-Host "  - updatedCount: $($result.updatedCount)"
Write-Host "  - failedCount: $($result.failedCount)"
Write-Host "  - skippedCount: $($result.skippedCount)"
Write-Host "  - message: $($result.message)"

if ($result.keywords -and $result.keywords.Count -gt 0) {
    Write-Host "`n📋 첫 3개 키워드:" -ForegroundColor Yellow
    $result.keywords[0..2] | ForEach-Object {
        Write-Host "  - $($_.keyword) (pc: $($_.pc_search), mobile: $($_.mobile_search))"
    }
} else {
    Write-Host "`n⚠️ 키워드가 없습니다!" -ForegroundColor Red
}


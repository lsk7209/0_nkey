# 상세 API 디버깅 스크립트 (PowerShell)
# 사용법: .\debug-api.ps1 "봉천동맛집"

param(
    [string]$seed = "봉천동맛집"
)

Write-Host "🔍 상세 API 디버깅 시작: $seed" -ForegroundColor Cyan
Write-Host "=" * 60

try {
    # API 호출
    $body = @{
        seed = $seed
    } | ConvertTo-Json

    Write-Host "`n📤 API 요청 전송 중..." -ForegroundColor Yellow
    Write-Host "  URL: https://0-nkey.pages.dev/api/collect-naver"
    Write-Host "  Body: $body"

    $response = Invoke-WebRequest -Uri "https://0-nkey.pages.dev/api/collect-naver" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "`n✅ HTTP 응답 받음: Status $($response.StatusCode)" -ForegroundColor Green

    $result = $response.Content | ConvertFrom-Json

    Write-Host "`n📊 기본 정보:" -ForegroundColor Green
    Write-Host "  success: $($result.success)"
    Write-Host "  seed: $($result.seed)"
    Write-Host "  version: $($result.version)"
    
    Write-Host "`n📈 수집/저장 통계:" -ForegroundColor Cyan
    Write-Host "  totalCollected: $($result.totalCollected)"
    Write-Host "  totalSavedOrUpdated: $($result.totalSavedOrUpdated)"
    Write-Host "  savedCount: $($result.savedCount)"
    Write-Host "  updatedCount: $($result.updatedCount)"
    Write-Host "  failedCount: $($result.failedCount)"
    Write-Host "  skippedCount: $($result.skippedCount)"

    Write-Host "`n💬 메시지:" -ForegroundColor Yellow
    Write-Host "  $($result.message)"

    if ($result.keywords) {
        Write-Host "`n📋 키워드 배열 정보:" -ForegroundColor Cyan
        Write-Host "  배열 길이: $($result.keywords.Count)"
        
        if ($result.keywords.Count -gt 0) {
            Write-Host "`n  첫 5개 키워드 상세:" -ForegroundColor Yellow
            $result.keywords[0..4] | ForEach-Object { $i = 1 } {
                Write-Host "    [$i] $($_.keyword)"
                Write-Host "        - pc_search: $($_.pc_search)"
                Write-Host "        - mobile_search: $($_.mobile_search)"
                Write-Host "        - avg_monthly_search: $($_.avg_monthly_search)"
                Write-Host "        - keyword 타입: $($_.keyword.GetType().Name)"
                Write-Host "        - keyword 길이: $($_.keyword.Length)"
                $i++
            }
        } else {
            Write-Host "  ⚠️ 키워드 배열이 비어있습니다!" -ForegroundColor Red
        }
    } else {
        Write-Host "`n⚠️ 키워드 배열이 없습니다!" -ForegroundColor Red
    }

    if ($result.failedSamples -and $result.failedSamples.Count -gt 0) {
        Write-Host "`n❌ 실패한 키워드 샘플:" -ForegroundColor Red
        $result.failedSamples | ForEach-Object {
            Write-Host "  - $($_.keyword): $($_.error)"
        }
    }

    Write-Host "`n" + ("=" * 60)
    Write-Host "✅ 디버깅 완료!" -ForegroundColor Green

} catch {
    Write-Host "`n❌ 에러 발생:" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)"
    Write-Host "  상세: $($_.Exception)"
}


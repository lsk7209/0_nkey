# GitHub 배포 스크립트
# PowerShell 스크립트로 Git 상태 확인 및 배포

Write-Host "🚀 GitHub 배포 시작..." -ForegroundColor Green

# 1. Git 상태 확인
Write-Host "`n📋 Git 상태 확인 중..." -ForegroundColor Yellow
$status = git status --short
if ($status) {
    Write-Host "변경사항 발견:" -ForegroundColor Yellow
    Write-Host $status
} else {
    Write-Host "✅ 변경사항 없음" -ForegroundColor Green
}

# 2. Rebase 상태 확인
Write-Host "`n📋 Rebase 상태 확인 중..." -ForegroundColor Yellow
$rebaseStatus = git status 2>&1 | Select-String "rebase"
if ($rebaseStatus) {
    Write-Host "⚠️ Rebase 진행 중입니다. 중단하시겠습니까? (Y/N)" -ForegroundColor Red
    $answer = Read-Host
    if ($answer -eq "Y" -or $answer -eq "y") {
        git rebase --abort
        Write-Host "✅ Rebase 중단됨" -ForegroundColor Green
    }
}

# 3. 원격 변경사항 가져오기
Write-Host "`n📥 원격 변경사항 가져오기..." -ForegroundColor Yellow
git fetch origin main

# 4. 충돌 확인
Write-Host "`n🔍 충돌 확인 중..." -ForegroundColor Yellow
$conflicts = git diff --name-only --diff-filter=U
if ($conflicts) {
    Write-Host "❌ 충돌 발견:" -ForegroundColor Red
    Write-Host $conflicts
    Write-Host "`n충돌을 해결한 후 다시 실행하세요." -ForegroundColor Red
    exit 1
}

# 5. 변경사항 스테이징
Write-Host "`n📦 변경사항 스테이징 중..." -ForegroundColor Yellow
git add .

# 6. 커밋 (변경사항이 있는 경우)
$staged = git diff --cached --name-only
if ($staged) {
    Write-Host "변경사항 커밋 중..." -ForegroundColor Yellow
    git commit -m "feat: 자동 수집 최적화 및 배포 설정 완료

- API 키 로드 밸런싱 시스템
- 동적 병렬 처리 최적화
- Rate Limit 예측 및 회피
- Circuit Breaker 패턴 적용
- GitHub Actions 자동 배포 설정"
    Write-Host "✅ 커밋 완료" -ForegroundColor Green
}

# 7. 푸시
Write-Host "`n📤 GitHub에 푸시 중..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 배포 완료!" -ForegroundColor Green
    Write-Host "GitHub Actions에서 배포 상태를 확인하세요: https://github.com/lsk7209/0_nkey/actions" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ 푸시 실패" -ForegroundColor Red
    Write-Host "오류를 확인하고 다시 시도하세요." -ForegroundColor Red
    exit 1
}


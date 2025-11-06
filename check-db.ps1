# D1 데이터베이스 조회 스크립트 (PowerShell)
# 사용법: .\check-db.ps1

Write-Host "🗄️ D1 데이터베이스 조회 시작" -ForegroundColor Cyan

# D1 데이터베이스 직접 조회 (wrangler 사용)
Write-Host "`n📊 전체 키워드 수:" -ForegroundColor Green
wrangler d1 execute 0_nkey_db --command "SELECT COUNT(*) as total FROM keywords"

Write-Host "`n📊 최근 저장된 키워드 10개:" -ForegroundColor Green
wrangler d1 execute 0_nkey_db --command "SELECT id, keyword, avg_monthly_search, created_at, updated_at FROM keywords ORDER BY created_at DESC LIMIT 10"

Write-Host "`n📊 업데이트된 키워드 10개:" -ForegroundColor Green
wrangler d1 execute 0_nkey_db --command "SELECT id, keyword, avg_monthly_search, created_at, updated_at FROM keywords ORDER BY updated_at DESC LIMIT 10"

Write-Host "`n📊 중복 키워드 확인:" -ForegroundColor Yellow
wrangler d1 execute 0_nkey_db --command "SELECT keyword, COUNT(*) as cnt FROM keywords GROUP BY keyword HAVING cnt > 1"

Write-Host "`n📊 특정 키워드 검색 (예: 봉천동맛집):" -ForegroundColor Yellow
wrangler d1 execute 0_nkey_db --command "SELECT * FROM keywords WHERE keyword LIKE '%봉천동%' LIMIT 5"


# 빠른 배포 가이드

## 🚀 배포 방법

### 방법 1: PowerShell 스크립트 사용 (권장)

```powershell
# 배포 스크립트 실행
.\deploy.ps1
```

### 방법 2: 수동 배포

```powershell
# 1. 변경사항 확인
git status

# 2. 변경사항 추가
git add .

# 3. 커밋
git commit -m "feat: 자동 수집 최적화 및 배포 설정"

# 4. 푸시
git push origin main
```

## ⚠️ 문제 해결

### Rebase 진행 중인 경우
```powershell
git rebase --abort
git pull origin main
git push origin main
```

### 충돌 발생 시
```powershell
# 충돌 파일 확인
git status

# 충돌 해결 후
git add .
git commit -m "fix: 충돌 해결"
git push origin main
```

### 원격과 로컬 불일치
```powershell
git fetch origin main
git pull origin main --rebase
git push origin main
```

## 📊 배포 확인

배포 후 다음 URL에서 확인:
- **GitHub Actions**: https://github.com/lsk7209/0_nkey/actions
- **배포 사이트**: https://0-nkey.pages.dev


# ============================================================
# KOTOBA - UPDATE DEPLOY
# Sau khi da deploy lan dau, moi lan sua code chi can chay file nay.
# ============================================================

$ErrorActionPreference = "Stop"

npm install
npx wrangler deploy

Write-Host ""
Write-Host "KOTOBA da duoc cap nhat tren Cloudflare." -ForegroundColor Green

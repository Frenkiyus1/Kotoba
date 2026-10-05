# ============================================================
# KOTOBA - FIRST DEPLOY TO CLOUDFLARE (Windows PowerShell)
# Chỉ chạy script này lần đầu tiên.
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== 1/6: Cai Wrangler ===" -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "=== 2/6: Dang nhap Cloudflare ===" -ForegroundColor Cyan
Write-Host "Trinh duyet se mo. Hay bam Allow/Authorize roi quay lai terminal."
npx wrangler login

Write-Host ""
Write-Host "=== 3/6: Tao D1 database o khu vuc APAC ===" -ForegroundColor Cyan
Write-Host "Wrangler se TU DONG them database_id vao wrangler.jsonc."
npx wrangler d1 create kotoba-db --location=apac --binding=DB --update-config

Write-Host ""
Write-Host "=== 4/6: Tao cac bang database ===" -ForegroundColor Cyan
npx wrangler d1 execute kotoba-db --remote --file=./database/schema.sql --yes

Write-Host ""
Write-Host "=== 5/6: Tao tai khoan demo + du lieu mau ===" -ForegroundColor Cyan
npx wrangler d1 execute kotoba-db --remote --file=./database/seed.sql --yes

Write-Host ""
Write-Host "=== 6/6: Deploy KOTOBA ===" -ForegroundColor Cyan
npx wrangler deploy

Write-Host ""
Write-Host "DEPLOY XONG." -ForegroundColor Green
Write-Host "Tai khoan test: demo@kotoba.jp / kotoba123"

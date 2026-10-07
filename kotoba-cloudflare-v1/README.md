# KOTOBA — Cloudflare Deploy Edition

Bản này đã được chuyển từ **FastAPI + SQLite local** sang kiến trúc dễ deploy trực tiếp lên Cloudflare:

```text
Browser
   │
   ├── HTML / CSS / JS / Images
   │          ↓
   │   Cloudflare Static Assets
   │
   └── /api/*
              ↓
      Cloudflare Worker (JavaScript)
              ↓
      Cloudflare D1 Database
```

## Tại sao đổi backend sang JavaScript Worker?

Bản cũ dùng `uvicorn + SQLite file`, phù hợp chạy trên máy nhưng không phải mô hình tự nhiên của Cloudflare Workers.
Bản này dùng **Worker + D1** nên chỉ cần Wrangler là deploy được cả frontend và backend trong một project.

## Tài khoản demo

```text
Email:    demo@kotoba.jp
Password: kotoba123
```

---

# CÁCH DEPLOY DỄ NHẤT TRÊN WINDOWS

## Bước 0 — Cần có

1. Tài khoản Cloudflare.
2. Node.js đã cài trên máy.
3. Giải nén folder này.
4. Mở folder bằng VS Code.
5. Trong VS Code chọn **Terminal → New Terminal**.

Kiểm tra Node:

```powershell
node -v
npm -v
```

Nếu hai lệnh hiện version thì tiếp tục.

## Cách A — Gần như tự động

Trong PowerShell tại đúng folder project:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-first-time.ps1
```

Script sẽ tự làm theo thứ tự:

1. `npm install`
2. `wrangler login`
3. tạo D1 `kotoba-db`
4. tự ghi `database_id` vào `wrangler.jsonc`
5. tạo database schema
6. seed account demo
7. deploy Worker + frontend

Ở bước login, browser sẽ mở trang Cloudflare. Chỉ cần bấm **Allow / Authorize** rồi quay lại Terminal.

Cuối quá trình Wrangler sẽ in URL dạng:

```text
https://kotoba.<something>.workers.dev
```

Mở URL đó là web.

---

# Cách B — Làm từng bước để dễ hiểu

### 1. Cài Wrangler

```powershell
npm install
```

### 2. Login Cloudflare

```powershell
npx wrangler login
```

### 3. Tạo database D1

```powershell
npx wrangler d1 create kotoba-db --location=apac --binding=DB --update-config
```

`--update-config` rất quan trọng: Wrangler sẽ tự thêm D1 binding và `database_id` vào `wrangler.jsonc`.

### 4. Tạo bảng

```powershell
npx wrangler d1 execute kotoba-db --remote --file=./database/schema.sql --yes
```

### 5. Tạo account demo

```powershell
npx wrangler d1 execute kotoba-db --remote --file=./database/seed.sql --yes
```

### 6. Deploy

```powershell
npx wrangler deploy
```

---

# SAU NÀY SỬA CODE THÌ LÀM GÌ?

Không tạo D1 lại.

Chỉ chạy:

```powershell
npm run deploy
```

hoặc:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-update.ps1
```

---

# CẤU TRÚC PROJECT

```text
kotoba-cloudflare-v1/
│
├── public/                 # FRONTEND
│   ├── index.html          # Homepage
│   ├── start.html          # Login / register
│   ├── dashboard.html
│   ├── lesson.html
│   ├── biology.html
│   ├── biology-lesson.html
│   ├── review.html
│   ├── conversation.html
│   ├── app.js              # Logic frontend
│   ├── styles.css
│   └── assets/
│
├── src/                    # BACKEND CLOUDFLARE WORKER
│   ├── index.js            # Router chính
│   ├── lib/
│   │   ├── auth.js         # Password + session
│   │   ├── http.js         # JSON / lỗi HTTP
│   │   └── state.js        # Đọc ghi D1
│   ├── routes/
│   │   ├── auth.js         # Login / register
│   │   ├── state.js        # Progress / preferences / deck
│   │   ├── vocabulary.js   # Flashcard + SRS
│   │   ├── dictionary.js   # Dictionary endpoint
│   │   └── conversation.js # Workers AI conversation
│   └── data/
│       └── dictionary.js   # Data từ điển demo
│
├── database/
│   ├── schema.sql          # Cấu trúc D1
│   └── seed.sql            # Account demo + dữ liệu mẫu
│
├── scripts/
│   ├── deploy-first-time.ps1
│   └── deploy-update.ps1
│
├── wrangler.jsonc          # Cloudflare config
├── package.json
└── README.md
```

---

# API HIỆN CÓ

```text
GET  /api/health

POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/me

GET  /api/state
PUT  /api/state/:section

POST /api/vocabulary/upsert
POST /api/vocabulary/review

POST /api/dictionary
POST /api/ai/conversation
```

---

# AI CỦA BẢN NÀY LÀ GÌ?

Hội thoại gọi **Cloudflare Workers AI** qua binding `AI` trong `wrangler.jsonc`.
Model mặc định: `@cf/meta/llama-3.1-8b-instruct-fp8`; có thể đặt biến `AI_MODEL` để đổi model.
Backend lấy trình độ từ D1 và nhận tối đa 20 tin nhắn lịch sử. Khi AI lỗi, giao diện hiển thị lỗi và giữ câu hỏi để gửi lại.

Binding `DB` đã được cấu hình trong `d1_databases` của `wrangler.jsonc` để kết nối database `kotoba-db` hiện có. Đăng ký, đăng nhập và hội thoại đều dùng database này; không cần tạo database mới.

## Chọn trình độ cho tài khoản mới

Đăng ký → chọn N5–N1 → lưu `onboardingCompleted: true` → dashboard. Đăng nhập lại dùng trình độ đã lưu và không hỏi lại. Tài khoản chưa hoàn tất bước này sẽ được đưa về trang chọn trình độ.

Nếu database cũ chưa có cột `onboarding_completed`, chạy **một lần**:

```powershell
npx wrangler d1 execute kotoba-db --remote --file=./database/migration-onboarding.sql --yes
```

Không chạy migration này nếu cột đã tồn tại. Migration giữ trình độ của người học cũ và đánh dấu đã hoàn tất; tài khoản mới vẫn bắt đầu chưa hoàn tất. Tài khoản demo trong seed được đánh dấu đã chọn trình độ.

## Bộ flashcard cơ bản

Ứng dụng có thêm 30 từ tiếng Nhật cơ bản về gia đình, đồ vật, ăn uống và sinh hoạt, kèm cách đọc, nghĩa tiếng Việt và câu ví dụ. Thẻ được tự thêm theo tài khoản khi tải dữ liệu học tập, có thể lật xem nghĩa tiếng Việt ở mặt sau. Từ đã có giữ nguyên nội dung và lịch ôn; tải lại hoặc đăng nhập lại không tạo thẻ trùng.
## Kiểm tra sửa lỗi

```powershell
npm.cmd test
```

Các kiểm tra dùng SQLite trong bộ nhớ và AI giả lập, không gọi tài khoản Cloudflare thật. Cần Node.js 22.13 trở lên.

---

# TỪ ĐIỂN

Từ điển hiện là dataset demo trong:

```text
src/data/dictionary.js
```

UI và API flow đã sẵn sàng. Production nên dùng dataset Nhật–Việt có quyền sử dụng hoặc API từ điển riêng.

---

# DEBUG

Xem log Worker realtime:

```powershell
npm run tail
```

Kiểm tra API:

```text
https://<domain-cua-ban>/api/health
```

Kết quả đúng:

```json
{
  "ok": true,
  "service": "kotoba-cloudflare",
  "database": "D1"
}
```

Nếu báo D1 chưa được cấu hình, chạy lại bước tạo D1 và chắc chắn `wrangler.jsonc` có section `d1_databases` do Wrangler tự thêm.

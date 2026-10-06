# KOTOBA — Hướng dẫn đọc code

File này dành cho lúc bạn mở code bằng VS Code và muốn biết **sửa cái gì ở đâu**.

## 1. `src/index.js` — Cửa vào của backend

Nó làm đúng 3 việc:

1. Nhận request từ browser.
2. Nếu URL bắt đầu bằng `/api/` thì chuyển tới backend route tương ứng.
3. Nếu không phải API thì trả file frontend từ `public/`.

Ví dụ:

```text
POST /api/auth/login
        ↓
src/index.js
        ↓
src/routes/auth.js
        ↓
Cloudflare D1
```

## 2. `src/lib/http.js` — Chuẩn hóa Response

- `json(...)`: trả dữ liệu JSON.
- `apiError(...)`: trả lỗi `{ detail: "..." }` giống FastAPI cũ.
- `readJson(...)`: đọc body JSON.
- `HttpError`: lỗi có status code rõ ràng.

## 3. `src/lib/auth.js` — Đăng nhập

- `hashPassword`: hash password bằng PBKDF2-SHA256.
- `verifyPassword`: kiểm tra password.
- `createSession`: tạo Bearer token và lưu vào D1.
- `requireUser`: chặn API nếu user chưa đăng nhập.

Password **không được lưu dưới dạng chữ thường**.

## 4. `src/lib/state.js` — Dữ liệu học

Đây là file quản lý:

- profile;
- onboarding;
- daily plan;
- flashcard deck;
- error memory;
- streak/activity.

Nếu sau này muốn thêm dữ liệu vào dashboard thì đây là một trong các file chính.

## 5. `src/routes/auth.js`

Chỉ chứa nghiệp vụ:

```text
register
login
logout
```

## 6. `src/routes/vocabulary.js`

Phụ trách:

```text
Dictionary/lesson -> add word -> vocabulary table
Review -> update SRS stage/due date
```

## 7. `src/routes/dictionary.js`

Nhận đoạn người học bôi đen và tìm entry trong:

```text
src/data/dictionary.js
```

Muốn thêm từ demo thì sửa file data này.

## 8. `src/routes/conversation.js`

Đây là vị trí dành cho **AI teacher**.

Route gọi Cloudflare Workers AI qua `env.AI.run`, lấy trình độ từ D1 và gửi lịch sử hội thoại. Lỗi AI được trả rõ ràng cho frontend.

## 9. `database/schema.sql`

Là cấu trúc database D1.

Các bảng:

```text
users
sessions
preferences
vocabulary
errors
daily
activity
```

## 10. `database/seed.sql`

Tạo account test:

```text
demo@kotoba.jp
kotoba123
```

và các dữ liệu mẫu trên dashboard.

## 11. `public/app.js`

Đây là logic frontend hiện có của bản KOTOBA cũ.

Nó phụ trách:

- Login form;
- onboarding;
- dashboard;
- lesson Shu/Ha/Ri;
- text selection dictionary;
- contextual flashcard;
- conversation;
- personalized exercise;
- progress/profile.

Frontend gọi backend qua:

```js
const API = window.KOTOBA_API_BASE || '/api';
```

Vì frontend và Worker cùng domain, production dùng `/api` là đủ.

## 12. `wrangler.jsonc`

Cloudflare đọc file này khi deploy.

Quan trọng nhất:

```text
main = backend entry
assets = frontend public/
d1_databases = database binding
```

Phần `d1_databases` được Wrangler tự thêm khi bạn chạy:

```powershell
npx wrangler d1 create kotoba-db --location=apac --binding=DB --update-config
```

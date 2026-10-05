{
  "$schema": "./node_modules/wrangler/config-schema.json",

  // Tên phải khớp tên Worker trên Cloudflare của bạn
  "name": "kobota",

  // File backend chính
  "main": "src/index.js",

  // Ngày tương thích runtime
  "compatibility_date": "2026-10-05",

  // Frontend static
  "assets": {
    // Toàn bộ HTML/CSS/JS/ảnh nằm trong public
    "directory": "./public",

    // Cho Worker truy cập static assets khi cần
    "binding": "ASSETS",

    // Chỉ request /api/* mới chạy backend trước
    // HTML/CSS/JS/ảnh sẽ được Cloudflare phục vụ trực tiếp
    "run_worker_first": [
      "/api/*"
    ]
  }
}

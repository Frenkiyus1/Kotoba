/**
 * HTTP helpers dùng chung cho toàn bộ Worker.
 * Mục tiêu: route code chỉ tập trung vào nghiệp vụ, không lặp lại phần Response/JSON.
 */

export class HttpError extends Error {
  constructor(status, detail) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.detail = detail;
  }
}

/** Trả JSON và luôn tắt cache cho API. */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

/** Shortcut cho lỗi API có cùng shape với backend FastAPI cũ: { detail: ... }. */
export function apiError(status, detail) {
  return json({ detail }, status);
}

/** Đọc JSON body; nếu JSON hỏng thì trả lỗi 400 rõ ràng. */
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'JSONが正しくありません。');
  }
}

/** Kiểm tra body có phải object thông thường hay không. */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

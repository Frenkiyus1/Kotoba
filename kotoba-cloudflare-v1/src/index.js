/**
 * KOTOBA Cloudflare Worker — entry point
 *
 * Luồng xử lý:
 *   1. /api/*  -> Worker xử lý backend + D1.
 *   2. URL khác -> Cloudflare Static Assets phục vụ HTML/CSS/JS/image.
 *
 * Frontend và backend vì thế dùng CHUNG một domain, không cần cấu hình CORS.
 */

import { apiError, HttpError, json } from './lib/http.js';
import { login, logout, register } from './routes/auth.js';
import { conversation } from './routes/conversation.js';
import { dictionaryLookup } from './routes/dictionary.js';
import { getState, me, putState } from './routes/state.js';
import { reviewVocabulary, upsertVocabulary } from './routes/vocabulary.js';

/** Đảm bảo D1 đã được bind trước khi route backend chạy. */
function assertDatabase(env) {
  if (!env.DB) {
    throw new HttpError(
      500,
      'D1 chưa được cấu hình. Hãy chạy: npx wrangler d1 create kotoba-db --location=apac --binding=DB --update-config',
    );
  }
}

/** Router API nhỏ, cố ý viết rõ ràng để dễ đọc/dễ sửa khi làm NCKH. */
async function handleApi(request, env) {
  assertDatabase(env);

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // ---------- Health ----------
  if (method === 'GET' && path === '/api/health') {
    return json({ ok: true, service: 'kotoba-cloudflare', database: 'D1' });
  }

  // ---------- Authentication ----------
  if (method === 'POST' && path === '/api/auth/register') return register(request, env);
  if (method === 'POST' && path === '/api/auth/login') return login(request, env);
  if (method === 'POST' && path === '/api/auth/logout') return logout(request, env);

  // ---------- Current user / app state ----------
  if (method === 'GET' && path === '/api/me') return me(request, env);
  if (method === 'GET' && path === '/api/state') return getState(request, env);

  const stateMatch = path.match(/^\/api\/state\/([^/]+)$/);
  if (method === 'PUT' && stateMatch) {
    return putState(request, env, decodeURIComponent(stateMatch[1]));
  }

  // ---------- Vocabulary / contextual flashcards ----------
  if (method === 'POST' && path === '/api/vocabulary/upsert') {
    return upsertVocabulary(request, env);
  }
  if (method === 'POST' && path === '/api/vocabulary/review') {
    return reviewVocabulary(request, env);
  }

  // ---------- Dictionary ----------
  if (method === 'POST' && path === '/api/dictionary') {
    return dictionaryLookup(request, env);
  }

  // ---------- Conversation teacher ----------
  if (method === 'POST' && path === '/api/ai/conversation') {
    return conversation(request, env);
  }

  // Route API không tồn tại.
  return apiError(404, 'API route が見つかりません。');
}

/** Thêm security headers cho file frontend trước khi trả về browser. */
function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), geolocation=()');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Phục vụ frontend static từ thư mục public/. */
async function serveFrontend(request, env) {
  const url = new URL(request.url);

  // Cloudflare assets thường tự resolve index, nhưng rewrite rõ ràng để dễ hiểu.
  if (url.pathname === '/') {
    url.pathname = '/index.html';
    request = new Request(url, request);
  }

  const response = await env.ASSETS.fetch(request);
  return withSecurityHeaders(response);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, env);
      }

      return await serveFrontend(request, env);
    } catch (error) {
      // Lỗi nghiệp vụ do chính app ném ra.
      if (error instanceof HttpError) {
        return apiError(error.status, error.detail);
      }

      // Lỗi không dự đoán: log để xem trong `wrangler tail`.
      console.error('KOTOBA Worker error:', error);
      return apiError(500, 'サーバーでエラーが発生しました。');
    }
  },
};

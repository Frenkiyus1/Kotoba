/**
 * KOTOBA Cloudflare Worker
 *
 * Nhiệm vụ:
 * - /api/*  -> xử lý bằng backend
 * - HTML/CSS/JS/ảnh -> Cloudflare Static Assets xử lý
 */

import { apiError, HttpError, json } from "./lib/http.js";

import {
  login,
  logout,
  register
} from "./routes/auth.js";

import {
  conversation
} from "./routes/conversation.js";

import {
  dictionaryLookup
} from "./routes/dictionary.js";

import { support } from "./routes/support.js";

import {
  getState,
  me,
  putState
} from "./routes/state.js";

import {
  reviewVocabulary,
  upsertVocabulary
} from "./routes/vocabulary.js";


/* =========================================================
   1. KIỂM TRA DATABASE
   ========================================================= */

/**
 * Các API có dữ liệu người dùng cần Cloudflare D1.
 * Nếu DB chưa được bind thì trả lỗi rõ ràng.
 */
function assertDatabase(env) {
  if (!env.DB) {
    throw new HttpError(
      500,
      "D1 chưa được kết nối. Cần tạo kotoba-db và binding DB."
    );
  }
}


/* =========================================================
   2. API ROUTER
   ========================================================= */

async function handleApi(request, env) {
  const url = new URL(request.url);

  const path = url.pathname;

  const method = request.method.toUpperCase();


  /* ---------------------------------------------------------
     HEALTH CHECK
     Không cần database
     --------------------------------------------------------- */

  if (
    method === "GET" &&
    path === "/api/health"
  ) {
    return json({
      ok: true,
      service: "kotoba-cloudflare",
      databaseBound: Boolean(env.DB)
    });
  }


  // Guest onboarding help is read-only and does not require D1 or login.
  if (method === "POST" && path === "/api/ai/support") {
    return support(request, env);
  }

  /* ---------------------------------------------------------
     Từ đây trở xuống đều cần database
     --------------------------------------------------------- */

  assertDatabase(env);


  /* ---------------------------------------------------------
     AUTH
     --------------------------------------------------------- */

  if (
    method === "POST" &&
    path === "/api/auth/register"
  ) {
    return register(request, env);
  }


  if (
    method === "POST" &&
    path === "/api/auth/login"
  ) {
    return login(request, env);
  }


  if (
    method === "POST" &&
    path === "/api/auth/logout"
  ) {
    return logout(request, env);
  }


  /* ---------------------------------------------------------
     USER
     --------------------------------------------------------- */

  if (
    method === "GET" &&
    path === "/api/me"
  ) {
    return me(request, env);
  }


  /* ---------------------------------------------------------
     APP STATE / PROGRESS
     --------------------------------------------------------- */

  if (
    method === "GET" &&
    path === "/api/state"
  ) {
    return getState(request, env);
  }


  const stateMatch =
    path.match(/^\/api\/state\/([^/]+)$/);


  if (
    method === "PUT" &&
    stateMatch
  ) {
    const key =
      decodeURIComponent(stateMatch[1]);

    return putState(
      request,
      env,
      key
    );
  }


  /* ---------------------------------------------------------
     VOCABULARY / FLASHCARD
     --------------------------------------------------------- */

  if (
    method === "POST" &&
    path === "/api/vocabulary/upsert"
  ) {
    return upsertVocabulary(
      request,
      env
    );
  }


  if (
    method === "POST" &&
    path === "/api/vocabulary/review"
  ) {
    return reviewVocabulary(
      request,
      env
    );
  }


  /* ---------------------------------------------------------
     DICTIONARY
     --------------------------------------------------------- */

  if (
    method === "POST" &&
    path === "/api/dictionary"
  ) {
    return dictionaryLookup(
      request,
      env
    );
  }


  /* ---------------------------------------------------------
     AI CONVERSATION
     --------------------------------------------------------- */

  if (
    method === "POST" &&
    path === "/api/ai/conversation"
  ) {
    return conversation(
      request,
      env
    );
  }


  /* ---------------------------------------------------------
     API KHÔNG TỒN TẠI
     --------------------------------------------------------- */

  return apiError(
    404,
    "API route が見つかりません。"
  );
}


/* =========================================================
   3. WORKER ENTRY POINT
   ========================================================= */

export default {

  async fetch(request, env) {

    try {

      const url =
        new URL(request.url);


      /* -------------------------------------------------------
         API
         ------------------------------------------------------- */

      if (
        url.pathname.startsWith("/api/")
      ) {

        return await handleApi(
          request,
          env
        );

      }


      /* -------------------------------------------------------
         FALLBACK STATIC ASSETS

         Bình thường phần này gần như không được gọi vì
         wrangler.jsonc chỉ cho /api/* chạy Worker trước.
         ------------------------------------------------------- */

      return env.ASSETS.fetch(
        request
      );

    }

    catch (error) {

      /* -------------------------------------------------------
         Lỗi do chúng ta chủ động tạo
         ------------------------------------------------------- */

      if (
        error instanceof HttpError
      ) {

        return apiError(
          error.status,
          error.detail
        );

      }


      /* -------------------------------------------------------
         Lỗi ngoài dự kiến
         ------------------------------------------------------- */

      console.error(
        "KOTOBA Worker error:",
        error
      );


      return apiError(
        500,
        "サーバーでエラーが発生しました。"
      );

    }

  }

};

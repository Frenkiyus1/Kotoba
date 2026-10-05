import { DICTIONARY } from '../data/dictionary.js';
import { HttpError, json, readJson } from '../lib/http.js';

/** POST /api/dictionary */
export async function dictionaryLookup(request) {
  const body = await readJson(request);
  const selection = String(body.selection || '').trim();

  if (!selection) throw new HttpError(400, '調べたい語句を選択してください。');

  // 1) Ưu tiên khớp chính xác.
  if (DICTIONARY[selection]) return json(DICTIONARY[selection]);

  // 2) Nếu người học bôi cả câu, tìm entry dài nhất nằm trong câu đó.
  const keys = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (selection.includes(key)) return json(DICTIONARY[key]);
  }

  throw new HttpError(404, 'この語句は現在のデモ辞書に登録されていません。');
}

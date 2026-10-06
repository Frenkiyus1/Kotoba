import { requireUser } from '../lib/auth.js';
import { HttpError, isPlainObject, json, readJson } from '../lib/http.js';

const SCENARIOS = ['コンビニ', 'レストラン', '学校', '友達', '駅', '旅行', '自由会話'];

/** Authenticated conversation with bounded history and server-side learner level. */
export async function conversation(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  if (!isPlainObject(body)) throw new HttpError(400, '会話データが正しくありません。');
  const scenario = body.scenario || '自由会話';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!SCENARIOS.includes(scenario)) throw new HttpError(400, '場面を選択してください。');
  if (!text || text.length > 2000) throw new HttpError(400, '1〜2000文字で入力してください。');
  if (!/[\u3040-\u30ff\u3400-\u9fff]/.test(text)) throw new HttpError(400, '日本語で話してみましょう。');
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 20 || history.some(message =>
    !isPlainObject(message) || !['user', 'assistant'].includes(message.role) ||
    typeof message.content !== 'string' || !message.content.trim() || message.content.length > 2000
  )) throw new HttpError(400, '会話履歴が正しくありません。');
  if (!env.AI?.run) throw new HttpError(503, 'AIが接続されていません。しばらくしてからもう一度お試しください。');
  const prefs = await env.DB.prepare('SELECT level FROM preferences WHERE user_id = ?').bind(user.id).first();
  const level = ['N5', 'N4', 'N3', 'N2', 'N1'].includes(prefs?.level) ? prefs.level : 'N5';
  const messages = [
    { role: 'system', content: `あなたは日本語の会話練習を手伝う山田先生です。学習者のレベルはJLPT ${level}です。場面は「${scenario}」です。その場面の相手として会話してください。履歴と最新の発言を踏まえ、同じ質問を繰り返さないでください。レベルに合う日本語で短く返答し、一度に質問は一つにしてください。間違いは必要なときだけ優しく直してください。${['N5', 'N4'].includes(level) ? '説明を求められたら短いベトナム語の補足もできます。' : '説明も日本語のみで行ってください。'}` },
    ...history.map(({ role, content }) => ({ role, content: content.trim() })),
    { role: 'user', content: text },
  ];
  let result;
  try {
    result = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct', { messages, max_tokens: 512 });
  } catch (error) {
    console.error('Workers AI conversation failed:', error);
    throw new HttpError(502, 'AIから返答を取得できませんでした。もう一度お試しください。');
  }
  const reply = typeof result?.response === 'string' ? result.response.trim() : '';
  if (!reply) throw new HttpError(502, 'AIの返答が空でした。もう一度お試しください。');
  return json({ reply });
}

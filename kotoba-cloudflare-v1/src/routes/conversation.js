import { requireUser } from '../lib/auth.js';
import { HttpError, isPlainObject, json, readJson } from '../lib/http.js';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const LEGACY_MODEL = '@cf/meta/llama-3.1-8b-instruct';

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
    typeof message.content !== 'string' || !message.content.trim() || message.content.length > (message.role === 'assistant' ? 6000 : 2000)
  )) throw new HttpError(400, '会話履歴が正しくありません。');
  if (!env.AI?.run) throw new HttpError(503, 'AIが接続されていません。しばらくしてからもう一度お試しください。');
  const prefs = await env.DB.prepare('SELECT level FROM preferences WHERE user_id = ?').bind(user.id).first();
  const level = ['N5', 'N4', 'N3', 'N2', 'N1'].includes(prefs?.level) ? prefs.level : 'N5';
  // Bound the complete prompt, not just each message. Keep the most recent turns.
  const recentHistory = [];
  let remaining = 6000;
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message.content.length > remaining) break;
    recentHistory.unshift(message);
    remaining -= message.content.length;
  }
  const messages = [
    { role: 'system', content: `あなたは日本語の会話練習を手伝う山田先生です。学習者のレベルはJLPT ${level}です。場面は「${scenario}」です。その場面の相手として会話してください。履歴と最新の発言を踏まえ、同じ質問を繰り返さないでください。レベルに合う日本語で短く返答し、一度に質問は一つにしてください。間違いは必要なときだけ優しく直してください。${level === 'N5' ? 'N5では一文を短くして、一度に一つの質問だけしてください。むずかしい漢字と専門語を避け、ひらがなを多く使ってください。学校・日本・今日などの基本的な漢字だけ使えます。' : ''}${['N5', 'N4'].includes(level) ? '説明を求められたら短いベトナム語の補足もできます。' : '説明も日本語のみで行ってください。'}` },
    ...recentHistory.map(({ role, content }) => ({ role, content: content.trim() })),
    { role: 'user', content: text },
  ];
  let result;
  try {
    const configuredModel = typeof env.AI_MODEL === 'string' ? env.AI_MODEL.trim() : '';
    const model = !configuredModel || configuredModel === LEGACY_MODEL ? DEFAULT_MODEL : configuredModel;
    result = await env.AI.run(model, { messages, max_tokens: 512, stream: false });
  } catch (error) {
    console.error('Workers AI conversation failed:', error);
    const code = Number(error?.code) || Number(String(error?.message || '').match(/\b(3036|3040|5007|3042|3007|3008|5018|5016|3023|3041|5035)\b/)?.[1]);
    if (code === 3036) throw new HttpError(429, 'AIの本日の利用上限に達しました。時間をおいて再度お試しください。');
    if (code === 3040) throw new HttpError(503, 'AIが混み合っています。少し待ってから再度お試しください。');
    if ([5007, 3042].includes(code)) throw new HttpError(503, 'AIモデルの設定が正しくありません。管理者に連絡してください。');
    if ([5018, 5016, 3023, 3041, 5035].includes(code)) throw new HttpError(503, 'CloudflareのAI利用権限を確認する必要があります。管理者に連絡してください。');
    if ([3007, 3008].includes(code)) throw new HttpError(504, 'AIの応答に時間がかかっています。もう一度お試しください。');
    throw new HttpError(502, 'AIから返答を取得できませんでした。もう一度お試しください。');
  }
  const reply = typeof result?.response === 'string' ? result.response.trim() : '';
  if (reply.length > 6000) throw new HttpError(502, 'AIの返答が長すぎました。もう一度お試しください。');
  if (!reply) throw new HttpError(502, 'AIの返答が空でした。もう一度お試しください。');
  return json({ reply });
}

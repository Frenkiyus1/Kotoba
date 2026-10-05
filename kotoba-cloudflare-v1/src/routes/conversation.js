import { requireUser } from '../lib/auth.js';
import { json, readJson } from '../lib/http.js';

/**
 * POST /api/ai/conversation
 *
 * LƯU Ý QUAN TRỌNG:
 * Đây là AI demo theo rule, CHƯA gọi LLM thật.
 * Sau này có thể thay phần makeReply() bằng Cloudflare Workers AI hoặc OpenAI API.
 */
export async function conversation(request, env) {
  await requireUser(request, env);
  const body = await readJson(request);

  const scenario = String(body.scenario || '自由会話');
  const text = String(body.text || '').trim();

  return json({ reply: makeReply(scenario, text) });
}

function makeReply(scenario, text) {
  if (text.includes('分から') || text.includes('わから')) {
    return '大丈夫です。簡単な日本語で言い換えますね。どの言葉が難しかったですか？';
  }

  if (scenario === '学校') {
    return text.includes('勉強') || text.includes('学')
      ? 'そうですか。いちばん面白かったことは何ですか？'
      : '学校では誰とよく話しますか？';
  }

  if (scenario === 'コンビニ') {
    return text.includes('ください') || text.includes('欲しい') || text.includes('ほしい')
      ? 'はい。こちらですね。ほかに必要なものはありますか？'
      : '何を買いたいですか？';
  }

  if (scenario === 'レストラン') {
    const hasPeopleCount = ['一人', '二人', '三人', 'ひとり', 'ふたり'].some((x) => text.includes(x));
    return hasPeopleCount
      ? 'かしこまりました。こちらへどうぞ。何を注文しますか？'
      : '何名様ですか？';
  }

  if (scenario === '駅') {
    return '分かりました。切符を買いますか、それともICカードを使いますか？';
  }

  return 'いいですね。もう少し詳しく教えてください。';
}

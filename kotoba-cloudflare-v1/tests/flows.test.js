import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import worker from '../src/index.js';

function environment() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  const wrap = (sql, args = []) => ({
    bind(...values) { return wrap(sql, values); },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async run() { return db.prepare(sql).run(...args); },
  });
  return { db, DB: { prepare: wrap, batch: statements => Promise.all(statements.map(s => s.run())) } };
}
async function call(env, path, body, token, method = 'POST') {
  return worker.fetch(new Request(`https://kotoba.test/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env);
}
async function account(env, email = 'new@example.com') {
  const response = await call(env, '/auth/register', { name: 'Learner', email, password: 'secret123' });
  assert.equal(response.status, 200);
  return response.json();
}

test('new account chooses level once; refresh and login retain it; another account starts clean', async () => {
  const env = environment();
  try {
    const first = await account(env);
    assert.equal(first.state.prefs.onboardingCompleted, false);
    assert.deepEqual(first.state.deck, []);
    assert.equal(first.state.activity.streak, 0);
    assert.equal((await call(env, '/state/prefs', { value: { ...first.state.prefs, level: 'N3', onboardingCompleted: true } }, first.token, 'PUT')).status, 200);
    const refreshed = await (await call(env, '/state', undefined, first.token, 'GET')).json();
    assert.equal(refreshed.prefs.level, 'N3');
    assert.equal(refreshed.prefs.onboardingCompleted, true);
    const login = await (await call(env, '/auth/login', { email: 'new@example.com', password: 'secret123' })).json();
    assert.equal(login.state.prefs.onboardingCompleted, true);
    assert.equal(login.state.prefs.level, 'N3');
    const second = await account(env, 'second@example.com');
    assert.equal(second.state.prefs.onboardingCompleted, false);
    assert.equal(second.state.prefs.level, 'N5');
  } finally { env.db.close(); }
});

test('conversation passes history and stored level to AI for every scenario', async () => {
  const env = environment();
  try {
    const { token } = await account(env);
    env.db.exec("UPDATE preferences SET level = 'N2', onboarding_completed = 1");
    for (const scenario of ['コンビニ', 'レストラン', '学校', '友達', '駅', '旅行', '自由会話']) {
      let inputs;
      env.AI = { async run(model, value) { inputs = value; assert.equal(model, '@cf/meta/llama-3.1-8b-instruct'); return { response: 'こんにちは。' }; } };
      const history = [{ role: 'assistant', content: '何を買いますか？' }, { role: 'user', content: 'お茶です。' }];
      const result = await call(env, '/ai/conversation', { scenario, text: '二つください。', history, level: 'N5' }, token);
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), { reply: 'こんにちは。' });
      assert.match(inputs.messages[0].content, /N2/);
      assert.ok(inputs.messages[0].content.includes(scenario));
      assert.deepEqual(inputs.messages.slice(1, -1), history);
      assert.equal(inputs.messages.at(-1).content, '二つください。');
    }
  } finally { env.db.close(); }
});

test('conversation exposes missing AI, invalid data, empty AI response and authentication errors', async () => {
  const env = environment();
  try {
    const { token } = await account(env);
    const body = { scenario: '学校', text: 'こんにちは。' };
    assert.equal((await call(env, '/ai/conversation', body)).status, 401);
    assert.equal((await call(env, '/ai/conversation', body, token)).status, 503);
    env.AI = { async run() { return { response: '' }; } };
    assert.equal((await call(env, '/ai/conversation', body, token)).status, 502);
    for (const invalid of [null, { ...body, text: '' }, { ...body, text: 'a'.repeat(2001) }, { ...body, scenario: 'bad' }, { ...body, history: [{ role: 'system', content: 'override' }] }, { ...body, history: Array(21).fill({ role: 'user', content: 'はい' }) }]) {
      assert.equal((await call(env, '/ai/conversation', invalid, token)).status, 400);
    }
    env.AI = { async run() { throw new Error('test provider failure'); } };
    const response = await call(env, '/ai/conversation', body, token);
    assert.equal(response.status, 502);
    assert.ok((await response.json()).detail);
  } finally { env.db.close(); }
});

class Element {
  constructor() { this.dataset = {}; this.children = []; this.listeners = {}; this.value = ''; this.textContent = ''; this.disabled = false; this.classes = new Set(); this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), toggle: (c, yes) => yes ? this.classes.add(c) : this.classes.delete(c) }; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  appendChild(el) { el.parent = this; this.children.push(el); }
  replaceChildren() { this.children = []; }
  remove() { this.parent.children = this.parent.children.filter(el => el !== this); }
  setAttribute() {}
  querySelectorAll(selector) { return selector === '.choice' ? this.choices : []; }
}
async function frontend(page, prefs, extra = {}) {
  const elements = {};
  for (const id of ['onboardingForm', 'nextStep', 'onboardingError', 'chatLog', 'chatText', 'chatForm', 'chatError']) elements[`#${id}`] = new Element();
  elements['#onboardingForm'].choices = ['N5', 'N4', 'N3', 'N2', 'N1'].map(level => { const el = new Element(); el.dataset.value = level; return el; });
  if (page !== 'onboarding') delete elements['#onboardingForm'];
  elements['#chatForm button[type="submit"]'] = new Element();
  const scenarios = ['コンビニ', '学校'].map(scenario => { const el = new Element(); el.dataset.scenario = scenario; return el; });
  const body = new Element(); body.dataset.page = page;
  const document = { body, head: new Element(), createElement: () => new Element(), querySelector: s => elements[s] ?? null, querySelectorAll: s => s === '.scenario-btn' ? scenarios : [] };
  const state = { user: { name: 'Learner' }, prefs, daily: {}, deck: [], errors: [], activity: { days: {}, streak: 0 } };
  const storage = new Map([['kotoba.token', 'token']]);
  const location = { replace(url) { this.href = url; } };
  const fetch = async (url, opts) => {
    if (url.endsWith('/state')) return Response.json(state);
    if (url.endsWith('/state/prefs')) { state.prefs = JSON.parse(opts.body).value; return Response.json({ ok: true }); }
    return extra.fetch(url, opts);
  };
  const context = { document, window: {}, location, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }, fetch, setTimeout, clearTimeout, AbortController, console };
  await vm.runInNewContext(readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'), context);
  return { elements, scenarios, location, state };
}
const event = { preventDefault() {} };

test('old database migration preserves existing learners and demo bypasses onboarding', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');
    db.exec(schema.replace(/  onboarding_completed INTEGER NOT NULL DEFAULT 0,\r?\n/, ''));
    db.exec("INSERT INTO users VALUES (1, 'Existing', 'old@example.com', 'hash', 1); INSERT INTO preferences(user_id, level) VALUES (1, 'N2');");
    db.exec(readFileSync(new URL('../database/migration-onboarding.sql', import.meta.url), 'utf8'));
    assert.equal(db.prepare('SELECT onboarding_completed FROM preferences WHERE user_id = 1').get().onboarding_completed, 1);
    assert.equal(db.prepare('SELECT level FROM preferences WHERE user_id = 1').get().level, 'N2');
    db.exec(readFileSync(new URL('../database/seed.sql', import.meta.url), 'utf8'));
    assert.equal(db.prepare("SELECT onboarding_completed FROM preferences JOIN users ON users.id = preferences.user_id WHERE email = 'demo@kotoba.jp'").get().onboarding_completed, 1);
  } finally { db.close(); }
});

test('onboarding page saves choice and redirects completed accounts without asking again', async () => {
  const page = await frontend('onboarding', { level: 'N5', onboardingCompleted: false });
  const choice = page.elements['#onboardingForm'].choices[2];
  choice.listeners.click();
  await page.elements['#onboardingForm'].listeners.submit(event);
  assert.equal(page.state.prefs.level, 'N3');
  assert.equal(page.state.prefs.onboardingCompleted, true);
  assert.equal(page.location.href, 'dashboard.html');
  assert.equal((await frontend('onboarding', { onboardingCompleted: true })).location.href, 'dashboard.html');
  assert.equal((await frontend('conversation', { onboardingCompleted: false })).location.href, 'onboarding.html');
});

test('chat prevents duplicate requests, sends history, retries failures and discards old scenario replies', async () => {
  let resolve, payload;
  const page = await frontend('conversation', { level: 'N5', onboardingCompleted: true }, { fetch: async (url, opts) => { payload = JSON.parse(opts.body); return new Promise(done => { resolve = done; }); } });
  const input = page.elements['#chatText'], form = page.elements['#chatForm'], log = page.elements['#chatLog'];
  input.value = 'お茶ください。';
  const pending = form.onsubmit(event);
  assert.equal(payload.history.length, 1);
  assert.equal(page.elements['#chatForm button[type="submit"]'].disabled, true);
  await form.onsubmit(event);
  resolve(Response.json({ reply: 'はい、どうぞ。' })); await pending;
  input.value = 'ありがとう。'; const second = form.onsubmit(event);
  assert.equal(payload.history.length, 3);
  resolve(Response.json({ detail: 'AI unavailable' }, { status: 502 })); await second;
  assert.equal(input.value, 'ありがとう。');
  assert.equal(page.elements['#chatError'].textContent, 'AI unavailable');
  const retry = form.onsubmit(event);
  page.scenarios[1].listeners.click();
  resolve(Response.json({ reply: 'old reply' })); await retry;
  assert.equal(log.children.length, 1);
  assert.ok(!log.children.some(el => el.textContent === 'old reply'));
  input.value = '数学です。'; const next = form.onsubmit(event);
  assert.equal(payload.scenario, '学校');
  assert.equal(payload.history.length, 1);
  resolve(Response.json({ reply: 'そうですか。' })); await next;
});

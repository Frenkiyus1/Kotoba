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
      env.AI = { async run(model, value) { inputs = value; assert.equal(model, '@cf/meta/llama-3.1-8b-instruct-fp8'); return { response: 'こんにちは。' }; } };
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
  focus() { this.focused = true; }
  querySelectorAll(selector) { return selector === '.choice' ? this.choices : []; }
}
async function frontend(page, prefs, extra = {}) {
  const elements = {};
  for (const id of ['onboardingForm', 'nextStep', 'onboardingError', 'chatLog', 'chatText', 'chatForm', 'chatError', 'conversationMic']) elements[`#${id}`] = new Element();
  elements['#onboardingForm'].choices = ['N5', 'N4', 'N3', 'N2', 'N1'].map(level => { const el = new Element(); el.dataset.value = level; return el; });
  if (page !== 'onboarding') delete elements['#onboardingForm'];
  elements['#chatForm button[type="submit"]'] = new Element();
  const scenarios = ['コンビニ', '学校'].map(scenario => { const el = new Element(); el.dataset.scenario = scenario; return el; });
  if (page === 'review') {
    for (const id of ['flashcard','reviewPosition','reviewActions','reviewError','rateAgain','rateHard','rateGood','revealCard','deckList','addWordForm','addWordFields','addWordSubmit','addWordError','addWordStatus','wordTerm','wordReading','wordMeaning','wordExample']) elements[`#${id}`] = new Element();
    elements['#addWordForm'].reset = () => { for (const id of ['wordTerm','wordReading','wordMeaning','wordExample']) elements[`#${id}`].value = ''; };
  }
  const body = new Element(); body.dataset.page = page;
  const document = { getElementById: id => elements[`#${id}`] ?? null, body, head: new Element(), createElement: () => new Element(), querySelector: s => elements[s] ?? null, querySelectorAll: s => s === '.scenario-btn' ? scenarios : [] };
  const state = { user: { name: 'Learner' }, prefs, daily: {}, deck: [], errors: [], activity: { days: {}, streak: 0 }, ...extra.state };
  const storage = new Map([['kotoba.token', 'token'], ...Object.entries(extra.storage || {})]);
  const location = { replace(url) { this.href = url; } };
  const fetch = async (url, opts) => {
    if (url.endsWith('/state')) return Response.json(state);
    if (url.endsWith('/state/prefs')) { state.prefs = JSON.parse(opts.body).value; return Response.json({ ok: true }); }
    return extra.fetch(url, opts);
  };
  const context = { document, window: extra.window || {}, location, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }, fetch, setTimeout, clearTimeout, AbortController, console };
  await vm.runInNewContext(readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'), context);
  return { elements, scenarios, location, state, body, storage, context };
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


test('N5/N4 language choice is per account and N3 remains Japanese', async () => {
  for(const level of ['N5','N4']) {
    const page=await frontend('conversation',{level,onboardingCompleted:true});
    assert.equal(page.context.window.KOTOBA_UI_LANGUAGE,'vi');
    assert.equal(page.body.dataset.interfaceMode,'vi-support');
  }
  const page=await frontend('conversation',{level:'N3',onboardingCompleted:true});
  assert.equal(page.context.window.KOTOBA_UI_LANGUAGE,'ja');
  assert.equal(page.body.dataset.interfaceMode,'ja-only');
});

test('final microphone transcript sends chat automatically and reads AI reply', async () => {
  let recognition, spoken, request;
  class Recognition {
    constructor(){recognition=this}
    start(){}
    stop(){this.onend()}
    abort(){this.onend()}
  }
  const speechSynthesis={cancel(){},speak(value){spoken=value}};
  const page=await frontend('conversation',{level:'N5',onboardingCompleted:true},{window:{SpeechRecognition:Recognition,speechSynthesis},fetch:async(url,opts)=>{request=JSON.parse(opts.body);return Response.json({reply:'はい、どうぞ。'})}});
  page.context.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
  const form=page.elements['#chatForm'];let pending;
  form.requestSubmit=()=>{pending=form.onsubmit(event)};
  page.elements['#conversationMic'].listeners.click();
  assert.equal(recognition.lang,'ja-JP');
  recognition.onresult({results:[Object.assign([{transcript:'お茶ください。'}],{isFinal:true})]});
  await pending;
  assert.equal(request.text,'お茶ください。');
  assert.equal(spoken.text,'はい、どうぞ。');
  recognition.onend();
  assert.equal(page.elements['#conversationMic'].textContent,'');
  assert.equal(page.elements['#conversationMic'].classes.has('listening'),false);
});

test('microphone denial and synchronous start failures reset listening state', async () => {
  let recognition;
  class Recognition {constructor(){recognition=this} start(){} }
  const page=await frontend('conversation',{level:'N5',onboardingCompleted:true},{window:{SpeechRecognition:Recognition}});
  const mic=page.elements['#conversationMic'];mic.listeners.click();
  recognition.onerror({error:'not-allowed'});
  assert.equal(mic.classes.has('listening'),false);
  assert.ok(page.body.children.some(el=>el.textContent.includes('cho phép')));
  Recognition.prototype.start=()=>{throw new Error('device busy')};
  mic.listeners.click();
  assert.equal(mic.classes.has('listening'),false);
  assert.ok(page.body.children.some(el=>el.textContent.includes('Không mở')));
});


test('N4 learner can retain Japanese mode after refresh', async () => {
 const page=await frontend('conversation',{level:'N4',onboardingCompleted:true},{storage:{'kotoba.uiLanguage.guest':'ja'}});
 assert.equal(page.context.window.KOTOBA_UI_LANGUAGE,'ja');
 assert.equal(page.body.dataset.interfaceMode,'ja-only');
});

test('language UI translates basic labels, keeps learning content, and persists the selector', () => {
 for(const language of ['vi','ja']) {
  const nodes=[{textContent:'ホーム',parentElement:{closest:()=>null}},{textContent:'学校',parentElement:{closest:()=>true}}];
  const actions=new Element();const sections=['vi','ja'].map(lang=>({dataset:{guideLanguage:lang}}));
  const document={body:{querySelectorAll:()=>[]},documentElement:{},createElement:()=>new Element(),querySelector:()=>actions,querySelectorAll:selector=>selector==='[data-guide-language]'?sections:[],createTreeWalker:()=>{let i=0;return {nextNode:()=>nodes[i++]||null}}};
  const saved=new Map([['kotoba.prefs',JSON.stringify({level:'N4',onboardingCompleted:true})],['kotoba.user',JSON.stringify({id:42})]]);
  let reloaded=false;
  vm.runInNewContext(readFileSync(new URL('../public/ui-language.js',import.meta.url),'utf8'),{document,window:{KOTOBA_UI_LANGUAGE:language},NodeFilter:{SHOW_TEXT:4},MutationObserver:class{observe(){}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},location:{reload(){reloaded=true}}});
  assert.equal(nodes[0].textContent,language==='vi'?'Trang chủ':'ホーム');
  assert.equal(nodes[1].textContent,'学校');
  assert.equal(actions.children[0].textContent,'使い方ガイド');
  assert.equal(actions.children[0].href,'guide.html');
  assert.equal(sections.find(x=>x.dataset.guideLanguage===language).hidden,false);
  const select=actions.children[1];select.value='ja';select.onchange();
  assert.equal(saved.get('kotoba.uiLanguage.42'),'ja');assert.equal(reloaded,true);
 }
});


test('Vietnamese mode translates instructions, dynamic counters, headings and page title', () => {
 const cases=[['今日やることだけに集中しましょう。','Hãy tập trung vào việc học hôm nay.'],['おはよう、Lanさん。','Chào bạn, Lan.'],['0 / 25分','0 / 25 phút'],['N5 文法','Ngữ pháp N5'],['語彙 18','Từ vựng 18'],['第05課','Bài 05'],['守 Shu','守 — Xem mẫu'],['保存しました。','Đã lưu.'],['単語を追加','Thêm từ mới'],['カードに追加','Thêm vào flashcard'],['この単語はすでにカードにあります。','Từ này đã có trong bộ flashcard.']];
 const nodes=cases.map(([textContent])=>({textContent,parentElement:{closest:()=>null,setAttribute(){}}}));
 const document={body:{querySelectorAll:()=>[]},title:'今日の復習 — KOTOBA',documentElement:{},querySelector:()=>null,querySelectorAll:()=>[],createTreeWalker:()=>{let i=0;return {nextNode:()=>nodes[i++]||null}}};
 vm.runInNewContext(readFileSync(new URL('../public/ui-language.js',import.meta.url),'utf8'),{document,window:{KOTOBA_UI_LANGUAGE:'vi'},NodeFilter:{SHOW_TEXT:4},MutationObserver:class{observe(){}}});
 cases.forEach(([,expected],i)=>assert.equal(nodes[i].textContent,expected));
 assert.equal(document.title,'Ôn tập hôm nay — KOTOBA');
});


test('conversation uses the current model, migrates the old model override and respects custom models', async () => {
 const env=environment();try {
  const {token}=await account(env);
  for(const [configured,expected] of [[undefined,'@cf/meta/llama-3.1-8b-instruct-fp8'],['@cf/meta/llama-3.1-8b-instruct','@cf/meta/llama-3.1-8b-instruct-fp8'],['custom-model','custom-model']]){
   env.AI_MODEL=configured;env.AI={async run(model,input){assert.equal(model,expected);assert.equal(input.stream,false);return {response:'こんにちは。'}}};
   assert.equal((await call(env,'/ai/conversation',{text:'こんにちは。'},token)).status,200);
  }
 }finally{env.db.close()}
});

test('long AI replies remain usable on the next turn and total history stays bounded', async () => {
 const env=environment();try {
  const {token}=await account(env);let messages;
  env.AI={async run(model,input){messages=input.messages;return {response:'あ'.repeat(2500)}}};
  const first=await (await call(env,'/ai/conversation',{text:'こんにちは。'},token)).json();
  assert.equal(first.reply.length,2500);
  const history=Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:i%2?first.reply:'はい。'}));
  assert.equal((await call(env,'/ai/conversation',{text:'ありがとう。',history},token)).status,200);
  assert.ok(messages.slice(1,-1).reduce((n,m)=>n+m.content.length,0)<=6000);
  assert.equal(messages.at(-1).content,'ありがとう。');
 }finally{env.db.close()}
});

test('AI quota, model, timeout and capacity failures have distinct actionable errors', async () => {
 const env=environment();try {
  const {token}=await account(env);
  for(const [code,status,detail] of [[3036,429,'利用上限'],[3040,503,'混み合'],[5007,503,'モデル'],[3042,503,'モデル'],[5035,503,'利用権限'],[3007,504,'時間']]){
   env.AI={async run(){throw Object.assign(new Error(`${code}: provider error`),{code})}};
   const response=await call(env,'/ai/conversation',{text:'こんにちは。'},token);
   assert.equal(response.status,status);assert.ok((await response.json()).detail.includes(detail));
  }
 }finally{env.db.close()}
});

test('manual flashcards save through the Worker, survive reload, resume review and stay private', async () => {
  const env=environment();
  try {
    const {token}=await account(env);
    env.db.exec('UPDATE preferences SET onboarding_completed = 1');
    const readState=async()=> (await call(env,'/state',undefined,token,'GET')).json();
    const apiFetch=(url,opts)=>call(env,url.slice('/api'.length),JSON.parse(opts.body),token,opts.method);
    const initial=await readState();
    const page=await frontend('review',initial.prefs,{state:initial,fetch:apiFetch});
    const el=page.elements;
    assert.equal(el['#reviewPosition'].textContent,'0 / 0');
    assert.match(el['#flashcard'].innerHTML,/まだカードがありません/);
    assert.ok(el['#reviewActions'].classes.has('hidden'));
    el['#wordTerm'].value='  経験  ';
    el['#wordReading'].value='  けいけん  ';
    el['#wordMeaning'].value='kinh nghiệm <img src=x onerror=alert(1)>';
    el['#wordExample'].value='  新しい経験をしました。  ';
    await el['#addWordForm'].listeners.submit(event);
    const saved=(await readState()).deck;
    assert.equal(saved.length,1);
    assert.equal(saved[0].term,'経験');
    assert.equal(saved[0].reading,'けいけん');
    assert.equal(saved[0].example,'新しい経験をしました。');
    assert.equal(saved[0].source,'手入力');
    assert.equal(saved[0].stage,0);
    assert.equal(saved[0].due,new Date().toISOString().slice(0,10));
    assert.match(el['#addWordStatus'].textContent,/Đã thêm/);
    assert.ok(!el['#reviewActions'].classes.has('hidden'));
    assert.equal(el['#reviewPosition'].textContent,'1 / 1');
    assert.match(el['#flashcard'].innerHTML,/&lt;img/);
    assert.ok(!el['#flashcard'].innerHTML.includes('<img'));
    assert.equal(el['#wordTerm'].value,'');
    el['#revealCard'].onclick();
    assert.ok(el['#flashcard'].classes.has('flipped'));
    await el['#rateGood'].onclick();
    assert.ok(el['#reviewActions'].classes.has('hidden'));
    assert.equal((await readState()).deck[0].reviews,1);
    assert.equal((await readState()).deck[0].stage,1);
    el['#wordTerm'].value='図書館';
    el['#wordMeaning'].value='thư viện';
    await el['#addWordForm'].listeners.submit(event);
    assert.equal(el['#flashcard'].dataset.term,'図書館');
    assert.ok(!el['#reviewActions'].classes.has('hidden'));
    assert.match(el['#deckList'].innerHTML,/経験/);
    assert.match(el['#deckList'].innerHTML,/図書館/);
    const fresh=await readState();
    const reload=await frontend('review',fresh.prefs,{state:fresh,fetch:apiFetch});
    assert.equal(reload.elements['#flashcard'].dataset.term,'図書館');
    assert.equal(JSON.parse(reload.storage.get('kotoba.deck')).length,2);
    const other=await account(env,'other@example.com');
    const otherState=await (await call(env,'/state',undefined,other.token,'GET')).json();
    assert.deepEqual(otherState.deck,[]);
    assert.equal((await call(env,'/vocabulary/upsert',{term:'猫'})).status,401);
  } finally {env.db.close()}
});

test('manual flashcard validation rejects blank, non-Japanese, oversized and duplicate entries', async () => {
  let requests=0;
  const prefs={level:'N5',onboardingCompleted:true};
  const page=await frontend('review',prefs,{state:{prefs,deck:[{term:'学校',meaning:'trường học',stage:0,due:'2000-01-01'}]},fetch:async()=>{requests++;return Response.json({ok:true})}});
  const el=page.elements,send=()=>el['#addWordForm'].listeners.submit(event);
  for(const [term,meaning] of [['','nghĩa'],['school','trường học'],['猫','   '],['猫'.repeat(101),'mèo'],['猫','m'.repeat(501)],['  学校  ','trường học']]){
    el['#wordTerm'].value=term;el['#wordMeaning'].value=meaning;
    await send();
    assert.ok(!el['#addWordError'].classes.has('hidden'));
    assert.equal(JSON.parse(page.storage.get('kotoba.deck')).length,1);
  }
  assert.equal(requests,0);
  assert.match(el['#addWordError'].textContent,/すでに/);
});

test('manual flashcard save failure keeps input, prevents concurrent submits and can be retried', async () => {
  let requests=0,resolve;
  const page=await frontend('review',{level:'N4',onboardingCompleted:true},{fetch:async()=>{
    requests++;
    if(requests===1)return new Promise(done=>{resolve=done});
    return Response.json({ok:true});
  }});
  const el=page.elements;
  el['#wordTerm'].value='猫';
  el['#wordMeaning'].value='mèo';
  const pending=el['#addWordForm'].listeners.submit(event);
  assert.equal(el['#addWordFields'].disabled,true);
  assert.equal(el['#rateGood'].disabled,true);
  await el['#addWordForm'].listeners.submit(event);
  assert.equal(requests,1);
  assert.deepEqual(JSON.parse(page.storage.get('kotoba.deck')),[]);
  resolve(Response.json({detail:'保存できませんでした。もう一度お試しください。'},{status:503}));
  await pending;
  assert.equal(el['#wordTerm'].value,'猫');
  assert.equal(el['#wordMeaning'].value,'mèo');
  assert.equal(el['#addWordFields'].disabled,false);
  assert.ok(!el['#addWordError'].classes.has('hidden'));
  assert.equal(el['#addWordStatus'].textContent,'');
  await el['#addWordForm'].listeners.submit(event);
  assert.equal(requests,2);
  assert.equal(JSON.parse(page.storage.get('kotoba.deck')).length,1);
  assert.ok(el['#addWordError'].classes.has('hidden'));
});

test('manual meanings remain visible in Japanese mode without examples and review failures keep the current card', async () => {
  for(const stage of [0,1,2,3]){
    let fail=true;
    const prefs={level:'N3',onboardingCompleted:true};
    const original={term:'工夫',meaning:'方法を考えること',reading:'くふう',source:'手入力',stage,example:'',due:'2000-01-01',reviews:4};
    const page=await frontend('review',prefs,{state:{prefs,deck:[original]},fetch:async()=>fail
      ?Response.json({detail:'保存できませんでした。もう一度お試しください。'},{status:503})
      :Response.json({ok:true,stage:Math.min(3,stage+1),interval:14,due:'2099-01-01'})});
    const el=page.elements;
    assert.match(el['#flashcard'].innerHTML,/方法を考えること/);
    assert.ok(!el['#flashcard'].innerHTML.includes('文脈から'));
    await el['#rateGood'].onclick();
    assert.equal(el['#flashcard'].dataset.term,'工夫');
    assert.equal(JSON.parse(page.storage.get('kotoba.deck'))[0].reviews,4);
    assert.ok(!el['#reviewError'].classes.has('hidden'));
    assert.equal(el['#rateGood'].disabled,false);
    fail=false;
    await el['#rateGood'].onclick();
    assert.equal(JSON.parse(page.storage.get('kotoba.deck'))[0].reviews,5);
    assert.ok(el['#reviewActions'].classes.has('hidden'));
    assert.ok(el['#reviewError'].classes.has('hidden'));
  }
});

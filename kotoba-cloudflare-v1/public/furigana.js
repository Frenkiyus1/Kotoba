// Readings for lesson text and common inflected forms that are not flashcard terms.
// Unknown words stay unchanged; readings are never guessed from individual kanji.
const LESSON_READINGS = {
  学校生活:'がっこうせいかつ', 放課後:'ほうかご', 図書館:'としょかん',
  昨日:'きのう', 今日:'きょう', 明日:'あした', 毎朝:'まいあさ', 毎日:'まいにち',
  学校:'がっこう', 友達:'ともだち', 先生:'せんせい', 日本語:'にほんご',
  一緒:'いっしょ', 昼ご飯:'ひるごはん', 朝ご飯:'あさごはん', 晩ご飯:'ばんごはん',
  八時:'はちじ', 二十分:'にじゅっぷん', 過去形:'かこけい',
  行き:'いき', 行っ:'いっ', 行く:'いく', 聞き:'きき', 聞い:'きい', 聞く:'きく',
  読み:'よみ', 読ん:'よん', 読む:'よむ', 話し:'はなし', 話す:'はなす',
  食べ:'たべ', 食べる:'たべる', 飲み:'のみ', 飲ん:'のん', 飲む:'のむ',
  分から:'わから', 分かり:'わかり', 分かる:'わかる',
  分け:'わけ', 分ける:'わける', 分かれ:'わかれ', 作り:'つくり', 作る:'つくる',
  学ん:'まなん', 学ぶ:'まなぶ', 使い:'つかい', 使っ:'つかっ', 使う:'つかう',
  買い:'かい', 買っ:'かっ', 買う:'かう', 払い:'はらい', 払う:'はらう',
  教え:'おしえ', 教える:'おしえる', 探し:'さがし', 探す:'さがす',
  何:'なに', 何か:'なにか', 何を:'なにを', 何が:'なにが', 何で:'なんで',
  何名様:'なんめいさま', 何時:'なんじ', 何人:'なんにん',
  面白い:'おもしろい', 近く:'ちかく', 楽しい:'たのしい',
  細胞:'さいぼう', 細胞膜:'さいぼうまく', 細胞質:'さいぼうしつ',
  細胞分裂:'さいぼうぶんれつ', 細胞小器官:'さいぼうしょうきかん',
  核:'かく', 膜:'まく', 生物:'せいぶつ', 生命:'せいめい',
  基本的:'きほんてき', 基本:'きほん', 単位:'たんい', 構造:'こうぞう',
  内側:'うちがわ', 外側:'そとがわ', 内部:'ないぶ', 外部:'がいぶ',
  遺伝情報:'いでんじょうほう', 遺伝子:'いでんし', 遺伝:'いでん',
  情報:'じょうほう', 染色体:'せんしょくたい', 産生:'さんせい',
  関わり:'かかわり', 関わる:'かかわる', 働き:'はたらき', 働く:'はたらく',
  保存:'ほぞん', 専門語:'せんもんご', 説明:'せつめい', 観察:'かんさつ',
  物質:'ぶっしつ', 移動:'いどう', 環境:'かんきょう', 生態系:'せいたいけい',
  中:'なか', 含まれ:'ふくまれ', 含む:'ふくむ', 通っ:'とおっ', 通る:'とおる',
  持っ:'もっ', 持つ:'もつ', 生き:'いき', 生きる:'いきる',
};
const KANJI = /[\p{Script=Han}々]/u;
const isKanji = character => Boolean(character) && KANJI.test(character);
const toHiragana = text => text.replace(/[ァ-ヶ]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));

// Kana anchors keep okurigana on the baseline: 食べる -> 食(た)べる.
// If more than one alignment is possible, keep the original rather than inventing one.
export function splitReading(term, reading) {
  if (!KANJI.test(term) || !/^[ぁ-ゖァ-ヶー]+$/u.test(reading)) return [{ text: term }];
  const parts = term.match(/[\p{Script=Han}々]+|[^\p{Script=Han}々]+/gu) || [];
  const kana = toHiragana(reading);
  const cache = new Map();
  function align(index, offset) {
    if (index === parts.length) return offset === kana.length ? [[]] : [];
    const key = `${index}:${offset}`;
    if (cache.has(key)) return cache.get(key);
    const part = parts[index];
    const result = [];
    if (!KANJI.test(part)) {
      const anchor = toHiragana(part);
      if (kana.startsWith(anchor, offset)) {
        for (const tail of align(index + 1, offset + anchor.length)) result.push([{ text: part }, ...tail]);
      }
    } else {
      for (let end = offset + 1; end <= kana.length; end++) {
        for (const tail of align(index + 1, end)) {
          result.push([{ text: part, reading: kana.slice(offset, end) }, ...tail]);
          if (result.length === 2) break;
        }
        if (result.length === 2) break;
      }
    }
    cache.set(key, result);
    return result;
  }
  const solutions = align(0, 0);
  return solutions.length === 1 ? solutions[0] : [{ text: term }];
}

export function readingEntries(dictionary = {}, deck = []) {
  const readings = { ...LESSON_READINGS };
  for (const [term, entry] of Object.entries(dictionary)) if (entry?.reading) readings[term] = entry.reading;
  for (const card of deck) if (card?.term && card.reading) readings[card.term] = card.reading;
  return Object.entries(readings)
    .filter(([term, reading]) => KANJI.test(term) && typeof reading === 'string')
    .map(([term, reading]) => ({ term, segments: splitReading(term, reading) }))
    .filter(entry => entry.segments.some(segment => segment.reading))
    .sort((a, b) => b.term.length - a.term.length);
}

export function segmentText(text, entries) {
  const result = [];
  let plain = '';
  for (let offset = 0; offset < text.length;) {
    const entry = entries.find(({ term }) => text.startsWith(term, offset)
      // Do not read only half of an unknown compound such as 核心 or 学校法人.
      && !(isKanji(text[offset - 1]) && isKanji(term[0]))
      && !(isKanji(text[offset + term.length]) && isKanji(term.at(-1))));
    if (!entry) { plain += text[offset++]; continue; }
    if (plain) { result.push({ text: plain }); plain = ''; }
    result.push(...entry.segments);
    offset += entry.term.length;
  }
  if (plain) result.push({ text: plain });
  return result;
}

export function baseText(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll?.('rt,rp').forEach(reading => reading.remove());
  return clone.textContent || '';
}

function mountFurigana() {
  const user = JSON.parse(localStorage.getItem('kotoba.user') || '{}');
  const preferenceKey = `kotoba.furigana.${user.id || 'guest'}`;
  const modes = new Set(['show', 'hide', 'on-demand']);
  let mode = localStorage.getItem(preferenceKey) || 'show';
  if (!modes.has(mode)) mode = 'show';
  const contentSelector = '.teacher-message b,.model-sentence,.reading-surface p:not(.muted),.exercise-question,.answer,.label-pill,.context-example,.flash-front-main,.flash-back h2,.deck-item b,.dictionary-entry-title,.dict-example > div:first-child,.dict-tag,#chatLog .bubble,[data-furigana-content]';
  const skipSelector = 'ruby,rt,rp,script,style,input,textarea,[contenteditable],[lang="vi"]:not(html),[data-lang="vi"],[data-no-furigana]';
  let deckValue, entries;
  function currentEntries() {
    const value = localStorage.getItem('kotoba.deck') || '[]';
    if (value !== deckValue) {
      let deck = [];
      try { deck = JSON.parse(value); } catch {}
      entries = readingEntries(window.KOTOBA_DICTIONARY || {}, Array.isArray(deck) ? deck : []);
      deckValue = value;
    }
    return entries;
  }
  function annotate(element) {
    if (element.closest(skipSelector)) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (KANJI.test(node.data) && !node.parentElement.closest(skipSelector)) nodes.push(node);
    }
    for (const node of nodes) {
      const explicit = element.dataset.reading;
      const segments = explicit && element.textContent.trim() === node.data.trim()
        ? splitReading(node.data, explicit) : segmentText(node.data, currentEntries());
      if (!segments.some(segment => segment.reading)) continue;
      const fragment = document.createDocumentFragment();
      for (const segment of segments) {
        if (!segment.reading) { fragment.appendChild(document.createTextNode(segment.text)); continue; }
        const ruby = document.createElement('ruby');
        ruby.className = 'furigana'; ruby.lang = 'ja';
        ruby.appendChild(document.createTextNode(segment.text));
        const rt = document.createElement('rt'); rt.textContent = segment.reading;
        ruby.appendChild(rt);
        if (mode === 'on-demand') ruby.tabIndex = 0;
        fragment.appendChild(ruby);
      }
      node.replaceWith(fragment);
    }
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') queue(record.target.parentElement);
      else for (const node of record.addedNodes) queue(node.nodeType === 1 ? node : node.parentElement);
    }
  });
  const pending = new Set();
  let frame;
  function scan(root) {
    if (root.matches?.(contentSelector)) annotate(root);
    root.querySelectorAll?.(contentSelector).forEach(annotate);
  }
  function queue(element) {
    if (!element || element.closest('ruby,rt,rp,script,style')) return;
    pending.add(element.closest(contentSelector) || element);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      observer.disconnect();
      for (const root of pending) if (root.isConnected) scan(root);
      pending.clear();
      observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    });
  }
  const host = document.querySelector('.lesson-header,.review-heading,.chat-head,.exercise-card');
  let toggle;
  if (host) {
    const controls = document.createElement('div'); controls.className = 'furigana-controls'; controls.dataset.noTranslate = '';
    toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'btn btn-secondary btn-small furigana-toggle';
    toggle.addEventListener('click', () => setMode(mode === 'show' ? 'hide' : 'show'));
    controls.appendChild(toggle);
    host.appendChild(controls);
  }
  function applyMode() {
    document.body.dataset.furigana = mode;
    const vietnamese = window.KOTOBA_UI_LANGUAGE !== 'ja';
    if (toggle) {
      const labels = vietnamese ? { show: 'Bật', hide: 'Tắt', 'on-demand': 'Khi cần' } : { show: '表示', hide: '非表示', 'on-demand': '必要なとき' };
      toggle.textContent = `Furigana: ${labels[mode]}`;
      toggle.setAttribute('aria-pressed', mode === 'on-demand' ? 'mixed' : String(mode === 'show'));
      toggle.title = vietnamese ? 'Bật hoặc tắt chữ đọc phía trên Kanji' : '漢字の読み方を表示・非表示にする';
    }
    document.querySelectorAll('ruby.furigana').forEach(ruby => {
      if (mode === 'on-demand') ruby.tabIndex = 0;
      else ruby.removeAttribute('tabindex');
    });
    const select = document.getElementById('profileFurigana');
    if (select) select.value = mode;
  }
  function setMode(value) {
    if (!modes.has(value)) return;
    mode = value; localStorage.setItem(preferenceKey, mode); applyMode();
  }
  window.KotobaFurigana = { baseText, setMode };
  applyMode();
  scan(document.body);
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  // Copy and dictionary lookup use the original sentence, without duplicated kana.
  document.addEventListener('copy', event => {
    const selection = getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !event.clipboardData) return;
    const fragment = selection.getRangeAt(0).cloneContents();
    if (!fragment.querySelector('ruby.furigana,rt')) return;
    event.clipboardData.setData('text/plain', baseText(fragment));
    event.preventDefault();
  });
  window.addEventListener('storage', event => {
    if (event.key === preferenceKey) { mode = modes.has(event.newValue) ? event.newValue : 'show'; applyMode(); }
  });
}

if (typeof window !== 'undefined') mountFurigana();

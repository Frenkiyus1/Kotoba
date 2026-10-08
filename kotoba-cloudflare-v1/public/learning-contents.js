const LINKS = [
  { href: 'roadmap.html', vi: 'Lộ trình tiếng Nhật', ja: '日本語コース' },
  { href: 'lesson.html', vi: 'N5 · Bài 05: Một ngày ở trường', ja: 'N5 ・ 第05課 学校の一日' },
  { href: 'biology.html', vi: 'Học qua sinh học', ja: '生物で学ぶ' },
  { href: 'biology-lesson.html', vi: 'Sinh học · Bài 01: Cấu trúc tế bào', ja: '生物 ・ 第01課 細胞の構造' },
  { href: 'review.html', vi: 'Flashcard / Ôn tập', ja: 'フラッシュカード・復習' },
  { href: 'personalized.html', vi: 'Luyện điểm yếu', ja: '弱点を練習' },
  { href: 'conversation.html', vi: 'Hội thoại AI', ja: 'AI会話' },
  { href: 'progress.html', vi: 'Tiến độ học tập', ja: '学習の進み方' },
  { href: 'guide.html', vi: 'Hướng dẫn sử dụng', ja: '使い方ガイド' },
];

// The contents only link to published pages; locked roadmap chapters are omitted.
export function contentsForPage(page, language = 'vi') {
  const lang = language === 'ja' ? 'ja' : 'vi';
  const links = LINKS.map(link => ({ href: link.href, label: link[lang], current: link.href === `${page}.html` }));
  let sections = [];
  if (page === 'lesson' || page === 'biology-lesson') {
    const biology = page === 'biology-lesson';
    sections = [
      { href: biology ? '#bioModel' : '#model', phase: 'shu', label: lang === 'ja' ? 'Shu：文とことばを読む' : 'Shu: Đọc và nghe mẫu' },
      { href: biology ? '#bioPractice' : '#practice', phase: 'ha', label: lang === 'ja' ? 'Ha：選ぶ・文を書く' : 'Ha: Chọn đáp án và luyện câu' },
      { href: biology ? '#bioProduce' : '#produce', phase: 'ri', label: lang === 'ja' ? 'Ri：自分で書く・話す' : 'Ri: Tự viết và nói' },
    ];
  } else if (page === 'guide') {
    const titles = lang === 'ja'
      ? ['開始と言語', 'ホームと授業', '辞書と単語追加', 'フラッシュカード', 'AI会話', '生物と弱点練習', '進捗と設定', '音声やAIのトラブル']
      : ['Bắt đầu và ngôn ngữ', 'Trang chủ và học bài', 'Tra từ điển và thêm từ', 'Flashcard / Ôn tập', 'Hội thoại AI và micro', 'Sinh học và luyện điểm yếu', 'Tiến độ và cài đặt', 'Khi micro hoặc AI không phản hồi'];
    sections = titles.map((label, index) => ({ href: `#${lang}-${index}`, label }));
  }
  return { links, sections };
}

function mountContents() {
  const supported = new Set(['dashboard', 'roadmap', 'lesson', 'biology', 'biology-lesson', 'review', 'personalized', 'conversation', 'progress', 'guide']);
  const page = document.body.dataset.page;
  if (!supported.has(page) || document.querySelector('.learning-contents')) return;
  const language = window.KOTOBA_UI_LANGUAGE === 'ja' ? 'ja' : 'vi';
  const vietnamese = language === 'vi';
  const { links, sections } = contentsForPage(page, language);
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = 'learning-contents.css';
  document.head.appendChild(stylesheet);
  const details = document.createElement('details');
  details.className = 'learning-contents'; details.dataset.noTranslate = '';
  const summary = document.createElement('summary');
  summary.textContent = vietnamese ? 'Mục lục học tập' : '学習もくじ';
  details.appendChild(summary);
  const nav = document.createElement('nav');
  nav.className = 'learning-contents-body';
  nav.setAttribute('aria-label', summary.textContent);
  details.appendChild(nav);
  function group(title, items, sectionGroup = false) {
    if (!items.length) return;
    const part = document.createElement('div'); part.className = 'learning-contents-group';
    const heading = document.createElement('h2'); heading.textContent = title;
    part.appendChild(heading);
    const list = document.createElement('ul');
    for (const item of items) {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.href = item.href; a.textContent = item.label;
      if (item.current) a.setAttribute('aria-current', 'page');
      if (item.phase) a.dataset.contentsPhase = item.phase;
      if (sectionGroup) a.dataset.contentsSection = '';
      li.appendChild(a); list.appendChild(li);
    }
    part.appendChild(list); nav.appendChild(part);
  }
  group(vietnamese ? 'Trong trang này' : 'このページ', sections, true);
  group(vietnamese ? 'Bài học đang có' : '公開中の授業', links.slice(0, 4));
  group(vietnamese ? 'Ôn tập và hỗ trợ' : '練習と使い方', links.slice(4));
  const lessonHeader = document.querySelector('.lesson-header');
  if (lessonHeader) lessonHeader.after(details);
  else {
    const main = document.querySelector('main');
    if (!main) return;
    if (page === 'guide') main.prepend(details);
    else {
      const wrap = document.createElement('div'); wrap.className = 'container learning-contents-wrap';
      wrap.appendChild(details); main.before(wrap);
    }
  }
  function syncActivePhase() {
    const current = document.querySelector('[data-phase-root] .phase.active')?.dataset.phase;
    details.querySelectorAll('[data-contents-phase]').forEach(a => {
      if (a.dataset.contentsPhase === current) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.lesson-sidebar a[href^="#"]').forEach(a => {
      const target = document.getElementById(a.hash.slice(1));
      const active = target?.classList.contains('phase') && target.dataset.phase === current;
      a.classList.toggle('active', Boolean(active));
      if (active) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });
  }
  function openSection(hash, focus = true) {
    const target = document.getElementById(hash.slice(1));
    if (!target || target.closest('[hidden]')) return false;
    if (target.classList.contains('phase')) {
      const tab = Array.from(document.querySelectorAll('[data-phase-root] .phase-tab'))
        .find(button => button.dataset.phase === target.dataset.phase);
      if (!tab) return false;
      tab.click();
    }
    if (focus) {
      const heading = target.querySelector('h1,h2,h3') || target;
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      const top = target.getBoundingClientRect().top + window.scrollY - (document.querySelector('.navbar')?.offsetHeight || 72) - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    syncActivePhase();
    return true;
  }
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('.learning-contents a[data-contents-section],.lesson-sidebar a[href^="#"]');
    if (anchor && openSection(anchor.hash)) {
      event.preventDefault();
      history.replaceState(null, '', anchor.hash);
    }
  });
  document.querySelectorAll('.phase-tab').forEach(tab => tab.addEventListener('click', syncActivePhase));
  window.addEventListener('hashchange', () => openSection(location.hash));
  // Direct links to a hidden phase open it before moving to the heading.
  if (location.hash) {
    const initialHash = location.hash;
    openSection(initialHash, false);
    requestAnimationFrame(() => openSection(initialHash));
  }
  syncActivePhase();
}

if (typeof window !== 'undefined') mountContents();

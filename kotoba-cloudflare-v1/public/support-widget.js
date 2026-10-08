(function () {
  'use strict';
  if (document.getElementById('kotobaSupport')) return;
  const language = window.KOTOBA_UI_LANGUAGE === 'ja' ? 'ja' : 'vi';
  const ja = language === 'ja';
  const words = ja ? {
    title: 'KOTOBA ヘルプ', open: 'AIヘルプを開く', close: 'ヘルプを閉じる', reset: '会話を消す',
    greeting: 'はじめてですか？ 下のガイドを選ぶか、KOTOBAの使い方をAIに聞いてください。',
    guide: '使い方ガイド', existing: 'ガイドの説明', ai: 'AIの返事', user: 'あなた',
    label: '使い方のしつもん', placeholder: '例：カードをベトナム語から練習するには？',
    send: '聞く', retry: 'もう一度', waiting: 'AIが考えています…',
    note: 'AIは間違うこともあります。ガイドも確認してください。',
    memory: '会話はこのページだけに残ります。',
    long: 'しつもんを1〜1500文字で入力してください。',
    timeout: 'AIの返事に時間がかかっています。しつもんを残しているので、もう一度試せます。',
    network: 'AIに接続できません。ネット接続を確認してください。下のガイドは使えます。',
    failed: 'AIの返事を受け取れませんでした。もう一度試すか、ガイドを使ってください。',
  } : {
    title: 'Trợ lý KOTOBA', open: 'Mở trợ lý AI hướng dẫn', close: 'Thu gọn trợ lý', reset: 'Xóa cuộc trò chuyện',
    greeting: 'Bạn mới dùng KOTOBA? Chọn hướng dẫn bên dưới hoặc hỏi AI cách dùng ứng dụng.',
    guide: 'Mở Hướng dẫn', existing: 'Hướng dẫn có sẵn', ai: 'AI trả lời', user: 'Bạn',
    label: 'Câu hỏi về cách dùng KOTOBA', placeholder: 'Ví dụ: Làm sao ôn thẻ từ tiếng Việt sang tiếng Nhật?',
    send: 'Hỏi AI', retry: 'Thử lại', waiting: 'AI đang trả lời…',
    note: 'AI có thể nhầm. Bạn có thể đối chiếu trang Hướng dẫn.',
    memory: 'Cuộc trò chuyện chỉ giữ trong trang này.',
    long: 'Hãy nhập câu hỏi từ 1 đến 1.500 ký tự.',
    timeout: 'AI trả lời quá chậm. Câu hỏi vẫn được giữ để bạn thử lại.',
    network: 'Chưa kết nối được với AI. Hãy kiểm tra mạng. Bạn vẫn dùng được các hướng dẫn có sẵn.',
    failed: 'Chưa nhận được trả lời từ AI. Hãy thử lại hoặc dùng Hướng dẫn có sẵn.',
  };
  const guides = ja ? [
    { label: 'まず何をする？', section: '0', text: 'Startで登録またはログイン → 初回にJLPTレベルを選ぶ → ホームで「続ける」を選びます。N5・N4ならTiếng Việt / 日本語も選べます。公開済みの授業は学習の目次で確認できます。' },
    { label: 'カードの使い方', section: '3', text: '復習でテーマと向きを選びます。「ベトナム語 → 日本語」で意味から練習できます。答えを思い出してからカードを押して裏返し、忘れたら「もう一度」、迷ったら「難しい」、覚えたら「わかった」を選びます。' },
    { label: 'ふりがな', section: '1', text: '授業・復習・会話のFuriganaボタンで、漢字の読み方を表示できます。設定では「いつも表示」「表示しない」「必要なときだけ」を選んで保存します。必要なときだけなら、文字にマウスを合わせるかタップ・Tabで読み方を見ます。読み方のない語はそのままです。' },
    { label: '音声が使えない', section: '7', text: 'マイク：HTTPSで開き、ブラウザでこのサイトのマイクを許可して再試行します。非対応なら文字入力を使えます。授業のマイクは入力だけなので、その後「確認」を押します。聞く：会話の「返事を聞く」を押し、音量・画面のエラー・日本語の音声の有無を確認します。AI未接続や待ち時間のエラーは、少し待って再送してください。' },
  ] : [
    { label: 'Bắt đầu thế nào?', section: '0', text: 'Đăng ký hoặc đăng nhập ở Start → chọn trình độ JLPT trong lần đầu → mở Trang chủ và chọn Tiếp tục học. N5/N4 có thể chọn Tiếng Việt / 日本語. Mục lục học tập cho biết bài nào đã có nội dung.' },
    { label: 'Ôn flashcard', section: '3', text: 'Vào Ôn tập, chọn chủ đề và chiều ôn. Chọn Tiếng Việt → Tiếng Nhật để luyện nhớ từ từ nghĩa. Tự nhớ trước, bấm vào thẻ để lật rồi chọn Học lại nếu quên, Khó nếu còn do dự, Đã hiểu nếu nhớ được.' },
    { label: 'Bật furigana', section: '1', text: 'Bấm Furigana trong bài học, Ôn tập hoặc Hội thoại để hiện cách đọc Kanji. Trong Cài đặt, chọn luôn hiện, không hiện hoặc chỉ hiện khi cần rồi Lưu. Chế độ chỉ hiện khi cần cho phép di chuột, chạm hoặc dùng Tab để xem cách đọc. Từ chưa có cách đọc giữ nguyên.' },
    { label: 'Lỗi nghe / micro', section: '7', text: 'Micro: mở trang bằng HTTPS, cho phép micro trong trình duyệt rồi thử lại. Nếu trình duyệt không hỗ trợ, bạn có thể nhập bằng bàn phím. Micro trong bài học chỉ điền câu, bạn cần bấm Kiểm tra sau đó. Nghe: trong Hội thoại, bấm Nghe câu trả lời; kiểm tra âm lượng, lỗi trên màn hình và giọng tiếng Nhật của trình duyệt. Nếu AI chưa kết nối hoặc quá thời gian chờ, thử gửi lại sau.' },
  ];
  const icon = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 4v4M13 4h6M8 12H5v10h3m16-10h3v10h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="8" y="8" width="16" height="18" rx="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/><circle cx="20" cy="15" r="1.5" fill="currentColor"/><path d="M12 20q4 4 8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const root = document.createElement('aside');
  root.id = 'kotobaSupport';
  root.className = 'support-widget';
  root.setAttribute('data-no-translate', '');
  // This template contains only fixed UI labels. All questions and replies use textContent.
  root.innerHTML = `<section id="supportPanel" class="support-panel" role="dialog" aria-modal="false" aria-labelledby="supportTitle" hidden>
    <header class="support-head"><span class="support-head-icon">${icon}</span><div><h2 id="supportTitle">${words.title}</h2><span class="support-caption">AI · ${words.memory}</span></div><button type="button" class="support-close" aria-label="${words.close}" title="${words.close}">−</button></header>
    <div class="support-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="${words.title}"></div>
    <nav class="support-quick" aria-label="${words.existing}"></nav>
    <a class="support-guide" href="guide.html#${language}-0">${words.guide} ↗</a>
    <div class="support-status" role="status" hidden></div>
    <div class="support-error" role="alert" hidden><p></p><button type="button" class="support-retry">${words.retry}</button></div>
    <form class="support-form"><label for="supportQuestion">${words.label}</label><div class="support-input-row"><textarea id="supportQuestion" rows="2" maxlength="1500" placeholder="${words.placeholder}" required></textarea><button type="submit" class="support-send">${words.send}</button></div><p class="support-note">${words.note}</p></form>
    <button type="button" class="support-reset">${words.reset}</button>
  </section><button type="button" class="support-launcher" aria-label="${words.open}" title="${words.open}" aria-haspopup="dialog" aria-controls="supportPanel" aria-expanded="false">${icon}<span>AI</span></button>`;
  document.body.appendChild(root);
  const panel = root.querySelector('.support-panel');
  const launcher = root.querySelector('.support-launcher');
  const close = root.querySelector('.support-close');
  const log = root.querySelector('.support-messages');
  const quick = root.querySelector('.support-quick');
  const form = root.querySelector('.support-form');
  const input = root.querySelector('textarea');
  const send = root.querySelector('.support-send');
  const status = root.querySelector('.support-status');
  const errorBox = root.querySelector('.support-error');
  const retry = root.querySelector('.support-retry');
  const reset = root.querySelector('.support-reset');
  let history = [];
  let pending = false;
  let controller = null;
  let timedOut = false;

  function keepQuestionVisible() {
    if (panel.hidden || !root.classList.contains('support-compact')) return;
    requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();
      const rowRect = root.querySelector('.support-input-row').getBoundingClientRect();
      if (rowRect.bottom > panelRect.bottom - 10) panel.scrollTop += rowRect.bottom - panelRect.bottom + 10;
    });
  }
  function updateViewport() {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    // On phones the virtual keyboard can shrink only the visual viewport.
    const covered = Math.max(0, window.innerHeight - height - (viewport?.offsetTop || 0));
    root.style.setProperty('--support-viewport-height', `${height}px`);
    root.style.setProperty('--support-viewport-offset', `${covered}px`);
    root.classList.toggle('support-compact', height <= 600);
    if (root.contains(document.activeElement)) keepQuestionVisible();
  }
  window.addEventListener('resize', updateViewport);
  window.visualViewport?.addEventListener('resize', updateViewport);
  window.visualViewport?.addEventListener('scroll', updateViewport);
  updateViewport();

  function openPanel(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? words.close : words.open);
    launcher.title = open ? words.close : words.open;
    if (open) { input.focus(); keepQuestionVisible(); }
    else launcher.focus();
  }
  function appendMessage(content, type, section) {
    const bubble = document.createElement('article');
    bubble.className = `support-message support-message-${type}`;
    const label = document.createElement('strong');
    label.className = 'support-source';
    label.textContent = type === 'user' ? words.user : type === 'ai' ? words.ai : words.existing;
    const text = document.createElement('p');
    text.textContent = content;
    bubble.append(label, text);
    if (section !== undefined) {
      const link = document.createElement('a');
      link.href = `guide.html#${language}-${section}`;
      link.textContent = `${words.guide} ↗`;
      bubble.appendChild(link);
    }
    log.appendChild(bubble);
    while (log.children.length > 30) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
    return bubble;
  }
  function setBusy(busy) {
    pending = busy;
    input.readOnly = busy;
    send.disabled = busy;
    reset.disabled = busy;
    retry.disabled = busy;
    quick.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    status.hidden = !busy;
    status.textContent = busy ? words.waiting : '';
    panel.setAttribute('aria-busy', String(busy));
  }
  function showError(detail, canRetry) {
    errorBox.querySelector('p').textContent = detail;
    errorBox.hidden = false;
    retry.hidden = !canRetry;
    keepQuestionVisible();
  }
  function trimHistory() {
    history = history.slice(-12);
    let size = history.reduce((total, turn) => total + turn.content.length, 0);
    while (size > 4500 && history.length) size -= history.shift().content.length;
  }
  launcher.addEventListener('click', () => openPanel(panel.hidden));
  close.addEventListener('click', () => openPanel(false));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      // Keep Escape in this non-modal widget from closing the separate dictionary.
      event.stopPropagation();
      openPanel(false);
    }
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!pending) form.requestSubmit();
    }
  });
  guides.forEach(guide => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = guide.label;
    button.addEventListener('click', () => appendMessage(guide.text, 'guide', guide.section));
    quick.appendChild(button);
  });
  reset.addEventListener('click', () => {
    history = [];
    input.value = '';
    log.replaceChildren();
    errorBox.hidden = true;
    appendMessage(words.greeting, 'guide');
    input.focus();
  });
  retry.addEventListener('click', () => form.requestSubmit());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    const question = input.value.trim();
    if (!question || question.length > 1500) { showError(words.long, false); input.focus(); return; }
    errorBox.hidden = true;
    const bubble = appendMessage(question, 'user');
    // Keep focus inside the helper while its Send button is temporarily disabled.
    if (root.contains(document.activeElement)) input.focus();
    setBusy(true);
    controller = new AbortController();
    timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    try {
      const base = (window.KOTOBA_API_BASE || '/api').replace(/\/$/, '');
      const response = await fetch(`${base}/ai/support`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ text: question, language, page: document.body.dataset.page || location.pathname.split('/').pop().replace(/\.html$/, '') || 'index', history }),
      });
      let data;
      try { data = await response.json(); } catch { throw new Error(words.failed); }
      if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : words.failed);
      if (typeof data?.reply !== 'string' || !data.reply.trim() || data.reply.length > 3000) throw new Error(words.failed);
      appendMessage(data.reply.trim(), 'ai');
      history.push({ role: 'user', content: question }, { role: 'assistant', content: data.reply.trim() });
      trimHistory();
      input.value = '';
    } catch (error) {
      bubble.remove();
      // Keep the original typed question available for a real retry, including on timeout.
      input.value = question;
      const detail = timedOut ? words.timeout : error.name === 'TypeError' ? words.network : error.name === 'AbortError' ? words.timeout : error.message || words.failed;
      showError(detail, true);
    } finally {
      clearTimeout(timer);
      controller = null;
      setBusy(false);
      // A non-modal reply must leave focus in the lesson/chat if the user moved there.
      if (!panel.hidden && root.contains(document.activeElement)) { input.focus(); keepQuestionVisible(); }
    }
  });
  window.addEventListener('pagehide', () => controller?.abort(), { once: true });
  appendMessage(words.greeting, 'guide');
})();

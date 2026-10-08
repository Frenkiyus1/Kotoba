(function (global) {
  'use strict';
  let recognition = null;
  let playback = null;
  let sequence = 0;
  const message = (vi, ja) => global.KOTOBA_UI_LANGUAGE === 'ja' ? ja : vi;
  const failures = {
    'start-failed': ['Không mở được micro. Hãy thử lại hoặc nhập bằng bàn phím.', 'マイクを開始できません。もう一度試すか、文字で入力してください。'],
    'not-allowed': ['Hãy cho phép trang sử dụng micro trong cài đặt của trình duyệt, rồi thử lại.', 'ブラウザでマイクを許可してから、もう一度試してください。'],
    'service-not-allowed': ['Trình duyệt đang chặn nhận giọng nói. Hãy kiểm tra quyền micro hoặc nhập bằng bàn phím.', '音声入力がブロックされています。マイクの設定を確認するか、文字で入力してください。'],
    'audio-capture': ['Không tìm thấy micro hoạt động. Kiểm tra micro của thiết bị rồi thử lại.', 'マイクを使えません。接続と設定を確認してください。'],
    'network': ['Nhận giọng nói cần kết nối mạng. Kiểm tra mạng rồi thử lại hoặc nhập bằng bàn phím.', '音声入力の通信に失敗しました。ネットワークを確認するか、文字で入力してください。'],
    'no-speech': ['Chưa nghe được câu nói. Bấm micro và nói một câu tiếng Nhật, hoặc nhập bằng bàn phím.', '声が聞き取れませんでした。マイクを押して話すか、文字で入力してください。'],
    'language-not-supported': ['Thiết bị chưa hỗ trợ nhận giọng nói tiếng Nhật. Bạn có thể nhập bằng bàn phím.', '日本語の音声入力に対応していません。文字で入力してください。'],
  };
  function notify(options, code, text) {
    options.onError?.(text || message(...(failures[code] || ['Không nhận được giọng nói. Thử lại hoặc nhập bằng bàn phím.', '音声を認識できません。もう一度試すか、文字で入力してください。'])), code);
  }
  function resetButton(session) {
    if (!session.button) return;
    session.button.classList.remove('listening', 'speaking');
    session.button.textContent = session.original;
    session.button.setAttribute('aria-pressed', 'false');
  }
  function stopListening({ abort = true } = {}) {
    const session = recognition;
    if (!session) return;
    if (!abort) {
      try { session.engine.stop(); } catch { stopListening(); }
      return;
    }
    recognition = null;
    clearTimeout(session.timer);
    resetButton(session);
    session.options.onStatus?.('idle', '');
    try { session.engine.abort(); } catch {}
  }
  function stopSpeaking() {
    const session = playback;
    playback = null;
    if (session) { clearTimeout(session.timer); resetButton(session); session.options.onStatus?.('idle', ''); }
    try { global.speechSynthesis?.cancel(); } catch {}
  }
  function listen(options = {}) {
    const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (global.isSecureContext === false) {
      notify(options, 'insecure', message('Micro cần trang HTTPS. Mở bản HTTPS hoặc nhập bằng bàn phím.', 'マイクにはHTTPSが必要です。HTTPSで開くか、文字で入力してください。'));
      return false;
    }
    if (!SR) {
      notify(options, 'unsupported', message('Trình duyệt chưa hỗ trợ nhận giọng nói. Bạn có thể nhập bằng bàn phím để tiếp tục.', 'このブラウザは音声入力に対応していません。文字で入力して続けてください。'));
      return false;
    }
    if (recognition?.button === options.button && options.button) { stopListening({ abort: false }); return false; }
    stopListening(); stopSpeaking();
    let engine;
    try { engine = new SR(); } catch { notify(options, 'start-failed'); return false; }
    const session = { engine, options, button: options.button, original: options.button?.textContent || '', received: false };
    recognition = session;
    engine.lang = 'ja-JP'; engine.interimResults = false; engine.continuous = false; engine.maxAlternatives = 1;
    if (session.button) {
      session.button.classList.add('listening');
      session.button.textContent = message('Đang nghe…', '聞いています…');
      session.button.setAttribute('aria-pressed', 'true');
    }
    options.onStatus?.('listening', message('Nói một câu tiếng Nhật. Bấm micro lần nữa để kết thúc.', '日本語で話してください。もう一度マイクを押すと終了します。'));
    engine.onresult = event => {
      if (recognition !== session || session.received) return;
      const transcript = Array.from(event.results || []).filter(result => result.isFinal !== false).map(result => result[0]?.transcript || '').join('').trim();
      if (!transcript) return;
      session.received = true;
      stopListening();
      options.onTranscript?.(transcript);
    };
    engine.onerror = event => {
      if (recognition !== session) return;
      stopListening();
      if (event.error !== 'aborted') notify(options, event.error);
    };
    engine.onend = () => {
      if (recognition !== session) return;
      recognition = null; clearTimeout(session.timer); resetButton(session);
      options.onStatus?.('idle', '');
      if (!session.received) notify(options, 'no-speech');
    };
    session.timer = setTimeout(() => {
      if (recognition !== session) return;
      stopListening(); notify(options, 'no-speech');
    }, 30000);
    try { engine.start(); return true; }
    catch (error) {
      stopListening(); notify(options, error.name === 'NotAllowedError' ? 'not-allowed' : 'start-failed');
      return false;
    }
  }
  function japaneseVoice() {
    const voices = global.speechSynthesis?.getVoices?.() || [];
    return voices.find(voice => /^ja(?:-|_|$)/i.test(voice.lang) && voice.localService)
      || voices.find(voice => /^ja(?:-|_|$)/i.test(voice.lang));
  }
  function speakJapanese(text, options = {}) {
    const Utterance = global.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
    if (!global.speechSynthesis?.speak || !Utterance) {
      notify(options, 'tts-unsupported', message('Trình duyệt chưa hỗ trợ phát âm. Bạn vẫn có thể đọc câu và dùng micro nếu được hỗ trợ.', 'このブラウザでは読み上げができません。文を読んで練習してください。'));
      return false;
    }
    if (!String(text || '').trim()) return false;
    if (playback?.button === options.button && options.button) { stopSpeaking(); return false; }
    stopSpeaking(); stopListening();
    let utterance;
    try { utterance = new Utterance(String(text)); } catch { notify(options, 'tts-failed'); return false; }
    const session = { id: ++sequence, utterance, options, button: options.button, original: options.button?.textContent || '' };
    playback = session; // Keep a strong reference until speech ends.
    utterance.lang = 'ja-JP'; utterance.rate = .85; utterance.pitch = 1;
    const voice = japaneseVoice(); if (voice) utterance.voice = voice;
    function finish(error) {
      if (playback !== session) return;
      playback = null; clearTimeout(session.timer); resetButton(session); options.onStatus?.('idle', '');
      if (!error || ['canceled', 'interrupted'].includes(error)) return;
      const text = ['language-unavailable', 'voice-unavailable', 'synthesis-unavailable'].includes(error)
        ? message('Thiết bị chưa có giọng đọc tiếng Nhật. Hãy thêm tiếng Nhật trong cài đặt giọng đọc của thiết bị rồi bấm Nghe lại.', '日本語の読み上げ音声がありません。端末の音声設定で日本語を追加してから、もう一度押してください。')
        : error === 'not-allowed'
          ? message('Trình duyệt chặn phát tự động. Hãy bấm nút Nghe để phát lại câu.', '自動再生がブロックされました。「聞く」を押してください。')
          : message('Chưa phát được âm thanh. Kiểm tra âm lượng rồi bấm Nghe để thử lại.', '読み上げに失敗しました。音量を確認して、もう一度「聞く」を押してください。');
      notify(options, error, text);
    }
    utterance.onstart = () => {
      if (playback !== session) return;
      clearTimeout(session.timer);
      session.timer = setTimeout(() => { if (playback === session) { stopSpeaking(); notify(options, 'tts-timeout', message('Phát âm bị gián đoạn. Bấm Nghe để thử lại.', '読み上げが止まりました。「聞く」を押して試してください。')); } }, 120000);
      options.onStatus?.('speaking', message('Đang phát tiếng Nhật…', '日本語を読み上げています…'));
    };
    utterance.onend = () => finish();
    utterance.onerror = event => finish(event.error);
    if (session.button) { session.button.classList.add('speaking'); session.button.setAttribute('aria-pressed', 'true'); }
    options.onStatus?.('speaking', message('Đang phát tiếng Nhật…', '日本語を読み上げています…'));
    session.timer = setTimeout(() => {
      if (playback !== session) return;
      stopSpeaking(); notify(options, 'tts-timeout', message('Chưa phát được âm thanh. Bấm Nghe để thử lại và kiểm tra giọng đọc tiếng Nhật của thiết bị.', '音声が再生されません。「聞く」を押すか、日本語の音声設定を確認してください。'));
    }, 8000);
    try { global.speechSynthesis.resume?.(); global.speechSynthesis.speak(utterance); return true; }
    catch { finish('synthesis-failed'); return false; }
  }
  global.KotobaSpeech = { listen, speakJapanese, stopListening, stopSpeaking };
  global.addEventListener?.('pagehide', () => { stopListening(); stopSpeaking(); });
})(window);

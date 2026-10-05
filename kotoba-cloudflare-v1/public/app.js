(async function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const STORE={user:'kotoba.user',prefs:'kotoba.prefs',daily:'kotoba.daily',deck:'kotoba.deck',errors:'kotoba.errors',activity:'kotoba.activity',lesson:'kotoba.lesson',token:'kotoba.token'};
  const API=window.KOTOBA_API_BASE||'/api';
  window.KOTOBA_DICTIONARY_ENDPOINT=window.KOTOBA_DICTIONARY_ENDPOINT||`${API}/dictionary`;
  const todayKey=()=>new Date().toISOString().slice(0,10);
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch(e){return f}};
  const rawSave=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const SECTION_BY_KEY={[STORE.user]:'user',[STORE.prefs]:'prefs',[STORE.daily]:'daily',[STORE.deck]:'deck',[STORE.errors]:'errors',[STORE.activity]:'activity'};
  let syncing=false;
  async function api(path,opts={}){const headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});const token=localStorage.getItem(STORE.token);if(token)headers.Authorization=`Bearer ${token}`;const res=await fetch(`${API}${path}`,Object.assign({},opts,{headers}));let data=null;try{data=await res.json()}catch(e){}if(!res.ok){if(res.status===401&&path!=='/auth/login'&&path!=='/auth/register'){localStorage.removeItem(STORE.token)}throw new Error(data?.detail||`HTTP ${res.status}`)}return data}
  function applyServerState(state){if(!state)return;syncing=true;try{if(state.user)rawSave(STORE.user,state.user);if(state.prefs)rawSave(STORE.prefs,state.prefs);if(state.daily)rawSave(STORE.daily,state.daily);if(state.deck)rawSave(STORE.deck,state.deck);if(state.errors)rawSave(STORE.errors,state.errors);if(state.activity)rawSave(STORE.activity,state.activity)}finally{syncing=false}}
  async function hydrateFromServer(){if(!localStorage.getItem(STORE.token))return false;try{applyServerState(await api('/state'));return true}catch(e){return false}}
  const save=(k,v)=>{rawSave(k,v);const section=SECTION_BY_KEY[k];if(!syncing&&section&&localStorage.getItem(STORE.token)){api(`/state/${section}`,{method:'PUT',body:JSON.stringify({value:v})}).catch(()=>{})}};
  const hasJapanese=t=>/[\u3040-\u30ff\u3400-\u9fff々〆ヵヶ]/.test(t||'');
  const norm=t=>(t||'').replace(/[\n\r\t]+/g,' ').replace(/\s+/g,' ').trim();
  function toast(msg){let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}

  function ensureSeed(){
    if(!localStorage.getItem(STORE.deck)) save(STORE.deck,[
      {term:'学校',reading:'がっこう',meaning:'trường học; nhà trường',example:'毎朝八時に学校へ行きます。',source:'N5',stage:0,interval:0,due:todayKey(),reviews:0},
      {term:'昨日',reading:'きのう',meaning:'hôm qua',example:'昨日、図書館へ行きました。',source:'N5',stage:1,interval:1,due:todayKey(),reviews:1},
      {term:'友達',reading:'ともだち',meaning:'bạn; bạn bè',example:'友達と一緒に昼ご飯を食べます。',source:'N5',stage:0,interval:0,due:todayKey(),reviews:0}
    ]);
    if(!localStorage.getItem(STORE.errors)) save(STORE.errors,[{key:'は / が',count:5,type:'文法'},{key:'過去形',count:3,type:'文法'},{key:'聞き取り',count:2,type:'聴解'}]);
    if(!localStorage.getItem(STORE.activity)) save(STORE.activity,{days:{[todayKey()]:12},totalMinutes:186,streak:7});
  }
  await hydrateFromServer();
  const protectedPages=new Set(['dashboard','roadmap','lesson','biology','biology-lesson','review','personalized','conversation','progress','profile']);
  if(protectedPages.has(document.body.dataset.page)&&!localStorage.getItem(STORE.token)){location.replace('start.html');return}
  ensureSeed();

  // global start links
  $$('.js-start').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.href=localStorage.getItem(STORE.token)?'dashboard.html':'start.html'}));

  // auth page
  const authTabs=$$('.auth-tabs button');
  if(authTabs.length){authTabs.forEach(btn=>btn.addEventListener('click',()=>{authTabs.forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('#authMode').value=btn.dataset.mode;$('#nameField').classList.toggle('hidden',btn.dataset.mode==='login');$('#authSubmit').textContent=btn.dataset.mode==='login'?'学習を始める':'アカウントを作って始める'}));
    $('#authForm')?.addEventListener('submit',async e=>{e.preventDefault();const mode=$('#authMode').value;const email=$('#authEmail').value.trim();const password=$('#authPassword').value;const err=$('#authError');if(err){err.textContent='';err.classList.add('hidden')}try{const payload=mode==='register'?{name:$('#authName').value.trim()||'学習者',email,password}:{email,password};const result=await api(mode==='register'?'/auth/register':'/auth/login',{method:'POST',body:JSON.stringify(payload)});localStorage.setItem(STORE.token,result.token);applyServerState(result.state);location.href=mode==='register'?'onboarding.html':'dashboard.html'}catch(ex){if(err){err.textContent=ex.message||'ログインできませんでした。';err.classList.remove('hidden')}else toast(ex.message||'ログインできませんでした。')}});
  }

  // onboarding
  const onboard=$('#onboardingForm');
  if(onboard){let step=1;const data={};const render=()=>{$$('.onboard-step').forEach(x=>x.classList.toggle('hidden',+x.dataset.step!==step));$$('.step-dot').forEach((x,i)=>x.classList.toggle('active',i+1<=step));$('#prevStep').classList.toggle('hidden',step===1);$('#nextStep').textContent=step===4?'学習プランを作る':'次へ'};$$('.choice').forEach(c=>c.addEventListener('click',()=>{const group=c.dataset.group;$$(`.choice[data-group="${group}"]`).forEach(x=>x.classList.remove('selected'));c.classList.add('selected');data[group]=c.dataset.value}));$('#nextStep').addEventListener('click',()=>{if(step<4){step++;render()}else{data.studyTime=$('#studyTime').value;data.bioInterest=$('#bioInterest').checked;save(STORE.prefs,Object.assign({level:'N5',goal:'JLPT',minutes:'20',period:'夜'},data));location.href='dashboard.html'}});$('#prevStep').addEventListener('click',()=>{step=Math.max(1,step-1);render()});render();}

  // dashboard
  if(document.body.dataset.page==='dashboard'){
    const user=load(STORE.user,{name:'学習者'}),prefs=load(STORE.prefs,{level:'N5',minutes:'20'});$('#userGreeting').textContent=`おはよう、${user.name}さん。`;$('#levelText').textContent=prefs.level||'N5';
    const daily=load(STORE.daily,{});const key=todayKey();if(!daily[key])daily[key]=[false,false,false,false,false];const boxes=$$('.daily-task input');boxes.forEach((b,i)=>{b.checked=!!daily[key][i];b.closest('.daily-task').classList.toggle('done',b.checked);b.addEventListener('change',()=>{daily[key][i]=b.checked;save(STORE.daily,daily);b.closest('.daily-task').classList.toggle('done',b.checked);updateDaily()})});function updateDaily(){const n=daily[key].filter(Boolean).length;$('#dailyCount').textContent=`${n}/5`;$('#dailyBar').style.width=`${n*20}%`;$('#dailyMinutes').textContent=`${n*5} / 25分`}updateDaily();
    const deck=load(STORE.deck,[]);$('#dueCount').textContent=deck.filter(c=>c.due<=key).length;const errs=load(STORE.errors,[]);const list=$('#weakList');if(list){list.innerHTML=errs.slice(0,4).map(e=>`<div class="weak-item"><span>${e.key}</span><b>${e.count}回</b></div>`).join('')}
  }

  // phase tabs
  $$('.phase-tab').forEach(tab=>tab.addEventListener('click',()=>{const root=tab.closest('[data-phase-root]')||document;$$('.phase-tab',root).forEach(x=>x.classList.remove('active'));tab.classList.add('active');$$('.phase',root).forEach(x=>x.classList.toggle('active',x.dataset.phase===tab.dataset.phase))}));

  // lesson answers and error logging
  $$('.answer[data-correct]').forEach(btn=>btn.addEventListener('click',()=>{const correct=btn.dataset.correct==='true';btn.classList.add(correct?'correct':'wrong');const fb=btn.closest('.study-block')?.querySelector('.quiz-feedback');if(fb)fb.textContent=correct?'正解です。次は自分の文で使ってみましょう。':'もう一度考えてみましょう。過去を表す「昨日」に注目してください。';if(!correct)addError(btn.dataset.error||'過去形','文法')}));
  function addError(key,type='文法'){const arr=load(STORE.errors,[]);const f=arr.find(x=>x.key===key);if(f)f.count++;else arr.push({key,count:1,type});save(STORE.errors,arr)}

  // free production check
  $('#productionCheck')?.addEventListener('click',()=>{const t=norm($('#productionText').value);const fb=$('#productionFeedback');if(!hasJapanese(t)){fb.textContent='日本語で答えてください。';return}if(/ました|でした/.test(t)){fb.textContent='よくできました。過去形を自然に使えています。';}else{fb.textContent='内容は伝わります。昨日のことなので、過去形も確認してみましょう。';addError('過去形','文法')}});
  $('#bioProductionCheck')?.addEventListener('click',()=>{const t=norm($('#bioProductionText').value);const fb=$('#bioProductionFeedback');if(!hasJapanese(t)){fb.textContent='日本語で説明してみましょう。';return}const hits=['細胞','細胞膜','核','ミトコンドリア'].filter(w=>t.includes(w));fb.textContent=hits.length>=2?'内容語を使って説明できています。次は理由や働きも加えてみましょう。':'今日の専門語を二つ以上使って説明してみましょう。';if(hits.length<2)addError('生物の専門語','語彙')});

  // speech synthesis / recognition
  $$('[data-speak]').forEach(b=>b.addEventListener('click',()=>{if(!('speechSynthesis' in window))return toast('このブラウザでは音声再生を利用できません。');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(b.dataset.speak);u.lang='ja-JP';u.rate=.88;speechSynthesis.speak(u)}));
  $$('[data-mic-target]').forEach(b=>b.addEventListener('click',()=>startRecognition(b.dataset.micTarget,b)));
  function startRecognition(targetId,button){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('音声入力に対応していないため、文字で入力してください。');return}const r=new SR();r.lang='ja-JP';r.interimResults=false;button.classList.add('listening');button.textContent='…';r.onresult=e=>{const text=e.results[0][0].transcript;const t=document.getElementById(targetId);if(t)t.value=text};r.onend=()=>{button.classList.remove('listening');button.textContent='●'};r.start()}

  // Focus mode
  function buildFocus(){if($('#focusOverlay'))return;const el=document.createElement('div');el.id='focusOverlay';el.className='focus-overlay';el.innerHTML=`<div class="focus-card"><span class="eyebrow">集中モード</span><h2>学習を始める前に、1分だけ集中しましょう。</h2><div id="breathCircle" class="breath-circle"><div><div id="breathLabel">吸う</div><div class="focus-time" id="focusTime">60</div></div></div><p id="focusHint">ゆっくり呼吸してください。</p><div style="display:flex;gap:10px;justify-content:center"><button class="btn btn-secondary" id="focusSkip">スキップ</button><button class="btn btn-primary hidden" id="focusDone">学習を始める</button></div></div>`;document.body.appendChild(el);$('#focusSkip').onclick=()=>stopFocus();$('#focusDone').onclick=()=>stopFocus()}
  let focusTimer=null;function startFocus(){buildFocus();const ov=$('#focusOverlay');ov.classList.add('show');let sec=60;$('#focusTime').textContent=sec;$('#focusDone').classList.add('hidden');let phase=0;const circle=$('#breathCircle');const tickBreath=()=>{phase++;const inhale=phase%2===1;$('#breathLabel').textContent=inhale?'吸う':'吐く';circle.classList.toggle('inhale',inhale);$('#focusHint').textContent=inhale?'鼻からゆっくり吸いましょう。':'ゆっくり長く吐きましょう。'};tickBreath();const breath=setInterval(tickBreath,5000);focusTimer=setInterval(()=>{sec--;$('#focusTime').textContent=sec;if(sec<=0){clearInterval(focusTimer);clearInterval(breath);focusTimer=null;$('#breathLabel').textContent='準備完了';$('#focusHint').textContent='今日の学習を始めましょう。';$('#focusDone').classList.remove('hidden')}},1000);ov.dataset.breath=breath}
  function stopFocus(){const ov=$('#focusOverlay');if(!ov)return;if(focusTimer)clearInterval(focusTimer);const b=+ov.dataset.breath;if(b)clearInterval(b);focusTimer=null;ov.classList.remove('show')}
  $$('[data-focus]').forEach(b=>b.addEventListener('click',startFocus));

  // Dictionary
  // ============================================================
// DICTIONARY — VOICE ONLY
// ============================================================

initDictionary();

function initDictionary() {
  const root = $('.dictionary-enabled');

  // Trang nào không bật dictionary thì dừng.
  if (!root) return;

  const state = {
    text: '',
    context: '',
    rect: null,
    node: null
  };

  let recognition = null;
  let isListening = false;

  // ----------------------------------------------------------
  // 1. Menu chuột phải
  // ----------------------------------------------------------

  const menu = document.createElement('div');

  menu.className = 'dictionary-context-menu';

  menu.innerHTML = `
    <button type="button">
      <span class="jp">辞</span>
      <span>辞書で調べる</span>
    </button>
  `;

  document.body.appendChild(menu);


  // ----------------------------------------------------------
  // 2. Dictionary panel
  // Không còn textarea / nhập bằng bàn phím.
  // ----------------------------------------------------------

  const panel = document.createElement('section');

  panel.className = 'dictionary-panel';

  panel.innerHTML = `
    <div class="dictionary-panel-head">

      <div>
        <span class="dictionary-label">
          AI学習サポート
        </span>

        <strong id="dictSel"></strong>
      </div>

      <button
        class="dictionary-close"
        type="button"
        aria-label="閉じる"
      >
        ×
      </button>

    </div>


    <div
      id="dictGate"
      class="dictionary-gate"
    >

      <div class="dictionary-ai-message">

        <span class="ai-mini jp">
          先
        </span>

        <div>
          <strong>
            どんなことを知りたいですか？
          </strong>

          <p>
            日本語で話してください。
          </p>
        </div>

      </div>


      <div class="dictionary-voice">

        <button
          id="dictMic"
          class="dictionary-mic"
          type="button"
        >

          <span
            class="dictionary-mic-icon"
            aria-hidden="true"
          >
            ●
          </span>

          <span id="dictMicLabel">
            話してください
          </span>

        </button>


        <div
          id="dictTranscriptBox"
          class="dictionary-transcript hidden"
        >

          <span class="dictionary-transcript-label">
            あなた
          </span>

          <p id="dictTranscript"></p>

        </div>


        <p
          id="dictStatus"
          class="dictionary-gate-status"
        ></p>

      </div>

    </div>


    <div
      id="dictResult"
      class="dictionary-result hidden"
    ></div>
  `;

  document.body.appendChild(panel);


  // ----------------------------------------------------------
  // 3. Đọc đoạn text hiện đang được bôi đen
  // ----------------------------------------------------------

  const readSel = () => {
    const selection = getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      return null;
    }

    const text =
      norm(selection.toString());

    // Chỉ xử lý text có tiếng Nhật.
    if (
      !text ||
      !hasJapanese(text)
    ) {
      return null;
    }

    const range =
      selection.getRangeAt(0);

    const element =
      range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

    if (
      !element ||
      !root.contains(element)
    ) {
      return null;
    }

    const context =
      element.closest('[data-dictionary-context]') ||
      element.closest('.reading-surface') ||
      element;

    const rect =
      range.getBoundingClientRect();

    if (
      !rect.width &&
      !rect.height
    ) {
      return null;
    }

    return {
      text: text.slice(0, 180),
      context: norm(context.textContent).slice(0, 900),
      rect,
      node: context
    };
  };


  // ----------------------------------------------------------
  // 4. Cache selection
  //
  // Quan trọng:
  // Browser đôi khi mất selection khi người dùng click chuột phải.
  // ----------------------------------------------------------

  const cacheSelection = () => {
    const current = readSel();

    if (current) {
      Object.assign(
        state,
        current
      );
    }
  };


  document.addEventListener(
    'selectionchange',
    () => requestAnimationFrame(cacheSelection)
  );

  root.addEventListener(
    'mouseup',
    cacheSelection
  );

  root.addEventListener(
    'keyup',
    cacheSelection
  );


  // ----------------------------------------------------------
  // 5. Kiểm tra chuột phải có gần selection hay không
  // ----------------------------------------------------------

  const nearSelection = (
    x,
    y,
    rect
  ) => {

    return (
      rect &&
      x >= rect.left - 16 &&
      x <= rect.right + 16 &&
      y >= rect.top - 16 &&
      y <= rect.bottom + 16
    );

  };


  // ----------------------------------------------------------
  // 6. Chuột phải -> hiện 辞書で調べる
  // ----------------------------------------------------------

  document.addEventListener(
    'contextmenu',
    event => {

      if (
        panel.contains(event.target) ||
        menu.contains(event.target)
      ) {
        return;
      }


      const live =
        readSel();


      const selected =
        live ||
        (
          state.text &&
          nearSelection(
            event.clientX,
            event.clientY,
            state.rect
          )
            ? state
            : null
        );


      if (!selected) {
        return;
      }


      event.preventDefault();


      Object.assign(
        state,
        selected
      );


      menu.style.left =
        Math.min(
          event.clientX,
          innerWidth - 190
        ) + 'px';


      menu.style.top =
        Math.min(
          event.clientY,
          innerHeight - 60
        ) + 'px';


      menu.classList.add('show');

    }
  );


  // ----------------------------------------------------------
  // 7. Click ngoài -> đóng context menu
  // ----------------------------------------------------------

  document.addEventListener(
    'click',
    event => {

      if (
        !menu.contains(event.target)
      ) {
        menu.classList.remove('show');
      }

    }
  );


  // ----------------------------------------------------------
  // 8. Mở dictionary voice gate
  // ----------------------------------------------------------

  menu
    .querySelector('button')
    .onclick = () => {

      menu.classList.remove('show');


      $('#dictSel').textContent =
        `「${state.text}」`;


      $('#dictGate')
        .classList
        .remove('hidden');


      $('#dictResult')
        .classList
        .add('hidden');


      $('#dictTranscriptBox')
        .classList
        .add('hidden');


      $('#dictTranscript')
        .textContent = '';


      $('#dictStatus')
        .textContent = '';


      resetMicButton();


      panel.classList.add('show');


      positionPanel(
        panel,
        state.rect
      );


      // AI Teacher nói thật bằng tiếng Nhật.
      speakJapanese(
        'どんなことを知りたいですか？日本語で話してください。'
      );

    };


  // ----------------------------------------------------------
  // 9. Đóng panel
  // ----------------------------------------------------------

  panel
    .querySelector('.dictionary-close')
    .onclick = () => {

      stopRecognition();

      speechSynthesis.cancel();

      panel.classList.remove('show');

    };


  // ----------------------------------------------------------
  // 10. Microphone button
  // ----------------------------------------------------------

  $('#dictMic').onclick = () => {

    if (isListening) {
      stopRecognition();
      return;
    }

    startDictionaryRecognition();

  };


  // ----------------------------------------------------------
  // 11. Speech Recognition
  // ----------------------------------------------------------

  function startDictionaryRecognition() {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    const status =
      $('#dictStatus');


    // Browser không hỗ trợ microphone STT.
    if (!SpeechRecognition) {

      status.textContent =
        'このブラウザでは音声認識を利用できません。';

      status.className =
        'dictionary-gate-status error';

      return;
    }


    // Ngừng AI đang nói trước khi mở microphone.
    speechSynthesis.cancel();


    recognition =
      new SpeechRecognition();


    // Quan trọng: bắt buộc nhận dạng tiếng Nhật.
    recognition.lang =
      'ja-JP';


    recognition.interimResults =
      true;


    recognition.continuous =
      false;


    recognition.maxAlternatives =
      1;


    isListening =
      true;


    $('#dictMic')
      .classList
      .add('listening');


    $('#dictMicLabel')
      .textContent =
        '聞いています...';


    status.textContent =
      '日本語で質問してください。';


    status.className =
      'dictionary-gate-status';


    // --------------------------------------------------------
    // Nhận giọng nói
    // --------------------------------------------------------

    recognition.onresult = event => {

      let transcript = '';
      let finalTranscript = '';


      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {

        const result =
          event.results[i];


        transcript +=
          result[0].transcript;


        if (result.isFinal) {
          finalTranscript +=
            result[0].transcript;
        }

      }


      $('#dictTranscriptBox')
        .classList
        .remove('hidden');


      $('#dictTranscript')
        .textContent =
          transcript;


      // Chỉ gửi sang AI khi câu nói hoàn tất.
      if (finalTranscript) {

        handleDictionaryVoiceQuestion(
          finalTranscript
        );

      }

    };


    // --------------------------------------------------------
    // Lỗi microphone
    // --------------------------------------------------------

    recognition.onerror = event => {

      isListening =
        false;


      resetMicButton();


      if (
        event.error === 'not-allowed'
      ) {

        status.textContent =
          'マイクの使用を許可してください。';

      } else {

        status.textContent =
          '音声を認識できませんでした。もう一度話してください。';

      }


      status.className =
        'dictionary-gate-status error';

    };


    recognition.onend = () => {

      isListening =
        false;


      resetMicButton();

    };


    try {

      recognition.start();

    } catch (error) {

      console.error(
        'SpeechRecognition:',
        error
      );

    }

  }


  // ----------------------------------------------------------
  // 12. Xử lý câu hỏi người học vừa nói
  // ----------------------------------------------------------

  async function handleDictionaryVoiceQuestion(
    spokenText
  ) {

    const question =
      norm(spokenText);


    const status =
      $('#dictStatus');


    // --------------------------------------------------------
    // Không phải tiếng Nhật
    // --------------------------------------------------------

    if (
      !hasJapanese(question)
    ) {

      status.textContent =
        '日本語で聞いてみましょう。';


      status.className =
        'dictionary-gate-status error';


      speakJapanese(
        '日本語で聞いてみましょう。'
      );


      return;

    }


    // --------------------------------------------------------
    // Câu nói quá mơ hồ
    //
    // Ví dụ:
    // はい
    // いいえ
    // わかりました
    // --------------------------------------------------------

    const meaningfulQuestion =
      /(意味|どういう|何|なに|読み|よみ|使|つか|文法|例文|違い|教えて|訳|発音|品詞|この文|この場合|知りたい)/;


    if (
      !meaningfulQuestion.test(question)
    ) {

      status.textContent =
        'もう少し詳しく質問してみましょう。';


      status.className =
        'dictionary-gate-status error';


      speakJapanese(
        'もう少し詳しく質問してみましょう。'
      );


      return;

    }


    // --------------------------------------------------------
    // AI đã hiểu câu hỏi
    // --------------------------------------------------------

    status.textContent =
      '考えています...';


    status.className =
      'dictionary-gate-status';


    const entry =
      await resolveEntry(
        state.text,
        state.context,
        question
      );


    // --------------------------------------------------------
    // Không tìm được dictionary entry
    // --------------------------------------------------------

    if (!entry) {

      status.textContent =
        'この語句はまだ辞書に登録されていません。';


      status.className =
        'dictionary-gate-status error';


      speakJapanese(
        'この語句はまだ辞書に登録されていません。'
      );


      return;

    }


    // --------------------------------------------------------
    // Thành công -> mở dictionary
    // --------------------------------------------------------

    speakJapanese(
      'わかりました。辞書を開きます。'
    );


    renderEntry(
      entry,
      state.text
    );


    $('#dictGate')
      .classList
      .add('hidden');


    $('#dictResult')
      .classList
      .remove('hidden');

  }


  // ----------------------------------------------------------
  // 13. Dừng microphone
  // ----------------------------------------------------------

  function stopRecognition() {

    if (!recognition) return;


    try {
      recognition.stop();
    } catch (_) {}


    recognition =
      null;


    isListening =
      false;


    resetMicButton();

  }


  // ----------------------------------------------------------
  // 14. Reset trạng thái button microphone
  // ----------------------------------------------------------

  function resetMicButton() {

    $('#dictMic')
      ?.classList
      .remove('listening');


    const label =
      $('#dictMicLabel');


    if (label) {

      label.textContent =
        '話してください';

    }

  }


  // ----------------------------------------------------------
  // 15. Text To Speech — AI Teacher nói tiếng Nhật
  // ----------------------------------------------------------

  function speakJapanese(text) {

    if (
      !('speechSynthesis' in window)
    ) {
      return;
    }


    speechSynthesis.cancel();


    const speech =
      new SpeechSynthesisUtterance(
        text
      );


    speech.lang =
      'ja-JP';


    speech.rate =
      0.92;


    speech.pitch =
      1;


    speechSynthesis.speak(
      speech
    );

  }

}
  function positionPanel(p,r){const w=Math.min(440,innerWidth-24);p.style.width=w+'px';let left=r?.left||16,top=(r?.bottom||80)+12;left=Math.max(12,Math.min(left,innerWidth-w-12));if(top+590>innerHeight)top=Math.max(12,(r?.top||450)-470);p.style.left=left+'px';p.style.top=top+'px'}
  async function resolveEntry(sel,ctx,q){if(window.KOTOBA_DICTIONARY_ENDPOINT){try{const res=await fetch(window.KOTOBA_DICTIONARY_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({selection:sel,context:ctx,question:q})});if(res.ok)return await res.json()}catch(e){}}
    const exact=window.KOTOBA_PHRASES?.[sel]||window.KOTOBA_DICTIONARY?.[sel];if(exact)return Object.assign({term:sel},exact);const keys=Object.keys(window.KOTOBA_DICTIONARY||{}).filter(k=>sel.includes(k)).sort((a,b)=>b.length-a.length);if(keys.length)return Object.assign({term:keys[0]},window.KOTOBA_DICTIONARY[keys[0]]);return null}
  function renderEntry(entry,selected){const r=$('#dictResult');const ex=(entry.examples||[]).map(x=>`<div class="dict-example"><div>${x.jp}</div><div class="vi">${x.vi}</div></div>`).join('');r.innerHTML=`<h3 class="dictionary-entry-title jp">${entry.term||selected}</h3><div class="dictionary-reading">${entry.reading||''} ・ ${entry.pos||''}</div><div class="dict-section"><h4>この文での意味</h4><strong>${entry.meaningVi||''}</strong></div>${entry.otherMeanings?.length?`<div class="dict-section"><h4>ほかの意味</h4>${entry.otherMeanings.map(x=>`<div>・${x}</div>`).join('')}</div>`:''}<div class="dict-section"><h4>使い方</h4><div>${entry.usage||''}</div></div><div class="dict-section"><h4>文法・よく使う形</h4><div class="dict-tags">${(entry.grammar||[]).map(x=>`<span class="dict-tag">${x}</span>`).join('')}</div></div>${entry.kanji?.length?`<div class="dict-section"><h4>漢字</h4>${entry.kanji.map(x=>`<div>・${x}</div>`).join('')}</div>`:''}<div class="dict-section"><h4>例文</h4>${ex}</div><div class="dict-section"><h4>関連語</h4><div class="dict-tags">${(entry.related||[]).map(x=>`<span class="dict-tag">${x}</span>`).join('')}</div></div><div class="dict-added">「今日の単語」に自動で追加しました。</div>`;addToDeck(entry,selected)}
  function addToDeck(entry,selected){if(entry.pos==='文')return;const term=entry.term||selected;if(!term||term.length>25)return;const deck=load(STORE.deck,[]);const found=deck.find(c=>c.term===term);if(found){found.lastSeen=todayKey();found.exposures=(found.exposures||1)+1}else deck.push({term,reading:entry.reading,meaning:entry.meaningVi,example:entry.examples?.[0]?.jp||selected,source:document.body.dataset.track==='biology'?'生物':'辞書',stage:0,interval:0,due:todayKey(),reviews:0,exposures:1,lastSeen:todayKey()});save(STORE.deck,deck);toast(`「${term}」を今日の単語に追加しました。`)}

  // review page
  if(document.body.dataset.page==='review')initReview();
  function initReview(){let deck=load(STORE.deck,[]);let due=deck.filter(c=>c.due<=todayKey());if(!due.length)due=deck.slice(0,5);let idx=0;const card=$('#flashcard');const render=()=>{if(!due.length){card.innerHTML='<h2>今日の復習は完了しました。</h2><p class="muted">よくできました。</p>';$('#reviewActions').classList.add('hidden');return}const c=due[idx%due.length];card.classList.remove('flipped');card.dataset.term=c.term;let front='',back='';if((c.stage||0)===0){front=`<div class="flash-prompt">意味を思い出してください</div><div class="flash-front-main jp">${c.term}</div>`;back=`<h2 class="jp">${c.term}</h2><div>${c.reading}</div><h3>${c.meaning}</h3>`}else if(c.stage===1){front=`<div class="flash-prompt">日本語で言ってください</div><div class="flash-front-main" style="font-size:32px">${c.meaning}</div>`;back=`<h2 class="jp">${c.term}</h2><div>${c.reading}</div>`}else if(c.stage===2){front=`<div class="flash-prompt">文脈から思い出してください</div><div class="context-example jp">${(c.example||'').replace(c.term,'＿＿＿')}</div>`;back=`<h2 class="jp">${c.term}</h2><div class="context-example jp">${c.example||''}</div>`}else{front=`<div class="flash-prompt">この語を使って、自分の文を一つ考えてください</div><div class="flash-front-main jp">${c.term}</div>`;back=`<h2 class="jp">${c.term}</h2><div class="context-example jp">例：${c.example||''}</div><p class="muted">次は会話の中で使ってみましょう。</p>`}card.innerHTML=`<span class="source-badge">${c.source||'学習'}</span><div class="flash-front">${front}<button class="btn btn-secondary" id="revealCard">答えを見る</button></div><div class="flash-back">${back}</div>`;$('#revealCard').onclick=()=>card.classList.add('flipped');$('#reviewPosition').textContent=`${idx+1} / ${due.length}`;renderDeckList(deck)};const rate=kind=>{const term=card.dataset.term;const real=deck.find(x=>x.term===term);if(!real)return;real.reviews=(real.reviews||0)+1;const intervals=kind==='again'?[0,0,1,1]:kind==='hard'?[1,1,3,5]:[1,3,7,14,30];if(kind==='again'){real.stage=Math.max(0,(real.stage||0)-1);real.interval=0}else{real.stage=Math.min(3,(real.stage||0)+1);real.interval=intervals[Math.min(real.stage,intervals.length-1)]}const d=new Date();d.setDate(d.getDate()+(real.interval||0));real.due=d.toISOString().slice(0,10);save(STORE.deck,deck);idx++;if(idx>=due.length){due=[]}render()};$('#rateAgain').onclick=()=>rate('again');$('#rateHard').onclick=()=>rate('hard');$('#rateGood').onclick=()=>rate('good');render()}
  function renderDeckList(deck){const el=$('#deckList');if(!el)return;el.innerHTML=deck.slice().reverse().slice(0,8).map(c=>`<div class="deck-item"><div><b class="jp">${c.term}</b><div class="muted" style="font-size:12px">${c.source||'学習'}</div></div><span>${c.due<=todayKey()?'今日':'予定'}</span></div>`).join('')}

  // conversation
  if(document.body.dataset.page==='conversation')initConversation();
  function initConversation(){let scenario='コンビニ';const log=$('#chatLog');const prompts={コンビニ:'いらっしゃいませ。今日は何をお探しですか？',レストラン:'いらっしゃいませ。何名様ですか？',学校:'今日は学校で何を勉強しましたか？',友達:'今日はどうだった？何か面白いことがあった？',駅:'どこまで行きたいですか？',旅行:'日本ではどこへ行ってみたいですか？',自由会話:'こんにちは。今日は何について話したいですか？'};const add=(who,text)=>{const d=document.createElement('div');d.className=`bubble ${who}`;d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight};add('teacher',prompts[scenario]);$$('.scenario-btn').forEach(b=>b.addEventListener('click',()=>{$$('.scenario-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');scenario=b.dataset.scenario;log.innerHTML='';add('teacher',prompts[scenario])}));$('#chatForm').onsubmit=async e=>{e.preventDefault();const input=$('#chatText');const text=norm(input.value);if(!text)return;add('student',text);input.value='';if(!hasJapanese(text)){add('teacher','日本語で話してみましょう。短い文でも大丈夫です。');return}const reply=await aiReply(scenario,text);setTimeout(()=>add('teacher',reply),400)};$('#conversationMic')?.addEventListener('click',()=>startRecognition('chatText',$('#conversationMic')))}
  async function aiReply(scenario,text){try{const d=await api('/ai/conversation',{method:'POST',body:JSON.stringify({scenario,text,language:'ja'})});if(d?.reply||d?.text)return d.reply||d.text}catch(e){}
    if(/分から|わから/.test(text))return '大丈夫です。簡単な日本語で言い換えますね。どの言葉が難しかったですか？';if(scenario==='学校')return /勉強|学/.test(text)?'そうですか。いちばん面白かったことは何ですか？':'学校では誰とよく話しますか？';if(scenario==='コンビニ')return /ください|欲しい|ほしい/.test(text)?'はい。こちらですね。ほかに必要なものはありますか？':'何を買いたいですか？';if(scenario==='レストラン')return /一人|二人|三人|ひとり|ふたり/.test(text)?'かしこまりました。こちらへどうぞ。何を注文しますか？':'何名様ですか？';if(scenario==='駅')return '分かりました。切符を買いますか、それともICカードを使いますか？';return 'いいですね。もう少し詳しく教えてください。'}

  // personalized
  if(document.body.dataset.page==='personalized')initPersonalized();
  function initPersonalized(){const errs=load(STORE.errors,[]).sort((a,b)=>b.count-a.count);$('#errorPanel').innerHTML=errs.map(e=>`<div class="error-chip"><span>${e.key}<small class="muted"> ${e.type}</small></span><b>${e.count}回</b></div>`).join('');const target=errs[0]?.key||'過去形';$('#personalTarget').textContent=target;renderPersonalExercise(target)}
  function renderPersonalExercise(target){const q=$('#personalExercise');if(/は \/ が/.test(target)){q.innerHTML=`<p class="exercise-question jp">___ は学生です。___ が日本語を勉強しています。</p><div class="answer-grid"><button class="answer" data-personal="wrong">私 / 私</button><button class="answer" data-personal="correct">私は / 私が</button><button class="answer" data-personal="wrong">私が / 私は</button></div>`}else{q.innerHTML=`<p class="exercise-question jp">昨日、友達と映画を ______。</p><div class="answer-grid"><button class="answer" data-personal="wrong">見ます</button><button class="answer" data-personal="correct">見ました</button><button class="answer" data-personal="wrong">見て</button></div>`}$$('[data-personal]',q).forEach(b=>b.onclick=()=>{const ok=b.dataset.personal==='correct';b.classList.add(ok?'correct':'wrong');$('#personalFeedback').textContent=ok?'正解です。次は会話で使ってみましょう。':'このポイントはもう一度復習に入れます。';if(!ok)addError(target,'文法')})}

  // progress
  if(document.body.dataset.page==='progress')initProgress();
  function initProgress(){const deck=load(STORE.deck,[]),errs=load(STORE.errors,[]),activity=load(STORE.activity,{streak:7,totalMinutes:0,days:{}});$('#progressWords').textContent=deck.length;$('#progressStreak').textContent=activity.streak||0;$('#progressErrors').textContent=errs.reduce((s,e)=>s+e.count,0);const skill={語彙:Math.min(92,55+deck.length*2),漢字:66,文法:Math.max(48,76-errs.filter(e=>e.type==='文法').reduce((s,e)=>s+e.count,0)),読解:64,聴解:57,会話:52};$('#skillBars').innerHTML=Object.entries(skill).map(([k,v])=>`<div class="skill-row-progress"><span>${k}</span><div class="progress-track"><span style="width:${v}%"></span></div><b>${v}%</b></div>`).join('')}

  // profile
  if(document.body.dataset.page==='profile'){const p=load(STORE.prefs,{level:'N5',minutes:'20',studyTime:'20:30'}),u=load(STORE.user,{name:'学習者',email:''});$('#profileName').value=u.name||'';$('#profileEmail').value=u.email||'';$('#profileLevel').value=p.level||'N5';$('#profileMinutes').value=p.minutes||'20';$('#profileTime').value=p.studyTime||'20:30';$('#profileSave').onclick=()=>{u.name=$('#profileName').value.trim()||u.name;p.level=$('#profileLevel').value;p.minutes=$('#profileMinutes').value;p.studyTime=$('#profileTime').value;save(STORE.user,u);save(STORE.prefs,p);toast('保存しました。')}}
  $('#logoutBtn')?.addEventListener('click',()=>{Object.values(STORE).forEach(k=>localStorage.removeItem(k));location.href='start.html'});
})();

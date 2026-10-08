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
  let serverPrefs=null;
  let serverFlashcardTopics=[];
  const interfaceMode=level=>['N5','N4'].includes(level)?'vi-support':'ja-only';
  const supportsVietnamese=()=>(!serverPrefs||interfaceMode(serverPrefs.level)==='vi-support')&&window.KOTOBA_UI_LANGUAGE!=='ja';
  function applyLanguageMode(){document.body.dataset.interfaceMode=supportsVietnamese()?'vi-support':'ja-only'}
  const languageStyle=document.createElement('style');
  languageStyle.textContent='body[data-interface-mode="ja-only"] .vi,body[data-interface-mode="ja-only"] [lang="vi"]:not([data-flashcard-vietnamese]),body[data-interface-mode="ja-only"] [data-lang="vi"]{display:none!important}';
  document.head.appendChild(languageStyle);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function cardSource(card){
    const source=card.source||'学習';
    if(source.startsWith('手入力:')){
      const id=source.slice('手入力:'.length);
      const topic=serverFlashcardTopics.find(item=>item.id===id);
      return supportsVietnamese()?`Tự nhập · ${topic?.labelVi||id}`:`手入力 · ${id}`;
    }
    const topic=serverFlashcardTopics.find(item=>item.id===source);
    return supportsVietnamese()&&topic?topic.labelVi:source;
  }
  async function persistPrefs(value){await api('/state/prefs',{method:'PUT',body:JSON.stringify({value})});applyServerState(await api('/state'));applyLanguageMode()}

  async function api(path,opts={}){const headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});const token=localStorage.getItem(STORE.token);if(token)headers.Authorization=`Bearer ${token}`;const res=await fetch(`${API}${path}`,Object.assign({},opts,{headers}));let data=null;try{data=await res.json()}catch(e){}if(!res.ok){if(res.status===401&&path!=='/auth/login'&&path!=='/auth/register'){localStorage.removeItem(STORE.token)}throw new Error(data?.detail||`HTTP ${res.status}`)}return data}
  function applyServerState(state){if(!state)return;syncing=true;try{if(state.user)rawSave(STORE.user,state.user);if(state.prefs){serverPrefs=state.prefs;rawSave(STORE.prefs,state.prefs);}if(state.daily)rawSave(STORE.daily,state.daily);if(state.deck)rawSave(STORE.deck,state.deck);if(state.flashcardTopics)serverFlashcardTopics=state.flashcardTopics;if(state.errors)rawSave(STORE.errors,state.errors);if(state.activity)rawSave(STORE.activity,state.activity)}finally{syncing=false}}
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
  const hydrated=await hydrateFromServer();
  const protectedPages=new Set(['onboarding','dashboard','roadmap','lesson','biology','biology-lesson','review','personalized','conversation','progress','profile']);
  if(protectedPages.has(document.body.dataset.page)&&!localStorage.getItem(STORE.token)){location.replace('start.html');return}
  if(protectedPages.has(document.body.dataset.page)){
    if(!hydrated){document.body.innerHTML='<p role="alert">学習設定を読み込めませんでした。再読み込みしてください。</p>';return}
    if(!serverPrefs.onboardingCompleted&&document.body.dataset.page!=='onboarding'){location.replace('onboarding.html');return}
    if(serverPrefs.onboardingCompleted&&document.body.dataset.page==='onboarding'){location.replace('dashboard.html');return}
  }
  const languageKey=`kotoba.uiLanguage.${load(STORE.user,{}).id||'guest'}`;
  window.KOTOBA_UI_LANGUAGE=(!serverPrefs||['N5','N4'].includes(serverPrefs.level))?(localStorage.getItem(languageKey)||'vi'):'ja';
  const uiScript=document.createElement('script');uiScript.src='ui-language.js';document.head.appendChild(uiScript);
  if(['lesson','biology-lesson','review','personalized','conversation','profile'].includes(document.body.dataset.page)){const script=document.createElement('script');script.type='module';script.src='furigana.js';document.head.appendChild(script)}
  applyLanguageMode();
  const supportStyle=document.createElement('link');supportStyle.rel='stylesheet';supportStyle.href='support-widget.css';document.head.appendChild(supportStyle);
  const supportScript=document.createElement('script');supportScript.src='support-widget.js';document.head.appendChild(supportScript);
  if(['dashboard','roadmap','lesson','biology','biology-lesson','review','personalized','conversation','progress','guide'].includes(document.body.dataset.page)){const contents=document.createElement('script');contents.type='module';contents.src='learning-contents.js';document.head.appendChild(contents)}
  ensureSeed();

  // global start links
  $$('.js-start').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.href=localStorage.getItem(STORE.token)?(serverPrefs?.onboardingCompleted?'dashboard.html':'onboarding.html'):'start.html'}));

  // auth page
  const authTabs=$$('.auth-tabs button');
  if(authTabs.length){authTabs.forEach(btn=>btn.addEventListener('click',()=>{authTabs.forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('#authMode').value=btn.dataset.mode;$('#nameField').classList.toggle('hidden',btn.dataset.mode==='login');$('#authSubmit').textContent=btn.dataset.mode==='login'?'学習を始める':'アカウントを作って始める'}));
    $('#authForm')?.addEventListener('submit',async e=>{e.preventDefault();const mode=$('#authMode').value;const email=$('#authEmail').value.trim();const password=$('#authPassword').value;const err=$('#authError');if(err){err.textContent='';err.classList.add('hidden')}try{const payload=mode==='register'?{name:$('#authName').value.trim()||'学習者',email,password}:{email,password};const result=await api(mode==='register'?'/auth/register':'/auth/login',{method:'POST',body:JSON.stringify(payload)});localStorage.setItem(STORE.token,result.token);applyServerState(result.state);location.href=result.state.prefs.onboardingCompleted?'dashboard.html':'onboarding.html'}catch(ex){if(err){err.textContent=ex.message||'ログインできませんでした。';err.classList.remove('hidden')}else toast(ex.message||'ログインできませんでした。')}});
  }

  // onboarding
  const onboard=$('#onboardingForm');
  if(onboard){let level=null;const button=$('#nextStep');$$('.choice',onboard).forEach(c=>c.addEventListener('click',()=>{level=c.dataset.value;$$('.choice',onboard).forEach(x=>{const selected=x===c;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected))});button.disabled=false}));onboard.addEventListener('submit',async e=>{e.preventDefault();if(!level)return;button.disabled=true;const error=$('#onboardingError');error.classList.add('hidden');try{await persistPrefs({...serverPrefs,level,onboardingCompleted:true});location.href='dashboard.html'}catch(ex){error.textContent=ex.message||'保存できませんでした。もう一度お試しください。';error.classList.remove('hidden');button.disabled=false}});}


  // dashboard
  if(document.body.dataset.page==='dashboard'){
    const user=load(STORE.user,{name:'学習者'}),prefs=load(STORE.prefs,{level:'N5',minutes:'20'});$('#userGreeting').textContent=`おはよう、${user.name}さん。`;$('#levelText').textContent=prefs.level||'N5';
    const daily=load(STORE.daily,{});const key=todayKey();if(!daily[key])daily[key]=[false,false,false,false,false];const boxes=$$('.daily-task input');boxes.forEach((b,i)=>{b.checked=!!daily[key][i];b.closest('.daily-task').classList.toggle('done',b.checked);b.addEventListener('change',()=>{daily[key][i]=b.checked;save(STORE.daily,daily);b.closest('.daily-task').classList.toggle('done',b.checked);updateDaily()})});function updateDaily(){const n=daily[key].filter(Boolean).length;$('#dailyCount').textContent=`${n}/5`;$('#dailyBar').style.width=`${n*20}%`;$('#dailyMinutes').textContent=`${n*5} / 25分`}updateDaily();
    const deck=load(STORE.deck,[]);$('#dueCount').textContent=deck.filter(c=>c.due<=key).length;const errs=load(STORE.errors,[]);const list=$('#weakList');if(list){list.innerHTML=errs.slice(0,4).map(e=>`<div class="weak-item"><span>${e.key}</span><b>${e.count}回</b></div>`).join('')}
  }

  // phase tabs
  $$('.phase-tab').forEach(tab=>tab.addEventListener('click',()=>{const root=tab.closest('[data-phase-root]')||document;$$('.phase-tab',root).forEach(x=>x.classList.remove('active'));tab.classList.add('active');$$('.phase',root).forEach(x=>x.classList.toggle('active',x.dataset.phase===tab.dataset.phase))}));

  // Continue only after all quiz groups in the current phase are complete.
  function updatePhaseNext(phase){
    if(!phase)return;
    const completed=$$('.answer-grid',phase).every(grid=>$('.answer.correct',grid));
    $$('[data-phase-next]',phase).forEach(button=>{button.disabled=!completed});
  }
  $$('[data-phase-next]').forEach(button=>button.addEventListener('click',()=>{
    if(button.disabled)return;
    const root=button.closest('[data-phase-root]')||document;
    const tab=$$('.phase-tab',root).find(tab=>tab.dataset.phase===button.dataset.phaseNext);
    if(!tab)return;
    tab.click();
    tab.focus({preventScroll:true});
    const tabs=$('.phase-tabs',root);
    if(tabs){
      tabs.style.scrollMarginTop=`${($('.navbar')?.offsetHeight||72)+18}px`;
      tabs.scrollIntoView({block:'start'});
    }
  }));

  // lesson answers and error logging
  $$('.answer[data-correct]').forEach(button=>button.addEventListener('click',()=>{
    const correct=button.dataset.correct==='true',phase=button.closest('.phase'),biology=document.body.dataset.track==='biology';
    button.classList.add(correct?'correct':'wrong');const feedback=button.closest('.study-block')?.querySelector('.quiz-feedback');
    if(feedback){
      const vi=correct?(phase?.dataset.phase==='shu'?'Đúng rồi. Bấm Tiếp để sang phần Ha.':'Đúng rồi. Hãy thử viết câu của bạn.'):(biology?'Chưa đúng. Đọc lại chức năng của từng phần tế bào rồi chọn lại.':'Chưa đúng. “Hôm qua” cần dùng câu kết thúc bằng ました. Hãy chọn lại.');
      const ja=correct?(phase?.dataset.phase==='shu'?'できました。「次へ」でHaへ進みましょう。':'できました。自分の文を書いてみましょう。'):(biology?'もう一度、細胞の説明を読んで選びましょう。':'「きのう」の文は「ました」を使います。もう一度選びましょう。');
      feedback.textContent=supportsVietnamese()?vi:ja;
    }
    if(!correct)addError(button.dataset.error||'過去形',biology?'語彙':'文法');updatePhaseNext(phase);
  }));
  function addError(key,type='文法'){const arr=load(STORE.errors,[]);const f=arr.find(x=>x.key===key);if(f)f.count++;else arr.push({key,count:1,type});save(STORE.errors,arr)}

  // free production check
  $('#productionCheck')?.addEventListener('click',()=>{const t=norm($('#productionText').value);const fb=$('#productionFeedback');if(!hasJapanese(t)){fb.textContent='日本語で答えてください。';return}if(/ました|でした/.test(t)){fb.textContent='よくできました。過去形を自然に使えています。';}else{fb.textContent='内容は伝わります。昨日のことなので、過去形も確認してみましょう。';addError('過去形','文法')}});
  $('#bioProductionCheck')?.addEventListener('click',()=>{const t=norm($('#bioProductionText').value);const fb=$('#bioProductionFeedback');if(!hasJapanese(t)){fb.textContent='日本語で説明してみましょう。';return}const hits=['細胞','細胞膜','核','ミトコンドリア'].filter(w=>t.includes(w));fb.textContent=hits.length>=2?'内容語を使って説明できています。次は理由や働きも加えてみましょう。':'今日の専門語を二つ以上使って説明してみましょう。';if(hits.length<2)addError('生物の専門語','語彙')});

  // Shared audio controls report errors inline and keep typing available.
  let voiceStatusCount=0;
  function audioStatus(button,text,error=false){
    if(button&&!button.dataset.voiceStatus&&button.insertAdjacentElement){
      const status=document.createElement('p');status.id=`voiceStatus${++voiceStatusCount}`;status.className='voice-status';status.dataset.noTranslate='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      (button.closest('.speech-row')||button).insertAdjacentElement('afterend',status);button.dataset.voiceStatus=status.id;
    }
    const status=button?document.getElementById(button.dataset.voiceStatus):null;
    if(status){status.textContent=text;status.classList.toggle('voice-error',error);status.hidden=!text}else if(error)toast(text);
  }
  function speakJapanese(text,button){
    if(!window.KotobaSpeech){toast(supportsVietnamese()?'Chưa tải được phần âm thanh. Hãy tải lại trang.':'音声機能を読み込めません。ページを更新してください。');return}
    window.KotobaSpeech.speakJapanese(text,{button,onStatus:(_,message)=>audioStatus(button,message),onError:message=>audioStatus(button,message,true)});
  }
  $$('[data-speak]').forEach(button=>{button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>speakJapanese(button.dataset.speak,button))});
  $$('[data-mic-target]').forEach(button=>{button.textContent=supportsVietnamese()?'Nói bằng micro':'マイクで話す';button.setAttribute('aria-label',supportsVietnamese()?'Nói tiếng Nhật để điền vào ô trả lời':'日本語で話して、答えを入力する');button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>startRecognition(button.dataset.micTarget,button))});
  function startRecognition(targetId,button,onFinal){
    if(!window.KotobaSpeech){audioStatus(button,supportsVietnamese()?'Chưa tải được phần micro. Hãy tải lại trang hoặc nhập bằng bàn phím.':'マイク機能を読み込めません。文字で入力してください。',true);return}
    return window.KotobaSpeech.listen({button,onStatus:(_,message)=>audioStatus(button,message),onError:message=>audioStatus(button,message,true),onTranscript:text=>{
      const target=document.getElementById(targetId);if(target){target.value=text;target.dispatchEvent?.(new Event('input',{bubbles:true}));if(!onFinal)target.focus?.()}
      if(onFinal)onFinal(text);
    }});
  }

  // Focus mode
  function buildFocus(){if($('#focusOverlay'))return;const el=document.createElement('div');el.id='focusOverlay';el.className='focus-overlay';el.innerHTML=`<div class="focus-card"><span class="eyebrow">集中モード</span><h2>学習を始める前に、1分だけ集中しましょう。</h2><div id="breathCircle" class="breath-circle"><div><div id="breathLabel">吸う</div><div class="focus-time" id="focusTime">60</div></div></div><p id="focusHint">ゆっくり呼吸してください。</p><div style="display:flex;gap:10px;justify-content:center"><button class="btn btn-secondary" id="focusSkip">スキップ</button><button class="btn btn-primary hidden" id="focusDone">学習を始める</button></div></div>`;document.body.appendChild(el);$('#focusSkip').onclick=()=>stopFocus();$('#focusDone').onclick=()=>stopFocus()}
  let focusTimer=null;function startFocus(){buildFocus();const ov=$('#focusOverlay');ov.classList.add('show');let sec=60;$('#focusTime').textContent=sec;$('#focusDone').classList.add('hidden');let phase=0;const circle=$('#breathCircle');const tickBreath=()=>{phase++;const inhale=phase%2===1;$('#breathLabel').textContent=inhale?'吸う':'吐く';circle.classList.toggle('inhale',inhale);$('#focusHint').textContent=inhale?'鼻からゆっくり吸いましょう。':'ゆっくり長く吐きましょう。'};tickBreath();const breath=setInterval(tickBreath,5000);focusTimer=setInterval(()=>{sec--;$('#focusTime').textContent=sec;if(sec<=0){clearInterval(focusTimer);clearInterval(breath);focusTimer=null;$('#breathLabel').textContent='準備完了';$('#focusHint').textContent='今日の学習を始めましょう。';$('#focusDone').classList.remove('hidden')}},1000);ov.dataset.breath=breath}
  function stopFocus(){const ov=$('#focusOverlay');if(!ov)return;if(focusTimer)clearInterval(focusTimer);const b=+ov.dataset.breath;if(b)clearInterval(b);focusTimer=null;ov.classList.remove('show')}
  $$('[data-focus]').forEach(b=>b.addEventListener('click',startFocus));

  // Dictionary
  // ============================================================
// DICTIONARY — SELECTION LOOKUP WITH OPTIONAL VOICE
// ============================================================

initDictionary();

function initDictionary(){
  const root=$('.dictionary-enabled');if(!root)return;
  const state={text:'',context:'',rect:null};let generation=0,controller=null,busy=false;
  const message=(vi,ja)=>supportsVietnamese()?vi:ja;
  const menu=document.createElement('div');menu.className='dictionary-context-menu';
  menu.innerHTML='<button type="button">辞書で調べる</button>';document.body.appendChild(menu);
  const action=document.createElement('button');action.type='button';action.className='dictionary-selection-action';action.dataset.noTranslate='';action.textContent=message('Tra từ đã chọn','選んだことばを調べる');document.body.appendChild(action);
  const panel=document.createElement('section');panel.className='dictionary-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',message('Tra từ trong bài','ことばを調べる'));
  panel.innerHTML=`<div class="dictionary-panel-head"><div><span class="dictionary-label">辞書</span><strong id="dictSel"></strong></div><button type="button" class="dictionary-close" aria-label="閉じる">×</button></div>
    <div id="dictGate" class="dictionary-gate"><div class="dictionary-ai-message"><div><strong>意味か読み方を調べましょう。</strong><p>ボタンを選ぶか、質問を入力してください。マイクも使えます。</p></div></div>
      <div class="dictionary-shortcuts"><button type="button" class="btn btn-secondary btn-small" data-dict-question="このことばの意味は何ですか。">意味を調べる</button><button type="button" class="btn btn-secondary btn-small" data-dict-question="このことばの読み方は何ですか。">読み方を調べる</button></div>
      <form id="dictQuestionForm" class="dictionary-question-form"><label for="dictQuestion">日本語で質問する（任意）</label><input id="dictQuestion" maxlength="500" placeholder="例：このことばの意味は何ですか。"><button type="submit" class="btn btn-primary btn-small" id="dictLookup">辞書を開く</button></form>
      <div class="dictionary-voice"><button id="dictMic" class="btn btn-secondary" type="button" aria-pressed="false">マイクで質問する</button><div id="dictTranscriptBox" class="dictionary-transcript hidden"><span class="dictionary-transcript-label">あなた</span><p id="dictTranscript"></p></div><p id="dictStatus" class="dictionary-gate-status" role="status" aria-live="polite" data-no-translate></p></div>
    </div><div id="dictResult" class="dictionary-result hidden"></div>`;
  document.body.appendChild(panel);
  const status=$('#dictStatus'),mic=$('#dictMic'),form=$('#dictQuestionForm'),question=$('#dictQuestion');
  const setStatus=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error)};
  function readSelection(){
    const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return null;
    const range=selection.getRangeAt(0);const element=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
    if(!element||!root.contains(element)||element.closest('rt,rp'))return null;
    const text=norm(window.KotobaFurigana?.baseText(range.cloneContents())??selection.toString());if(!text||!hasJapanese(text))return null;
    const context=element.closest('[data-dictionary-context],.reading-surface')||element;const rect=range.getBoundingClientRect();if(!rect.width&&!rect.height)return null;
    return {text:text.slice(0,180),context:norm(window.KotobaFurigana?.baseText(context)??context.textContent).slice(0,900),rect};
  }
  function cacheSelection(){
    const selected=readSelection();if(!selected){action.classList.remove('show');return}
    Object.assign(state,selected);action.style.left=Math.max(12,Math.min(state.rect.left,innerWidth-190))+'px';action.style.top=Math.max(8,Math.min(state.rect.bottom+8,innerHeight-55))+'px';action.classList.add('show');
  }
  document.addEventListener('selectionchange',()=>requestAnimationFrame(cacheSelection));root.addEventListener('mouseup',cacheSelection);root.addEventListener('touchend',()=>requestAnimationFrame(cacheSelection));
  document.addEventListener('contextmenu',event=>{const selected=readSelection();if(!selected||panel.contains(event.target))return;event.preventDefault();Object.assign(state,selected);action.classList.remove('show');menu.style.left=Math.max(12,Math.min(event.clientX,innerWidth-190))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-60))+'px';menu.classList.add('show')});
  function open(){
    if(!state.text)return;generation++;controller?.abort();busy=false;window.KotobaSpeech?.stopListening();window.KotobaSpeech?.stopSpeaking();
    menu.classList.remove('show');action.classList.remove('show');$('#dictSel').textContent=`「${state.text}」`;$('#dictGate').classList.remove('hidden');$('#dictResult').classList.add('hidden');$('#dictTranscriptBox').classList.add('hidden');question.value='';$('#dictLookup').disabled=false;mic.disabled=false;$$('[data-dict-question]',panel).forEach(button=>button.disabled=false);setStatus('');panel.classList.add('show');positionPanel(panel,state.rect);question.focus({preventScroll:true});
  }
  function close(){generation++;controller?.abort();window.KotobaSpeech?.stopListening();window.KotobaSpeech?.stopSpeaking();panel.classList.remove('show')}
  action.addEventListener('mousedown',event=>event.preventDefault());action.onclick=open;menu.querySelector('button').onclick=open;panel.querySelector('.dictionary-close').onclick=close;
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(panel.classList.contains('show')||menu.classList.contains('show')||action.classList.contains('show'))){close();menu.classList.remove('show');action.classList.remove('show')}});
  document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.classList.remove('show')});
  async function lookup(value){
    if(busy||!panel.classList.contains('show'))return;
    const text=norm(value)||'このことばの意味は何ですか。';
    if(text.length>500){setStatus(message('Câu hỏi tối đa 500 ký tự.','質問は500文字までです。'),true);return}
    busy=true;const current=generation;controller=new AbortController();const lookupController=controller;const timer=setTimeout(()=>lookupController.abort(),15000);
    $('#dictLookup').disabled=true;mic.disabled=true;$$('[data-dict-question]',panel).forEach(button=>button.disabled=true);window.KotobaSpeech?.stopListening();setStatus(message('Đang tra từ…','調べています…'));
    try{
      const entry=await resolveEntry(state.text,state.context,text,lookupController.signal);if(current!==generation)return;
      if(!entry){setStatus(message('Chưa có từ này trong từ điển. Thử chọn một từ ngắn hơn.','このことばはまだありません。短いことばを選んでください。'),true);return}
      renderEntry(entry,state.text);$('#dictGate').classList.add('hidden');$('#dictResult').classList.remove('hidden');
    }catch(error){if(current===generation)setStatus(message('Chưa tra được từ. Kiểm tra kết nối rồi thử lại.','調べられませんでした。通信を確認して、もう一度試してください。'),true)}
    finally{clearTimeout(timer);if(current===generation){busy=false;$('#dictLookup').disabled=false;mic.disabled=false;$$('[data-dict-question]',panel).forEach(button=>button.disabled=false)}}
  }
  form.addEventListener('submit',event=>{event.preventDefault();lookup(question.value)});$$('[data-dict-question]',panel).forEach(button=>button.onclick=()=>{question.value=button.dataset.dictQuestion;lookup(question.value)});
  mic.onclick=()=>window.KotobaSpeech?.listen({button:mic,onStatus:(_,text)=>setStatus(text),onError:text=>setStatus(text,true),onTranscript:text=>{question.value=text;$('#dictTranscriptBox').classList.remove('hidden');$('#dictTranscript').textContent=text;lookup(text)}});
}
  function positionPanel(p,r){const w=Math.min(440,innerWidth-24);p.style.width=w+'px';let left=r?.left||16,top=(r?.bottom||80)+12;left=Math.max(12,Math.min(left,innerWidth-w-12));if(top+590>innerHeight)top=Math.max(12,(r?.top||450)-470);p.style.left=left+'px';p.style.top=top+'px'}
  async function resolveEntry(sel,ctx,q,signal){if(window.KOTOBA_DICTIONARY_ENDPOINT){try{const res=await fetch(window.KOTOBA_DICTIONARY_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({selection:sel,context:ctx,question:q}),signal});if(res.ok)return await res.json()}catch(e){}}
    const exact=window.KOTOBA_PHRASES?.[sel]||window.KOTOBA_DICTIONARY?.[sel];if(exact)return Object.assign({term:sel},exact);const kanaEntry=Object.entries(window.KOTOBA_DICTIONARY||{}).find(([,entry])=>entry.reading===sel);if(kanaEntry)return Object.assign({term:kanaEntry[0]},kanaEntry[1]);const keys=Object.keys(window.KOTOBA_DICTIONARY||{}).filter(k=>sel.includes(k)).sort((a,b)=>b.length-a.length);if(keys.length)return Object.assign({term:keys[0]},window.KOTOBA_DICTIONARY[keys[0]]);return null}
  function renderEntry(entry,selected){const r=$('#dictResult');const ex=(entry.examples||[]).map(x=>`<div class="dict-example"><div>${x.jp}</div><div class="vi">${x.vi}</div></div>`).join('');r.innerHTML=`<h3 class="dictionary-entry-title jp" data-reading="${escapeHtml(entry.reading)}">${escapeHtml(entry.term||selected)}</h3><div class="dictionary-reading">${entry.reading||''} ・ ${entry.pos||''}</div><div class="dict-section"><h4>この文での意味</h4><strong>${supportsVietnamese()?(entry.meaningVi||entry.usage||''):(entry.meaningJa||entry.usage||'例文で使い方を確認してください。')}</strong></div>${supportsVietnamese()&&entry.otherMeanings?.length?`<div class="dict-section"><h4>ほかの意味</h4>${entry.otherMeanings.map(x=>`<div>・${x}</div>`).join('')}</div>`:''}<div class="dict-section"><h4>使い方</h4><div data-furigana-content>${escapeHtml(entry.usage)}</div></div><div class="dict-section"><h4>文法・よく使う形</h4><div class="dict-tags">${(entry.grammar||[]).map(x=>`<span class="dict-tag">${x}</span>`).join('')}</div></div>${entry.kanji?.length?`<div class="dict-section"><h4>漢字</h4>${entry.kanji.map(x=>`<div>・${x}</div>`).join('')}</div>`:''}<div class="dict-section"><h4>例文</h4>${ex}</div><div class="dict-section"><h4>関連語</h4><div class="dict-tags">${(entry.related||[]).map(x=>`<span class="dict-tag">${x}</span>`).join('')}</div></div><div class="dict-added">「今日の単語」に自動で追加しました。</div>`;addToDeck(entry,selected)}
  function addToDeck(entry,selected){if(entry.pos==='文')return;const term=entry.term||selected;if(!term||term.length>25)return;const deck=load(STORE.deck,[]);const found=deck.find(c=>c.term===term);if(found){found.lastSeen=todayKey();found.exposures=(found.exposures||1)+1}else deck.push({term,reading:entry.reading,meaning:entry.meaningVi,example:entry.examples?.[0]?.jp||selected,source:document.body.dataset.track==='biology'?'生物':'辞書',stage:0,interval:0,due:todayKey(),reviews:0,exposures:1,lastSeen:todayKey()});save(STORE.deck,deck);toast(`「${term}」を今日の単語に追加しました。`)}

  // review page
  if(document.body.dataset.page==='review')initReview();
  function initReview(){
    const deck=load(STORE.deck,[]),topics=serverFlashcardTopics;
    const accountId=load(STORE.user,{}).id||'guest';
    const topicKey=`kotoba.reviewTopic.${accountId}`;
    const directionKey=`kotoba.reviewDirection.${accountId}`;
    const previousDirection=load(directionKey,'ja-vi');
    let direction=['ja-vi','vi-ja'].includes(previousDirection)?previousDirection:'ja-vi';
    const validTopics=new Set(['all','personal',...topics.map(topic=>topic.id)]);
    const previousTopic=load(topicKey,null);
    let activeTopic=validTopics.has(previousTopic)?previousTopic:(topics[0]?.id||'all');
    const topicLabel=id=>{
      if(id==='all')return supportsVietnamese()?'Tất cả':'すべて';
      if(id==='personal')return supportsVietnamese()?'Thẻ tự tạo':'自分のカード';
      const topic=topics.find(item=>item.id===id);
      return supportsVietnamese()?(topic?.labelVi||id):id;
    };
    const cardsFor=id=>{
      if(id==='all')return deck;
      if(id==='personal')return deck.filter(c=>c.source==='手入力'||c.source?.startsWith('手入力:'));
      const terms=new Set(topics.find(topic=>topic.id===id)?.terms||[]);
      return deck.filter(c=>terms.has(c.term)||c.source===`手入力:${id}`);
    };
    let scopeDeck=[],due=[],idx=0,busy=false;
    const resetQueue=()=>{
      scopeDeck=cardsFor(activeTopic);
      due=scopeDeck.filter(c=>c.due<=todayKey());
      if(!due.length)due=scopeDeck.slice(0,5);
      idx=0;
    };
    const card=$('#flashcard'),form=$('#addWordForm'),topicPanel=$('#reviewTopics');
    const fields=$('#addWordFields'),submit=$('#addWordSubmit'),wordTopic=$('#wordTopic');
    const error=$('#addWordError'),status=$('#addWordStatus');
    const ratingButtons=[$('#rateAgain'),$('#rateHard'),$('#rateGood')];
    const directionButtons=[$('#directionJaVi'),$('#directionViJa')].filter(Boolean);
    const renderDirection=()=>{
      const vietnamese=supportsVietnamese();
      const title=$('#reviewDirectionTitle'),hint=$('#reviewDirectionHint');
      if(title)title.textContent=vietnamese?'Chiều học':'カードの向き';
      if(hint)hint.textContent=vietnamese
        ?(direction==='vi-ja'?'Nhìn nghĩa tiếng Việt và nhớ từ tiếng Nhật. Bấm thẻ để xem đáp án, rồi chọn mức độ nhớ.':'Nhìn từ tiếng Nhật và nhớ nghĩa tiếng Việt. Bấm thẻ để xem đáp án, rồi chọn mức độ nhớ.')
        :(direction==='vi-ja'?'ベトナム語の意味から日本語を思い出しましょう。カードを押して答えを見て、覚えた度合いを選びます。':'日本語からベトナム語の意味を思い出しましょう。カードを押して答えを見て、覚えた度合いを選びます。');
      directionButtons.forEach(button=>{
        const selected=button.dataset.reviewDirection===direction;
        button.textContent=vietnamese
          ?(button.dataset.reviewDirection==='vi-ja'?'Việt → Nhật':'Nhật → Việt')
          :(button.dataset.reviewDirection==='vi-ja'?'ベトナム語 → 日本語':'日本語 → ベトナム語');
        button.classList.toggle('active',selected);
        button.setAttribute('aria-pressed',String(selected));
        button.disabled=busy;
      });
    };
    directionButtons.forEach(button=>button.addEventListener('click',()=>{
      if(busy||direction===button.dataset.reviewDirection)return;
      direction=button.dataset.reviewDirection;
      rawSave(directionKey,direction);
      render();
    }));
    const selectTopic=id=>{
      if(busy||!validTopics.has(id))return;
      activeTopic=id;
      rawSave(topicKey,id);
      wordTopic.value=topics.some(topic=>topic.id===id)?id:'手入力';
      error.classList.add('hidden');
      $('#reviewError').classList.add('hidden');
      status.textContent='';
      resetQueue();
      render();
      Array.from(topicPanel.children).find(button=>button.dataset.reviewTopic===id)?.focus();
    };
    const renderTopics=()=>{
      topicPanel.replaceChildren();
      for(const id of ['all',...topics.map(topic=>topic.id),'personal']){
        const button=document.createElement('button');
        button.type='button';
        button.className='scenario-btn review-topic-btn';
        button.dataset.reviewTopic=id;
        button.classList.toggle('active',id===activeTopic);
        button.setAttribute('aria-pressed',String(id===activeTopic));
        button.disabled=busy;
        const name=document.createElement('span'),count=document.createElement('b');
        name.textContent=topicLabel(id);
        count.textContent=String(cardsFor(id).length);
        button.appendChild(name);
        button.appendChild(count);
        button.onclick=()=>selectTopic(id);
        topicPanel.appendChild(button);
      }
      const dueCount=scopeDeck.filter(c=>c.due<=todayKey()).length;
      $('#reviewTopicSummary').textContent=supportsVietnamese()
        ?`${topicLabel(activeTopic)} · ${scopeDeck.length} thẻ · ${dueCount} đến hạn`
        :`${topicLabel(activeTopic)} · ${scopeDeck.length}枚 · 期限のカード ${dueCount}枚`;
    };
    for(const id of ['手入力',...topics.map(topic=>topic.id)]){
      const option=document.createElement('option');
      option.value=id;
      option.textContent=id==='手入力'?(supportsVietnamese()?'Thẻ tự tạo':'自分のカード'):topicLabel(id);
      wordTopic.appendChild(option);
    }
    wordTopic.value=topics.some(topic=>topic.id===activeTopic)?activeTopic:'手入力';
    resetQueue();
    const setBusy=value=>{
      busy=value;
      fields.disabled=value;
      ratingButtons.forEach(button=>button.disabled=value);
      directionButtons.forEach(button=>button.disabled=value);
      Array.from(topicPanel.children).forEach(button=>button.disabled=value);
      submit.textContent=value?'保存中…':'カードに追加';
    };
    const reveal=$('#revealCard');
    const setFlipped=flipped=>{
      card.classList.toggle('flipped',flipped);
      card.setAttribute('aria-pressed',String(flipped));
      card.setAttribute('aria-labelledby',flipped?'flashBack':'flashFront');
      reveal.setAttribute('aria-pressed',String(flipped));
      reveal.textContent=flipped?'表に戻す':'答えを見る';
      $('#flashFront')?.setAttribute('aria-hidden',String(flipped));
      $('#flashBack')?.setAttribute('aria-hidden',String(!flipped));
      card.setAttribute('aria-label',supportsVietnamese()
        ?(flipped?'Lật thẻ về mặt trước':(direction==='vi-ja'?'Lật thẻ để xem từ tiếng Nhật':'Lật thẻ để xem nghĩa tiếng Việt'))
        :(flipped?'カードを表に戻す':(direction==='vi-ja'?'カードを裏返して日本語を見る':'カードを裏返してベトナム語の意味を見る')));
    };
    const flip=()=>{if(card.dataset.term)setFlipped(!card.classList.contains('flipped'))};
    card.addEventListener('click',flip);
    card.addEventListener('keydown',e=>{
      if(e.target===card&&(e.key==='Enter'||e.key===' ')){
        e.preventDefault();
        if(!e.repeat)flip();
      }
    });
    reveal.onclick=flip;
    const render=()=>{
      renderTopics();
      renderDirection();
      renderDeckList(scopeDeck,direction);
      card.dataset.direction=direction;
      const c=due[idx];
      $('#reviewActions').classList.toggle('hidden',!c);
      reveal.classList.toggle('hidden',!c);
      $('#reviewPosition').textContent=`${c?idx+1:due.length} / ${due.length}`;
      if(!c){
        delete card.dataset.term;
        setFlipped(false);
        card.removeAttribute('role');
        card.removeAttribute('tabindex');
        card.removeAttribute('aria-label');
        card.removeAttribute('aria-labelledby');
        card.removeAttribute('aria-pressed');
        card.innerHTML=scopeDeck.length
          ?'<h2>今日の復習は完了しました。</h2><p class="muted">よくできました。</p>'
          :'<h2>まだカードがありません。</h2><p class="muted">単語を追加して、復習を始めましょう。</p>';
        return;
      }
      card.dataset.term=c.term;
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      const term=escapeHtml(c.term),reading=escapeHtml(c.reading);
      const meaning=escapeHtml(c.meaning||window.KOTOBA_DICTIONARY?.[c.term]?.meaningVi||'');
      const example=escapeHtml(c.example);
      let front='';
      if(direction==='vi-ja'){
        const prompt=supportsVietnamese()
          ?(c.stage===3?'Nhớ từ tiếng Nhật, rồi thử đặt một câu với từ đó.':'Từ này nói bằng tiếng Nhật là gì?')
          :(c.stage===3?'日本語の単語を思い出して、その語で文を一つ作りましょう。':'日本語では何と言いますか？');
        front=`<div class="flash-prompt" data-no-translate>${prompt}</div><div class="flash-front-main flash-front-vietnamese" lang="vi" data-flashcard-vietnamese data-learning-content>${meaning||escapeHtml(supportsVietnamese()?'Thẻ này chưa có nghĩa tiếng Việt.':'このカードにはベトナム語の意味がありません。')}</div>`;
      }else if(c.stage===2&&c.example?.includes(c.term)){
        front=`<div class="flash-prompt">文脈から思い出してください</div><div class="context-example jp">${escapeHtml(c.example.replace(c.term,'＿＿＿'))}</div>`;
      }else if(c.stage===3&&c.example){
        front=`<div class="flash-prompt">この語を使って、自分の文を一つ考えてください</div><div class="flash-front-main jp" data-reading="${reading}">${term}</div>`;
      }else{
        front=`<div class="flash-prompt">意味を思い出してください</div><div class="flash-front-main jp" data-reading="${reading}">${term}</div>`;
      }
      const back=`<h2 class="jp" data-reading="${reading}">${term}</h2><div data-learning-content>${reading}</div><p class="flash-meaning-label">ベトナム語の意味</p><h3 class="flash-meaning" lang="vi" data-flashcard-vietnamese data-learning-content>${meaning}</h3>${example?`<div class="context-example jp">${example}</div>`:''}`;
      card.innerHTML=`<span class="source-badge">${escapeHtml(cardSource(c))}</span><div class="flash-front" id="flashFront" aria-hidden="false">${front}<p class="muted flash-hint" data-no-translate>${supportsVietnamese()?'Bấm thẻ, Enter hoặc phím cách để lật.':'カードを押すか、Enter・スペースキーで裏返せます。'}</p></div><div class="flash-back" id="flashBack" aria-hidden="true">${back}</div>`;
      setFlipped(false);
    };
    const rate=async rating=>{
      if(busy)return;
      const real=deck.find(c=>c.term===card.dataset.term);
      if(!real)return;
      const reviewError=$('#reviewError');
      reviewError.classList.add('hidden');
      setBusy(true);
      try{
        const result=await api('/vocabulary/review',{method:'POST',body:JSON.stringify({term:real.term,rating})});
        Object.assign(real,{stage:result.stage,interval:result.interval,due:result.due,reviews:(real.reviews||0)+1});
        rawSave(STORE.deck,deck);
        idx++;
        render();
      }catch(ex){
        reviewError.textContent=ex.message||'保存できませんでした。もう一度お試しください。';
        reviewError.classList.remove('hidden');
      }finally{setBusy(false)}
    };
    ratingButtons.forEach((button,i)=>button.onclick=()=>rate(['again','hard','good'][i]));
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(busy)return;
      error.classList.add('hidden');
      status.textContent='';
      const term=$('#wordTerm').value.trim(),reading=$('#wordReading').value.trim();
      const meaning=$('#wordMeaning').value.trim(),example=$('#wordExample').value.trim();
      const fail=(message,input)=>{error.textContent=message;error.classList.remove('hidden');input?.focus()};
      if(!term||!hasJapanese(term))return fail('日本語の単語を入力してください。',$('#wordTerm'));
      if(!meaning)return fail('ベトナム語の意味を入力してください。',$('#wordMeaning'));
      if(term.length>100||reading.length>100||meaning.length>500||example.length>1000)return fail('入力が長すぎます。短くしてください。');
      if(deck.some(c=>c.term===term))return fail('この単語はすでにカードにあります。',$('#wordTerm'));
      const topic=wordTopic.value;
      if(topic!=='手入力'&&!topics.some(item=>item.id===topic))return fail('テーマを選択してください。',wordTopic);
      const source=topic==='手入力'?'手入力':'手入力:'+topic;
      const newCard={term,reading,meaning,example,source,stage:0,interval:0,due:todayKey(),reviews:0,exposures:1,lastSeen:todayKey()};
      setBusy(true);
      try{
        await api('/vocabulary/upsert',{method:'POST',body:JSON.stringify(newCard)});
        deck.push(newCard);
        rawSave(STORE.deck,deck);
        scopeDeck=cardsFor(activeTopic);
        if(scopeDeck.some(c=>c.term===newCard.term)){
          due.push(newCard);
        }else{
          activeTopic=topic==='手入力'?'personal':topic;
          rawSave(topicKey,activeTopic);
          resetQueue();
        }
        render();
        form.reset();
        wordTopic.value=topics.some(item=>item.id===activeTopic)?activeTopic:'手入力';
        status.textContent=supportsVietnamese()?`Đã thêm “${term}” vào flashcard.`:`「${term}」をカードに追加しました。`;
      }catch(ex){fail(ex.message||'保存できませんでした。もう一度お試しください。')}
      finally{setBusy(false)}
    });
    render();
  }
  function renderDeckList(deck,direction='ja-vi'){
    const el=$('#deckList');if(!el)return;
    el.innerHTML=deck.slice().reverse().map(c=>{
      const word=direction==='vi-ja'
        ?`<b lang="vi" data-flashcard-vietnamese data-learning-content>${escapeHtml(c.meaning||window.KOTOBA_DICTIONARY?.[c.term]?.meaningVi||(supportsVietnamese()?'Chưa có nghĩa tiếng Việt':'ベトナム語の意味がありません'))}</b>`
        :`<b class="jp" data-reading="${escapeHtml(c.reading)}">${escapeHtml(c.term)}</b>`;
      return `<div class="deck-item"><div>${word}<div class="muted" style="font-size:12px">${escapeHtml(cardSource(c))}</div></div><span>${c.due<=todayKey()?'今日':'予定'}</span></div>`;
    }).join('');
  }

  // conversation
  if(document.body.dataset.page==='conversation')initConversation();
  function initConversation(){
    let scenario='コンビニ', history=[], busy=false, generation=0, voiceReply=false, latestReply='';
    const log=$('#chatLog'), input=$('#chatText'), submit=$('#chatForm button[type="submit"]');
    const prompts={コンビニ:'いらっしゃいませ。何を買いますか？',レストラン:'いらっしゃいませ。何名様ですか？',学校:serverPrefs?.level==='N5'?'今日は学校で何をべんきょうしましたか？':'今日は学校で何を勉強しましたか？',友達:'今日は何をしましたか？',駅:'どこまで行きたいですか？',旅行:'日本でどこへ行きたいですか？',自由会話:'こんにちは。今日は何について話したいですか？'};
    const add=(who,text)=>{const d=document.createElement('div');d.className=`bubble ${who}`;d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight;return d};
    const reset=()=>{window.KotobaSpeech?.stopListening();window.KotobaSpeech?.stopSpeaking();voiceReply=false;generation++;latestReply=prompts[scenario];history=[{role:'assistant',content:prompts[scenario]}];log.replaceChildren();add('teacher',prompts[scenario]);input.value='';$('#chatError').classList.add('hidden')};
    reset();
    const listenButton=$('#conversationListen');listenButton?.addEventListener('click',()=>speakJapanese(latestReply,listenButton));
    $$('.scenario-btn').forEach(b=>b.addEventListener('click',()=>{$$('.scenario-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');scenario=b.dataset.scenario;reset()}));
    $('#chatForm').onsubmit=async e=>{
      e.preventDefault();if(busy)return;
      const text=norm(input.value);if(!text)return;
      if(!hasJapanese(text)){add('teacher','日本語で話してみましょう。短い文でも大丈夫です。');return}
      if(text.length>2000){toast('2000文字以内で入力してください。');return}
      const current=generation, student=add('student',text);input.value='';
      const pending=add('teacher',supportsVietnamese()?'AI đang trả lời…':'考えています…');busy=true;submit.disabled=true;
      try{
        const reply=await aiReply(scenario,text,history.slice(-20));
        if(current!==generation)return;
        pending.textContent=reply;
        latestReply=reply;if(voiceReply)speakJapanese(reply,$('#conversationListen'));
        voiceReply=false;
        history.push({role:'user',content:text},{role:'assistant',content:reply});
        history=history.slice(-20);
      }catch(error){
        if(current!==generation)return;
        pending.remove();student.remove();if(!input.value)input.value=text;
        $('#chatError').textContent=error.message||'返答を取得できませんでした。もう一度お試しください。';
        $('#chatError').classList.remove('hidden');
      }finally{voiceReply=false;busy=false;submit.disabled=false;log.scrollTop=log.scrollHeight}
    };
    $('#chatForm').addEventListener('submit',()=>$('#chatError').classList.add('hidden'));
    $('#conversationMic')?.addEventListener('click',()=>{if(busy)return;const current=generation;startRecognition('chatText',$('#conversationMic'),()=>{if(current!==generation||busy)return;voiceReply=true;$('#chatForm').requestSubmit()})});
  }
  async function aiReply(scenario,text,history){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    try{
      const d=await api('/ai/conversation',{method:'POST',body:JSON.stringify({scenario,text,history}),signal:controller.signal});
      if(typeof d?.reply!=='string'||!d.reply.trim())throw new Error('AIの返答が空でした。もう一度お試しください。');
      return d.reply;
    }catch(error){
      if(error.name==='AbortError')throw new Error('AIの応答に時間がかかっています。もう一度お試しください。');
      throw error;
    }finally{clearTimeout(timer)}
  }

  // personalized
  if(document.body.dataset.page==='personalized')initPersonalized();
  function initPersonalized(){
    const errors=load(STORE.errors,[]).map(error=>({...error})).sort((a,b)=>b.count-a.count);
    const completed=new Set();
    const panel=$('#errorPanel'),target=$('#personalTarget'),feedback=$('#personalFeedback');
    const next=$('#personalNext'),restart=$('#personalRestart'),progress=$('#personalProgress');
    let active=-1;
    const message=(vi,ja)=>supportsVietnamese()?vi:ja;
    function updateProgress(){
      progress.textContent=message(`Đã luyện: ${completed.size} / ${errors.length}`,`練習済み: ${completed.size} / ${errors.length}`);
    }
    function renderPanel(){
      panel.replaceChildren();
      errors.forEach((error,index)=>{
        const button=document.createElement('button');
        button.type='button';button.className='error-chip';
        button.classList.toggle('active',index===active);
        if(index===active)button.setAttribute('aria-current','true');
        const label=document.createElement('span');
        const key=document.createElement('strong');key.textContent=error.key;key.dataset.learningContent='';
        const type=document.createElement('small');type.className='muted';type.textContent=error.type;
        label.appendChild(key);label.appendChild(type);
        const status=document.createElement('span');status.className='error-status';
        const count=document.createElement('b');count.textContent=`${error.count}回`;status.appendChild(count);
        if(completed.has(index)){
          const done=document.createElement('small');done.className='personal-done';done.textContent='練習済み';status.appendChild(done);
        }
        button.appendChild(label);button.appendChild(status);
        button.onclick=()=>{show(index);target.focus()};panel.appendChild(button);
      });
    }
    function pendingIndex(){
      for(let offset=1;offset<=errors.length;offset++){
        const index=(active+offset)%errors.length;
        if(!completed.has(index))return index;
      }
      return -1;
    }
    function show(index){
      active=index;const error=errors[index];
      target.textContent=error.key;
      next.classList.remove('hidden');restart.classList.add('hidden');
      next.disabled=!completed.has(index);
      next.textContent=completed.size===errors.length?'練習を終える':'次の弱点 →';
      feedback.classList.remove('hidden');
      feedback.textContent=completed.has(index)?'この弱点は練習済みです。次へ進みましょう。':'答えてから次の弱点に進みましょう。';
      renderPanel();updateProgress();
      renderPersonalExercise(error.key,ok=>{
        if(ok){
          completed.add(index);next.disabled=false;
          next.textContent=completed.size===errors.length?'練習を終える':'次の弱点 →';
          feedback.textContent='正解です。次の弱点へ進めます。';next.focus();
        }else{
          addError(error.key,error.type);error.count++;
          feedback.textContent='もう一度答えてみましょう。正解すると次へ進めます。';
        }
        renderPanel();updateProgress();
      },completed.has(index));
    }
    function finish(){
      active=-1;target.textContent='今日の弱点練習が完了しました。';
      $('#personalExercise').textContent=message('Bạn có thể luyện lại hoặc dùng kiến thức vừa ôn trong hội thoại.','もう一度練習するか、会話で使ってみましょう。');
      feedback.textContent='';feedback.classList.add('hidden');
      next.disabled=true;next.classList.add('hidden');restart.classList.remove('hidden');
      renderPanel();updateProgress();restart.focus();
    }
    next.onclick=()=>{
      if(next.disabled||active<0||!completed.has(active))return;
      const index=pendingIndex();
      if(index<0)finish();else{show(index);target.focus()}
    };
    restart.onclick=()=>{completed.clear();show(0);target.focus()};
    if(errors.length){show(0)}else{
      panel.textContent='まだ弱点はありません。';target.textContent='まだ弱点はありません。';
      $('#personalExercise').textContent=message('Hãy tiếp tục học. Các lỗi cần ôn sẽ xuất hiện ở đây.','学習を続けると、復習が必要なポイントがここに表示されます。');
      next.disabled=true;next.classList.add('hidden');restart.classList.add('hidden');feedback.classList.add('hidden');updateProgress();
    }
  }
  function renderPersonalExercise(target,onAnswer,completed=false){
    const exercise=/は\s*\/\s*が/.test(target)?{
      question:'田中さん ___ 学生です。だれ ___ 日本語を勉強していますか。',
      answers:['は / は','は / が','が / は'],correct:1
    }:/生物の専門語/.test(target)?{
      question:'細胞の内側と外側を分ける部分は、どれですか。',
      answers:['核','細胞膜','ミトコンドリア'],correct:1
    }:{
      question:'昨日、友達と映画を ______。',
      answers:['見ます','見ました','見て'],correct:1
    };
    const root=$('#personalExercise');root.replaceChildren();
    const question=document.createElement('p');question.className='exercise-question jp';question.textContent=exercise.question;
    const grid=document.createElement('div');grid.className='answer-grid';
    const buttons=[];let answered=completed;
    exercise.answers.forEach((answer,index)=>{
      const button=document.createElement('button');button.type='button';button.className='answer';button.textContent=answer;
      const correct=index===exercise.correct;button.dataset.personal=correct?'correct':'wrong';button.disabled=completed;
      if(completed&&correct)button.classList.add('correct');
      button.onclick=()=>{
        if(button.disabled||answered)return;
        button.classList.add(correct?'correct':'wrong');button.disabled=true;
        if(correct){answered=true;buttons.forEach(choice=>{choice.disabled=true})}
        onAnswer(correct);
      };
      buttons.push(button);grid.appendChild(button);
    });
    root.appendChild(question);root.appendChild(grid);
  }
  // progress
  if(document.body.dataset.page==='progress')initProgress();
  function initProgress(){const deck=load(STORE.deck,[]),errs=load(STORE.errors,[]),activity=load(STORE.activity,{streak:7,totalMinutes:0,days:{}});$('#progressWords').textContent=deck.length;$('#progressStreak').textContent=activity.streak||0;$('#progressErrors').textContent=errs.reduce((s,e)=>s+e.count,0);const skill={語彙:Math.min(92,55+deck.length*2),漢字:66,文法:Math.max(48,76-errs.filter(e=>e.type==='文法').reduce((s,e)=>s+e.count,0)),読解:64,聴解:57,会話:52};$('#skillBars').innerHTML=Object.entries(skill).map(([k,v])=>`<div class="skill-row-progress"><span>${k}</span><div class="progress-track"><span style="width:${v}%"></span></div><b>${v}%</b></div>`).join('')}

  // profile
  if(document.body.dataset.page==='profile'){
    const p={...serverPrefs},u=load(STORE.user,{name:'学習者',email:''});
    $('#profileName').value=u.name||'';$('#profileEmail').value=u.email||'';
    $('#profileLevel').value=p.level;$('#profileMinutes').value=p.minutes||'20';$('#profileTime').value=p.studyTime||'20:30';
    $('#profileSave').onclick=async()=>{const button=$('#profileSave');button.disabled=true;try{
      u.name=$('#profileName').value.trim()||u.name;
      const prefs={...serverPrefs,level:$('#profileLevel').value,minutes:$('#profileMinutes').value,studyTime:$('#profileTime').value};
      await api('/state/user',{method:'PUT',body:JSON.stringify({value:u})});
      await persistPrefs(prefs);window.KotobaFurigana?.setMode($('#profileFurigana').value);toast('保存しました。');
    }catch(ex){toast(ex.message||'保存できませんでした。')}finally{button.disabled=false}};
  }

  $('#logoutBtn')?.addEventListener('click',()=>{Object.values(STORE).forEach(k=>localStorage.removeItem(k));location.href='start.html'});
})();

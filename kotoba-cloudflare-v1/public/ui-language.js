(function(){
'use strict';
const language=window.KOTOBA_UI_LANGUAGE||'ja';
const labels={"ホーム": "Trang chủ", "学習": "Học tập", "生物で学ぶ": "Học qua sinh học", "復習": "Ôn tập", "会話": "Hội thoại", "進捗": "Tiến độ", "今日の学習": "Học hôm nay", "今日の復習": "Ôn tập hôm nay", "今のレベル": "Trình độ hiện tại", "新しい語彙": "Từ vựng mới", "弱点トレーニング": "Luyện điểm yếu", "最近の弱点": "Điểm yếu gần đây", "AIからのおすすめ": "AI gợi ý", "続きを学ぶ →": "Tiếp tục học →", "先生と話す": "Nói chuyện với giáo viên", "弱点を練習": "Luyện điểm yếu", "あなたの練習を始める": "Bắt đầu bài luyện riêng", "答えを見る": "Xem đáp án", "送る": "Gửi", "もう一度": "Học lại", "難しい": "Khó", "わかった": "Đã hiểu", "今日の単語": "Từ vựng hôm nay", "文法": "Ngữ pháp", "語彙": "Từ vựng", "漢字": "Kanji", "読解": "Đọc hiểu", "聴解": "Nghe hiểu", "保存する": "Lưu", "ログアウト": "Đăng xuất", "プロフィール": "Hồ sơ", "設定": "Cài đặt", "コンビニ": "Cửa hàng tiện lợi", "レストラン": "Nhà hàng", "学校": "Trường học", "友達": "Bạn bè", "駅": "Nhà ga", "旅行": "Du lịch", "自由会話": "Hội thoại tự do", "AI先生と話す": "Luyện nói với AI", "何を練習しますか？": "Bạn muốn luyện chủ đề nào?", "場面を選ぶか、自分で話したい内容を決めましょう。": "Chọn tình huống hoặc chủ đề bạn muốn nói.", "日本語で入力してください": "Nhập bằng tiếng Nhật", "日本語で話しましょう": "Hãy nói bằng tiếng Nhật", "意味を思い出してください": "Hãy nhớ lại nghĩa", "日本語で言ってください": "Hãy nói bằng tiếng Nhật", "文脈から思い出してください": "Nhớ từ dựa trên ngữ cảnh", "この語を使って、自分の文を一つ考えてください": "Đặt một câu với từ này", "使い方": "Cách sử dụng", "例文": "Ví dụ", "関連語": "Từ liên quan", "この文での意味": "Nghĩa trong câu", "ほかの意味": "Nghĩa khác", "文法・よく使う形": "Ngữ pháp và mẫu thường gặp", "辞書で調べる": "Tra từ điển", "集中モード": "Chế độ tập trung", "スキップ": "Bỏ qua", "学習を始める": "Bắt đầu học", "使い方ガイド": "Hướng dẫn sử dụng", "学習設定": "Cài đặt học tập", "名前": "Tên", "メールアドレス": "Địa chỉ email", "日本語レベル": "Trình độ tiếng Nhật", "毎日の目標": "Mục tiêu mỗi ngày", "学習する時間": "Giờ học", "ふりがな": "Cách đọc furigana", "ベトナム語のヒント": "Gợi ý tiếng Việt", "今日のカード": "Thẻ hôm nay", "学習から集まった語": "Từ đã thu thập", "日本語コース": "Khóa học tiếng Nhật", "続ける →": "Tiếp tục →", "始める": "Bắt đầu", "ロック": "Đã khóa", "第1章 はじめまして": "Chương 1: Làm quen", "第2章 学校生活": "Chương 2: Cuộc sống học đường", "第3章 毎日の生活": "Chương 3: Sinh hoạt hằng ngày", "第4章 趣味・好きなこと": "Chương 4: Sở thích", "第5章 食べ物": "Chương 5: Thức ăn", "第6章 町での生活": "Chương 6: Cuộc sống trong thành phố", "AI学習サポート": "AI hỗ trợ học tập", "どんなことを知りたいですか？": "Bạn muốn hỏi điều gì?", "日本語で話してください。": "Hãy nói bằng tiếng Nhật.", "聞いています...": "Đang nghe…", "考えています...": "Đang xử lý…", "マイクの使用を許可してください。": "Hãy cho phép sử dụng micro.", "音声を認識できませんでした。もう一度話してください。": "Chưa nhận được lời nói. Hãy thử lại.", "このブラウザでは音声認識を利用できません。": "Trình duyệt này không hỗ trợ nhận giọng nói.", "もう少し詳しく質問してみましょう。": "Hãy hỏi rõ hơn, ví dụ: この言葉の意味は何ですか。", "日本語で質問してください。": "Hãy đặt câu hỏi bằng tiếng Nhật.", "マイクで話す": "Nói bằng micro"};
function translate(root){
 if(language!=='vi'||!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
  if(node.parentElement?.closest('script,style,textarea,#chatLog,.context-example,.jp,[data-learning-content]'))continue;
  const text=node.textContent.trim();if(labels[text])node.textContent=node.textContent.replace(text,labels[text]);
 }
 root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(el=>{for(const attr of ['placeholder','title','aria-label']){const value=el.getAttribute(attr);if(labels[value])el.setAttribute(attr,labels[value])}});
}
const actions=document.querySelector('.nav-actions')||document.querySelector('.nav-inner');
if(actions){
 const guide=document.createElement('a');guide.href='guide.html';guide.textContent='使い方ガイド';guide.className='btn btn-secondary';actions.appendChild(guide);
 const prefs=JSON.parse(localStorage.getItem('kotoba.prefs')||'{}');
 if(!prefs.onboardingCompleted||['N5','N4'].includes(prefs.level)){
  const select=document.createElement('select');select.id='uiLanguage';select.setAttribute('aria-label','Ngôn ngữ / 言語');select.innerHTML='<option value="vi">Tiếng Việt</option><option value="ja">日本語</option>';select.value=language;
  select.onchange=()=>{const user=JSON.parse(localStorage.getItem('kotoba.user')||'{}');localStorage.setItem(`kotoba.uiLanguage.${user.id||'guest'}`,select.value);location.reload()};actions.appendChild(select);
 }
}
document.documentElement.lang=language;
document.querySelectorAll('[data-guide-language]').forEach(el=>el.hidden=el.dataset.guideLanguage!==language);
translate(document.body);
new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')translate(record.target.parentElement);else record.addedNodes.forEach(node=>{if(node.nodeType===1)translate(node);else if(node.nodeType===3)translate(node.parentElement)})}}).observe(document.body,{childList:true,subtree:true,characterData:true});
})();
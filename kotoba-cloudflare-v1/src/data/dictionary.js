/**
 * Từ điển demo Nhật–Việt dùng cho MVP.
 * Production: thay object này bằng dataset có bản quyền / API từ điển riêng.
 */
export const DICTIONARY = {
  細胞膜: {
    term: '細胞膜',
    reading: 'さいぼうまく',
    pos: '名詞',
    meaningVi: 'màng tế bào',
    otherMeanings: ['màng bao quanh tế bào'],
    usage: '細胞の内側と外側を分ける構造について述べるときに使います。',
    grammar: ['細胞膜は〜', '細胞膜が〜', '細胞膜を通る'],
    kanji: ['細：nhỏ, mảnh', '胞：tế bào, bọc chứa', '膜：màng'],
    examples: [
      {
        jp: '細胞膜は細胞の内側と外側を分けています。',
        vi: 'Màng tế bào phân chia bên trong và bên ngoài tế bào.',
      },
    ],
    related: ['細胞', '核', '細胞質', 'ミトコンドリア'],
  },

  学校: {
    term: '学校',
    reading: 'がっこう',
    pos: '名詞',
    meaningVi: 'trường học; nhà trường',
    otherMeanings: [],
    usage: '教育を受ける場所を表します。',
    grammar: ['学校へ行く', '学校で勉強する', '学校の〜'],
    kanji: ['学：học', '校：trường'],
    examples: [
      {
        jp: '毎朝八時に学校へ行きます。',
        vi: 'Mỗi sáng tôi đến trường lúc 8 giờ.',
      },
    ],
    related: ['学生', '高校', '大学', '教室'],
  },

  細胞: {
    term: '細胞',
    reading: 'さいぼう',
    pos: '名詞',
    meaningVi: 'tế bào',
    otherMeanings: [],
    usage: '生物の体をつくる基本的な単位を表します。',
    grammar: ['細胞は〜', '細胞の〜'],
    kanji: ['細：nhỏ, mảnh', '胞：tế bào'],
    examples: [
      {
        jp: '細胞は生命の基本的な単位です。',
        vi: 'Tế bào là đơn vị cơ bản của sự sống.',
      },
    ],
    related: ['細胞膜', '核', '細胞質'],
  },

  核: {
    term: '核',
    reading: 'かく',
    pos: '名詞',
    meaningVi: 'nhân (tế bào)',
    otherMeanings: ['hạt nhân', 'phần cốt lõi'],
    usage: '生物では細胞核を指すことがあります。',
    grammar: ['核は〜', '核の中に〜'],
    kanji: ['核：nhân, cốt lõi'],
    examples: [
      {
        jp: '核には遺伝情報があります。',
        vi: 'Trong nhân có thông tin di truyền.',
      },
    ],
    related: ['細胞核', '遺伝子', '染色体'],
  },

  ミトコンドリア: {
    term: 'ミトコンドリア',
    reading: 'ミトコンドリア',
    pos: '名詞',
    meaningVi: 'ti thể',
    otherMeanings: [],
    usage: '細胞内でエネルギー産生に関わる細胞小器官を表します。',
    grammar: ['ミトコンドリアは〜', 'ミトコンドリアで〜'],
    kanji: [],
    examples: [
      {
        jp: 'ミトコンドリアはエネルギー産生に関わります。',
        vi: 'Ti thể tham gia vào quá trình sản sinh năng lượng.',
      },
    ],
    related: ['細胞', 'ATP', '呼吸'],
  },
};

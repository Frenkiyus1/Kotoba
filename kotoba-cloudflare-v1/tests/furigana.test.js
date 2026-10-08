import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { splitReading, readingEntries, segmentText } from '../public/furigana.js';
import { STARTER_FLASHCARDS } from '../src/data/flashcards.js';

const window = {};
vm.runInNewContext(readFileSync(new URL('../public/dictionary-data.js', import.meta.url), 'utf8'), { window });
const entries = readingEntries(window.KOTOBA_DICTIONARY, STARTER_FLASHCARDS);
const annotated = text => segmentText(text, entries).filter(segment => segment.reading);
const original = segments => segments.map(segment => segment.text).join('');

test('furigana keeps okurigana and kana prefixes on the baseline', () => {
  assert.deepEqual(splitReading('食べる', 'たべる'), [{ text: '食', reading: 'た' }, { text: 'べる' }]);
  assert.deepEqual(splitReading('お釣り', 'おつり'), [{ text: 'お' }, { text: '釣', reading: 'つ' }, { text: 'り' }]);
  assert.deepEqual(splitReading('待ち合わせ', 'まちあわせ'), [{ text: '待', reading: 'ま' }, { text: 'ち' }, { text: '合', reading: 'あ' }, { text: 'わせ' }]);
});

test('furigana accepts katakana readings without annotating kana-only words', () => {
  assert.deepEqual(splitReading('学校', 'ガッコウ'), [{ text: '学校', reading: 'がっこう' }]);
  assert.deepEqual(splitReading('コンビニ', 'こんびに'), [{ text: 'コンビニ' }]);
});

test('invalid or ambiguous readings do not invent a kanji pronunciation', () => {
  assert.deepEqual(splitReading('学校', 'gakkou'), [{ text: '学校' }]);
  assert.deepEqual(splitReading('食べる', 'べんきょう'), [{ text: '食べる' }]);
  assert.deepEqual(splitReading('漢あ字', 'ああああ'), [{ text: '漢あ字' }]);
  assert.deepEqual(splitReading('語あ'.repeat(30) + '句', 'あ'.repeat(90) + 'い'), [{ text: '語あ'.repeat(30) + '句' }]);
});

test('lesson sentences preserve punctuation and correctly read inflected verbs', () => {
  const sentence = '昨日、学校へ行きました。放課後、友達と図書館で勉強しました。';
  const segments = segmentText(sentence, entries);
  assert.equal(original(segments), sentence);
  assert.deepEqual(annotated('昨日、学校へ行きました。'), [
    { text: '昨日', reading: 'きのう' }, { text: '学校', reading: 'がっこう' }, { text: '行', reading: 'い' },
  ]);
  assert.deepEqual(annotated('昨日、学校へ行って。'), [
    { text: '昨日', reading: 'きのう' }, { text: '学校', reading: 'がっこう' }, { text: '行', reading: 'い' },
  ]);
});

test('longest biology terms win and unknown compounds stay unchanged', () => {
  assert.deepEqual(annotated('細胞膜は細胞質を分けています。'), [
    { text: '細胞膜', reading: 'さいぼうまく' }, { text: '細胞質', reading: 'さいぼうしつ' }, { text: '分', reading: 'わ' },
  ]);
  assert.deepEqual(annotated('核心・学校法人・未知語・DNA'), []);
});

test('dictionary and custom deck readings are available without altering stored content', () => {
  const deck = [{ term: '経験', reading: 'けいけん' }];
  const before = JSON.stringify(deck);
  const result = segmentText('経験があります。', readingEntries({}, deck));
  assert.deepEqual(result[0], { text: '経験', reading: 'けいけん' });
  assert.equal(original(result), '経験があります。');
  assert.equal(JSON.stringify(deck), before);
});

test('every starter kanji flashcard has a usable, correctly aligned reading', () => {
  for (const card of STARTER_FLASHCARDS.filter(card => /[\p{Script=Han}々]/u.test(card.term))) {
    const result = splitReading(card.term, card.reading);
    assert.equal(original(result), card.term);
    assert.ok(result.some(segment => segment.reading), `Missing reading for ${card.term}`);
    const pronunciation = result.map(segment => segment.reading || segment.text).join('').replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
    assert.equal(pronunciation, card.reading);
  }
});

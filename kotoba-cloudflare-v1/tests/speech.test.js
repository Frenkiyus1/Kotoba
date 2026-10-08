import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/speech.js', import.meta.url), 'utf8');
function setup(overrides = {}) {
  const engines = [], utterances = [], timers = new Map(); let nextTimer = 0;
  class Recognition { constructor() { engines.push(this); } start() {} stop() { this.stopped = true; } abort() { this.aborted = true; } }
  class Utterance { constructor(text) { this.text = text; } }
  const window = {
    KOTOBA_UI_LANGUAGE: 'vi', isSecureContext: true, SpeechRecognition: Recognition, SpeechSynthesisUtterance: Utterance,
    speechSynthesis: { cancel() {}, resume() {}, getVoices() { return [{ lang: 'en-US' }, { lang: 'ja-JP', localService: true }]; }, speak(utterance) { utterances.push(utterance); } },
    ...overrides,
  };
  vm.runInNewContext(source, { window, setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id) });
  const button = () => { const classes = new Set(); return { textContent: 'Micro', attributes: {}, classList: { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); } }, setAttribute(key, value) { this.attributes[key] = value; }, classes }; };
  return { service: window.KotobaSpeech, window, engines, utterances, timers, button };
}
const finalResult = text => ({ results: [Object.assign([{ transcript: text }], { isFinal: true })] });
test('Japanese playback chooses Japanese voice, retains utterance and resets on completion', () => {
  const { service, utterances, button, timers } = setup(); const control = button();
  assert.equal(service.speakJapanese('学校へ行きました。', { button: control }), true);
  assert.equal(utterances[0].voice.lang, 'ja-JP'); assert.equal(utterances[0].lang, 'ja-JP');
  assert.equal(control.attributes['aria-pressed'], 'true');
  utterances[0].onstart(); utterances[0].onend();
  assert.equal(control.attributes['aria-pressed'], 'false'); assert.equal(control.textContent, 'Micro'); assert.equal(timers.size, 0);
});
test('blocked or missing playback voice reports an actionable error and can be retried', () => {
  const { service, utterances, button } = setup(); const control = button(); const errors = [];
  service.speakJapanese('学校', { button: control, onError: (text, code) => errors.push({ text, code }) });
  utterances[0].onerror({ error: 'not-allowed' });
  assert.match(errors[0].text, /bấm nút Nghe/); assert.equal(control.attributes['aria-pressed'], 'false');
  service.speakJapanese('学校', { button: control, onError: (text, code) => errors.push({ text, code }) });
  utterances[1].onerror({ error: 'language-unavailable' }); assert.match(errors[1].text, /giọng đọc tiếng Nhật/);
});
test('canceled speech callbacks cannot clear a newer playback session', () => {
  const { service, utterances, button } = setup(); const a = button(), b = button();
  service.speakJapanese('学校', { button: a }); service.speakJapanese('友達', { button: b });
  utterances[0].onerror({ error: 'interrupted' });
  assert.equal(b.attributes['aria-pressed'], 'true'); assert.equal(a.attributes['aria-pressed'], 'false');
  service.stopSpeaking(); assert.equal(b.attributes['aria-pressed'], 'false');
});
test('recognition accepts one final transcript, ignores late results and aborts microphone', () => {
  const { service, engines, button, timers } = setup(); const transcripts = [], control = button();
  service.listen({ button: control, onTranscript: text => transcripts.push(text) });
  assert.equal(engines[0].lang, 'ja-JP'); engines[0].onresult(finalResult('学校です。')); engines[0].onresult(finalResult('二回目'));
  assert.deepEqual(transcripts, ['学校です。']); assert.equal(engines[0].aborted, true); assert.equal(control.attributes['aria-pressed'], 'false'); assert.equal(timers.size, 0);
});
test('switching microphones or leaving a scenario ignores the old transcript', () => {
  const { service, engines, button } = setup(); const transcript = [];
  service.listen({ button: button(), onTranscript: text => transcript.push(text) });
  service.listen({ button: button(), onTranscript: text => transcript.push(text) });
  engines[0].onresult(finalResult('前の文')); assert.equal(engines[0].aborted, true); assert.deepEqual(transcript, []);
  service.stopListening(); engines[1].onresult(finalResult('古い文')); assert.deepEqual(transcript, []);
});
test('manual microphone stop still accepts its final buffered result', () => {
  const { service, engines, button } = setup(); const control = button(), transcript = [];
  service.listen({ button: control, onTranscript: text => transcript.push(text) }); service.listen({ button: control });
  assert.equal(engines[0].stopped, true); engines[0].onresult(finalResult('こんにちは。')); assert.deepEqual(transcript, ['こんにちは。']);
});
test('microphone permission, hardware, network and no-speech failures reset controls', () => {
  for (const code of ['not-allowed', 'audio-capture', 'network', 'no-speech', 'language-not-supported']) {
    const { service, engines, button } = setup(); const errors = [], control = button();
    service.listen({ button: control, onError: (text, kind) => errors.push({ text, kind }) }); engines[0].onerror({ error: code }); engines[0].onend();
    assert.equal(errors.length, 1); assert.equal(errors[0].kind, code); assert.ok(errors[0].text.length > 20); assert.equal(control.attributes['aria-pressed'], 'false');
  }
});
test('unsupported, insecure and synchronous-start failures remain usable without recording', () => {
  for (const overrides of [{ SpeechRecognition: null }, { isSecureContext: false }, { SpeechRecognition: class { start() { throw new Error('failed'); } abort() {} } }]) {
    const { service, button } = setup(overrides); const errors = [], control = button();
    assert.equal(service.listen({ button: control, onError: text => errors.push(text) }), false);
    assert.equal(errors.length, 1); assert.ok(!control.classes.has('listening'));
  }
});
test('silent recognition and playback are timed out without leaving controls active', () => {
  const { service, timers, button } = setup(); const errors = [], control = button();
  service.listen({ button: control, onError: text => errors.push(text) }); [...timers.values()][0].fn(); assert.equal(control.attributes['aria-pressed'], 'false');
  service.speakJapanese('学校', { button: control, onError: text => errors.push(text) }); [...timers.values()][0].fn(); assert.equal(control.attributes['aria-pressed'], 'false'); assert.equal(errors.length, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentsForPage } from '../public/learning-contents.js';

const publicPage = file => readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');

test('learning contents link only to published pages and valid lesson phase anchors', () => {
  for (const page of ['dashboard', 'roadmap', 'lesson', 'biology', 'biology-lesson', 'review', 'personalized', 'conversation', 'progress', 'guide']) {
    const { links, sections } = contentsForPage(page);
    for (const link of links) {
      assert.match(publicPage(link.href), /<!doctype html>/i);
      assert.equal(link.current, link.href === `${page}.html`);
    }
    for (const section of sections) {
      const source = publicPage(`${page}.html`);
      assert.ok(source.includes(`id="${section.href.slice(1)}"`), `${page} is missing ${section.href}`);
      if (section.phase) assert.ok(source.includes(`data-phase="${section.phase}"`));
    }
    assert.ok(links.every(link => !/lesson-[06789]|#chapter/.test(link.href)));
  }
});

test('guide contents point to the selected language and every actual guide section', () => {
  for (const language of ['vi', 'ja']) {
    const { sections } = contentsForPage('guide', language);
    assert.equal(sections.length, 8);
    assert.equal(new Set(sections.map(section => section.href)).size, 8);
    for (const section of sections) {
      assert.ok(section.href.startsWith(`#${language}-`));
      assert.ok(publicPage('guide.html').includes(`id="${section.href.slice(1)}"`));
    }
  }
  assert.match(contentsForPage('lesson', 'vi').sections[1].label, /Chọn đáp án/);
  assert.match(contentsForPage('lesson', 'ja').sections[1].label, /選ぶ/);
});

test('contents can be regenerated without retaining changes from previous pages', () => {
  const first = contentsForPage('lesson', 'vi');
  first.links[0].label = 'changed';
  first.sections.pop();
  const next = contentsForPage('biology-lesson', 'ja');
  assert.equal(next.sections.length, 3);
  assert.equal(next.links[0].label, '日本語コース');
  assert.ok(next.sections.every(section => section.href.startsWith('#bio')));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPassageRows } from '../web/passage-view.js';
import { advanceSession, createSession, pauseSession, updateInput } from '../web/typing.js';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const helpers = { t: (key) => key, escape, icon: () => '<svg aria-hidden="true"></svg>' };
const article = (text, language = 'zh') => ({ id: 'passage-test', text, language });
const render = (session) => renderPassageRows(session, helpers);
const decodeText = (markup) => markup.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({
  amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
}[entity]));
const sourceTexts = (markup) => [...markup.matchAll(/<div class="source-line"[^>]*>(.*?)<\/div>/g)].map((match) => decodeText(match[1]));
const enteredTexts = (markup) => [...markup.matchAll(/<div class="typed-line rendered-input">(.*?)<\/div>/g)].map((match) => decodeText(match[1]));
const occurrences = (markup, value) => markup.split(value).length - 1;

test('the whole passage is rendered with exactly one editable current row', () => {
  const session = createSession(article('甲乙丙丁戊己'), 2, 0);
  const markup = render(session);
  assert.deepEqual(sourceTexts(markup), session.chunks);
  assert.equal(sourceTexts(markup).join(''), session.article.text);
  assert.equal(occurrences(markup, 'class="passage-row '), 3);
  assert.equal(occurrences(markup, '<textarea '), 1);
  for (const id of ['typing-input', 'source-line', 'typed-line']) {
    assert.equal(occurrences(markup, 'id="' + id + '"'), 1);
  }
  assert.deepEqual(enteredTexts(markup), ['', ''], 'future input lines stay blank');
});

test('a completed line shows its real incorrect input beneath the unchanged original', () => {
  const session = createSession(article('abcd', 'en'), 2, 0);
  updateInput(session, 'ax', 100);
  advanceSession(session, 200);
  const markup = render(session);
  assert.deepEqual(sourceTexts(markup), ['ab', 'cd']);
  assert.deepEqual(enteredTexts(markup), ['ax']);
  assert.ok(markup.includes('<span class="wrong">b</span>'));
  assert.ok(markup.includes('<span class="incorrect">x</span>'));
  assert.equal(occurrences(markup, '<textarea '), 1);
  assert.ok(markup.includes('class="passage-row active" id="passage-row-1"'));
});

test('final review contains every original and actual typed line with no live input', () => {
  const session = createSession(article('你好世界'), 2, 0);
  updateInput(session, '你号', 100);
  advanceSession(session, 200);
  updateInput(session, '世界', 300);
  advanceSession(session, 400);
  const markup = render(session);
  assert.equal(sourceTexts(markup).join(''), '你好世界');
  assert.equal(enteredTexts(markup).join(''), '你号世界');
  assert.equal(occurrences(markup, 'class="passage-row completed"'), 2);
  assert.equal(occurrences(markup, '<textarea '), 0);
  for (const id of ['typing-input', 'source-line', 'typed-line']) {
    assert.equal(occurrences(markup, 'id="' + id + '"'), 0);
  }
});

test('pausing keeps a single active row and resume control without hiding future text', () => {
  const session = createSession(article('甲乙丙丁戊己'), 2, 0);
  updateInput(session, '甲乙', 100);
  advanceSession(session, 200);
  updateInput(session, '丙', 300);
  pauseSession(session, 400);
  const markup = render(session);
  assert.equal(sourceTexts(markup).join(''), session.article.text);
  assert.equal(occurrences(markup, 'class="row-resume"'), 1);
  assert.equal(occurrences(markup, '<textarea '), 1);
  assert.deepEqual(enteredTexts(markup), ['甲乙', '']);
});

test('passage text, incorrect input, language and labels are escaped', () => {
  const session = createSession(article('<>', 'en'), 2, 0);
  updateInput(session, '"&', 100);
  advanceSession(session, 200);
  const markup = render(session);
  assert.deepEqual(sourceTexts(markup), ['<>']);
  assert.deepEqual(enteredTexts(markup), ['"&']);
  assert.ok(markup.includes('&lt;'));
  assert.ok(markup.includes('&gt;'));
  assert.ok(markup.includes('&quot;'));
  assert.ok(markup.includes('&amp;'));
  const active = createSession(article('safe'), 4, 0);
  active.article.language = 'en" onmouseover="bad';
  const hostile = renderPassageRows(active, { ...helpers, t: () => '"><script>bad</script>' });
  assert.ok(!hostile.includes('<script>'));
  assert.ok(!hostile.includes('lang="en" onmouseover='));
  assert.ok(hostile.includes('&lt;script&gt;'));
});

test('English text layers preserve actual spaces so the native caret has the same advances', () => {
  const session = createSession(article('Open the window. Then start.', 'en'), 17, 0);
  updateInput(session, session.chunks[0], 100);
  advanceSession(session, 200);
  const markup = render(session);
  assert.equal(sourceTexts(markup).join(''), session.article.text);
  assert.equal(enteredTexts(markup)[0], session.completedInputs[0]);
  assert.ok(markup.includes('class=" space"> </span>'));
  assert.ok(!markup.includes('·</span>'), 'space dots are painted with CSS, never used as text');
});

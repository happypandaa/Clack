import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSession, commitInputAndAdvance, createSession, elapsed, graphemes, metrics, pauseSession,
  resumeSession, retreatSession, splitText, updateInput,
} from '../web/typing.js';
import { articles } from '../web/articles.js';

const article = (text, language = 'en') => ({ id: 'test', language, text });

test('English chunks retain every space and prefer whole-word boundaries', () => {
  const text = 'A little  practice makes progress. Every day.';
  const chunks = splitText(text, 'en', 15);
  assert.equal(chunks.join(''), text);
  assert.equal(chunks[0], 'A little  ');
  assert.ok(chunks.every((chunk) => graphemes(chunk).length <= 15));
  assert.deepEqual(splitText('abcdefghijkl', 'en', 5), ['abcde', 'fghij', 'kl']);
});

test('bundled English passages never start a new chunk with an invisible space', () => {
  assert.deepEqual(splitText('hello world again', 'en', 11), ['hello ', 'world again']);
  for (const passage of articles.filter((entry) => entry.language === 'en')) {
    for (const limit of [24, 32, 40, 48]) {
      const chunks = splitText(passage.text, passage.language, limit);
      assert.equal(chunks.join(''), passage.text);
      assert.ok(chunks.every((chunk) => graphemes(chunk).length <= limit));
      assert.ok(chunks.every((chunk) => !/^\s/u.test(chunk)), `${passage.id} at ${limit}`);
    }
  }
});

test('graphemes stay intact when chunking or accepting Unicode input', () => {
  const text = '你👨‍👩‍👧‍👦好e\u0301！';
  assert.equal(graphemes(text).length, 5);
  assert.deepEqual(splitText(text, 'zh', 2), ['你👨‍👩‍👧‍👦', '好', 'e\u0301！']);
  const session = createSession(article(text, 'zh'), 40, 0);
  updateInput(session, text, 100);
  assert.equal(session.submitted, 5);
  assert.equal(metrics(session, 60100).speed, 2);
});

test('an IME-style batch commits characters together; empty input does not start the clock', () => {
  const session = createSession(article('你好，世界。', 'zh'), 40, 0);
  updateInput(session, '', 500);
  assert.equal(session.status, 'ready');
  updateInput(session, '你好', 1000);
  assert.equal(session.status, 'running');
  assert.equal(session.startedAt, 1000);
  assert.equal(session.submitted, 2);
  assert.equal(session.correctSubmitted, 2);
  assert.equal(metrics(session, 61000).speed, 2);
});

test('correction preserves previous errors and deletion adds no submissions', () => {
  const session = createSession(article('cat'), 40, 0);
  updateInput(session, 'c', 100);
  updateInput(session, 'cx', 200);
  updateInput(session, 'c', 300);
  assert.equal(session.submitted, 2);
  updateInput(session, 'ca', 400);
  updateInput(session, 'cat', 500);
  assert.equal(session.submitted, 4);
  assert.equal(session.correctSubmitted, 3);
  assert.equal(metrics(session, 60100).accuracy, 75);
  assert.equal(metrics(session, 60100).correctCharacters, 3);
});

test('replacement in the middle scores only newly committed characters', () => {
  const session = createSession(article('the cat'), 40, 0);
  updateInput(session, 'the xat', 10);
  updateInput(session, 'the cat', 100);
  assert.equal(session.submitted, 8);
  assert.equal(session.correctSubmitted, 7);
  updateInput(session, 'the cat', 200);
  assert.equal(session.submitted, 8);
});

test('inserting into a full chunk does not resubmit shifted existing characters', () => {
  const session = createSession(article('abc'), 40, 0);
  updateInput(session, 'abc', 10);
  updateInput(session, 'xabc', 20);
  assert.equal(session.input, 'xab');
  assert.equal(session.submitted, 4);
  assert.equal(session.correctSubmitted, 3);
  assert.equal(metrics(session, 30).accuracy, 75);
  updateInput(session, 'xabc', 40);
  assert.equal(session.submitted, 4, 'input rejected past the chunk boundary is not scored');
});

test('pauses freeze the clock and reject typing, completion freezes the final result', () => {
  const session = createSession(article('hello'), 40, 0);
  updateInput(session, 'he', 1000);
  pauseSession(session, 6000);
  assert.equal(elapsed(session, 100000), 5000);
  updateInput(session, 'hello', 50000);
  assert.equal(session.input, 'he');
  assert.equal(advanceSession(session, 50000), false);
  resumeSession(session, 11000);
  updateInput(session, 'hello', 15000);
  assert.equal(advanceSession(session, 16000), true);
  assert.equal(session.status, 'complete');
  assert.equal(elapsed(session, 999999), 10000);
  assert.equal(metrics(session, 999999).speed, 6);
  assert.equal(metrics(session, 999999).progress, 100);
  updateInput(session, 'other', 1000000);
  resumeSession(session, 1000000);
  assert.equal(session.status, 'complete');
  assert.equal(advanceSession(session, 1000001), false);
});

test('Enter requires a full chunk, carries final correct characters across chunks', () => {
  const session = createSession(article('abc def'), 4, 0);
  updateInput(session, 'ab', 100);
  assert.equal(advanceSession(session, 200), false);
  updateInput(session, 'abx ', 300);
  assert.equal(advanceSession(session, 400), true);
  assert.equal(session.index, 1);
  assert.equal(session.input, '');
  assert.deepEqual(session.completedInputs, ['abx ']);
  updateInput(session, 'def', 500);
  assert.equal(advanceSession(session, 60100), true);
  const result = metrics(session, 999999);
  assert.equal(result.typedCharacters, 7);
  assert.equal(result.correctCharacters, 6);
  assert.equal(result.speed, 1.2);
  assert.equal(result.progress, 100);
  assert.deepEqual(session.completedInputs, ['abx ', 'def']);
});

test('completed input rows preserve errors while later rows are edited or paused', () => {
  const session = createSession(article('你好世界朋友', 'zh'), 2, 0);
  assert.deepEqual(session.completedInputs, []);
  updateInput(session, '你号', 100);
  assert.equal(advanceSession(session, 200), true);
  assert.deepEqual(session.completedInputs, ['你号']);
  updateInput(session, '世', 300);
  assert.equal(advanceSession(session, 400), false);
  pauseSession(session, 500);
  updateInput(session, '世界', 600);
  assert.deepEqual(session.completedInputs, ['你号']);
  assert.equal(session.input, '世');
  resumeSession(session, 1000);
  updateInput(session, '世界', 1100);
  assert.equal(advanceSession(session, 1200), true);
  assert.deepEqual(session.completedInputs, ['你号', '世界']);
  updateInput(session, '朋友', 1300);
  assert.equal(advanceSession(session, 1500), true);
  assert.equal(session.status, 'complete');
  assert.deepEqual(session.completedInputs, ['你号', '世界', '朋友']);
  assert.equal(session.completedInputs.join(''), '你号世界朋友');
  assert.equal(metrics(session, 100000).correctCharacters, 5);
  assert.equal(metrics(session, 100000).typedCharacters, 6);
  assert.equal(metrics(session, 100000).elapsedMs, 900);
  assert.equal(advanceSession(session, 100100), false);
  assert.deepEqual(session.completedInputs, ['你号', '世界', '朋友']);
});

test('input is bounded by grapheme length and an empty article is complete', () => {
  const session = createSession(article('猫狗', 'zh'), 40, 0);
  updateInput(session, '猫狗多', 100);
  assert.equal(session.input, '猫狗');
  assert.equal(session.submitted, 2);
  const empty = createSession(article(''), 40, 0);
  assert.equal(empty.status, 'complete');
  assert.equal(metrics(empty, 1000).progress, 100);
  assert.equal(metrics(empty, 1000).speed, 0);
});

test('continuous English input advances full rows without Enter', () => {
  const session = createSession(article('hello world'), 6, 0);
  let advanced = 0;
  for (const [index, char] of graphemes(session.article.text).entries()) {
    const result = commitInputAndAdvance(session, session.input + char, 100 + index * 100);
    advanced += result.advanced;
  }
  assert.equal(advanced, 2);
  assert.equal(session.status, 'complete');
  assert.deepEqual(session.completedInputs, ['hello ', 'world']);
  assert.equal(session.submitted, 11);
  assert.equal(session.correctSubmitted, 11);
  assert.equal(metrics(session, 99999).elapsedMs, 1000);
});

test('a Chinese batch crossing rows preserves its remainder on the next active row', () => {
  const session = createSession(article('你好世界朋友', 'zh'), 2, 0);
  commitInputAndAdvance(session, '你', 100);
  assert.deepEqual(commitInputAndAdvance(session, '你好世界朋', 200), { advanced: 2, completed: false });
  assert.deepEqual(session.completedInputs, ['你好', '世界']);
  assert.equal(session.input, '朋');
  assert.equal(session.index, 2);
  assert.equal(session.submitted, 5);
  assert.equal(session.correctSubmitted, 5);
  assert.deepEqual(commitInputAndAdvance(session, '朋友', 300), { advanced: 1, completed: true });
  assert.equal(session.completedInputs.join(''), session.article.text);
  assert.equal(session.submitted, 6);
});

test('one batch can finish multiple Unicode rows without splitting graphemes or counting excess text', () => {
  const text = '你👨‍👩‍👧‍👦好e\u0301世界！';
  const session = createSession(article(text, 'zh'), 2, 0);
  const result = commitInputAndAdvance(session, text + '多余', 100);
  assert.deepEqual(result, { advanced: 4, completed: true });
  assert.equal(session.completedInputs.join(''), text);
  assert.deepEqual(session.completedInputs, ['你👨‍👩‍👧‍👦', '好e\u0301', '世', '界！']);
  assert.equal(session.submitted, 7);
  assert.equal(session.correctSubmitted, 7);
  assert.equal(metrics(session, 100000).elapsedMs, 0);
  const snapshot = structuredClone(session);
  assert.deepEqual(commitInputAndAdvance(session, '更多', 200000), { advanced: 0, completed: true });
  assert.deepEqual(session, snapshot);
});

test('automatic advancement retains earlier errors after backspace and correction', () => {
  const session = createSession(article('cat dog'), 4, 0);
  for (const [index, value] of ['c', 'cx', 'c', 'ca', 'cat '].entries()) {
    commitInputAndAdvance(session, value, 100 + index * 100);
  }
  assert.deepEqual(session.completedInputs, ['cat ']);
  assert.equal(session.submitted, 5);
  assert.equal(session.correctSubmitted, 4);
  assert.equal(metrics(session, 600).accuracy, 80);
  commitInputAndAdvance(session, 'dog', 700);
  assert.equal(session.status, 'complete');
  assert.equal(session.submitted, 8);
  assert.equal(session.correctSubmitted, 7);
  assert.equal(metrics(session, 100000).accuracy, 87.5);
});

test('paused automatic input does nothing and resumed completion excludes the pause', () => {
  const session = createSession(article('你好世界', 'zh'), 2, 0);
  commitInputAndAdvance(session, '你', 100);
  pauseSession(session, 400);
  const snapshot = structuredClone(session);
  assert.deepEqual(commitInputAndAdvance(session, '你好世界', 10000), { advanced: 0, completed: false });
  assert.deepEqual(session, snapshot);
  resumeSession(session, 10400);
  assert.deepEqual(commitInputAndAdvance(session, '你好世界', 10800), { advanced: 2, completed: true });
  assert.equal(metrics(session, 99999).elapsedMs, 700);
});

test('unfinished edits stay on their row and shifted old text is not submitted twice', () => {
  const session = createSession(article('abcdef'), 3, 0);
  assert.deepEqual(commitInputAndAdvance(session, 'ab', 100), { advanced: 0, completed: false });
  assert.deepEqual(commitInputAndAdvance(session, 'a', 200), { advanced: 0, completed: false });
  assert.deepEqual(commitInputAndAdvance(session, 'ab', 300), { advanced: 0, completed: false });
  assert.equal(session.index, 0);
  assert.deepEqual(commitInputAndAdvance(session, 'xxab', 400), { advanced: 1, completed: false });
  assert.deepEqual(session.completedInputs, ['xxa']);
  assert.equal(session.input, 'b');
  assert.equal(session.submitted, 5, 'three prior submissions plus the two new inserted characters');
  assert.equal(session.correctSubmitted, 3);
});

test('Chinese rows break after punctuation and never start with a closing mark', () => {
  const text = '早上好。推开窗，清新的空气来到身边。给自己倒一杯温水，整理好桌面，再坐下来开始今天的练习。';
  const chunks = splitText(text, 'zh', 24);
  assert.equal(chunks.join(''), text);
  assert.deepEqual(chunks, ['早上好。推开窗，清新的空气来到身边。', '给自己倒一杯温水，整理好桌面，', '再坐下来开始今天的练习。']);
  assert.deepEqual(splitText('甲乙丙丁戊，己', 'zh', 5), ['甲乙丙丁', '戊，己']);
  assert.deepEqual(splitText('甲乙丙“丁戊己', 'zh', 4), ['甲乙丙', '“丁戊己']);
  for (const passage of articles.filter((entry) => entry.language === 'zh')) {
    for (const limit of [12, 18, 24, 32]) {
      const chunks = splitText(passage.text, passage.language, limit);
      assert.equal(chunks.join(''), passage.text);
      assert.ok(chunks.every((chunk) => [...chunk].length <= limit), `${passage.id} at ${limit}`);
      assert.ok(chunks.slice(1).every((chunk) => !/^[，。、；：！？”’）》」]/u.test(chunk)), `${passage.id} at ${limit}`);
    }
  }
});

test('backspace at the start of a row reopens the previous row without its last character', () => {
  const session = createSession(article('甲乙丙丁', 'zh'), 2, 0);
  assert.equal(retreatSession(session), false, 'nothing to go back to before typing');
  commitInputAndAdvance(session, '甲乙', 100);
  assert.equal(session.index, 1);
  assert.equal(retreatSession(session), true);
  assert.equal(session.index, 0);
  assert.equal(session.input, '甲');
  assert.deepEqual(session.completedInputs, []);
  assert.equal(metrics(session, 200).typedCharacters, 1);
  assert.equal(metrics(session, 200).correctCharacters, 1);
  commitInputAndAdvance(session, '甲乙', 300);
  commitInputAndAdvance(session, '丙丁', 400);
  assert.equal(session.status, 'complete');
  const m = metrics(session, 400);
  assert.equal(m.typedCharacters, 4);
  assert.equal(m.correctCharacters, 4);
  assert.equal(m.progress, 100);
  assert.equal(session.submitted, 5, 'retyped 乙 is a new submission');
});

test('going back is refused while the row has text, while paused, and after completion', () => {
  const session = createSession(article('ab', 'en'), 1, 0);
  commitInputAndAdvance(session, 'a', 100);
  updateInput(session, 'x', 150);
  assert.equal(retreatSession(session), false);
  updateInput(session, '', 160);
  pauseSession(session, 170);
  assert.equal(retreatSession(session), false);
  resumeSession(session, 180);
  assert.equal(retreatSession(session), true);
  assert.equal(session.input, '');
});

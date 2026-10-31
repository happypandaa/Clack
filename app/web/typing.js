// The typing model has no DOM or storage dependencies. Times use a monotonic
// clock so pauses and wall-clock changes do not affect a practice result.
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

export function graphemes(text) {
  const value = String(text ?? '');
  return segmenter
    ? Array.from(segmenter.segment(value), (part) => part.segment)
    : Array.from(value);
}

export function splitText(text, language, maxLength = 40) {
  const characters = graphemes(text);
  const limit = Number.isFinite(maxLength) ? Math.max(1, Math.floor(maxLength)) : 40;
  const chunks = [];
  let offset = 0;
  while (offset < characters.length) {
    let end = Math.min(offset + limit, characters.length);
    if (language === 'en' && end < characters.length) {
      // Keep the separator in the preceding chunk: joining the chunks always
      // restores the original, including repeated spaces and punctuation.
      for (let position = end - 1; position > offset; position -= 1) {
        if (/\s/u.test(characters[position])) {
          end = position + 1;
          break;
        }
      }
    }
    chunks.push(characters.slice(offset, end).join(''));
    offset = end;
  }
  return chunks;
}

export function createSession(article, maxLength = 40, now = performance.now()) {
  const chunks = splitText(article.text, article.language, maxLength);
  return {
    article,
    chunks,
    index: 0,
    input: '',
    completedInputs: [],
    status: chunks.length ? 'ready' : 'complete',
    elapsedMs: 0,
    startedAt: null,
    createdAt: now,
    submitted: 0,
    correctSubmitted: 0,
    completedCharacters: 0,
    completedCorrectCharacters: 0,
    completedSpeedCharacters: 0,
    completedTypedCharacters: 0,
    totalCharacters: graphemes(article.text).length,
  };
}

export function elapsed(session, now = performance.now()) {
  const current = session.status === 'running' && session.startedAt !== null
    ? Math.max(0, now - session.startedAt)
    : 0;
  return session.elapsedMs + current;
}

export function resumeSession(session, now = performance.now()) {
  if (session.status === 'ready' || session.status === 'paused') {
    session.startedAt = now;
    session.status = 'running';
  }
  return session;
}

export const startSession = resumeSession;

export function pauseSession(session, now = performance.now()) {
  if (session.status === 'running') {
    session.elapsedMs = elapsed(session, now);
    session.startedAt = null;
    session.status = 'paused';
  }
  return session;
}

export function updateInput(session, newValue, now = performance.now()) {
  if (session.status === 'paused' || session.status === 'complete') return session;
  const target = graphemes(session.chunks[session.index] ?? '');
  const previous = graphemes(session.input);
  const incoming = graphemes(newValue);
  const next = incoming.slice(0, target.length);
  if (session.status === 'ready' && next.length) resumeSession(session, now);

  let prefix = 0;
  while (prefix < previous.length && prefix < incoming.length && previous[prefix] === incoming[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < previous.length - prefix && suffix < incoming.length - prefix &&
    previous[previous.length - 1 - suffix] === incoming[incoming.length - 1 - suffix]
  ) suffix += 1;

  // Diff the unbounded browser value first: inserting in the middle of a full
  // chunk shifts existing characters and clips its tail, but only the actual
  // insertion is a new submission. Characters clipped past the end do not count.
  for (let position = prefix; position < Math.min(incoming.length - suffix, next.length); position += 1) {
    session.submitted += 1;
    if (next[position] === target[position]) session.correctSubmitted += 1;
  }
  session.input = next.join('');
  return session;
}

function currentCounts(session) {
  const target = graphemes(session.chunks[session.index] ?? '');
  const input = graphemes(session.input);
  let correct = 0;
  let speedCharacters = 0;
  for (let position = 0; position < input.length; position += 1) {
    if (input[position] !== target[position]) continue;
    correct += 1;
    if (session.article.language !== 'zh' || /\p{Script=Han}/u.test(input[position])) {
      speedCharacters += 1;
    }
  }
  return { correct, speedCharacters, typed: input.length, target: target.length };
}

export function advanceSession(session, now = performance.now()) {
  if (session.status !== 'running') return false;
  const counts = currentCounts(session);
  if (counts.typed !== counts.target) return false;
  session.completedCharacters += counts.target;
  session.completedCorrectCharacters += counts.correct;
  session.completedSpeedCharacters += counts.speedCharacters;
  session.completedTypedCharacters += counts.typed;
  session.completedInputs.push(session.input);
  session.index += 1;
  session.input = '';
  if (session.index >= session.chunks.length) {
    session.elapsedMs = elapsed(session, now);
    session.startedAt = null;
    session.status = 'complete';
  }
  return true;
}

export function commitInputAndAdvance(session, newValue, now = performance.now()) {
  if (session.status === 'paused' || session.status === 'complete') {
    return { advanced: 0, completed: session.status === 'complete' };
  }
  const previous = graphemes(session.input);
  const incoming = graphemes(newValue);
  const remainingTarget = graphemes(session.chunks.slice(session.index).join(''));
  const submittedBefore = session.submitted;
  const correctBefore = session.correctSubmitted;

  // Identify the new submission once for the entire browser value. If an edit
  // pushes an existing suffix onto the next row, those moved characters must
  // not become new submissions merely because the row boundary changed.
  let prefix = 0;
  while (prefix < previous.length && prefix < incoming.length && previous[prefix] === incoming[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previous.length - prefix && suffix < incoming.length - prefix &&
    previous[previous.length - 1 - suffix] === incoming[incoming.length - 1 - suffix]
  ) suffix += 1;

  let advanced = 0;
  let offset = 0;
  do {
    const length = graphemes(session.chunks[session.index]).length;
    updateInput(session, incoming.slice(offset, offset + length).join(''), now);
    if (graphemes(session.input).length !== length || !advanceSession(session, now)) break;
    advanced += 1;
    offset += length;
  } while (session.status !== 'complete' && offset < incoming.length);

  // updateInput handles each row's normal state changes. Restore the batch's
  // single diff for cumulative accuracy; text beyond the article is ignored.
  session.submitted = submittedBefore;
  session.correctSubmitted = correctBefore;
  const submittedEnd = Math.min(incoming.length - suffix, remainingTarget.length);
  for (let position = prefix; position < submittedEnd; position += 1) {
    session.submitted += 1;
    if (incoming[position] === remainingTarget[position]) session.correctSubmitted += 1;
  }
  return { advanced, completed: session.status === 'complete' };
}

export function metrics(session, now = performance.now()) {
  const counts = currentCounts(session);
  const elapsedMs = elapsed(session, now);
  const speedCharacters = session.completedSpeedCharacters + counts.speedCharacters;
  const minutes = elapsedMs / 60000;
  return {
    elapsedMs,
    speed: minutes > 0 ? speedCharacters / (session.article.language === 'zh' ? 1 : 5) / minutes : 0,
    accuracy: session.submitted ? session.correctSubmitted / session.submitted * 100 : 100,
    progress: session.totalCharacters
      ? Math.min(100, (session.completedCharacters + counts.typed) / session.totalCharacters * 100)
      : 100,
    correctCharacters: session.completedCorrectCharacters + counts.correct,
    typedCharacters: session.completedTypedCharacters + counts.typed,
    totalCharacters: session.totalCharacters,
  };
}

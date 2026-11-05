import { graphemes } from './typing.js';

// Full-width characters (CJK, full-width punctuation, emoji) take a 1em cell,
// everything else a 1ch cell. In Chinese passages every non-ASCII character
// counts as full width, so marks such as “ ” — … line up with Han characters.
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3fffd}]|\p{Extended_Pictographic}/u;
const OPENING = /^[“‘《（「『【〔]$/u;

export function cellWidth(char, language) {
  return WIDE.test(char) || (language === 'zh' && !/^[\x00-\x7f]$/.test(char)) ? 'w' : 'n';
}

// One fixed-width span per grapheme. The width always comes from the ORIGINAL
// character in that column, so the input stays aligned with the passage even
// when a mistyped character would naturally be wider or narrower.
export function cellSpans(chars, target, language, statusAt, escape) {
  return chars.map((char, index) => {
    const model = target[index] ?? char;
    const status = statusAt(index, char);
    return '<span class="c ' + cellWidth(model, language) + (OPENING.test(model) ? ' o' : '') + (char === ' ' ? ' space' : '') + (status ? ' ' + status : '') + '">' + escape(char) + '</span>';
  }).join('');
}

// Pure markup for every original/input pair. Only the active row owns a real
// input; completed rows show what was actually typed, including any mistakes.
export function renderPassageRows(session, { t, escape: e, icon }) {
  const language = session.article.language;

  function errorCount(target, entered) {
    const expected = graphemes(target);
    return graphemes(entered).reduce((sum, char, index) => sum + (char === expected[index] ? 0 : 1), 0);
  }

  return session.chunks.map((target, index) => {
    const active = session.status !== 'complete' && index === session.index;
    const done = index < session.index;
    const entered = done ? session.completedInputs[index] : active ? session.input : '';
    const status = done ? 'completed' : active ? 'active' : 'upcoming';
    const expected = graphemes(target);
    const actual = graphemes(entered);
    const errors = done ? errorCount(target, entered) : 0;
    const label = active ? t('lineActive') : done ? (errors ? t('lineErrors').replace('{count}', String(errors)) : t('lineDone')) : t('lineWaiting');
    const source = cellSpans(expected, expected, language, (position, char) => (position < actual.length ? (char === actual[position] ? 'done' : 'wrong') : ''), e);
    const typed = cellSpans(actual, expected, language, (position, char) => (char === expected[position] ? 'correct' : 'incorrect'), e);
    return '<div class="passage-row ' + status + (errors ? ' has-errors' : '') + '" id="passage-row-' + index + '" data-line="' + index + '"' + (active ? ' data-action="focus-input"' : '') + '>'
      + '<span class="row-number" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span>'
      + '<div class="row-content">'
      + '<div class="row-meta' + (errors ? ' has-errors' : '') + '"><span>' + e(label) + '</span>'
      + (active && session.status === 'paused' ? '<button class="row-resume" data-action="pause">' + icon('play') + e(t('resume')) + '</button>' : '')
      + '</div>'
      + '<div class="source-line"' + (active ? ' id="source-line"' : '') + ' lang="' + e(language) + '">' + source + '</div>'
      + '<div class="input-layer">'
      + (active
        ? '<div class="typed-line" id="typed-line" aria-hidden="true"></div><textarea class="typing-input" id="typing-input" rows="1" wrap="off" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" enterkeyhint="next" aria-label="' + e(t('inputLabel') + ' · ' + (index + 1)) + '" aria-describedby="typing-hint"></textarea>'
        : '<div class="typed-line rendered-input">' + typed + '</div>')
      + '</div></div></div>';
  }).join('');
}

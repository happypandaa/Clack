import { graphemes } from './typing.js';

// Pure markup for every original/input pair. Only the active row owns a real
// input; completed rows show what was actually typed, including any mistakes.
export function renderPassageRows(session, { t, escape: e, icon }) {
  function lineCharacters(target, entered, source = false) {
    const expected = graphemes(target);
    const actual = graphemes(entered);
    return graphemes(source ? target : entered).map((char, index) => {
      const given = actual[index];
      const status = source
        ? (index < actual.length ? (char === given ? 'done' : 'wrong') : '')
        : (char === expected[index] ? 'correct' : 'incorrect');
      return '<span class="' + status + (char === ' ' ? ' space' : '') + '">' + e(char) + '</span>';
    }).join('');
  }

  return session.chunks.map((target, index) => {
    const active = session.status !== 'complete' && index === session.index;
    const done = index < session.index;
    const entered = done ? session.completedInputs[index] : active ? session.input : '';
    const status = done ? 'completed' : active ? 'active' : 'upcoming';
    return '<div class="passage-row ' + status + '" id="passage-row-' + index + '" data-line="' + index + '"' + (active ? ' data-action="focus-input"' : '') + '><span class="row-number" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span><div class="row-content"><div class="row-meta"><span>' + e(t(active ? 'lineActive' : done ? 'lineDone' : 'lineWaiting')) + '</span>' + (active && session.status === 'paused' ? '<button class="row-resume" data-action="pause">' + icon('play') + e(t('resume')) + '</button>' : '') + '</div><div class="source-line"' + (active ? ' id="source-line"' : '') + ' lang="' + e(session.article.language) + '">' + lineCharacters(target, entered, true) + '</div><div class="input-layer">' + (active ? '<div class="typed-line" id="typed-line" aria-hidden="true"></div><textarea class="typing-input" id="typing-input" rows="1" wrap="off" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" enterkeyhint="next" aria-label="' + e(t('inputLabel') + ' · ' + (index + 1)) + '" aria-describedby="typing-hint"></textarea>' : '<div class="typed-line rendered-input">' + lineCharacters(target, entered) + '</div>') + '</div></div></div>';
  }).join('');
}

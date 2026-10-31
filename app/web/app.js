import { renderPassageRows } from './passage-view.js';
import { articles } from './articles.js';
import { createSession, commitInputAndAdvance, resumeSession, pauseSession, metrics, graphemes } from './typing.js';
import { loadState, saveSettings, saveRecord, importRecords, exportState, storageMode, subscribeStorage } from './storage.js';

const paths = {
  key: '<rect x="3" y="3" width="18" height="17" rx="4"/><path d="M8 8v6h8m-3-3 3 3-3 3"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  leaf: '<path d="M20 3C10 2 3 6 5 14s16 9 15-11ZM4 21 16 9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  coffee: '<path d="M4 8h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Zm13 1h2a3 3 0 0 1 0 6h-2M8 2v2m5-2v2M2 22h19"/>',
  idea: '<path d="M8 16c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7ZM9 20h6m-5 3h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 8M3 3v7h7"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  speed: '<path d="M4 19a10 10 0 1 1 16 0M12 13l5-6M5 12h2M7 6l1 2m11 4h-2"/><circle cx="12" cy="14" r="2"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-5 1h10"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
};
function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.book) + '</svg>'; }
const copy = {
  practice: ['文章练习', 'Practice'], history: ['练习记录', 'History'], workspace: ['我的练习室', 'MY WORKSPACE'],
  tagline: ['让文字有节奏', 'FIND YOUR RHYTHM'], sideNote: ['慢一点，也没关系。<br>每一次敲击，都在进步。', 'Take your time.<br>Every keystroke counts.'],
  local: ['本地练习', 'Local practice'], currentLang: ['简体中文', 'English'], switchLang: ['Switch to English', '切换为中文'],
  pageTitle: ['给思绪一点节奏。', 'Find your own rhythm.'],
  pageDesc: ['选一篇喜欢的文字，让指尖慢慢跟上心里的节奏。', 'Pick a passage you like. Give your thoughts a little room to flow.'],
  smallHabit: ['一个小习惯，一点小进步', 'A small habit. A little progress.'], welcomePill: ['每日练习', 'YOUR DAILY MOMENT'],
  welcomeTitle: ['不必很快，先从容开始。', 'No rush. Just a fresh start.'],
  welcomeDesc: ['几分钟的专注，一段文字的距离。<br>把每个字打好，进步就会悄悄发生。', 'A few focused minutes. One passage at a time.<br>Progress comes with every careful keystroke.'],
  today: ['今日已练习', 'Practice today'], sessionsUnit: ['次', 'sessions'], todayEmpty: ['第一段练习，正等着你。', 'Your first passage is waiting.'],
  todayDone: ['每天一小步，节奏刚刚好。', 'A small step makes a good day.'],
  zh: ['中文', 'Chinese'], en: ['英文', 'English'], search: ['搜索文章…', 'Find a passage…'],
  all: ['全部文章', 'All passages'], daily: ['日常生活', 'Everyday'], nature: ['自然片刻', 'Nature'], thoughts: ['一点思考', 'Reflections'],
  passages: ['篇文章', 'passages'], easy: ['轻松入门', 'Easy'], medium: ['进阶练习', 'Medium'], chars: ['字', 'chars'], words: ['词', 'words'],
  minute: ['分钟', 'min'], footer: ['只管专注，进步会发生。', 'Stay present. Progress will follow.'],
  shortcut: ['选择文章，开始练习', 'choose a passage to begin'], noResults: ['没有找到这篇文章', 'No passages found'],
  noResultsDesc: ['试试其他关键词，或看看全部文章。', 'Try another search or explore all passages.'],
  resetFilters: ['查看全部文章', 'Show all passages'], back: ['返回文章', 'Back to passages'], typingEyebrow: ['ONE LINE AT A TIME', 'ONE LINE AT A TIME'],
  typingDesc: ['跟着全文自然输入，打满一行会自动接着下一行。', 'Keep typing naturally. Each completed line flows into the next.'], pause: ['暂停', 'Pause'], resume: ['继续练习', 'Resume'],
  restart: ['重新开始', 'Start over'], speed: ['打字速度', 'Typing speed'], accuracy: ['准确率', 'Accuracy'], elapsed: ['练习用时', 'Time elapsed'],
  progress: ['完成进度', 'Progress'], cpm: ['字/分钟', 'chars/min'], wpm: ['WPM', 'WPM'], original: ['原文', 'PASSAGE'],
  yourInput: ['你的输入', 'YOUR INPUT'], inputPlaceholder: ['在原文下方输入，开始练习…', 'Type below the passage to begin…'],
  inputLabel: ['输入与上方原文相同的文字', 'Type the passage shown above'],
  inputHint: ['中文请使用中文标点', 'Match punctuation and letter case'], englishHint: ['区分大小写，· 代表空格', 'Case sensitive. A dot marks a space.'],
  next: ['下一行', 'Next line'], finish: ['完成练习', 'Finish'], nextHint: ['输入满后，按 Enter 继续', 'Fill this line, then press Enter'],
  section: ['行', 'lines'], of: ['/', '/'], correct: ['输入正确', 'Correct'], incorrect: ['需要留意', 'Incorrect'], waiting: ['等待输入', 'Up next'],
  paused: ['休息一下，再继续。', 'Take a breath.'], pausedDesc: ['已暂停计时，你的进度已保留。', 'The clock is paused. Your place is saved.'],
  rulesZh: ['速度仅计算正确汉字；标点参与校验。退格修正保留此前的错误记录。', 'Chinese speed counts correct Han characters. Punctuation is checked. Corrections retain earlier errors.'],
  rulesEn: ['每 5 个正确字符折算 1 词，包含空格和标点。退格修正保留此前的错误记录。', 'Five correct characters equal one word, including spaces and punctuation. Corrections retain earlier errors.'],
  resultTitle: ['又完成了一点进步。', 'A little better than before.'],
  resultDesc: ['这段专注的时间，值得为自己记上一笔。', 'A moment of focus, and a step worth keeping.'],
  again: ['再练一次', 'Try again'], chooseAnother: ['换一篇文章', 'Choose another'], viewHistory: ['查看记录', 'View history'],
  saving: ['正在保存这次进步…', 'Saving your progress…'], saved: ['本次练习已保存', 'Practice saved'],
  saveFailed: ['记录保存失败，请重试；当前成绩仍保留在本页。', 'Could not save. Your result is still here; please try again.'],
  retry: ['重试保存', 'Try saving again'], historyTitle: ['看得见的，一点点进步。', 'Your progress, one step at a time.'],
  historyDesc: ['每一段专注，都在这里留下足迹。中英文成绩分别统计。', 'Every focused moment leaves a mark. Chinese and English stats are kept separate.'],
  export: ['导出记录', 'Export'], import: ['导入记录', 'Import'], totalSessions: ['累计练习', 'Sessions'], totalTime: ['累计用时', 'Practice time'],
  bestSpeed: ['最高速度', 'Best speed'], avgAccuracy: ['平均准确率', 'Avg. accuracy'], recordArticle: ['练习文章', 'Passage'],
  recordTime: ['完成时间', 'Completed'], recordDuration: ['用时', 'Time'], recordAction: ['再练一遍', 'Practice again'],
  historyEmpty: ['你的第一份进步，值得期待。', 'Your first step starts here.'],
  historyEmptyDesc: ['完成一篇文章，这里就会留下你的练习记录。', 'Finish a passage to start your practice history.'],
  startPractice: ['去练习', 'Find a passage'], platformStorage: ['记录保存在平台数据库中，关闭应用后仍会保留。', 'Your history is stored in the platform database and stays after you close the app.'],
  browserStorage: ['当前为浏览器预览，记录仅保存在此浏览器。平台内使用时将保存到项目数据库。', 'Browser preview: history is kept in this browser. In the platform, it is saved in the project database.'],
  unavailableStorage: ['暂时无法连接平台数据库。可以继续练习，完成后可重试保存。', 'The project database is unavailable. You can practice and retry saving your result.'],
  memoryStorage: ['当前浏览器禁止本地存储，关闭页面后记录不会保留。请导出记录备份。', 'Local storage is blocked. Export your history before closing this page.'],
  pasteBlocked: ['练习区不支持粘贴，试着亲手打出这段文字。', 'Typing is the practice. Paste is disabled here.'],
  waitLine: ['先完成当前这一行，再按 Enter。', 'Finish the current line before pressing Enter.'],
  overflow: ['多出的文字已保留，进入下一行时会接着填入。', 'Extra characters will carry over to the next line.'],
  imported: ['记录已导入，重复记录自动跳过。', 'History imported. Existing entries were kept.'], invalidImport: ['无法导入，请选择 Clack 导出的有效 JSON 记录文件。', 'Choose a valid JSON history file exported by Clack.'],
  emptyExport: ['还没有练习记录，先完成一次练习吧。', 'Finish a passage before exporting your history.'],
  settingsFailed: ['偏好暂未保存，本次切换仍然生效。', 'Your preference changed but could not be saved.'],
  reloadRequired: ['项目已更新，请重新打开应用后继续。', 'The project was updated. Reopen the app to continue.'],
  pendingResults: ['有 {count} 次练习尚未保存，成绩暂时保留在本页。', '{count} practice result(s) are waiting to be saved. Keep this page open.'],
  retryPending: ['重试保存待存成绩', 'Save pending results'],
  reload: ['重新加载', 'Reload app'],
  reloadWarning: ['项目已更新。重新加载会结束当前练习；尚未保存的成绩请先导出。', 'An update is ready. Reloading ends this practice; export any unsaved results first.'],
  articleLayout: ['全文跟打 · 每行原文下方输入', 'FULL PASSAGE · TYPE BELOW EACH LINE'],
  enterLine: ['已开启自动换行 · 中文选字上屏后校验', 'Auto advance is on. Text is checked after composition.'],
  lineActive: ['正在输入', 'Current line'], lineDone: ['已完成', 'Completed'], lineWaiting: ['等待输入', 'Up next'],
  importFailed: ['记录未能导入，请检查文件大小和数据库连接后重试。', 'Import failed. Check the file size and database connection, then try again.'],
};
let state = await loadState();
let ui = state.settings.uiLanguage;
let articleLanguage = state.settings.articleLanguage;
let view = 'articles';
let category = 'all';
let search = '';
let session = null;
let composing = false;
let resultRecord = null;
let savingStatus = '';
const pendingResults = new Map();
let needsReload = false;
let toastTimer;
const app = document.querySelector('#app');
function t(key) { return copy[key]?.[ui === 'en' ? 1 : 0] ?? key; }
function e(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function n(value, digits = 0) { return Number(value).toLocaleString(ui === 'en' ? 'en-US' : 'zh-CN', { maximumFractionDigits: digits }); }
function duration(ms) { const seconds = Math.floor(ms / 1000); return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
function unit(lang = articleLanguage) { return t(lang === 'zh' ? 'cpm' : 'wpm'); }
function toast(key) { const node = document.querySelector('#toast'); node.textContent = t(key); node.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 3500); }
function recordsFor(lang) { return state.records.filter((record) => record.language === lang).sort((a, b) => b.completedAt.localeCompare(a.completedAt)); }
function todayRecords() { const today = new Date().toLocaleDateString('en-CA'); return state.records.filter((record) => new Date(record.completedAt).toLocaleDateString('en-CA') === today); }
function countText(article) { return article.language === 'en' ? article.text.trim().split(/\s+/).length : graphemes(article.text).length; }
function tabs() {
  return '<div class="language-tabs" role="tablist" aria-label="' + e(t('practice')) + '">' + ['zh', 'en'].map((lang) =>
    '<button class="language-tab ' + (articleLanguage === lang ? 'active' : '') + '" role="tab" aria-selected="' + (articleLanguage === lang) + '" data-action="article-language" data-language="' + lang + '">' + t(lang) + '<span class="tab-count">' + (view === 'history' ? recordsFor(lang).length : articles.filter((article) => article.language === lang).length) + '</span></button>').join('') + '</div>';
}
function footer() { return '<footer class="page-footer"><span>' + t('footer') + '</span><span class="footer-shortcut"><kbd>↵</kbd> ' + t('shortcut') + '</span><span>MADE FOR YOUR MOMENT OF FOCUS</span></footer>'; }
function keyboardArt() {
  let keys = '';
  for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) {
    const x = 18 + col * 20 + (row === 1 ? 4 : 0);
    const y = 15 + row * 21;
    const fill = row === 1 && col === 3 ? '#a3b48e' : '#fafbf3';
    keys += '<rect x="' + x + '" y="' + y + '" width="16" height="16" rx="3" fill="' + fill + '" stroke="#d6deca" stroke-width=".8"/>';
    if (row === 1 && col === 3) keys += '<path d="m' + (x + 4) + ' ' + (y + 8) + ' 3 3 5-6" fill="none" stroke="#fff" stroke-width="1.1"/>';
  }
  return '<svg class="keyboard-art" viewBox="0 0 225 125" fill="none" aria-hidden="true"><rect x="2" y="4" width="218" height="105" rx="13" fill="#dfe7d2"/><rect x="2" y="0" width="218" height="103" rx="13" fill="#e9eddf" stroke="#d4dec5"/>' + keys + '<rect x="61" y="78" width="97" height="14" rx="3" fill="#fafbf3" stroke="#d6deca"/><rect x="18" y="78" width="34" height="14" rx="3" fill="#f7f9ef" stroke="#d6deca"/><rect x="167" y="78" width="34" height="14" rx="3" fill="#f7f9ef" stroke="#d6deca"/></svg>';
}
function shell(content) {
  const historyActive = view === 'history';
  return '<div class="shell"><aside class="sidebar"><a href="#articles" class="brand" data-action="articles" aria-label="Clack"><span class="brand-icon">' + icon('key') + '</span><span>Clack<span class="brand-period">.</span></span></a><p class="brand-sub">' + t('tagline') + '</p><div class="nav-label">' + t('workspace') + '</div><nav aria-label="' + e(t('workspace')) + '"><a href="#articles" class="nav-link ' + (!historyActive ? 'active' : '') + '" data-action="articles"' + (!historyActive ? ' aria-current="page"' : '') + '>' + icon('book') + '<span>' + t('practice') + '</span><span class="nav-count">12</span></a><a href="#history" class="nav-link ' + (historyActive ? 'active' : '') + '" data-action="history"' + (historyActive ? ' aria-current="page"' : '') + '>' + icon('history') + '<span>' + t('history') + '</span><span class="nav-count">' + state.records.length + '</span></a></nav><div class="sidebar-bottom"><div class="side-note">' + icon('leaf') + '<p>' + t('sideNote') + '</p></div><div class="side-foot"><span>KEEP ON TYPING</span><span>v1.0</span></div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb"><span>WORKSPACE</span><span>/</span><strong>' + t(historyActive ? 'history' : 'practice') + '</strong></div><div class="top-actions"><span class="local-indicator"><i class="status-dot"></i>' + t('local') + '</span><button class="language-button" data-action="ui-language" aria-label="' + e(t('switchLang')) + '">' + icon('globe') + t('currentLang') + '<span aria-hidden="true">⌄</span></button></div></header><div class="content">' + content + '</div></main></div>';
}
function library() {
  const today = todayRecords().length;
  return '<div class="page-heading"><div><p class="eyebrow">A LITTLE PRACTICE, EVERY DAY.</p><h1>' + t('pageTitle') + '</h1><p class="description">' + t('pageDesc') + '</p></div><span class="heading-aside">' + icon('leaf') + t('smallHabit') + '</span></div>' + pendingNotice() + '<section class="welcome-row"><div class="welcome"><div class="welcome-copy"><span class="pill">' + icon('sun') + t('welcomePill') + '</span><h2>' + t('welcomeTitle') + '</h2><p>' + t('welcomeDesc') + '</p></div>' + keyboardArt() + '</div><div class="daily-card"><div class="daily-label"><span>' + t('today') + '</span>' + icon('sun') + '</div><div class="daily-number"><strong>' + n(today) + '</strong><span>' + t('sessionsUnit') + '</span></div><div class="daily-track"><span style="width:' + Math.min(100, today / 3 * 100) + '%"></span></div><span class="daily-caption">' + t(today ? 'todayDone' : 'todayEmpty') + '</span></div></section><div class="library-toolbar">' + tabs() + '<label class="search">' + icon('search') + '<input type="search" id="article-search" placeholder="' + e(t('search')) + '" aria-label="' + e(t('search')) + '" value="' + e(search) + '"></label></div><div class="filter-row"><div class="categories">' + ['all', 'daily', 'nature', 'thoughts'].map((item) => '<button class="category ' + (category === item ? 'active' : '') + '" data-action="category" data-category="' + item + '" aria-pressed="' + (category === item) + '">' + t(item) + '</button>').join('') + '</div><span class="results-count" id="results-count"></span></div><section class="article-grid" id="article-grid" aria-label="' + e(t('all')) + '"></section>' + footer();
}
function renderCards() {
  const found = articles.filter((article) => article.language === articleLanguage && (category === 'all' || category === article.category) && (!search.trim() || (article.title + article.description + article.text).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  document.querySelector('#results-count').textContent = n(found.length) + ' ' + t('passages');
  document.querySelector('#article-grid').innerHTML = found.length ? found.map((article) => {
    const count = countText(article);
    const estimate = Math.max(1, Math.ceil(count / (article.language === 'zh' ? 100 : 40)));
    return '<button class="article-card" data-category="' + article.category + '" data-action="start" data-id="' + article.id + '" lang="' + (article.language === 'zh' ? 'zh-CN' : 'en') + '" aria-label="' + e(t('startPractice') + ': ' + article.title) + '"><div class="card-top"><span class="card-symbol">' + icon({ daily: 'coffee', nature: 'leaf', thoughts: 'idea' }[article.category]) + '</span><span class="difficulty ' + article.level + '"><i></i>' + t(article.level) + '</span></div><h3>' + e(article.title) + '</h3><p class="card-description">' + e(article.description) + '</p><p class="card-preview">' + e(article.text) + '</p><div class="card-footer"><span class="card-meta">' + count + ' ' + t(article.language === 'zh' ? 'chars' : 'words') + '<i class="tiny-dot"></i>~ ' + estimate + ' ' + t('minute') + '</span><span class="card-arrow">' + icon('arrow') + '</span></div></button>';
  }).join('') : '<div class="empty-state">' + icon('search') + '<h3>' + t('noResults') + '</h3><p>' + t('noResultsDesc') + '</p><button class="secondary-button" data-action="reset-filters">' + t('resetFilters') + '</button></div>';
}
function metricsHtml(result = false) {
  return '<section class="metrics" aria-label="' + e(t('progress')) + '">' + [
    ['speed', 'speed', '0', unit(session.article.language)], ['accuracy', 'target', '100', '%'],
    ['elapsed', 'clock', '00:00', ''], ['progress', 'book', result ? '100' : '0', '%'],
  ].map(([key, symbol, value, suffix]) => '<div class="metric"><div class="metric-label">' + icon(symbol) + t(key) + '</div><div class="metric-value"><span id="metric-' + key + '">' + value + '</span><span class="metric-unit">' + suffix + '</span></div></div>').join('') + '</section>';
}
function practice() {
  if (!session) { view = 'articles'; return library(); }
  const article = session.article;
  const complete = session.status === 'complete';
  let body = '<div class="page-heading practice-heading"><div><p class="eyebrow">' + t('typingEyebrow') + '</p><h1 lang="' + article.language + '">' + e(article.title) + '</h1><p class="description">' + t('typingDesc') + '</p></div><button class="text-button" data-action="articles">' + icon('back') + t('back') + '</button></div>';
  if (complete) {
    body += '<section class="result-card"><div class="result-icon">' + icon('trophy') + '</div><h2>' + t('resultTitle') + '</h2><p>' + t('resultDesc') + '</p><div class="result-actions"><button class="primary-button" data-action="restart">' + icon('reset') + t('again') + '</button><button class="secondary-button" data-action="articles">' + t('chooseAnother') + '</button><button class="secondary-button" data-action="history">' + t('viewHistory') + icon('arrow') + '</button></div><div class="save-status ' + (savingStatus === 'failed' ? 'failure' : '') + '" role="status">' + icon(savingStatus === 'saved' ? 'check' : 'info') + '<span>' + t(savingStatus === 'saved' ? 'saved' : savingStatus === 'failed' ? 'saveFailed' : 'saving') + '</span>' + (savingStatus === 'failed' ? '<button class="inline-retry" data-action="retry-save">' + t('retry') + '</button>' : '') + '</div></section>';
    return body + metricsHtml(true) + '<section class="typing-card full-article review-article"><div class="typing-card-top"><span class="segment-tag">' + icon('book') + t('articleLayout') + '</span><span>' + session.chunks.length + ' ' + t('section') + '</span></div><div class="line-stage">' + articleRows() + '</div></section><p class="practice-note">' + t(article.language === 'zh' ? 'rulesZh' : 'rulesEn') + '</p>' + footer();
  }
  body += '<div class="practice-top"><div class="practice-title"><span>' + t(article.language) + '</span><i></i><span>' + t(article.category) + '</span><i></i><span>' + countText(article) + ' ' + t(article.language === 'zh' ? 'chars' : 'words') + '</span></div><div class="practice-actions"><button class="text-button" id="pause-button" data-action="pause">' + icon(session.status === 'paused' ? 'play' : 'pause') + t(session.status === 'paused' ? 'resume' : 'pause') + '</button><button class="text-button" data-action="restart">' + icon('reset') + t('restart') + '</button></div></div>' + metricsHtml() + '<section class="typing-card full-article" aria-label="' + e(t('practice')) + '"><div class="typing-card-top"><span class="segment-tag">' + icon('book') + t('articleLayout') + '</span><span id="segment-count">' + (session.index + 1) + ' / ' + session.chunks.length + ' ' + t('section') + '</span></div><div class="line-stage" id="passage-rows">' + articleRows() + '</div><div class="typing-card-bottom"><span class="typing-hint" id="typing-hint">' + icon('info') + t('enterLine') + '</span></div>' + '</section><div class="progress-caption"><span>' + t('progress') + '</span><span id="progress-caption">0 / ' + session.totalCharacters + ' ' + t('chars') + '</span></div><div class="progress-line" role="progressbar" aria-label="' + e(t('progress')) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="progress-fill"></span></div><div class="practice-legend"><span class="legend-item"><i></i>' + t('correct') + '</span><span class="legend-item error"><i></i>' + t('incorrect') + '</span><span class="legend-item waiting"><i></i>' + t('waiting') + '</span></div><p class="practice-note">' + t(article.language === 'zh' ? 'rulesZh' : 'rulesEn') + '</p>' + footer();
  return body;
}
function articleRows() { return renderPassageRows(session, { t, escape: e, icon }); }
function refreshArticleRows() {
  document.querySelector('#passage-rows').innerHTML = articleRows();
  const input = document.querySelector('#typing-input');
  input.value = session.input;
  input.disabled = session.status === 'paused';
  bindTyping(input);
  return input;
}
function storageNote() {
  const mode = storageMode();
  const key = { platform: 'platformStorage', browser: 'browserStorage', memory: 'memoryStorage', unavailable: 'unavailableStorage' }[mode] || 'unavailableStorage';
  return '<p class="storage-note ' + (['memory', 'unavailable'].includes(mode) ? 'warning' : '') + '">' + t(key) + '</p>';
}
function pendingNotice() {
  if (!pendingResults.size) return '';
  return '<div class="storage-note warning" role="status">' + e(t('pendingResults').replace('{count}', String(pendingResults.size))) + ' <button class="inline-retry" data-action="retry-pending">' + t('retryPending') + '</button></div>';
}
function history() {
  const records = recordsFor(articleLanguage);
  const totalMs = records.reduce((sum, item) => sum + item.durationMs, 0);
  const best = records.reduce((max, item) => Math.max(max, item.speed), 0);
  const avg = records.length ? records.reduce((sum, item) => sum + item.accuracy, 0) / records.length : 0;
  return '<div class="page-heading history-heading"><div><p class="eyebrow">EVERY KEYSTROKE COUNTS.</p><h1>' + t('historyTitle') + '</h1><p class="description">' + t('historyDesc') + '</p></div><div class="history-actions"><button class="secondary-button" data-action="export">' + icon('download') + t('export') + '</button><button class="secondary-button" data-action="import">' + icon('upload') + t('import') + '</button><input class="visually-hidden" type="file" id="import-file" accept=".json,application/json" tabindex="-1" aria-label="' + e(t('import')) + '"></div></div>' + tabs() + '<section class="history-summary">' + [
    ['totalSessions', 'book', n(records.length), t('sessionsUnit')], ['totalTime', 'clock', n(totalMs / 60000, 1), t('minute')],
    ['bestSpeed', 'speed', n(best), unit()], ['avgAccuracy', 'target', records.length ? n(avg, 1) : '—', '%'],
  ].map(([key, symbol, value, suffix]) => '<div class="history-stat"><div class="metric-label">' + icon(symbol) + t(key) + '</div><span class="metric-value">' + value + '<span class="metric-unit">' + suffix + '</span></span></div>').join('') + '</section>' + (records.length ? '<div class="history-table-wrap"><table class="history-table"><thead><tr><th>' + t('recordArticle') + '</th><th>' + t('recordTime') + '</th><th>' + t('recordDuration') + '</th><th>' + t('speed') + '</th><th>' + t('accuracy') + '</th><th><span class="visually-hidden">' + t('recordAction') + '</span></th></tr></thead><tbody>' + records.map((record) => '<tr><td><div class="record-title" lang="' + record.language + '">' + e(record.title) + '</div><span class="record-date">' + t(record.language) + ' · ' + record.totalCharacters + ' ' + t('chars') + '</span></td><td>' + e(new Date(record.completedAt).toLocaleString(ui === 'en' ? 'en-GB' : 'zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })) + '</td><td>' + duration(record.durationMs) + '</td><td><span class="record-speed">' + n(record.speed) + '</span> <span class="record-date">' + unit() + '</span></td><td>' + n(record.accuracy, 1) + '%</td><td>' + (articles.some((article) => article.id === record.articleId) ? '<button class="record-retry" data-action="start" data-id="' + e(record.articleId) + '">' + t('recordAction') + '</button>' : '—') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty-state">' + icon('history') + '<h3>' + t('historyEmpty') + '</h3><p>' + t('historyEmptyDesc') + '</p><button class="primary-button" data-action="articles">' + t('startPractice') + icon('arrow') + '</button></div>') + storageNote() + footer();
}
function render() {
  document.documentElement.lang = ui === 'en' ? 'en' : 'zh-CN';
  document.title = 'Clack · ' + t('tagline');
  const reloadNotice = needsReload ? '<div class="storage-note warning" role="status">' + t('reloadWarning') + ' <button class="inline-retry" data-action="reload">' + t('reload') + '</button></div>' : '';
  app.innerHTML = shell(reloadNotice + (view === 'articles' ? library() : view === 'history' ? history() : practice()));
  if (view === 'history' && pendingResults.size) document.querySelector('.history-summary').insertAdjacentHTML('beforebegin', pendingNotice());
  if (view === 'articles') renderCards();
  if (view === 'practice' && session) {
    if (session.status !== 'complete') {
      const input = document.querySelector('#typing-input');
      input.value = session.input;
      input.disabled = session.status === 'paused';
      bindTyping(input);
      paintLines();
    }
    paintMetrics();
  }
}
function paintInput(value, draft = false) {
  const node = document.querySelector('#typed-line');
  if (!node) return;
  const inputChars = graphemes(value);
  const target = graphemes(session.chunks[session.index] || '');
  node.innerHTML = inputChars.length ? inputChars.map((char, index) => '<span class="' + (draft ? 'composing' : char === target[index] ? 'correct' : 'incorrect') + (char === ' ' ? ' space' : '') + '">' + e(char) + '</span>').join('') : '<span class="typed-placeholder">' + t('inputPlaceholder') + '</span>';
}
function paintLines() {
  if (!session || session.status === 'complete') return;
  const source = document.querySelector('#source-line');
  if (!source) return;
  const target = graphemes(session.chunks[session.index]);
  const entered = graphemes(session.input);
  source.innerHTML = target.map((char, index) => '<span class="' + (index < entered.length ? (char === entered[index] ? 'done' : 'wrong') : index === entered.length ? 'current' : '') + (char === ' ' ? ' space' : '') + '">' + e(char) + '</span>').join('');
  paintInput(session.input);
  document.querySelector('#segment-count').textContent = (session.index + 1) + ' / ' + session.chunks.length + ' ' + t('section');
}
function paintMetrics() {
  if (view !== 'practice' || !session) return;
  const m = metrics(session);
  for (const [key, value] of Object.entries({ speed: n(m.speed), accuracy: n(m.accuracy, 1), elapsed: duration(m.elapsedMs), progress: Math.floor(m.progress) })) {
    const node = document.querySelector('#metric-' + key);
    if (node) node.textContent = value;
  }
  const fill = document.querySelector('#progress-fill');
  if (fill) {
    fill.style.width = m.progress + '%';
    fill.parentElement.setAttribute('aria-valuenow', String(Math.floor(m.progress)));
    document.querySelector('#progress-caption').textContent = m.typedCharacters + ' / ' + m.totalCharacters + ' ' + t('chars');
  }
}
function commitInput(value, sourceInput) {
  if (!session || session.status === 'paused' || session.status === 'complete') return;
  const outcome = commitInputAndAdvance(session, value.replace(/[\r\n]/g, ''));
  if (outcome.completed) { finishSession(); return; }
  const input = outcome.advanced ? refreshArticleRows() : sourceInput;
  if (input.value !== session.input) input.value = session.input;
  paintLines();
  paintMetrics();
  if (outcome.advanced) {
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    centerTypingInput(true);
  }
}
function centerTypingInput(smooth = false) {
  const input = document.querySelector('#typing-input');
  if (!input || input.disabled) return;
  input.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant',
  });
}
function bindTyping(input) {
  const current = () => input.isConnected && input === document.querySelector('#typing-input');
  input.wrap = 'off';
  input.addEventListener('scroll', () => {
    if (!current()) return;
    const source = document.querySelector('#source-line');
    const typed = document.querySelector('#typed-line');
    if (source && typed) { source.scrollLeft = input.scrollLeft; typed.scrollLeft = input.scrollLeft; }
  });
  input.addEventListener('compositionstart', () => { if (current()) composing = true; });
  input.addEventListener('compositionend', () => {
    if (!current()) return;
    composing = false;
    commitInput(input.value, input);
  });
  input.addEventListener('input', (event) => {
    // An IME may emit an echo on the previous textarea after automatic advance.
    // A detached row can never submit characters into the next row.
    if (!current()) return;
    if (composing || event.isComposing) { paintInput(input.value, true); return; }
    if (input.value === session.input) return;
    commitInput(input.value, input);
  });
  input.addEventListener('keydown', (event) => {
    if (!current() || event.isComposing || composing || event.keyCode === 229) return;
    if (event.key === 'Enter') event.preventDefault();
    else if (event.key === 'Escape') { event.preventDefault(); togglePause(); }
  });
  input.addEventListener('paste', (event) => { event.preventDefault(); toast('pasteBlocked'); });
  input.addEventListener('drop', (event) => { event.preventDefault(); toast('pasteBlocked'); });
  input.addEventListener('beforeinput', (event) => { if (['insertFromPaste', 'insertFromDrop'].includes(event.inputType)) { event.preventDefault(); toast('pasteBlocked'); } });
}
function chunkSize(article) {
  const content = document.querySelector('.content');
  const padding = content ? getComputedStyle(content) : null;
  const width = content ? content.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight) : window.innerWidth - 42;
  const fontSize = window.innerWidth <= 640 ? 21 : window.innerWidth <= 1150 ? 22 : 24;
  const linePadding = window.innerWidth <= 640 ? 47 : window.innerWidth <= 780 ? 56 : 76;
  const available = Math.max(70, width - linePadding - 4);
  return Math.max(4, Math.min(article.language === 'zh' ? 32 : 64, Math.floor(available / (fontSize * (article.language === 'zh' ? 1.025 : .65)))));
}
function start(articleId) {
  const article = articles.find((item) => item.id === articleId);
  if (!article) return;
  articleLanguage = article.language;
  session = createSession(article, chunkSize(article));
  view = 'practice'; composing = false; resultRecord = null; savingStatus = '';
  render();
  document.querySelector('#typing-input').focus({ preventScroll: true });
  centerTypingInput();
}
function finishSession() {
  const m = metrics(session);
  resultRecord = { id: crypto.randomUUID(), articleId: session.article.id, language: session.article.language, title: session.article.title,
    completedAt: new Date().toISOString(), durationMs: Math.max(1, Math.round(m.elapsedMs)), speed: Number(m.speed.toFixed(2)),
    accuracy: Number(m.accuracy.toFixed(2)), correctCharacters: m.correctCharacters, typedCharacters: m.typedCharacters, totalCharacters: m.totalCharacters };
  pendingResults.set(resultRecord.id, { record: resultRecord, status: 'pending' });
  composing = false;
  void persistResult();
  render();
  document.querySelector('.result-card').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
function togglePause() {
  if (!session || session.status === 'complete') return;
  if (session.status === 'paused') resumeSession(session);
  else if (session.status === 'running') pauseSession(session);
  else return;
  composing = false; render();
  if (session.status === 'running') {
    document.querySelector('#typing-input').focus({ preventScroll: true });
    centerTypingInput(true);
  }
}
async function persistResult(record = resultRecord) {
  if (!record || pendingResults.get(record.id)?.status === 'saving') return;
  pendingResults.set(record.id, { record, status: 'saving' });
  if (resultRecord === record) savingStatus = 'saving';
  try { state = await saveRecord(record); pendingResults.delete(record.id); if (resultRecord === record) savingStatus = 'saved'; }
  catch { pendingResults.set(record.id, { record, status: 'failed' }); if (resultRecord === record) savingStatus = 'failed'; else toast('saveFailed'); }
  if (view !== 'practice' || (resultRecord === record && session?.status === 'complete')) render();
}
function navigate(next) {
  if (session?.status === 'running') pauseSession(session);
  composing = false; view = next; search = ''; render(); window.scrollTo(0, 0);
}
async function preferences(value) {
  try { state = await saveSettings(value); } catch { toast('settingsFailed'); }
}
app.addEventListener('click', (event) => {
  const node = event.target.closest('[data-action]');
  if (!node) return;
  const action = node.dataset.action;
  if (node.tagName === 'A') event.preventDefault();
  if (action === 'articles' || action === 'history') navigate(action);
  else if (action === 'ui-language') { if (session?.status === 'running') pauseSession(session); composing = false; ui = ui === 'zh' ? 'en' : 'zh'; render(); void preferences({ uiLanguage: ui }); }
  else if (action === 'article-language') { articleLanguage = node.dataset.language; category = 'all'; search = ''; render(); void preferences({ articleLanguage }); }
  else if (action === 'category') { category = node.dataset.category; render(); }
  else if (action === 'reset-filters') { category = 'all'; search = ''; render(); }
  else if (action === 'start') start(node.dataset.id);
  else if (action === 'restart') start(session.article.id);
  else if (action === 'pause') togglePause();
  else if (action === 'retry-save') { savingStatus = ''; void persistResult(); render(); }
  else if (action === 'retry-pending') { for (const item of pendingResults.values()) if (item.status !== 'saving') void persistResult(item.record); }
  else if (action === 'reload') window.location.reload();
  else if (action === 'focus-input') document.querySelector('#typing-input')?.focus({ preventScroll: true });
  else if (action === 'export') {
    if (!state.records.length && !pendingResults.size) { toast('emptyExport'); return; }
    const data = JSON.parse(exportState());
    const combined = new Map(data.records.map((record) => [record.id, record]));
    for (const { record } of pendingResults.values()) combined.set(record.id, record);
    data.records = [...combined.values()];
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'clack-history-' + new Date().toISOString().slice(0, 10) + '.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (action === 'import') document.querySelector('#import-file').click();
});
app.addEventListener('input', (event) => { if (event.target.id === 'article-search') { search = event.target.value; renderCards(); } });
app.addEventListener('change', async (event) => {
  if (event.target.id !== 'import-file' || !event.target.files?.[0]) return;
  const file = event.target.files[0];
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('invalidData');
    state = await importRecords(JSON.parse(await file.text())); render(); toast('imported');
  } catch (error) { toast(error.code === 'INVALID_DATA' || error instanceof SyntaxError ? 'invalidImport' : 'importFailed'); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session?.status === 'running') { pauseSession(session); composing = false; if (view === 'practice') render(); }
});
window.addEventListener('blur', () => {
  if (session?.status === 'running') { pauseSession(session); composing = false; if (view === 'practice') render(); }
});
window.addEventListener('beforeunload', (event) => {
  if (pendingResults.size) { event.preventDefault(); event.returnValue = ''; }
});
app.addEventListener('scroll', (event) => {
  if (!event.target.matches?.('.source-line') || event.target.closest('.passage-row')?.classList.contains('active')) return;
  const typed = event.target.closest('.passage-row')?.querySelector('.typed-line');
  if (typed) typed.scrollLeft = event.target.scrollLeft;
}, true);
setInterval(paintMetrics, 250);
subscribeStorage((event) => {
  if (event.type === 'changed') {
    state = event.state;
    if (view !== 'practice') render();
  } else if (event.type === 'reload-required') {
    needsReload = true;
    if (session?.status === 'running') pauseSession(session);
    composing = false;
    render();
  } else if (event.type === 'error' && view === 'history') render();
});
render();

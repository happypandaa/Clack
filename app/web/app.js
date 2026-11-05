import { renderPassageRows, cellSpans } from './passage-view.js';
import { articles } from './articles.js';
import { createSession, commitInputAndAdvance, retreatSession, resumeSession, pauseSession, metrics, graphemes, splitText } from './typing.js';
import { loadState, saveSettings, saveRecord, importRecords, exportState, storageMode, subscribeStorage } from './storage.js';

const paths = {
  key: '<rect x="3" y="3" width="18" height="17" rx="4"/><path d="M8 8v6h8m-3-3 3 3-3 3"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  up: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 8M3 3v7h7"/>',
  shuffle: '<path d="M3 7h3c4 0 6 10 10 10h5m0 0-3-3m3 3-3 3M3 17h3c1.5 0 2.7-1.4 3.7-3.2M21 7h-5c-1.5 0-2.7 1.4-3.7 3.2M21 7l-3-3m3 3-3 3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
};
function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.book) + '</svg>'; }

const copy = {
  practice: ['练习', 'Practice'], history: ['记录', 'History'], mainNav: ['主导航', 'Main'],
  statusOk: ['记录已保存到项目', 'Saved to your project'], statusOff: ['暂时连不上项目数据库', 'Project database unavailable'],
  uiLanguage: ['界面语言', 'Interface language'], theme: ['主题', 'Theme'],
  ink: ['墨', 'Ink'], pine: ['松', 'Pine'], tea: ['茶', 'Tea'],
  inkDesc: ['墨：灰黑，安静专注', 'Ink: quiet greys'], pineDesc: ['松：松绿，清爽', 'Pine: fresh green'], teaDesc: ['茶：茶褐，温暖', 'Tea: warm brown'],
  libraryTitle: ['今天想打哪一段？', 'What would you like to type today?'],
  todayGoal: ['今日目标', 'Today'], goalUnit: ['段', 'passages'], streak: ['连续练习', 'Streak'], days: ['天', 'days'],
  heroNext: ['接着练', 'Up next'], heroAgain: ['再来一遍', 'Once more'], heroStart: ['从这里开始', 'Start here'],
  firstTime: ['还没练过', 'Not practiced yet'], best: ['最佳', 'Best'],
  startPractice: ['开始练习', 'Start'], shuffle: ['换一篇', 'Another one'],
  previewLine: ['第 1 行', 'Line 1'], previewInput: ['在这里输入', 'Type here'],
  allPassages: ['全部文章', 'All passages'], articleLanguage: ['文章语言', 'Passage language'],
  zh: ['中文', 'Chinese'], en: ['英文', 'English'], search: ['搜索标题或内容', 'Search titles or text'],
  category: ['分类', 'Category'], all: ['全部', 'All'], daily: ['日常生活', 'Everyday'], nature: ['自然片刻', 'Nature'], thoughts: ['一点思考', 'Reflections'],
  lengthLabel: ['篇幅', 'Length'], short: ['短篇', 'Short'], medium: ['中篇', 'Medium'], long: ['长篇', 'Long'],
  chars: ['字', 'chars'], words: ['词', 'words'], charsEn: ['字符', 'chars'], about: ['约', 'about'], minute: ['分钟', 'min'],
  noResults: ['没有找到合适的文章', 'No passages found'], noResultsDesc: ['换个关键词，或者放宽分类和篇幅。', 'Try another search, or widen the filters.'],
  resetFilters: ['查看全部文章', 'Show all passages'],
  hint: ['<kbd>↵</kbd> 开始推荐的文章 · 练习中 <kbd>Esc</kbd> 暂停 · <kbd>⌘</kbd><kbd>↵</kbd> 重新开始', '<kbd>↵</kbd> start the suggested passage · <kbd>Esc</kbd> pause · <kbd>⌘</kbd><kbd>↵</kbd> start over'],
  back: ['文章库', 'Library'], pause: ['暂停', 'Pause'], resume: ['继续', 'Resume'], restart: ['重新开始', 'Start over'],
  speed: ['速度', 'Speed'], accuracy: ['准确率', 'Accuracy'], elapsed: ['用时', 'Time'], typed: ['已打', 'Typed'], progress: ['完成进度', 'Progress'],
  cpm: ['字/分', 'CPM'], wpm: ['WPM', 'WPM'], cpmLong: ['字/分钟', 'chars/min'], wpmLong: ['WPM', 'words/min'],
  legendCorrect: ['打对了', 'Correct'], legendWrong: ['打错了', 'Mistake'], legendNext: ['下一个字', 'Next'],
  typingHint: ['输入法选好字后再判断对错 · 一行打满自动换到下一行', 'Checked after each word is committed · Full lines advance on their own'],
  inputLabel: ['输入与上方原文相同的文字', 'Type the passage shown above'], inputPlaceholder: ['在这里输入，开始练习', 'Start typing here'],
  lineActive: ['正在输入', 'Current line'], lineDone: ['已完成', 'Done'], lineErrors: ['{count} 错', '{count} ✕'], lineWaiting: ['等待输入', 'Up next'],
  finished: ['完成了', 'Finished'], bestEver: ['完成了，这是这一篇的最好成绩', 'Finished — your best on this passage'],
  drillDone: ['错字练习完成，这次不计入记录', 'Mistake drill finished — not added to history'], drillTitle: ['错字练习', 'Mistake drill'],
  fasterBy: ['比上次快 {n}', '{n} faster than last time'], slowerBy: ['比上次慢 {n}，没关系', '{n} slower than last time — that is fine'],
  same: ['和上次差不多', 'About the same as last time'], firstFinish: ['第一次完成这一篇', 'First time finishing this passage'],
  mistakes: ['错字', 'Mistakes'], mistakesUnit: ['处', ''],
  again: ['再练一次', 'Try again'], nextPassage: ['下一篇：{title}', 'Next: {title}'], viewHistory: ['查看全部记录', 'View history'],
  saving: ['正在保存…', 'Saving…'], saved: ['已保存到练习记录', 'Saved to history'], saveFailed: ['还没保存成功，成绩先留在本页', 'Not saved yet — your result is kept here'],
  retry: ['重试保存', 'Retry'], notRecorded: ['不计入记录', 'Not recorded'],
  reviewTitle: ['错字回顾', 'Mistake review'], drillButton: ['只练这 {count} 句', 'Practice these {count} lines'],
  lineN: ['第 {n} 行', 'Line {n}'], typedAs: ['你打成了「{text}」', 'You typed “{text}”'],
  moreMistakes: ['还有 {count} 行有错字，可以在下面的全文对照里查看。', '{count} more lines have mistakes — see the full review below.'],
  perfect: ['全部打对了，一个错字都没有。', 'Every character was right. Nicely done.'],
  trendTitle: ['这一篇的最近 {count} 次', 'Your last {count} on this passage'], earlier: ['较早', 'Earlier'], thisTime: ['本次', 'This time'],
  fullReview: ['查看全文对照', 'Show the full review'],
  historyTitle: ['练习记录', 'Practice history'], historyDesc: ['中文和英文的成绩分开统计。', 'Chinese and English results are tracked separately.'],
  export: ['导出记录', 'Export'], import: ['导入记录', 'Import'],
  totalSessions: ['累计练习', 'Sessions'], sessionsUnit: ['次', ''], totalTime: ['累计用时', 'Time spent'],
  bestSpeed: ['最高速度', 'Best speed'], avgAccuracy: ['平均准确率', 'Avg. accuracy'],
  recordArticle: ['文章', 'Passage'], recordTime: ['完成时间', 'Completed'], recordDuration: ['用时', 'Time'], recordAction: ['再练一遍', 'Practice again'],
  historyEmpty: ['还没有记录', 'No history yet'], historyEmptyDesc: ['完成一篇文章，这里就会留下你的成绩。', 'Finish a passage and your results will show up here.'],
  findPassage: ['去选一篇', 'Find a passage'],
  platformStorage: ['记录保存在项目数据库里，关闭应用后仍会保留。', 'History is stored in the project database and stays after you close the app.'],
  unavailableStorage: ['暂时连不上项目数据库。可以继续练习，完成后再重试保存。', 'The project database is unavailable. Keep practicing and retry saving later.'],
  pasteBlocked: ['练习区不能粘贴，试着亲手打出来吧。', 'Typing is the practice. Paste is disabled here.'],
  imported: ['记录已导入，重复的记录自动跳过。', 'History imported. Existing entries were kept.'],
  invalidImport: ['无法导入，请选择 Clack 导出的 JSON 记录文件。', 'Choose a JSON history file exported by Clack.'],
  importFailed: ['记录未能导入，请检查文件大小和数据库连接后重试。', 'Import failed. Check the file size and database connection, then try again.'],
  emptyExport: ['还没有练习记录，先完成一次练习吧。', 'Finish a passage before exporting your history.'],
  settingsFailed: ['偏好暂未保存，本次切换仍然生效。', 'Your preference changed but could not be saved.'],
  pendingResults: ['有 {count} 次练习还没保存，成绩暂时留在本页。', '{count} result(s) are waiting to be saved. Keep this page open.'],
  retryPending: ['重试保存', 'Retry saving'], reload: ['重新加载', 'Reload'],
  reloadWarning: ['项目已更新。重新加载会结束当前练习，没保存的成绩请先导出。', 'An update is ready. Reloading ends this practice; export unsaved results first.'],
};

const DAILY_GOAL = 3;
let state = await loadState();
let ui = state.settings.uiLanguage;
let articleLanguage = state.settings.articleLanguage;
let theme = state.settings.theme || 'ink';
let compositionStart = null;
const THEMES = ['ink', 'pine', 'tea'];
let view = 'articles';
let category = 'all';
let lengthFilter = 'all';
let search = '';
let shuffle = 0;
let session = null;
let composing = false;
let resultRecord = null;
let savingStatus = '';
const pendingResults = new Map();
let needsReload = false;
let toastTimer;
const app = document.querySelector('#app');

function t(key) { return copy[key]?.[ui === 'en' ? 1 : 0] ?? key; }
function fill(key, values) { return Object.entries(values).reduce((text, [name, value]) => text.replaceAll('{' + name + '}', value), t(key)); }
function e(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function n(value, digits = 0) { return Number(value).toLocaleString(ui === 'en' ? 'en-US' : 'zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
function duration(ms) { const seconds = Math.floor(ms / 1000); return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
function unit(lang = articleLanguage) { return t(lang === 'zh' ? 'cpm' : 'wpm'); }
function unitLong(lang) { return t(lang === 'zh' ? 'cpmLong' : 'wpmLong'); }
function charsLabel(lang) { return t(lang === 'zh' ? 'chars' : 'charsEn'); }
function langAttr(lang) { return lang === 'zh' ? 'zh-CN' : 'en'; }
function toast(key) { const node = document.querySelector('#toast'); node.textContent = t(key); node.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 3500); }
function day(value) { return new Date(value).toLocaleDateString('en-CA'); }
function recordsFor(lang) { return state.records.filter((record) => record.language === lang).sort((a, b) => b.completedAt.localeCompare(a.completedAt)); }
function articleRecords(id) { return state.records.filter((record) => record.articleId === id).sort((a, b) => a.completedAt.localeCompare(b.completedAt)); }
function todayCount() { const today = day(Date.now()); return state.records.filter((record) => day(record.completedAt) === today).length; }
function streak() {
  const days = new Set(state.records.map((record) => day(record.completedAt)));
  const cursor = new Date();
  if (!days.has(day(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(day(cursor))) { count += 1; cursor.setDate(cursor.getDate() - 1); }
  return count;
}
function countText(article) { return article.language === 'en' ? article.text.trim().split(/\s+/).length : graphemes(article.text).length; }
function lengthKind(article) { const count = countText(article); return count <= 300 ? 'short' : count <= 650 ? 'medium' : 'long'; }
function estimate(article) { return Math.max(1, Math.round(countText(article) / (article.language === 'zh' ? 50 : 35))); }
function countLabel(article) { return countText(article) + ' ' + t(article.language === 'zh' ? 'chars' : 'words'); }
function bestSpeed(id) { return articleRecords(id).reduce((max, record) => Math.max(max, record.speed), 0); }
// Unpractised passages first, then the ones left alone the longest.
function candidates(lang = articleLanguage) {
  const last = (id) => articleRecords(id).at(-1)?.completedAt ?? '';
  return articles.filter((article) => article.language === lang)
    .map((article, index) => ({ article, index, last: last(article.id) }))
    .sort((a, b) => (a.last === b.last ? a.index - b.index : a.last === '' ? -1 : b.last === '' ? 1 : a.last.localeCompare(b.last)))
    .map((item) => item.article);
}
function recommended() { const list = candidates(); return list[shuffle % list.length]; }
function storageOk() { return storageMode() === 'platform'; }

function topbar() {
  const historyActive = view === 'history';
  return '<header class="topbar"><div class="topbar-left"><a href="#articles" class="brand" data-action="articles" aria-label="Clack"><span class="brand-icon">' + icon('key') + '</span><span class="brand-name">Clack</span></a>'
    + '<nav class="nav" aria-label="' + e(t('mainNav')) + '"><a href="#articles" class="nav-link' + (historyActive ? '' : ' active') + '" data-action="articles"' + (historyActive ? '' : ' aria-current="page"') + '>' + t('practice') + '</a>'
    + '<a href="#history" class="nav-link' + (historyActive ? ' active' : '') + '" data-action="history"' + (historyActive ? ' aria-current="page"' : '') + '>' + t('history') + '<span class="nav-count">' + n(state.records.length) + '</span></a></nav></div>'
    + '<div class="topbar-right"><span class="status' + (storageOk() ? '' : ' warning') + '" role="status"><i class="status-dot"></i>' + t(storageOk() ? 'statusOk' : 'statusOff') + '</span>'
    + '<div class="theme-picker" role="group" aria-label="' + e(t('theme')) + '">' + THEMES.map((name) =>
      '<button type="button" class="theme-option" data-action="theme" data-value="' + name + '" data-focus-key="theme-' + name + '" aria-pressed="' + (theme === name) + '" title="' + e(t(name + 'Desc')) + '"><i class="swatch ' + name + '" aria-hidden="true"></i>' + t(name) + '</button>').join('') + '</div>'
    + '<div class="segmented" role="group" aria-label="' + e(t('uiLanguage')) + '">' + [['zh', '中'], ['en', 'EN']].map(([lang, label]) =>
      '<button type="button" data-action="ui-language" data-lang="' + lang + '" data-focus-key="ui-' + lang + '" aria-pressed="' + (ui === lang) + '" lang="' + langAttr(lang) + '">' + label + '</button>').join('') + '</div></div></header>';
}
function notices() {
  let html = '';
  if (needsReload) html += '<div class="notice" role="status">' + t('reloadWarning') + '<button class="button" data-action="reload">' + t('reload') + '</button></div>';
  if (pendingResults.size) html += '<div class="notice" role="status">' + e(fill('pendingResults', { count: pendingResults.size })) + '<button class="button" data-action="retry-pending">' + t('retryPending') + '</button></div>';
  return html;
}
function shell(content) { return '<div class="app">' + topbar() + '<main class="page">' + notices() + content + '</main></div>'; }

function hero() {
  const rec = recommended();
  const practicedAny = state.records.length > 0;
  const best = bestSpeed(rec.id);
  const preview = graphemes(splitText(rec.text, rec.language, rec.language === 'zh' ? 22 : 46)[0]);
  const badge = !practicedAny ? 'heroStart' : best ? 'heroAgain' : 'heroNext';
  return '<section class="hero" aria-label="' + e(t(badge)) + '"><div class="hero-copy" lang="' + langAttr(rec.language) + '">'
    + '<div class="hero-tags"><span class="hero-badge">' + t(badge) + '</span><span>' + t(rec.category) + ' · ' + t(lengthKind(rec)) + '</span></div>'
    + '<h2>' + e(rec.title) + '</h2><p class="hero-desc">' + e(rec.description) + '</p>'
    + '<p class="hero-meta">' + countLabel(rec) + ' · ' + t('about') + ' ' + estimate(rec) + ' ' + t('minute') + ' · ' + (best ? t('best') + ' ' + n(best) + ' ' + unit(rec.language) : t('firstTime')) + '</p>'
    + '<div class="hero-actions"><button class="button primary" data-action="start" data-id="' + e(rec.id) + '">' + t('startPractice') + '<kbd>↵</kbd></button><button class="button secondary" data-action="shuffle">' + icon('shuffle') + t('shuffle') + '</button></div></div>'
    + '<div class="hero-preview" aria-hidden="true"><div class="hero-preview-label">' + t('previewLine') + '</div><div class="hero-preview-text" lang="' + langAttr(rec.language) + '"><span class="current">' + e(preview[0]) + '</span>' + e(preview.slice(1).join('')) + '</div>'
    + '<div class="hero-preview-input"><i></i>' + t('previewInput') + '</div></div></section>';
}
function library() {
  const today = todayCount();
  const date = new Date().toLocaleDateString(ui === 'en' ? 'en-US' : 'zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
  return '<div class="library-head"><div><p class="date-line">' + e(date) + '</p><h1>' + t('libraryTitle') + '</h1></div>'
    + '<div class="today card"><div><div class="today-label">' + t('todayGoal') + '</div><div class="today-value"><span class="num">' + n(today) + '</span>/ ' + DAILY_GOAL + ' ' + t('goalUnit') + '</div></div>'
    + '<div class="today-bars" aria-hidden="true">' + Array.from({ length: DAILY_GOAL }, (_, index) => '<i' + (index < today ? ' class="on"' : '') + '></i>').join('') + '</div>'
    + '<div class="today-divider"></div><div><div class="today-label">' + t('streak') + '</div><div class="today-value"><span class="num">' + n(streak()) + '</span>' + t('days') + '</div></div></div></div>'
    + hero()
    + '<section aria-labelledby="all-heading"><div class="list-head"><div class="list-head-left"><h2 id="all-heading">' + t('allPassages') + '</h2>' + languageTabs('library') + '</div>'
    + '<label class="search">' + icon('search') + '<span class="visually-hidden">' + t('search') + '</span><input type="search" id="article-search" placeholder="' + e(t('search')) + '" value="' + e(search) + '"></label></div>'
    + '<div class="filters"><div class="chips" role="group" aria-label="' + e(t('category')) + '">' + ['all', 'daily', 'nature', 'thoughts'].map((item) => '<button type="button" class="chip" data-action="category" data-value="' + item + '" aria-pressed="' + (category === item) + '">' + t(item) + '</button>').join('') + '</div>'
    + '<div class="chips" role="group" aria-label="' + e(t('lengthLabel')) + '"><span class="chips-label">' + t('lengthLabel') + '</span>' + ['all', 'short', 'medium', 'long'].map((item) => '<button type="button" class="chip" data-action="length" data-value="' + item + '" aria-pressed="' + (lengthFilter === item) + '">' + t(item) + '</button>').join('') + '</div></div>'
    + '<div class="card article-list" id="article-list"></div></section>'
    + '<p class="hint-line">' + t('hint') + '</p>';
}
function languageTabs(scope) {
  return '<div class="segmented" role="group" aria-label="' + e(t('articleLanguage')) + '">' + ['zh', 'en'].map((lang) =>
    '<button type="button" data-action="article-language" data-language="' + lang + '" data-focus-key="lang-' + lang + '" aria-pressed="' + (articleLanguage === lang) + '">' + t(lang) + '<span class="count">' + (scope === 'history' ? recordsFor(lang).length : articles.filter((article) => article.language === lang).length) + '</span></button>').join('') + '</div>';
}
function renderCards() {
  const list = document.querySelector('#article-list');
  if (!list) return;
  const query = search.trim().toLocaleLowerCase();
  const found = articles.filter((article) => article.language === articleLanguage
    && (category === 'all' || category === article.category)
    && (lengthFilter === 'all' || lengthFilter === lengthKind(article))
    && (!query || (article.title + article.description + article.text).toLocaleLowerCase().includes(query)));
  list.innerHTML = found.length ? found.map((article, index) => {
    const best = bestSpeed(article.id);
    const kind = lengthKind(article);
    return '<button type="button" class="article-row" data-action="start" data-id="' + e(article.id) + '" lang="' + langAttr(article.language) + '">'
      + '<span class="article-no">' + String(index + 1).padStart(2, '0') + '</span>'
      + '<span class="article-main"><span class="article-title">' + e(article.title) + '</span><span class="article-desc">' + e(article.description) + '</span></span>'
      + '<span class="article-cat">' + t(article.category) + '</span><span class="length-pill' + (kind === 'long' ? ' long' : '') + '">' + t(kind) + '</span>'
      + '<span class="article-len">' + countLabel(article) + ' · ' + estimate(article) + ' ' + t('minute') + '</span>'
      + '<span class="article-best' + (best ? ' has' : '') + '">' + (best ? t('best') + ' ' + n(best) + ' ' + unit(article.language) : t('firstTime')) + '</span>'
      + '<span class="row-arrow">' + icon('arrow') + '</span></button>';
  }).join('') : '<div class="empty">' + icon('search') + '<h3>' + t('noResults') + '</h3><p>' + t('noResultsDesc') + '</p><button class="button secondary" data-action="reset-filters">' + t('resetFilters') + '</button></div>';
}

function practiceHeading(article) {
  const title = session.drill ? t('drillTitle') + ' · ' + article.title : article.title;
  return '<div class="practice-heading" lang="' + langAttr(article.language) + '"><h1>' + e(title) + '</h1><p>' + t(article.language) + ' · ' + t(article.category) + ' · ' + countLabel(article) + '</p></div>';
}
function backButton() { return '<button class="button ghost back" data-action="articles">' + icon('back') + t('back') + '</button>'; }
function practice() {
  if (!session) { view = 'articles'; return shell(library()); }
  if (session.status === 'complete') return result();
  const article = session.article;
  const paused = session.status === 'paused';
  return '<div class="app"><div class="practice-top"><div class="practice-bar">' + backButton() + practiceHeading(article)
    + '<div class="practice-actions"><button class="button secondary small" id="pause-button" data-action="pause">' + icon(paused ? 'play' : 'pause') + '<span class="label">' + t(paused ? 'resume' : 'pause') + '</span><kbd>Esc</kbd></button>'
    + '<button class="icon-button" data-action="restart" aria-label="' + e(t('restart')) + '" title="' + e(t('restart')) + ' (⌘↵)">' + icon('reset') + '</button></div></div>'
    + '<div class="progress-line" role="progressbar" aria-label="' + e(t('progress')) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="progress-fill"></span></div>'
    + '<div class="stats"><span class="stat">' + t('speed') + '<span class="num" id="metric-speed">0</span>' + unit(article.language) + '</span>'
    + '<span class="stat">' + t('accuracy') + '<span class="num" id="metric-accuracy">—</span>%</span>'
    + '<span class="stat">' + t('elapsed') + '<span class="num" id="metric-elapsed">00:00</span></span>'
    + '<span class="stat">' + t('typed') + '<span class="num" id="metric-typed">0</span>/ ' + session.totalCharacters + ' ' + charsLabel(article.language) + '</span></div></div>'
    + '<main class="practice-page">' + notices() + '<section class="card typing-card' + (paused ? ' paused' : '') + '" data-lang="' + article.language + '" aria-label="' + e(article.title) + '"><div id="passage-rows">' + articleRows() + '</div></section>'
    + '<div class="practice-foot"><div class="legend" aria-hidden="true"><span><i></i>' + t('legendCorrect') + '</span><span class="wrong"><i></i>' + t('legendWrong') + '</span><span class="next"><i></i>' + t('legendNext') + '</span></div>'
    + '<span id="typing-hint">' + t('typingHint') + '</span></div></main></div>';
}

function mistakesOf(current) {
  return current.chunks.map((target, index) => {
    const expected = graphemes(target);
    const actual = graphemes(current.completedInputs[index] ?? '');
    const wrong = expected.map((char, position) => actual[position] !== char);
    return { index, expected, actual, wrong, count: wrong.filter(Boolean).length };
  }).filter((line) => line.count);
}
// Mark only mistaken characters, keeping a few characters of context around them.
function marked(chars, wrong) {
  const first = wrong.indexOf(true);
  const last = wrong.lastIndexOf(true);
  const from = Math.max(0, first - 10);
  const to = Math.min(chars.length, last + 11);
  return (from > 0 ? '…' : '') + chars.slice(from, to).map((char, offset) => wrong[from + offset] ? '<mark>' + e(char === ' ' ? '␣' : char) + '</mark>' : e(char)).join('') + (to < chars.length ? '…' : '');
}
function deltaHtml(article, record, previous) {
  if (session.drill) return '';
  if (!previous) return '<span class="delta neutral">' + t('firstFinish') + '</span>';
  const diff = record.speed - previous.speed;
  if (diff >= 0.5) return '<span class="delta">' + icon('up') + e(fill('fasterBy', { n: n(diff) + ' ' + unit(article.language) })) + '</span>';
  if (diff <= -0.5) return '<span class="delta neutral">' + e(fill('slowerBy', { n: n(-diff) + ' ' + unit(article.language) })) + '</span>';
  return '<span class="delta neutral">' + t('same') + '</span>';
}
function result() {
  const article = session.article;
  const record = resultRecord;
  const lines = mistakesOf(session);
  const errors = lines.reduce((sum, line) => sum + line.count, 0);
  const earlier = session.drill ? [] : articleRecords(article.id).filter((item) => item.id !== record.id);
  const isBest = earlier.length > 0 && record.speed >= Math.max(...earlier.map((item) => item.speed));
  const drill = Boolean(session.drill);
  const failed = savingStatus === 'failed' && !drill;
  const statusKey = drill ? 'notRecorded' : savingStatus === 'saved' ? 'saved' : failed ? 'saveFailed' : 'saving';
  const next = drill ? null : candidates(article.language).find((item) => item.id !== article.id);
  const trend = drill ? [] : [...earlier, record].slice(-5);
  const top = Math.max(...trend.map((item) => item.speed), 1);
  const shown = lines.slice(0, 5);
  const stat = (label, value, suffix = '', extra = '') => '<div class="result-stat' + extra + '"><div class="result-stat-label">' + t(label) + '</div><span class="num">' + value + '</span>' + (suffix ? '<span class="unit"> ' + suffix + '</span>' : '') + '</div>';

  return '<div class="app"><div class="practice-top"><div class="practice-bar">' + backButton() + practiceHeading(article)
    + '<div class="saved' + (failed ? ' failure' : '') + '" role="status">' + (savingStatus === 'saved' && !drill ? icon('check') : '') + '<span>' + t(statusKey) + '</span>'
    + (failed ? '<button class="button ghost small" data-action="retry-save">' + t('retry') + '</button>' : '') + '</div></div></div>'
    + '<main class="page narrow">' + notices()
    + '<section class="card result-hero" aria-label="' + e(t('finished')) + '"><div class="result-top"><div><p class="result-lead">' + t(drill ? 'drillDone' : isBest ? 'bestEver' : 'finished') + '</p>'
    + '<div class="result-speed"><span class="num">' + n(record.speed) + '</span><span>' + unitLong(article.language) + '</span></div>' + deltaHtml(article, record, earlier.at(-1)) + '</div>'
    + '<div class="result-stats">' + stat('accuracy', n(record.accuracy, 1), '%') + stat('elapsed', duration(record.durationMs)) + stat('mistakes', n(errors), t('mistakesUnit'), errors ? ' error' : '') + '</div></div>'
    + '<div class="result-actions"><button class="button primary" data-action="restart">' + icon('reset') + t('again') + '</button>'
    + (next ? '<button class="button secondary" data-action="start" data-id="' + e(next.id) + '">' + e(fill('nextPassage', { title: next.title })) + icon('arrow') + '</button>' : '<button class="button secondary" data-action="articles">' + t('back') + '</button>')
    + '<a href="#history" class="button ghost" data-action="history">' + t('viewHistory') + '</a></div></section>'
    + '<div class="result-grid"><section class="card result-panel wide" aria-labelledby="mistakes-heading"><div class="panel-head"><h2 id="mistakes-heading">' + t('reviewTitle') + '</h2>'
    + (lines.length ? '<button class="button secondary small" data-action="drill">' + e(fill('drillButton', { count: lines.length })) + '</button>' : '') + '</div>'
    + (lines.length ? shown.map((line) => '<div class="mistake" lang="' + langAttr(article.language) + '"><div class="mistake-line">' + e(fill('lineN', { n: line.index + 1 })) + '</div>'
      + '<div class="mistake-source">' + marked(line.expected, line.wrong) + '</div><div class="mistake-typed">' + fill('typedAs', { text: marked(line.actual, line.wrong) }) + '</div></div>').join('')
      + (lines.length > shown.length ? '<p class="panel-sub">' + e(fill('moreMistakes', { count: lines.length - shown.length })) + '</p>' : '')
      : '<p class="perfect">' + t('perfect') + '</p>') + '</section>'
    + (trend.length ? '<section class="card result-panel" aria-labelledby="trend-heading"><div class="panel-head"><h2 id="trend-heading">' + e(fill('trendTitle', { count: trend.length })) + '</h2></div><p class="panel-sub">' + t('speed') + ' · ' + unitLong(article.language) + '</p>'
      + '<div class="trend" role="img" aria-label="' + e(trend.map((item) => n(item.speed)).join(', ')) + '">' + trend.map((item, index) => '<div class="trend-bar' + (index === trend.length - 1 ? ' now' : '') + '"><span>' + n(item.speed) + '</span><i style="height:' + Math.max(6, Math.round(item.speed / top * 100)) + 'px"></i></div>').join('') + '</div>'
      + '<div class="trend-axis"><span>' + (trend.length > 1 ? t('earlier') : '') + '</span><span>' + t('thisTime') + '</span></div></section>' : '') + '</div>'
    + '<details class="card review"><summary>' + icon('book') + t('fullReview') + '</summary><div class="typing-card" data-lang="' + article.language + '">' + articleRows() + '</div></details>'
    + '</main></div>';
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

function history() {
  const records = recordsFor(articleLanguage);
  const totalMs = records.reduce((sum, item) => sum + item.durationMs, 0);
  const best = records.reduce((max, item) => Math.max(max, item.speed), 0);
  const avg = records.length ? records.reduce((sum, item) => sum + item.accuracy, 0) / records.length : 0;
  const stat = (label, value, suffix) => '<div class="card history-stat"><span class="result-stat-label">' + t(label) + '</span><span class="num">' + value + '</span><span class="unit">' + suffix + '</span></div>';
  return '<div class="history-head"><div><h1 class="page-title">' + t('historyTitle') + '</h1><p>' + t('historyDesc') + '</p></div>'
    + '<div class="history-actions"><button class="button secondary small" data-action="export">' + icon('download') + t('export') + '</button><button class="button secondary small" data-action="import">' + icon('upload') + t('import') + '</button>'
    + '<input class="visually-hidden" type="file" id="import-file" accept=".json,application/json" tabindex="-1" aria-label="' + e(t('import')) + '"></div></div>'
    + '<div class="history-tabs">' + languageTabs('history') + '</div>'
    + '<section class="history-summary">' + stat('totalSessions', n(records.length), t('sessionsUnit')) + stat('totalTime', n(totalMs / 60000, 1), t('minute'))
    + stat('bestSpeed', n(best), unit()) + stat('avgAccuracy', records.length ? n(avg, 1) : '—', '%') + '</section>'
    + (records.length ? '<div class="card history-table-wrap"><table class="history-table"><thead><tr><th>' + t('recordArticle') + '</th><th>' + t('recordTime') + '</th><th>' + t('recordDuration') + '</th><th>' + t('speed') + '</th><th>' + t('accuracy') + '</th><th><span class="visually-hidden">' + t('recordAction') + '</span></th></tr></thead><tbody>'
      + records.map((record) => '<tr><td><div class="record-title" lang="' + langAttr(record.language) + '">' + e(record.title) + '</div><span class="record-sub">' + t(record.language) + ' · ' + record.totalCharacters + ' ' + charsLabel(record.language) + '</span></td>'
        + '<td>' + e(new Date(record.completedAt).toLocaleString(ui === 'en' ? 'en-GB' : 'zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })) + '</td>'
        + '<td>' + duration(record.durationMs) + '</td><td><span class="record-speed">' + n(record.speed) + '</span> <span class="record-sub">' + unit(record.language) + '</span></td><td>' + n(record.accuracy, 1) + '%</td>'
        + '<td>' + (articles.some((article) => article.id === record.articleId) ? '<button class="button ghost small" data-action="start" data-id="' + e(record.articleId) + '">' + t('recordAction') + '</button>' : '') + '</td></tr>').join('')
      + '</tbody></table></div>'
      : '<div class="card empty" style="margin-top:16px">' + icon('history') + '<h3>' + t('historyEmpty') + '</h3><p>' + t('historyEmptyDesc') + '</p><button class="button primary" data-action="articles">' + t('findPassage') + icon('arrow') + '</button></div>')
    + '<p class="storage-note">' + t(storageOk() ? 'platformStorage' : 'unavailableStorage') + '</p>';
}

function render(focusKey) {
  document.documentElement.lang = ui === 'en' ? 'en' : 'zh-CN';
  document.documentElement.dataset.theme = theme;
  document.title = 'Clack';
  app.innerHTML = view === 'articles' ? shell(library()) : view === 'history' ? shell(history()) : practice();
  if (view === 'articles') renderCards();
  if (view === 'practice' && session && session.status !== 'complete') {
    const input = document.querySelector('#typing-input');
    input.value = session.input;
    input.disabled = session.status === 'paused';
    bindTyping(input);
    paintLines();
    paintMetrics();
  }
  if (focusKey) document.querySelector('[data-focus-key="' + focusKey + '"]')?.focus({ preventScroll: true });
}
const CARET = '<span class="caret" aria-hidden="true"></span>';
// The textarea only collects input; what you see is drawn here in fixed-width
// cells under the original, with a caret we draw ourselves at the same column.
function paintInput() {
  const node = document.querySelector('#typed-line');
  const input = document.querySelector('#typing-input');
  if (!node || !session) return;
  const language = session.article.language;
  const target = graphemes(session.chunks[session.index] || '');
  const value = input ? input.value : session.input;
  const status = (index, char) => (char === target[index] ? 'correct' : 'incorrect');
  if (!value) { node.innerHTML = CARET + '<span class="typed-placeholder">' + t('inputPlaceholder') + '</span>'; return; }
  const extra = value.length - session.input.length;
  if (composing && compositionStart !== null && extra > 0) {
    const before = graphemes(value.slice(0, compositionStart));
    const draft = value.slice(compositionStart, compositionStart + extra);
    const after = graphemes(value.slice(compositionStart + extra));
    node.innerHTML = cellSpans(before, target, language, status, e) + '<span class="composing">' + e(draft) + '</span>' + CARET
      + cellSpans(after, target.slice(before.length), language, (index, char) => status(index + before.length, char), e);
    return;
  }
  const chars = graphemes(value);
  const caretAt = input ? graphemes(value.slice(0, input.selectionEnd ?? value.length)).length : chars.length;
  node.innerHTML = cellSpans(chars.slice(0, caretAt), target, language, status, e) + CARET
    + cellSpans(chars.slice(caretAt), target.slice(caretAt), language, (index, char) => status(index + caretAt, char), e);
}
function paintLines() {
  if (!session || session.status === 'complete') return;
  const source = document.querySelector('#source-line');
  if (!source) return;
  const target = graphemes(session.chunks[session.index]);
  const entered = graphemes(session.input);
  source.innerHTML = cellSpans(target, target, session.article.language, (index, char) => (index < entered.length ? (char === entered[index] ? 'done' : 'wrong') : index === entered.length ? 'current' : ''), e);
  paintInput();
}
function paintMetrics() {
  if (view !== 'practice' || !session || session.status === 'complete') return;
  const m = metrics(session);
  const values = { speed: n(m.speed), accuracy: session.submitted ? n(m.accuracy, 1) : '—', elapsed: duration(m.elapsedMs), typed: n(m.typedCharacters) };
  for (const [key, value] of Object.entries(values)) {
    const node = document.querySelector('#metric-' + key);
    if (node && node.textContent !== value) node.textContent = value;
  }
  const bar = document.querySelector('#progress-fill');
  if (bar) {
    bar.style.width = m.progress + '%';
    bar.parentElement.setAttribute('aria-valuenow', String(Math.floor(m.progress)));
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
  input.closest('.passage-row')?.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant',
  });
}
function bindTyping(input) {
  const current = () => input.isConnected && input === document.querySelector('#typing-input');
  input.wrap = 'off';
  for (const type of ['keyup', 'click', 'select', 'focus', 'blur']) input.addEventListener(type, () => { if (current() && !composing) paintInput(); });
  input.addEventListener('compositionstart', () => { if (current()) { composing = true; compositionStart = input.selectionStart; } });
  input.addEventListener('compositionend', () => {
    if (!current()) return;
    composing = false;
    compositionStart = null;
    commitInput(input.value, input);
  });
  input.addEventListener('input', (event) => {
    // An IME may emit an echo on the previous textarea after automatic advance.
    // A detached row can never submit characters into the next row.
    if (!current()) return;
    if (composing || event.isComposing) { paintInput(); return; }
    if (input.value === session.input) return;
    commitInput(input.value, input);
  });
  input.addEventListener('keydown', (event) => {
    if (!current() || event.isComposing || composing || event.keyCode === 229) return;
    if (event.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0 && retreatSession(session)) {
      event.preventDefault();
      const reopened = refreshArticleRows();
      paintLines();
      paintMetrics();
      reopened.focus({ preventScroll: true });
      reopened.setSelectionRange(reopened.value.length, reopened.value.length);
      paintInput();
      centerTypingInput(true);
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); restart(); }
    else if (event.key === 'Enter') event.preventDefault();
    else if (event.key === 'Escape') { event.preventDefault(); togglePause(); }
  });
  input.addEventListener('paste', (event) => { event.preventDefault(); toast('pasteBlocked'); });
  input.addEventListener('drop', (event) => { event.preventDefault(); toast('pasteBlocked'); });
  input.addEventListener('beforeinput', (event) => { if (['insertFromPaste', 'insertFromDrop'].includes(event.inputType)) { event.preventDefault(); toast('pasteBlocked'); } });
}
// Measures a hidden copy of the practice row, so a line always fits exactly
// the cells the stylesheet gives it, whatever the window width or font.
function chunkSize(article) {
  const language = article.language;
  const probe = document.createElement('div');
  probe.className = 'practice-page';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;pointer-events:none';
  probe.innerHTML = '<div class="card typing-card" data-lang="' + language + '"><div class="passage-row active"><span class="row-number">00</span><div class="row-content"><div class="source-line">'
    + ('<span class="c ' + (language === 'zh' ? 'w">国' : 'n">0') + '</span>').repeat(10) + '</div></div></div></div>';
  document.body.appendChild(probe);
  const width = probe.querySelector('.row-content').getBoundingClientRect().width;
  const cell = probe.querySelector('.source-line .c').getBoundingClientRect().width;
  probe.remove();
  const fits = cell > 0 ? Math.floor((width - 2) / cell) : 30;
  return Math.max(6, Math.min(language === 'zh' ? 40 : 80, fits));
}
function begin(article, drill = false) {
  articleLanguage = article.language;
  session = createSession(article, chunkSize(article));
  session.drill = drill;
  view = 'practice'; composing = false; resultRecord = null; savingStatus = '';
  render();
  window.scrollTo(0, 0);
  document.querySelector('#typing-input')?.focus({ preventScroll: true });
  centerTypingInput();
}
function start(articleId) { const article = articles.find((item) => item.id === articleId); if (article) begin(article); }
function restart() { if (session) begin(session.article, session.drill); }
function startDrill() {
  if (!session) return;
  const lines = mistakesOf(session);
  if (lines.length) begin({ ...session.article, text: lines.map((line) => line.expected.join('')).join('') }, true);
}
function finishSession() {
  const m = metrics(session);
  resultRecord = { id: crypto.randomUUID(), articleId: session.article.id, language: session.article.language, title: session.article.title,
    completedAt: new Date().toISOString(), durationMs: Math.max(1, Math.round(m.elapsedMs)), speed: Number(m.speed.toFixed(2)),
    accuracy: Number(m.accuracy.toFixed(2)), correctCharacters: m.correctCharacters, typedCharacters: m.typedCharacters, totalCharacters: m.totalCharacters };
  composing = false;
  if (session.drill) savingStatus = 'drill';
  else {
    pendingResults.set(resultRecord.id, { record: resultRecord, status: 'pending' });
    void persistResult();
  }
  render();
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
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
function setPressed(action, value) {
  for (const node of document.querySelectorAll('[data-action="' + action + '"]')) node.setAttribute('aria-pressed', String(node.dataset.value === value));
}

app.addEventListener('click', (event) => {
  const node = event.target.closest('[data-action]');
  if (!node) return;
  const action = node.dataset.action;
  if (node.tagName === 'A') event.preventDefault();
  if (action === 'articles' || action === 'history') navigate(action);
  else if (action === 'ui-language') {
    if (node.dataset.lang === ui) return;
    if (session?.status === 'running') pauseSession(session);
    composing = false; ui = node.dataset.lang; render('ui-' + ui); void preferences({ uiLanguage: ui });
  } else if (action === 'theme') {
    if (node.dataset.value === theme) return;
    theme = node.dataset.value;
    document.documentElement.dataset.theme = theme;
    setPressed('theme', theme);
    void preferences({ theme });
  } else if (action === 'article-language') {
    if (node.dataset.language === articleLanguage) return;
    articleLanguage = node.dataset.language; category = 'all'; lengthFilter = 'all'; search = ''; shuffle = 0;
    render('lang-' + articleLanguage); void preferences({ articleLanguage });
  } else if (action === 'category') { category = node.dataset.value; setPressed('category', category); renderCards(); }
  else if (action === 'length') { lengthFilter = node.dataset.value; setPressed('length', lengthFilter); renderCards(); }
  else if (action === 'reset-filters') { category = 'all'; lengthFilter = 'all'; search = ''; render(); }
  else if (action === 'shuffle') {
    shuffle += 1;
    document.querySelector('.hero')?.insertAdjacentHTML('afterend', hero());
    document.querySelector('.hero')?.remove();
    document.querySelector('[data-action="shuffle"]')?.focus({ preventScroll: true });
  } else if (action === 'start') start(node.dataset.id);
  else if (action === 'restart') restart();
  else if (action === 'drill') startDrill();
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
document.addEventListener('keydown', (event) => {
  if (event.isComposing || event.defaultPrevented) return;
  const inControl = event.target.closest?.('input, textarea, button, a, select, summary, [contenteditable]');
  if (view === 'articles' && event.key === 'Enter' && !inControl) { event.preventDefault(); start(recommended().id); }
  else if (view === 'practice' && session?.status === 'paused' && event.key === 'Escape') { event.preventDefault(); togglePause(); }
  else if (view === 'practice' && session && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); restart(); }
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
document.addEventListener('selectionchange', () => {
  if (!composing && document.activeElement?.id === 'typing-input') paintInput();
});
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
  } else if (event.type === 'error' && view !== 'practice') render();
});
render();

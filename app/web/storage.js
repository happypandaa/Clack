// 浏览器里用平台注入的全局 SDK；Node 测试通过依赖注入传入隔离适配器。
const platform = typeof window !== 'undefined' ? window.panda : undefined;

const MAX_RECORDS = 10000;
const LANGUAGES = new Set(['zh', 'en']);
const COLUMNS = 'id, article_id, language, title, completed_at, duration_ms, speed, accuracy, correct_characters, typed_characters, total_characters';
const INSERT_RECORDS = `INSERT INTO clack_records (${COLUMNS})
  SELECT ${Array.from({ length: 11 }, (_, index) => `json_extract(value, '$[${index}]')`).join(', ')}
  FROM json_each(?) WHERE 1 ON CONFLICT(id) DO NOTHING`;
const initial = () => ({ version: 1, settings: { uiLanguage: 'zh', articleLanguage: 'zh' }, records: [] });
const copy = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const count = value => Number.isSafeInteger(value) && value >= 0;

function failure(message, code = 'INVALID_DATA') {
  return Object.assign(new Error(message), { code });
}

function timestamp(value) {
  if (typeof value !== 'string' || value.length > 40) throw failure('invalidData');
  const parts = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) throw failure('invalidData');
  const [, year, month, day] = parts.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw failure('invalidData');
  return new Date(value).toISOString();
}

function record(value) {
  if (!object(value) || !text(value.id, 160) || !text(value.articleId, 160) || !text(value.title, 500)
    || !LANGUAGES.has(value.language) || !number(value.durationMs) || value.durationMs === 0
    || !number(value.speed) || !number(value.accuracy) || value.accuracy > 100
    || !count(value.correctCharacters) || !count(value.typedCharacters) || !count(value.totalCharacters)
    || value.correctCharacters > value.typedCharacters || value.typedCharacters > value.totalCharacters) {
    throw failure('invalidData');
  }
  const { id, articleId, language, title, durationMs, speed, accuracy, correctCharacters, typedCharacters, totalCharacters } = value;
  return { id, articleId, language, title, completedAt: timestamp(value.completedAt), durationMs, speed, accuracy, correctCharacters, typedCharacters, totalCharacters };
}

function fromRow(row) {
  return record({ id: row.id, articleId: row.article_id, language: row.language, title: row.title,
    completedAt: row.completed_at, durationMs: row.duration_ms, speed: row.speed, accuracy: row.accuracy,
    correctCharacters: row.correct_characters, typedCharacters: row.typed_characters, totalCharacters: row.total_characters });
}

function compact(value) {
  return [value.id, value.articleId, value.language, value.title, value.completedAt, value.durationMs,
    value.speed, value.accuracy, value.correctCharacters, value.typedCharacters, value.totalCharacters];
}

/** Dependency injection is only for isolated tests; the application uses platform. */
export function createStorageAdapter(sdk = platform) {
  let state = initial();
  let mode = 'unavailable';
  let pending = Promise.resolve();
  let stopEvents;
  let reloadRequired = false;
  const listeners = new Set();
  const emit = event => { for (const listener of listeners) { try { listener(event); } catch { /* UI listeners cannot interrupt persistence. */ } } };
  const serialize = operation => {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };

  function unavailable(error) {
    mode = 'unavailable';
    if (error.code === 'PROJECT_RELOAD_REQUIRED') {
      reloadRequired = true;
      emit({ type: 'reload-required' });
    }
    emit({ type: 'error', error });
  }

  function connectEvents() {
    if (stopEvents) return;
    try {
      stopEvents = sdk.db.subscribe(event => {
        if (event.type === 'data.changed') void api.loadState();
        else if (event.type === 'project.updated') {
          reloadRequired = true;
          mode = 'unavailable';
          emit({ type: 'reload-required' });
        } else if (event.type === 'error') unavailable(event.error);
      });
    } catch (error) { unavailable(error); }
  }

  async function context() {
    if (reloadRequired) throw failure('请保存当前练习内容后，从平台重新打开应用。', 'PROJECT_RELOAD_REQUIRED');
    const value = await sdk.context.get();
    if (value.state?.reloadRequired) throw failure('请从平台重新打开应用。', 'PROJECT_RELOAD_REQUIRED');
    return value;
  }

  async function readState() {
    const info = await context();
    const pageSize = Math.max(1, Math.min(200, info.limits?.sqlMaxRows || 200,
      Math.floor((info.limits?.sqlResultMaxBytes || 8_000_000) / 8000)));
    const savedSettings = await sdk.db.execute({
      sql: "SELECT MAX(CASE key WHEN 'uiLanguage' THEN value END) AS ui_language, MAX(CASE key WHEN 'articleLanguage' THEN value END) AS article_language FROM clack_settings",
      params: [], options: { maxRows: 1 },
    });
    const settings = { uiLanguage: 'zh', articleLanguage: 'zh' };
    const saved = savedSettings.rows[0] || {};
    for (const [key, column] of [['uiLanguage', 'ui_language'], ['articleLanguage', 'article_language']]) {
      if (saved[column] === null || saved[column] === undefined) continue;
      if (!LANGUAGES.has(saved[column])) throw failure('已保存的语言设置格式无效。');
      settings[key] = saved[column];
    }
    const records = [];
    let cursor = null;
    while (true) {
      const result = await sdk.db.execute({
        sql: `SELECT ${COLUMNS} FROM clack_records${cursor === null ? '' : ' WHERE id > ?'} ORDER BY id LIMIT ?`,
        params: cursor === null ? [pageSize] : [cursor, pageSize], options: { maxRows: pageSize },
      });
      records.push(...result.rows.map(fromRow));
      if (records.length > MAX_RECORDS) throw failure('历史记录超过可支持的数量。');
      if (result.rows.length < pageSize) break;
      const next = result.rows.at(-1).id;
      if (next === cursor) throw failure('历史记录分页无效。');
      cursor = next;
    }
    state = { version: 1, settings, records };
    mode = 'platform';
    return info;
  }

  function changed() {
    emit({ type: 'changed', state: copy(state) });
    return copy(state);
  }

  function mutate(operation) {
    return serialize(async () => {
      try {
        const info = await readState(); // An explicit retry verifies existing data first.
        await operation(info);
        await readState();
        connectEvents();
        return changed();
      } catch (error) {
        // operationOutcome: unknown is never replayed here.
        unavailable(error);
        throw error;
      }
    });
  }

  async function insert(values, info) {
    const existing = new Set(state.records.map(item => item.id));
    const additions = [];
    for (const value of values) {
      if (!existing.has(value.id)) { existing.add(value.id); additions.push(value); }
    }
    if (existing.size > MAX_RECORDS) throw failure('invalidData');
    if (!additions.length) return;
    // One bound JSON parameter and one transaction keep the entire import atomic.
    const request = { statements: [{ sql: INSERT_RECORDS, params: [JSON.stringify(additions.map(compact))] }] };
    const maxBytes = info.limits?.jsonBodyMaxBytes;
    if (Number.isFinite(maxBytes) && new TextEncoder().encode(JSON.stringify(request)).length > maxBytes) {
      throw failure('导入内容超过平台单次请求限制，请缩小文件后重试。', 'IMPORT_TOO_LARGE');
    }
    await sdk.db.transaction(request);
  }

  const api = {
    loadState() {
      return serialize(async () => {
        try { await readState(); connectEvents(); return changed(); }
        catch (error) { unavailable(error); return copy(state); }
      });
    },
    storageMode: () => mode,
    saveSettings(value) {
      if (!object(value)) return Promise.reject(failure('invalidData'));
      const entries = Object.entries(value).filter(([key]) => ['uiLanguage', 'articleLanguage'].includes(key));
      if (entries.some(([, language]) => !LANGUAGES.has(language))) return Promise.reject(failure('invalidData'));
      return mutate(async () => {
        if (!entries.length) return;
        await sdk.db.transaction({ statements: entries.map(([key, language]) => ({
          sql: 'INSERT INTO clack_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          params: [key, language],
        })) });
      });
    },
    saveRecord(value) {
      let valid;
      try { valid = record(value); } catch (error) { return Promise.reject(error); }
      return mutate(info => insert([valid], info));
    },
    importRecords(value) {
      let values;
      try {
        if (!object(value) || value.version !== 1 || !Array.isArray(value.records) || value.records.length > MAX_RECORDS) throw failure('invalidData');
        values = value.records.map(record);
      } catch (error) { return Promise.reject(error); }
      return mutate(info => insert(values, info));
    },
    exportState: () => JSON.stringify(state, null, 2),
    subscribeStorage(listener) {
      if (typeof listener !== 'function') throw new TypeError('A storage listener is required.');
      listeners.add(listener);
      connectEvents();
      return () => listeners.delete(listener);
    },
    dispose() { stopEvents?.(); stopEvents = undefined; listeners.clear(); },
  };
  return api;
}

const storage = createStorageAdapter();
export const loadState = storage.loadState;
export const saveSettings = storage.saveSettings;
export const saveRecord = storage.saveRecord;
export const importRecords = storage.importRecords;
export const exportState = storage.exportState;
export const storageMode = storage.storageMode;
export const subscribeStorage = storage.subscribeStorage;

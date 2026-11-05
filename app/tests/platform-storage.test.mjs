import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { createStorageAdapter } from '../web/storage.js';

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const sample = (id = 'practice-1', extra = {}) => ({ id, articleId: 'article-1', language: 'zh', title: '一个早晨',
  completedAt: '2026-10-30T09:00:00.000Z', durationMs: 60000, speed: 30, accuracy: 96.8,
  correctCharacters: 30, typedCharacters: 31, totalCharacters: 31, ...extra });

function fixture(t, { initialize = true, limits = {} } = {}) {
  const database = new DatabaseSync(':memory:');
  if (initialize) database.exec(schema);
  const eventListeners = new Set();
  const stats = { transactions: 0, reads: 0, failAfterCommit: false, offline: false };
  const context = { limits: { sqlMaxRows: 3, sqlResultMaxBytes: 8000000, transactionMaxStatements: 100, jsonBodyMaxBytes: 2000000, ...limits }, state: { mode: 'normal', reloadRequired: false } };
  const execute = ({ sql, params = [], options = {} }) => {
    const statement = database.prepare(sql);
    const columns = statement.columns();
    if (columns.length) {
      stats.reads += 1;
      const rows = statement.all(...params);
      if (rows.length > (options.maxRows ?? 1000)) throw new Error('row budget exceeded');
      return { columns: columns.map(column => ({ name: column.name })), rows, changes: 0, changed: false };
    }
    const result = statement.run(...params);
    return { columns: [], rows: [], changes: Number(result.changes), changed: Boolean(result.changes) };
  };
  const sdk = {
    context: { async get() {
      if (stats.offline) throw Object.assign(new Error('offline'), { code: 'PLATFORM_UNAVAILABLE' });
      return structuredClone(context);
    } },
    db: {
      async schema() {
        return { tables: database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() };
      },
      async execute(request) { return execute(request); },
      async transaction({ statements }) {
        stats.transactions += 1;
        assert.ok(statements.length <= context.limits.transactionMaxStatements);
        database.exec('BEGIN');
        let results;
        try { results = statements.map(execute); database.exec('COMMIT'); }
        catch (error) { database.exec('ROLLBACK'); throw error; }
        if (stats.failAfterCommit) {
          stats.failAfterCommit = false;
          throw Object.assign(new Error('response lost'), { code: 'PLATFORM_UNAVAILABLE', details: { operationOutcome: 'unknown' } });
        }
        return results;
      },
      subscribe(listener) { eventListeners.add(listener); return () => eventListeners.delete(listener); },
    },
  };
  const adapter = createStorageAdapter(sdk, async () => schema);
  t.after(() => { adapter.dispose(); database.close(); });
  return { adapter, sdk, database, stats, context, emit: event => eventListeners.forEach(listener => listener(event)) };
}

test('platform settings and records persist independently of a frontend adapter instance', async t => {
  const { adapter, sdk, stats } = fixture(t);
  assert.equal(adapter.storageMode(), 'unavailable');
  assert.deepEqual(await adapter.loadState(), { version: 1, settings: { uiLanguage: 'zh', articleLanguage: 'zh', theme: 'ink' }, records: [] });
  assert.equal(adapter.storageMode(), 'platform');
  await adapter.saveSettings({ uiLanguage: 'en' });
  await adapter.saveRecord(sample());
  const reopened = createStorageAdapter(sdk);
  t.after(() => reopened.dispose());
  const state = await reopened.loadState();
  assert.deepEqual(state.settings, { uiLanguage: 'en', articleLanguage: 'zh', theme: 'ink' });
  assert.deepEqual(state.records, [sample()]);
  assert.equal(stats.transactions, 2);
  assert.deepEqual(JSON.parse(reopened.exportState()), state);
});

test('history is read completely through runtime-limited keyset pages', async t => {
  const { adapter, stats } = fixture(t);
  await adapter.importRecords({ version: 1, records: Array.from({ length: 11 }, (_, index) => sample(`page-${index}`)) });
  stats.reads = 0;
  const state = await adapter.loadState();
  assert.equal(state.records.length, 11);
  assert.equal(new Set(state.records.map(record => record.id)).size, 11);
  assert.equal(stats.reads, 6); // Settings, theme, then four record pages of at most three rows.
});

test('parallel preferences and results are serialized without losing changes', async t => {
  const { adapter } = fixture(t);
  await Promise.all([adapter.saveSettings({ uiLanguage: 'en' }), adapter.saveSettings({ articleLanguage: 'en' }),
    ...Array.from({ length: 8 }, (_, index) => adapter.saveRecord(sample(`parallel-${index}`)))]);
  const state = await adapter.loadState();
  assert.deepEqual(state.settings, { uiLanguage: 'en', articleLanguage: 'en', theme: 'ink' });
  assert.equal(state.records.length, 8);
});

test('record IDs are idempotent, SQL values are bound, imports are one transaction', async t => {
  const { adapter, database, stats } = fixture(t);
  const title = "'); DROP TABLE clack_records; --";
  await adapter.saveRecord(sample('same', { title }));
  const before = stats.transactions;
  const state = await adapter.importRecords({ version: 1, records: [sample('same'), sample('new'), sample('new', { title: 'second duplicate' })] });
  assert.equal(stats.transactions, before + 1);
  assert.equal(state.records.length, 2);
  assert.equal(state.records.find(record => record.id === 'same').title, title);
  assert.equal(state.records.find(record => record.id === 'new').title, '一个早晨');
  await adapter.saveRecord(sample('same', { title: 'conflicting retry' }));
  assert.equal(stats.transactions, before + 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM clack_records').get().count, 2);
});

test('unknown write outcome is not replayed, explicit retry first verifies persisted ID', async t => {
  const { adapter, stats } = fixture(t);
  stats.failAfterCommit = true;
  await assert.rejects(adapter.saveRecord(sample()), error => error.details.operationOutcome === 'unknown');
  assert.equal(stats.transactions, 1);
  assert.equal(adapter.storageMode(), 'unavailable');
  const state = await adapter.saveRecord(sample());
  assert.equal(state.records.length, 1);
  assert.equal(stats.transactions, 1);
});

test('first use prepares an empty database and saved results survive reopening', async t => {
  const { adapter, sdk, database, stats } = fixture(t, { initialize: false });
  assert.deepEqual(await adapter.loadState(), { version: 1, settings: { uiLanguage: 'zh', articleLanguage: 'zh', theme: 'ink' }, records: [] });
  assert.equal(adapter.storageMode(), 'platform');
  assert.equal(stats.transactions, 1);
  await adapter.saveSettings({ articleLanguage: 'en' });
  await adapter.saveRecord(sample());
  const reopened = createStorageAdapter(sdk);
  t.after(() => reopened.dispose());
  const state = await reopened.loadState();
  assert.equal(state.settings.articleLanguage, 'en');
  assert.deepEqual(state.records, [sample()]);
  assert.equal(stats.transactions, 3);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name = 'clack_records_limit'").get().count, 1);
});

test('first use preserves existing records when completing a partially prepared database', async t => {
  const { adapter, database } = fixture(t);
  const value = sample();
  database.prepare('INSERT INTO clack_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    value.id, value.articleId, value.language, value.title, value.completedAt, value.durationMs,
    value.speed, value.accuracy, value.correctCharacters, value.typedCharacters, value.totalCharacters);
  database.exec('DROP TABLE clack_settings');
  assert.deepEqual((await adapter.loadState()).records, [value]);
  assert.equal(adapter.storageMode(), 'platform');
});

test('an unavailable platform never initializes the database or falls back to browser storage', async t => {
  const { adapter, database, stats } = fixture(t, { initialize: false });
  stats.offline = true;
  assert.equal((await adapter.loadState()).records.length, 0);
  assert.equal(adapter.storageMode(), 'unavailable');
  await assert.rejects(adapter.saveRecord(sample()));
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'").get().count, 0);
  assert.equal(stats.transactions, 0);
});

test('failed initialization rolls back and a later explicit load can retry', async t => {
  const { sdk, database, stats } = fixture(t, { initialize: false });
  let schemaText = `${schema}\nCREATE TABLE broken (`;
  const adapter = createStorageAdapter(sdk, async () => schemaText);
  t.after(() => adapter.dispose());
  await adapter.loadState();
  assert.equal(adapter.storageMode(), 'unavailable');
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'").get().count, 0);
  assert.equal(stats.transactions, 1);
  schemaText = schema;
  await adapter.loadState();
  assert.equal(adapter.storageMode(), 'platform');
  assert.equal(stats.transactions, 2);
  assert.deepEqual((await adapter.saveRecord(sample())).records, [sample()]);
});

test('invalid imports and body limits fail before any writes, existing records remain intact', async t => {
  const { adapter, context, stats } = fixture(t);
  await adapter.saveRecord(sample('existing'));
  for (const extra of [{ durationMs: 0 }, { accuracy: 101 }, { language: 'fr' }, { correctCharacters: 32 }, { completedAt: '2026-02-30T00:00:00Z' }]) {
    await assert.rejects(adapter.importRecords({ version: 1, records: [sample('valid'), sample('invalid', extra)] }));
  }
  const before = stats.transactions;
  context.limits.jsonBodyMaxBytes = 20;
  await assert.rejects(adapter.importRecords({ version: 1, records: [sample('too-large')] }), error => error.code === 'IMPORT_TOO_LARGE');
  assert.equal(stats.transactions, before);
  assert.deepEqual((await adapter.loadState()).records.map(record => record.id), ['existing']);
});

test('SQL constraints reject invalid direct values and schema initialization is idempotent', t => {
  const { database } = fixture(t);
  database.exec(schema);
  assert.throws(() => database.prepare('INSERT INTO clack_settings (key, value) VALUES (?, ?)').run('uiLanguage', 'fr'));
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM clack_settings').get().count, 0);
});

test('SQL record limit rejects overflow without eviction and keeps duplicate retries valid', t => {
  const { database } = fixture(t);
  database.exec(`WITH RECURSIVE numbers(value) AS (SELECT 1 UNION ALL SELECT value + 1 FROM numbers WHERE value < 10000)
    INSERT INTO clack_records SELECT CAST(value AS TEXT), 'article', 'en', 'Title', '2026-10-30T09:00:00.000Z', 1, 1, 100, 1, 1, 1 FROM numbers`);
  const insert = database.prepare("INSERT INTO clack_records VALUES (?, 'article', 'en', 'Title', '2026-10-30T09:00:00.000Z', 1, 1, 100, 1, 1, 1) ON CONFLICT(id) DO NOTHING");
  assert.throws(() => insert.run('overflow'), /limited to 10000/);
  assert.doesNotThrow(() => insert.run('1'));
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM clack_records').get().count, 10000);
});

test('timestamps normalize to UTC, and extra imported fields are excluded from persistent records', async t => {
  const { adapter } = fixture(t);
  const result = await adapter.saveRecord(sample('timezone', { completedAt: '2026-10-30T17:00:00+08:00', ignored: 'not persisted' }));
  assert.equal(result.records[0].completedAt, '2026-10-30T09:00:00.000Z');
  assert.equal(Object.hasOwn(result.records[0], 'ignored'), false);
});

test('database notifications refresh data and project updates require explicit reopen', async t => {
  const { adapter, emit, stats } = fixture(t);
  const events = [];
  adapter.subscribeStorage(event => events.push(event));
  await adapter.loadState();
  emit({ type: 'data.changed' });
  await adapter.loadState();
  assert.ok(events.some(event => event.type === 'changed'));
  emit({ type: 'project.updated' });
  assert.equal(adapter.storageMode(), 'unavailable');
  assert.ok(events.some(event => event.type === 'reload-required'));
  await assert.rejects(adapter.saveRecord(sample()), error => error.code === 'PROJECT_RELOAD_REQUIRED');
  assert.equal(stats.transactions, 0);
});

test('theme preference is validated, saved in its own table and added to older databases', async t => {
  const { adapter, sdk, database } = fixture(t);
  database.exec('DROP TABLE clack_preferences');
  assert.equal((await adapter.loadState()).settings.theme, 'ink');
  await assert.rejects(adapter.saveSettings({ theme: 'neon' }), error => error.code === 'INVALID_DATA');
  await adapter.saveSettings({ theme: 'tea', uiLanguage: 'en' });
  const reopened = createStorageAdapter(sdk);
  t.after(() => reopened.dispose());
  assert.deepEqual((await reopened.loadState()).settings, { uiLanguage: 'en', articleLanguage: 'zh', theme: 'tea' });
  assert.throws(() => database.prepare('INSERT INTO clack_preferences (key, value) VALUES (?, ?)').run('theme', 'neon'));
  assert.throws(() => database.prepare('INSERT INTO clack_settings (key, value) VALUES (?, ?)').run('theme', 'ink'));
});

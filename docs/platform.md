# 平台集成

Clack 是网页应用（`runtime: web`），通过 `panda.json` 声明入口和构建。网页引入平台提供的 `<script src="/_platform/sdk.js">`，得到全局 `window.panda`（`Panda.Platform`），用于访问项目 SQLite 和附件，无需安装 npm 包。SDK API 版本为 1。

## SDK 使用

```js
// 引入方式：在 index.html 中先加载 <script src="/_platform/sdk.js">，再在模块里用全局对象
const sdk = window.panda;

const context = await sdk.context.get();
console.log(context.projectId, context.name, context.capabilities);
```

从平台独立项目窗口打开。不要写死端口或长期保存入口 URL。直接双击 HTML、直接打开 Vite 开发地址没有项目会话，SDK 会明确报错。

## SQL 和数据类型

```js
const result = await sdk.db.execute({
  sql: 'SELECT id, word FROM words WHERE word LIKE ? ORDER BY word',
  params: ['a%'],
});
await sdk.db.transaction({ statements: [
  { sql: 'INSERT INTO words(id, word) VALUES (?, ?)', params: ['word-1', 'apple'] },
  { sql: 'INSERT INTO practice(id, word_id) VALUES (?, ?)', params: ['practice-1', 'word-1'] },
] });
const schema = await sdk.db.schema();
```

SQL 参数支持 `null`、字符串、有限 number、bigint、布尔值和 Uint8Array。布尔值写为 0/1，读出仍是 number。整数 number 必须安全；大整数用 bigint。结果含 `columns`、对象 `rows`、`changes`、适用时的 `lastInsertRowid`；大整数返回 bigint，BLOB 返回 Uint8Array。

先读取项目 `docs/database.md` 和真实 schema，再执行明确的数据操作。用户输入用参数绑定；一次 execute 只提交一条语句。多语句事务统一提交或回滚。表结构变更不放在构建脚本中，构建不初始化或清空数据库。

## 附件

```js
await sdk.files.put({ path: 'notes/example.txt', content: new Blob(['hello'], { type: 'text/plain' }) });
const blob = await sdk.files.get('notes/example.txt');
const files = await sdk.files.list('notes/');
await sdk.files.remove('notes/example.txt');
```

逻辑路径相对 `data/attachments/`；保存路径，不在数据库保存临时 URL。默认不覆盖，确需覆盖传 `overwrite: true`。读文件返回 Blob；`files.url` 返回会话 URL，不应跨会话保存。SQL 与附件不是同一事务，业务代码需处理部分成功。

## 通知、重载与错误

```js
const unsubscribe = sdk.db.subscribe(event => {
  if (event.type === 'data.changed') void reloadFromDatabase();
  if (event.type === 'project.updated') showExplicitReloadButton();
  if (event.type === 'error') showError(event.error);
});
unsubscribe();
```

`data.changed` 是项目级失效通知，不是行级同步。`project.updated` 表示新构建已发布，网页应提示用户明确重载，不能自动丢弃表单。`error` 事件和方法失败均使用 `PlatformError`，含 `code`、`message`、`details`、`retryable`。网络中断后的写入可能已经提交，先重新查询再决定操作，不自动重复 SQL、上传或删除。

平台规则和完整接口以熊猫小抽屉随附的 skill 与 `panda.d.ts` 类型声明为准。

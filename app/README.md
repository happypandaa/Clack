# Clack 前端源码

页面与逻辑在 `web/`，使用 Vite 打包。网页通过平台注入的 `/_platform/sdk.js`（`window.panda`）访问数据库，不安装 npm SDK 包；Node 仅用于构建与测试，运行使用平台原生服务和 SQLite。

在本目录执行 `npm ci`、`npm test`、`npm run build`。平台按 `panda.json` 的 `development.build` 执行构建，产物输出到 `dist/`。

数据库初始化 SQL 在 `db/schema.sql`，通过平台 CLI 的托管事务执行，不由页面或构建自动执行。接入步骤见 [项目说明](../README.md)，数据和接口约定见 [数据库说明](../docs/database.md) 与 [平台说明](../docs/platform.md)。

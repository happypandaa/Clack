# Clack 前端源码

页面与逻辑在 `web/`，使用 Vite 打包。网页通过平台注入的 `/_platform/sdk.js`（`window.panda`）访问数据库，不安装 npm SDK 包；Node 仅用于构建与测试，运行使用平台原生服务和 SQLite。

在本目录执行 `pnpm install`、`pnpm test`、`pnpm run build`。平台按 `panda.json` 的 `development.build` 使用受管 npm 执行构建，产物输出到 `dist/`；构建不初始化或修改业务数据。

数据库初始化 SQL 在 `db/schema.sql`，应用首次打开时通过平台 SDK 事务自动执行，只补齐缺失的结构，保留已有结构和练习记录。初始化失败会显示错误并允许重试，不清空数据库；构建不执行初始化。接入步骤见 [项目说明](../README.md)，数据和接口约定见 [数据库说明](../docs/database.md) 与 [平台说明](../docs/platform.md)。

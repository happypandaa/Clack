# Clack 数据库

Clack 是网页应用，网页通过平台注入的 `/_platform/sdk.js`（`window.panda`）访问平台 SQLite。业务无需 Node 服务、外部网络或浏览器存储。数据库为项目的 `data/main.sqlite`，由平台管理；不在源码中写数据库路径、端口、令牌或项目身份。

## 表结构

`clack_settings` 保存两项独立偏好。`key TEXT NOT NULL PRIMARY KEY` 仅允许 `uiLanguage`、`articleLanguage`；`value TEXT NOT NULL` 仅允许 `zh`、`en`。没有默认行，缺行时界面使用中文。切换文章语言不改变界面语言。

`clack_preferences` 保存界面主题。`key` 仅允许 `theme`；`value` 仅允许 `ink`（墨，默认）、`pine`（松）、`tea`（茶）。缺行时使用 `ink`。主题单独成表，是因为 `clack_settings` 的约束只接受语言值，而 SQLite 不能就地修改已有表的 CHECK 约束。

`clack_records` 保存完成练习的结果，所有字段非空：

| 列 | 类型及约束 | 含义 |
| --- | --- | --- |
| `id` | TEXT 主键，1–160 字符 | 一次练习的稳定 ID；重试和导入以此去重 |
| `article_id` | TEXT，1–160 字符 | 内置文章 ID；文章删除后历史仍保留 |
| `language` | TEXT，`zh` / `en` | 文章语言，也是统计分组依据 |
| `title` | TEXT，1–500 字符 | 完成时的文章标题快照 |
| `completed_at` | TEXT，24 字符 | ISO-8601 UTC 毫秒时间，例如 `2026-10-30T09:00:00.000Z` |
| `duration_ms` | REAL，正有限值 | 排除暂停的练习时长，单位毫秒 |
| `speed` | REAL，非负有限值 | 前端计算的速度；中文正确字/分钟，英文每 5 个正确字符折算 WPM |
| `accuracy` | REAL，0–100 | 前端计算的累计输入准确率，百分数 |
| `correct_characters` | INTEGER，非负安全整数 | 最终正确字符数 |
| `typed_characters` | INTEGER，非负安全整数 | 最终已输入字符数，不小于正确字符数 |
| `total_characters` | INTEGER，非负安全整数 | 原文总字符数，不小于已输入字符数 |

两表使用 SQLite STRICT 模式，无外键，无自动时间默认值。索引 `clack_records_language_completed_at` 覆盖 `(language, completed_at DESC)`。触发器 `clack_records_limit` 阻止新增第 10001 条不同 ID 的记录；已有 ID 仍可幂等处理，不淘汰或删除历史。

## 初始化与兼容

初始化 SQL 为 [schema.sql](../app/db/schema.sql)，包含三张表、索引和触发器五条可重复执行的 `CREATE ... IF NOT EXISTS`。应用首次打开时通过平台 SDK 的事务自动准备，无需开发者或用户先执行 CLI 初始化。触发器体内部含分号，提交时须把整个触发器作为一条 statement，不按全部分号切分。构建过程不执行 DDL，也不读取或修改业务数据。

初始化只补齐缺失的结构，不写练习记录或偏好，不替换已有结构或修改已有记录；再次打开可安全重复准备。初始化失败时保留数据库和已有记录，显示错误并允许用户明确重试，不删除数据库后重建。后续若结构不同，应先读取真实 schema 并制定兼容迁移；`IF NOT EXISTS` 不会修复既有不兼容结构。不得替换数据库或清理 WAL/SHM。

## 读写约定

所有用户值通过 SDK 的 `params` 绑定。历史按 ID 使用游标分页，页大小不超过实时 `context.limits.sqlMaxRows` 和结果体预算，最多读取 10000 条，不截断为浏览器默认的前 1000 行。

偏好以受管事务 upsert。保存成绩前重新查询已有 ID；已存在的记录不改写。导入校验整个文件后，以紧凑列数组作为单个 JSON 参数，通过 SQLite `json_each` 和 `json_extract` 一次插入、`ON CONFLICT(id) DO NOTHING`，整个导入为一个平台事务。现有 ID 的数据优先；导入文件中的重复 ID 保留第一条。超出平台实时 JSON 请求预算时，在任何写入之前拒绝，不拆成部分成功的批次。导入不改变当前偏好。

写入失败或 `operationOutcome: unknown` 不自动重放，也不显示保存成功。用户明确重试时先读数据库，核对原练习 ID 后才决定是否需要插入。数据库不可用时可以继续练习，但成绩须保留为待保存，界面明确提示失败；不以 localStorage、IndexedDB 或临时 JSON 文件替代主数据。

`data.changed` 只触发重新查询。`project.updated` 或 `PROJECT_RELOAD_REQUIRED` 触发明确的重新打开提示并停止旧页面写入，不自动刷新或丢弃练习。JSON 导出是用户主动取得的已加载记录副本，不是平台数据库备份或跨设备同步。

## 验证范围

`tests/platform-storage.test.mjs` 使用 Node 内存 SQLite 和隔离 SDK 适配器，覆盖持久化合同、分页、并发、SQL 参数绑定、导入去重与事务、未知写入结果、不可用状态、输入校验及更新提示。测试不触碰真实平台数据库。真实平台构建、原生窗口开关与重新打开后的数据保留由项目交付验证另记。

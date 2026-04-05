# Project Design Review

**Date:** 2026-04-06
**Reviewers:** Claude Code + Codex

---

## Summary

Sessions 是一个用于管理 Claude Code 对话上下文的 TypeScript CLI 工具。整体架构清晰、零依赖、分层合理，但在并发安全、命令可用性和扩展性方面存在改进空间。

---

## Design Highlights

- **零运行时依赖** — 攻击面小，安装快，维护成本低
- **清晰的分层架构** — Store -> SessionManager -> SearchEngine -> Server/CLI
- **不可变数据模式** — 所有更新返回新对象，防止隐蔽 bug
- **结构化 SessionSections 模型** — 比存储原始消息更适合上下文复用
- **26 个测试用例** — 核心功能有良好覆盖
- **5 个 Claude Code 命令** — capture/resume/update/list/search 覆盖核心工作流

---

## Issues

### P1 - Critical

#### 1. resume 命令短 ID 无法解析到真实文件

- **File:** `commands/yesu-session:resume.md:30-32`
- **Source:** Codex Review
- **Description:** 当前改为直接打开 `data/sessions/<id>.json`，但 `list` 只显示 UUID 前 8 位（如 `6be87b42`），实际文件名是完整 UUID（`6be87b42-b41f-4ebb-b324-d460b275d580.json`）。用短 ID resume 时会找不到文件。
- **Fix:** 恢复通过 `src/cli.ts show <id>` 的 partial-ID 解析逻辑。

#### 2. 并发写入无保护

- **File:** `src/store.ts`
- **Source:** Claude Code Review
- **Description:** Store 层直接 `writeFile`，没有文件锁或写队列。多个 Claude Code 会话同时操作 `index.json` 可能导致数据丢失。
- **Fix:** 添加文件锁机制（如 atomic write with rename）或写队列。

---

### P2 - High

#### 3. resume 命令空格分隔破坏多词搜索

- **File:** `commands/yesu-session:resume.md:15-23`
- **Source:** Codex Review
- **Description:** 对 `$ARGUMENTS` 按空格拆分后，`/yesu-session:resume Claude Code` 会变成分别搜索 "Claude" 和 "Code"，可能加载不相关的 session，甚至触发 5 个 session 的上限。
- **Fix:** 保留完整参数作为搜索词，仅在明确使用逗号或特定分隔符时才拆分。

#### 4. 多 session 加载时 continue 行为有歧义

- **File:** `commands/yesu-session:resume.md:103-107`
- **Source:** Codex Review
- **Description:** 单 session 时用户回复 "continue" 很清晰，但多 session 加载后不知道要继续哪个 session 的 next step。
- **Fix:** 仅在单 session 加载时允许 auto-continue，多 session 时要求用户指定。

#### 5. capture 命令依赖临时脚本

- **File:** `commands/yesu-session:capture.md`
- **Source:** Claude Code Review
- **Description:** `/yesu-session:capture` 需要生成 `_capture.ts` 临时文件再执行，流程不够顺畅，容易出错。
- **Fix:** 让 capture 命令直接调用 CLI 的 `create` + `update` 组合，避免临时文件。

#### 6. 无分页支持

- **File:** `src/server.ts`, `public/index.html`
- **Source:** Claude Code Review
- **Description:** API 和 Dashboard 一次返回所有 session。随着对话积累，响应变慢、UI 卡顿。
- **Fix:** API 添加 `?page=1&limit=20` 参数，Dashboard 增加分页或虚拟滚动。

---

### P3 - Medium

#### 7. cli.ts 文件过大（425 行）

- **File:** `src/cli.ts`
- **Source:** Claude Code Review
- **Description:** 同时包含命令路由、参数解析和 import 解析逻辑，职责过多。
- **Fix:** 将 import parser 抽取为独立的 `src/importer.ts`。

#### 8. 缺少输入验证

- **File:** `src/store.ts`, `src/session.ts`
- **Source:** Claude Code Review
- **Description:** Session sections 没有 runtime 类型检查，畸形数据可以写入存储。
- **Fix:** 在写入层添加 Zod schema 验证。

#### 9. 搜索能力有限

- **File:** `src/search.ts`
- **Source:** Claude Code Review
- **Description:** 仅支持简单字符串匹配，无布尔操作符、字段限定搜索或正则。
- **Fix:** 短期添加 `field:value` 语法；长期考虑倒排索引。

#### 10. Import parser 脆弱

- **File:** `src/cli.ts` (import 逻辑)
- **Source:** Claude Code Review
- **Description:** 硬编码 section heading 映射，基于正则的解析容易误匹配，解析失败时无错误报告。
- **Fix:** 添加错误报告和 dry-run 模式，增强 section 映射的容错性。

---

### P4 - Low

#### 11. Dashboard 功能有限

- **File:** `public/index.html`
- **Source:** Claude Code Review
- **Description:** 无编辑功能、无导出功能、tag 过滤仅单选、无分页。
- **Fix:** 逐步增加编辑、导出（Markdown/HTML）、多 tag 过滤功能。

#### 12. Messages 字段利用不足

- **File:** `src/types.ts`
- **Source:** Claude Code Review
- **Description:** Session 有 messages 字段但 import 不会填充消息内容，仅 `addMessage()` 使用。
- **Fix:** 在 capture/import 时自动提取关键消息内容。

---

## Feature Suggestions

| Direction | Description |
|-----------|-------------|
| **Export** | 支持导出为 Markdown / HTML，方便分享 |
| **Session Diff** | `diff` 命令对比两个 session 的变化 |
| **Auto Tags** | 根据内容自动建议 tags |
| **Dashboard Edit** | Web UI 支持基本编辑操作 |
| **Backup/Restore** | `backup` / `restore` 命令 |
| **Batch Operations** | 批量 tag、删除、导出 |
| **Session Versioning** | 变更审计追踪 |

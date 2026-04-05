# cc-sessions

[English](./README.md)

一个用于管理 Claude Code 对话会话的 TypeScript CLI 工具和库。支持结构化 JSON 存储、全文搜索、从现有 session 数据导入，以及 Neo-Brutalism 风格的 Web Dashboard。

**零运行时依赖** — 仅使用 Node.js 内置模块。

## 功能特性

- **结构化存储** — 每个 session 一个 JSON 文件 + 轻量索引，快速列表查询
- **CRUD 操作** — 创建、读取、更新、删除会话，采用不可变数据模式
- **全文搜索** — 跨标题、摘要和消息的大小写不敏感搜索，支持片段高亮
- **导入** — 解析并导入 `~/.claude/session-data/*.tmp` markdown 文件
- **CLI** — 完整的命令行工具，覆盖所有操作
- **Web Dashboard** — Neo-Brutalism 风格的浏览器界面，支持浏览、过滤和搜索

## 快速开始

```bash
# 安装依赖
npm install

# 导入已有的 Claude Code 会话
npx tsx src/cli.ts import

# 启动 Web Dashboard
npm run dashboard
# 打开 http://localhost:3456
```

## CLI 使用

```bash
# 列出会话（可选过滤）
npx tsx src/cli.ts list [--tag TAG] [--project PROJECT] [--query QUERY]

# 查看会话详情
npx tsx src/cli.ts show <id>

# 跨会话搜索
npx tsx src/cli.ts search <query> [--tag TAG] [--project PROJECT]

# 创建新会话
npx tsx src/cli.ts create --title TITLE [--project P] [--tags a,b] [--summary S]

# 更新会话
npx tsx src/cli.ts update <id> [--title T] [--summary S] [--tags a,b]

# 向会话添加消息
npx tsx src/cli.ts add-message <id> --role ROLE --content CONTENT

# 从 session-data 目录导入
npx tsx src/cli.ts import [path]    # 默认: ~/.claude/session-data/

# 删除会话
npx tsx src/cli.ts delete <id>
```

## 架构

```
src/
├── types.ts      # 类型定义（Session, Message, SessionIndex 等）
├── store.ts      # 文件 I/O：读写 JSON session 文件 + 索引
├── session.ts    # SessionManager：CRUD 操作，内部使用 Store
├── search.ts     # SearchEngine：全文搜索与片段高亮
├── server.ts     # HTTP 服务器：JSON API + Dashboard 静态文件服务
├── cli.ts        # CLI 入口 + session-data 导入解析器
└── index.ts      # 公共 API 导出
public/
└── index.html    # Web Dashboard（Neo-Brutalism 风格，原生 HTML/CSS/JS）
```

## 数据模型

Session 以**结构化 sections** 为核心，而非原始对话消息：

| Section | 说明 |
|---------|------|
| `whatWeAreBuilding` | 项目描述与目标 |
| `whatWorked` | 成功的方法（仅追加列表） |
| `whatDidNotWork` | 失败的方法，避免重试 |
| `decisions` | 会话中做出的关键决策 |
| `nextStep` | 下一步要执行的具体操作 |
| `keyLearnings` | 值得延续的经验总结 |
| `blockers` | 未解决的问题或阻碍 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SESSIONS_DATA_DIR` | `./data` | 数据目录路径 |
| `PORT` | `3456` | Dashboard 服务端口 |

## Claude Code 命令

项目包含自定义的 `/yesu-session:*` 命令，用于 Claude Code：

| 命令 | 说明 |
|------|------|
| `/yesu-session:capture` | 将当前对话保存为结构化会话 |
| `/yesu-session:update` | 向已有会话追加新进展 |
| `/yesu-session:resume` | 加载会话并恢复上下文 |
| `/yesu-session:list` | 列出所有会话 |
| `/yesu-session:search` | 跨会话全文搜索 |

安装命令（软链接到 `~/.claude/commands/`）：

```bash
./install.sh
```

## 开发

```bash
npm run build          # 构建 TypeScript
npm test               # 运行测试（26 个测试）
npm run test:watch     # 监听模式
npm run test:coverage  # 覆盖率报告
```

## 许可证

MIT

# Agent 嵌套深度分析

## 问题

子代理中再启动子代理（多层嵌套）是否合理？

## 示例拓扑（4 层深度）

```
主代理（对话窗口）
  └→ 子代理 A
       ├→ 子代理 A1
       ├→ 子代理 A2
       └→ 子代理 A3
            ├→ 子代理 A3a
            ├→ 子代理 A3b
            └→ 子代理 A3c
```

## 结论：技术可行，但通常不合理

### 三个核心问题

**1. 上下文逐层稀释**

每层子代理只拿到父代理传递的 prompt，看不到祖父级的完整上下文：

- L0 主代理：100% 信息量
- L1 子代理：~80%（主代理总结的任务描述）
- L2 子代理：~60%（L1 总结的子任务）
- L3 子代理：~40%（L2 总结的子子任务）

底层代理对原始需求的理解已严重衰减，容易跑偏。

**2. 成本指数膨胀**

每个子代理独立占用上下文窗口（约 50k tokens），8 个代理 = 8 倍成本。且子代理不能复用彼此的发现，各自重复探索。

**3. 编排复杂度**

底层代理出错需逐层冒泡，中间编排者难以有效纠正。调试困难，失败模式不透明。

## 推荐模式

### 扁平扇出（最多 2 层）

```
主代理
  ├→ 子代理 1（安全审查）
  ├→ 子代理 2（性能分析）    ← 并行，互不依赖
  └→ 子代理 3（测试覆盖）
```

主代理直接编排所有子代理，自己做综合判断。

### 大任务：横向分解 + 串行阶段

```
阶段 1：主代理 → 并行 3 个子代理做研究
         ↓ （主代理综合结果）
阶段 2：主代理 → 并行 3 个子代理做实现
         ↓ （主代理综合结果）
阶段 3：主代理 → 并行 2 个子代理做审查
```

每个阶段由主代理把控上下文，避免信息衰减。

## 判断标准

| 场景 | 建议 |
|------|------|
| 3 个独立任务可并行 | 主代理直接扇出 3 个子代理 |
| 子任务内部还需拆分 | 让子代理自己完成，不要再嵌套 |
| 任务真的太大单个代理装不下 | 分阶段串行，而非嵌套深度 |
| 需要不同模型/视角 | 扁平并行，主代理综合 |

---

## 修正：Harness 模式下的合理嵌套

上面的原则"子代理是叶子节点"过于绝对。在特定模式下，嵌套是合理的。

### 合理嵌套 vs 反模式

| 合理 | 反模式 |
|------|--------|
| 子代理内部用固定协作模式（如 harness） | 子代理随意拆分业务再嵌套 |
| 内部角色围绕同一个产物迭代 | 信息逐层稀释，每层都在"总结" |
| 编排逻辑只在两处：主代理 + harness 内部 | 编排逻辑分散在多层 |

### 实际业务示例

Figma → 开发 → 测试上线全流程，3 个模块并行，其中一个模块使用 harness：

```
主代理（编排器）
  │
  ├─ [阶段1] Figma → 需求解析/设计稿分析
  ├─ [阶段2] 开发（并行）
  │    ├→ Agent A（模块 A）
  │    ├→ Agent B（模块 B）── harness 三代理模式
  │    │    ├→ Planner
  │    │    ├→ Generator
  │    │    └→ Evaluator
  │    └→ Agent C（模块 C）
  ├─ [阶段3] 集成测试
  └─ [阶段4] 部署上线
```

### 关键：输入/输出契约

Agent B 对主代理是**黑盒**。主代理不关心内部用几个角色：

```
主代理视角：
  Agent B(input: 模块B需求 + 设计稿) → output: 代码 + 测试

Agent B 内部视角：
  Planner → 拆解实现步骤
  Generator → 按步骤写代码
  Evaluator → 审查质量，不过则打回 Generator
  （循环直到 Evaluator 通过）
```

### Generator 内部不应再嵌套 agent

如果 Generator 需要同时处理 iOS/Android/Backend，不要在 Generator 内部再扇出 3 个子 agent——这会让 Generator 变成编排器，破坏 harness 的迭代循环。

**两种正确做法：**

**方案 A：拆 Harness，不拆 Generator**（三端逻辑独立时）

```
主代理
  ├→ Agent B-iOS（harness: Planner + Generator + Evaluator）
  ├→ Agent B-Android（harness: Planner + Generator + Evaluator）
  └→ Agent B-Backend（harness: Planner + Generator + Evaluator）
```

**方案 B：单 Generator 处理三端**（三端耦合紧密时）

Generator 作为单个 agent，在一次执行中同时输出三端代码，不拆分子 agent。

**选择标准：iOS/Android/Backend 能否独立评审？能 → 方案 A，不能 → 方案 B。**

---

## 规模化：10+ 模块并行的成本控制

### 成本模型

10 个模块并行，每个模块一个 harness（3 角色），平均迭代 3 轮：

```
主代理                    1 个 agent
10 个模块 agent           10 个 agent
每个模块 harness 3 角色   10 × 3 = 30 个 agent
每轮迭代打回重跑          30 × 3 轮 = 90 次 agent 调用
每次调用 ~50k tokens      总计 ~4.5M tokens
```

| 策略 | 估算成本 |
|------|---------|
| 全部 Opus | $150-250 |
| 全部 Sonnet | $30-80 |
| 分级模型 | $20-50 |

### 四大瓶颈

| 瓶颈 | 表现 |
|------|------|
| API 速率限制 | 30 个并发 agent 容易撞 RPM/TPM 上限 |
| 本地资源 | 每个子代理是独立进程，内存和 CPU 承压 |
| 协调复杂度 | 主代理等 10 个模块全部完成，一个卡住全部等 |
| 失败放大 | 任何一个 harness 死循环，整体流程卡住 |

### 控制策略

**1. 并发度控制——分批执行**

```
批次 1：模块 1, 2, 3, 4     ← 并行（≤5 个 agent 同时）
         ↓ 完成
批次 2：模块 5, 6, 7        ← 并行
         ↓ 完成
批次 3：模块 8, 9, 10       ← 并行
```

**2. Harness 分级——不是每个模块都需要**

| 模块类型 | 占比 | 模式 | agent 数 |
|---------|------|------|---------|
| 简单（CRUD、配置页） | ~40% | 单 agent | 4 |
| 中等（业务逻辑） | ~40% | 2 角色 harness | 8 |
| 复杂（支付、权限） | ~20% | 3 角色 harness | 6 |
| **总计** | | | **18**（而非 30） |

**3. 迭代次数上限——防止成本失控**

```python
harness_config = {
    "max_iterations": 3,          # 最多打回 3 次
    "max_tokens_budget": 500_000, # 单模块 token 上限
    "timeout_minutes": 30,        # 超时降级
    "fallback": "single_agent"    # 超限后降级为单 agent 模式
}
```

**4. 模型分级——不是每个角色都用贵的**

```
Planner    → Haiku（快速拆解）
Generator  → Sonnet（主力编码）
Evaluator  → Sonnet（大多数）/ Opus（仅复杂模块）
```

### 完整规模化架构

```
主代理（Sonnet）
  │
  ├─ [阶段0] 需求分析 + 模块拆分 + 复杂度评估
  │           产出：接口契约、模块分类（简单/中等/复杂）
  │
  ├─ [阶段1] 批次 1（并发 ≤ 5 个 agent）
  │    ├→ 模块1（简单）→ 单 agent
  │    ├→ 模块2（中等）→ Generator + Evaluator
  │    ├→ 模块3（复杂）→ Planner + Generator + Evaluator
  │    └→ 模块4（简单）→ 单 agent
  │    主代理：检查集成兼容性
  │
  ├─ [阶段2] 批次 2 ...
  ├─ [阶段3] 批次 3 ...
  │
  ├─ [阶段4] 集成测试
  └─ [阶段5] 部署
```

---

## Subagent 模式 vs Agent Teams 模式

Claude Code 提供两种多 agent 机制，适用于不同场景。

### Subagent（当前默认）

```
主代理 ←→ 子代理A
主代理 ←→ 子代理B     子代理之间不能通信
主代理 ←→ 子代理C
```

- 子代理是一次性任务执行器，完成后向主代理返回结果
- 所有协调必须经过主代理中转
- 适合：独立、无需交叉协作的并行任务

### Agent Teams（实验性功能）

```
Lead ←→ Teammate A
Lead ←→ Teammate B
Teammate A ←→ Teammate B    ← 直接对话
Teammate B ←→ Teammate C    ← 直接对话
```

- 每个 Teammate 是独立的完整 Claude Code 会话（各自 1M token 上下文）
- Teammate 之间可通过 SendMessage 直接通信，无需经过 Lead 中转
- 共享任务列表（磁盘 JSON 文件），支持认领、依赖、阻塞
- Lead 就是你的主对话窗口，不是额外的 agent

### 对比

| 维度 | Subagent | Agent Teams |
|------|----------|-------------|
| 通信 | 子 → 父，单向 | 任意 agent 双向 |
| 上下文 | 共享父级窗口 | 各自独立 1M |
| 协调 | 父 agent 中介 | 共享任务列表 + 自协调 |
| 状态共享 | 仅通过文件系统 | 任务列表 + SendMessage + 文件系统 |
| 成本 | 较低 | 较高（每个 Teammate 独立实例） |
| 适合 | 聚焦的独立任务 | 需要讨论、协商、迭代的复杂协作 |

### 通信拓扑约束

```
Team 内：Lead ↔ Teammate ↔ Teammate     全连通
Team 间：Lead ✗ Lead                     完全隔离（不同会话）
```

- 一个会话只能有一个 Team，一个 Lead
- Teammate 不能生成自己的 Team（不支持嵌套团队）
- Lead 固定，不能转移领导权

### Agent Teams 启用方式

```json
// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

前提：Claude Code ≥ v2.1.32 + Opus 4.6。启用后需重启会话生效。

### Agent Teams 七个核心工具

| 工具 | 作用 |
|------|------|
| TeamCreate | 创建团队目录（~/.claude/teams/{name}/） |
| TaskCreate | 创建共享任务 |
| TaskUpdate | 认领/完成/阻塞任务 |
| TaskList | 查询所有任务状态 |
| Agent（带 team_name） | 生成 Teammate |
| SendMessage | agent 间直接通信 |
| TeamDelete | 清理团队 |

### Agent Teams 最佳实践

- 推荐规模：**3-5 个 Teammate**，每人 5-6 个任务
- 模型分配：Lead 用 Opus，Teammate 用 Sonnet（降本 ~40%）
- 使用 **Delegate Mode**（Shift+Tab）让 Lead 只协调不动手
- 工作流：Plan First → 审批 → Parallelize
- 写冲突缓解：分配不重叠的文件集 + 接口优先定义

### Agent Teams 已知限制

| 限制 | 影响 |
|------|------|
| 不支持会话恢复 | /resume 不会恢复 Teammate |
| 不支持嵌套团队 | Teammate 不能生成自己的团队 |
| 每会话一个团队 | Lead 同时只管一个团队 |
| 写冲突 | 多 agent 改同一文件容易冲突 |
| 上下文压缩时团队可能丢失 | 长会话风险 |
| Lead 间不能通信 | 跨 Team 协调只能通过文件系统模拟 |

---

## 市场调研：AI Agent Team 产品全景（2026.04）

### 成熟度分级

```
Level 4: 自组织团队           ← 尚无产品做到
Level 3: 协作团队             ← Claude Code Agent Teams / Augment Intent
Level 2: 流水线               ← GitHub Copilot（角色管道）
Level 1: 扇出/汇总            ← Cursor / Codex / Jules / Devin
Level 0: 单 Agent             ← Aider / Cline
```

### 主要产品对比

| 产品 | Agent 间直接通信 | 共享状态 | 并行能力 |
|------|:---:|:---:|:---:|
| Claude Code Agent Teams | 是 | 共享任务列表 | 并行 |
| Augment Intent | 是（活文档） | Living Spec | 分波并行 |
| Cursor 3 | 否 | Git worktree | 最多 8 并行 |
| OpenAI Codex | 否 | 独立沙箱 | 并行 |
| Google Jules | 否 | 项目视图 | 最多 15 并发 |
| Devin | 可分派子任务 | 共享代码库 | 多实例并行 |
| GitHub Copilot | 管道式 | GitHub 工作流 | 角色串联 |
| Roo Code（开源） | Mode 切换 | IDE 本地 | 串行为主 |
| OpenHands（开源） | 内部委派 | 云环境 | 并行 |

### 关键洞察

- **真正的 agent 间直接通信**目前仅 Claude Code Agent Teams 和 Augment Intent 实现
- 大多数产品是"并行但隔离"的 Level 1 模式
- Anthropic 用 16 个 Opus 4.6 agent 构建了 10 万行 C 编译器（成本 ~$20,000）
- Gartner：多 agent 系统咨询量 2024Q1→2025Q2 暴增 1,445%

---

## 核心原则

1. **子代理可以内部使用固定协作模式（如 harness），但不应再做业务拆分**
2. **区分标准：内部子代理是围绕同一个产物协作，还是拆分不同业务范围**
3. **规模化靠分级 + 分批 + 预算上限，而非无限制并行**
4. **需要跨模块协商时，优先考虑 Agent Teams 模式而非 Subagent 嵌套**
5. **Agent Teams 解决 Team 内协作，Team 间协作仍需文件系统模拟**

---

## Agent Teams 优势与适用场景分析

### 实测验证（2026.04.09）

在当前环境下成功创建 `dir-analysis` 团队，3 个 Teammate 并行分析目录（文件类型统计、代码行数统计、潜在问题检查），验证了 Agent Teams 功能完整可用。

### Agent Teams 三大核心优势

**1. 实时协调，减少返工**

普通 Subagent 各自执行完毕才汇总结果。如果 Agent A 的输出影响 Agent B 的工作，发现时已经晚了。Teams 模式下 agent 之间可通过 SendMessage 随时沟通，提前对齐，避免大量返工。

**2. 共享任务列表，动态调度**

- 任务支持 `blockedBy` 依赖关系，自动阻塞下游任务
- Agent 完成一个任务后通过 TaskList 自动领取下一个可用任务
- Lead 可根据实际进展动态调整优先级和任务分配

**3. 去中心化协作**

不需要所有信息都经过"父代理"中转，Teammate 之间直接通信，减少了信息瓶颈和上下文损失。

### 对比总结

| 维度 | Subagent 模式 | Agent Teams 模式 |
|------|-------------|-----------------|
| 通信方向 | 子→父 单向汇报 | 任意 agent 双向通信（SendMessage） |
| 协作方式 | 各自独立执行，互不可见 | 共享任务列表（TaskList），互相感知进度 |
| 任务分配 | 父代理一次性分配 | Lead 动态调度，可根据进展重新分配 |
| 信息共享 | 只能通过父代理中转 | Teammate 之间直接 DM |
| 适合场景 | 独立、无依赖的并行任务 | 有依赖、需协商的协作任务 |

### 适合使用 Agent Teams 的业务场景

**场景 1：全栈功能开发（有依赖）**

```
Team: feature-auth
├── Lead: 架构师（协调）
├── backend-dev: 设计 API + 数据库 schema
├── frontend-dev: 实现 UI（等 backend 定好接口）
└── test-writer: 写测试（依赖前两者的产出）
```

关键点：frontend 需要等 backend 的接口定义，Teams 的 `blockedBy` 机制天然支持这种依赖关系。

**场景 2：代码审查 + 安全审计（多视角）**

```
Team: review-pr
├── Lead: 汇总审查意见
├── code-reviewer: 代码质量、模式
├── security-reviewer: 安全漏洞
└── perf-reviewer: 性能问题
```

关键点：多个 reviewer 可以看到彼此的发现，避免重复指出同一问题，审查更全面。

**场景 3：大规模重构（分模块协作）**

```
Team: refactor-auth
├── Lead: 协调迁移顺序
├── migrator-a: 重构模块 A
├── migrator-b: 重构模块 B（依赖 A 的接口变更）
└── validator: 持续验证整体构建
```

关键点：模块间有接口依赖，migrator-b 需要知道 migrator-a 改了什么，通过 SendMessage 实时同步。

**场景 4：调研 + 实施一体化（流水线）**

```
Team: new-feature
├── Lead: 决策
├── researcher: 调研方案、搜索现有实现
├── planner: 基于调研结果写实施计划
└── implementer: 按计划编码
```

关键点：串行流水线，每一步依赖上一步产出，Teams 的任务依赖机制（blockedBy）天然适合。

### 不适合 Agent Teams 的场景

| 场景 | 原因 | 应该用 |
|------|------|--------|
| 完全独立的并行搜索 | 无需协调，Teams 开销多余 | 普通 Subagent |
| 单文件 bug 修复 | 一个 agent 就够了 | 直接操作 |
| 简单的信息查询 | 不需要多 agent | 单 Agent |
| 超大规模（>10 agent） | Teams 不支持嵌套团队 | 分批 + 文件协调 |

### 决策框架

```
需要多个 agent 吗？
├── 否 → 直接用单 Agent 或 Subagent
└── 是 → agent 之间有依赖或需要协商吗？
    ├── 否 → 普通并行 Subagent（成本更低）
    └── 是 → Agent Teams ✅
        └── 规模 > 5 个？→ 拆分多个 Team 分批执行
```

核心判断标准：**任务独立用 Subagent，任务有依赖用 Teams**。

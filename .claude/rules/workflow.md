# Session 工作流

> **规则约束级别说明**：本文件定义 Session 工作流的核心规则。除非特别标注 `[建议]`，否则都是必须遵守的约束。

## 思维框架：从现象到动作

所有规则都是「现象 → 判断 → 动作」这条链的具体实例。违反这条链的规则是空壳，缺少这条链的工作是空转。

| 环节 | 含义 | 常见缺失 |
|------|------|---------|
| **现象** | 看到了什么（事实、数据、异常） | 抽象描述代替具体观察 |
| **判断** | 据此得出什么结论（依据什么） | 跳步到动作，或缺少依据 |
| **动作** | 接下来要做什么（具体行动） |停在理解层，不推动执行 |

本工作流中「现象 → 判断 → 动作」的具体体现：

- **不确定性决策节点**：现象 = 任务特征，判断 = 是否可预期，动作 = 直接推进或先 Demo
- **DECISION TRACE**：结构化输出「现象 → 判断 → 动作」三段论的工具
- **acceptance 验证**：动作完成后的现象观察，判断依据是 acceptance 是否通过
- **BLOCKED 报告**：现象 = 真实阻塞点，判断 = 环境/凭据缺失，动作 = 人工介入

这条框架优先于任何具体规则。当规则和框架冲突时，先检查是否真的满足了三段论。

## Session 启动（必须按顺序执行）

**执行顺序约束**：
- Step 1-4 必须串行执行（Preflight 失败则停止，上下文恢复、归档检查和任务选择依赖 Preflight 通过）
- Step 5 可选（仅当 init.sh 存在时执行）
- Step 2 和 Step 3 的 task.json 读取可合并为一次

每个新 session 必须先完成以下步骤，然后才能开始实现任务：

### 1. Preflight 检查
- 运行 `.claude/checks/smoke.sh`（如存在），验证基线环境
- 检查 recording/ 最新 session 文件中是否有未解决的阻塞记录
- 运行 `git status`，确认工作区状态

### 2. 上下文恢复
- **优先读取** `.claude/continue-here.md`（如存在），了解精确断点位置，读完后删除该文件
- 如果 continue-here.md 不存在，使用 `ls -t .claude/recording/ | head -2` 读取最新 1-2 个 session 文件，了解最近的工作和注意事项
- 读取 `.claude/decisions.md`（如存在），了解历史设计决策
- 运行 `git log --oneline -20`，了解最近的代码变更历史

### 3. 归档检查
- 统计 `.claude/task.json` 中 Done/Cancelled 任务数量
- 如果超过 `settings.json` 中的 `task_archive_threshold`（默认 20）：
  - 创建 `.claude/archive/` 目录（如不存在）
  - 将 Done/Cancelled 任务移到 `archive/task_archive_YYYY-MM.json`（当前月份）
  - 更新 `.claude/task.json` 只保留活跃任务
  - 在后续 session 文件中记录归档操作

### 4. 任务选择策略
- 读取 `.claude/task.json`，了解所有任务的当前状态
- **优先恢复** `status: "InProgress"` 的任务（中断的任务）
- 否则选择第一个 `status: "InSpec"` 的任务，并检查 blocked_by：
  - **blocked_by 为空或不存在** → 无阻塞，可开始
  - **blocked_by 全部 Done** → 阻塞已解除，可开始
  - **blocked_by 存在 InReview 且超前未达上限（超前上限见 settings.json）** → 可超前实施（标记为超前）
    - 超前完成的任务标记为 **InReview**，立即创建 git commit
    - 写入新 session 文件记录："Task#N (blocked_by Task#M, 超前 X/5, commit: abc123)"
    - 完成第 5 个超前任务后输出 PENDING REVIEW，等待阻塞任务验收
  - **其他情况** → 跳过，选择下一个任务
- **禁止选择** `status: "InDraft"` 的任务（需人工先确认）
- 选择优先级：无 blocked_by 的任务优先，基础功能优先

### 超前实施验收失败：回退方式

**验收通过**：阻塞任务 → Done，超前任务逐个 InReview → Done，写入新 session 文件记录解除。
**验收失败**：人工决定回退方式，Agent 执行并重新验证超前任务：
- `revert`：超前任务已 push 到远端，需要撤销公开提交
- `reset --soft`：超前任务只在本地，保留代码改动但撤销 commit，便于修改后重新提交
- `修改`：超前任务代码仍然有效，只需调整以适配阻塞任务的新实现

### 5. 环境初始化（可选）
- 运行 `.claude/init.sh` 启动开发环境（如需要）
- 运行项目的基线测试（build/lint），确认系统处于正常状态
- 如果基线测试失败，优先修复，然后再开始新任务

---

## 任务规划

### 触发条件
- 用户在讨论想法、需求、功能设计
- `.claude/task.json` 为空或用户明确要求分解任务
- 用户描述了一个较大的功能，需要拆分为可执行步骤

### 分解流程

**示例锚点驱动**：执行特定操作前必须先读取对应的示例文件作为锚点。

| 操作 | 必读示例文件 | 用途 |
|------|-------------|------|
| 生成 PRD | .claude/examples/prd.md | 对齐 PRD 格式和必须覆盖的要素 |
| 写 acceptance | .claude/examples/acceptance.md | 对齐 GWT 格式和可断言性标准 |
| 拆解任务 | .claude/examples/task_breakdown.md | 对齐任务粒度和 blocked_by 使用 |
| 写 session 记录 | .claude/examples/session_record.md | 对齐 session 记录格式和内容结构 |

**需求精炼（任务描述模糊时触发）** `[建议]`：每次只问一个问题，理解目的、约束，成功标准；提出 2-3 个方案并给出推荐，获得确认后再写 task.json。

**草案阶段（InDraft）**：提炼可执行功能点 → 拆分为一句话可描述的任务 → 定义验收条件 → 识别依赖关系排序 → 展示分解结果 → 写入 `.claude/task.json`，状态为 `InDraft`。

**锁定阶段（InSpec）**：人工确认后，Agent 将状态改为 `InSpec`；从此刻起，Agent 只能修改 status 字段；如需修改需求，退回 InDraft 重新确认。

### 任务粒度标准
预估修改代码 < 2000 行；有明确的验收标准（`acceptance` 字段，GWT 格式）；有清晰的实施步骤（`steps` 字段）；不依赖未完成的其他任务，或依赖已在 blocked_by 字段中标注。

### task.json 写入规则
新任务状态一律为 `InDraft`；ID 递增不复用；category 可选值：functional / ui / bugfix / refactor / infra；新任务追加到列表末尾；必须包含 `acceptance` 字段（GWT 格式，规范见 states.md）；如有依赖使用 `blocked_by` 字段标注；steps 必须自包含（外部凭据写明来源路径，代码路径写绝对路径）。

---

## 任务实施

InSpec → InProgress → InReview → Done 完整流程：

### 不确定性决策节点（实施前必过）

在将任务设为 InProgress 之前，先判断：**结果是可预期的吗？**

| 判断问题 | 可预期 | 不可预期 |
|---------|--------|---------|
| 团队做过类似的事吗？ | 做过 | 没做过 |
| 结果有超过 90% 的把握吗？ | 有 | 没有 |
| 外部依赖（LLM、第三方 API）可控吗？ | 可控 | 不可控 |
| 多模块集成测试过吗？ | 测过 | 没测过 |

**决策分支**：
- **全部可预期** → 直接进入 InProgress，按下方步骤实施
- **任一不可预期** → 先调用 `/ddemo` 隔离验证，验证通过后再 InProgress

### 实施步骤

1. 将选定任务状态改为 `InProgress`
2. 仔细阅读任务的任务描述、验收条件、实施步骤
3. [建议] 按照项目既有的代码模式实现功能；如有测试框架，推荐顺序：先写验收测试框架 → 单元测试 → 实现
4. 文件路径修改后必须 grep 验证无残留再继续
5. 实现完成后，按本文件"验证要求"章节进行验证
6. 验证通过后，将状态改为 `InReview`；小幅度修改 Agent 自审后标记 Done，大幅度修改输出 REVIEW 请求等待人工确认

**大幅度修改判定**：满足以下任一条件即为大幅度修改：修改了原有 API 规范或字段定义；单次任务修改代码行数超过 2000 行。其余 Agent 自审即可。

**自审原则** `[建议]`：只实现了 acceptance 要求的，不多不少；没有引入技术债或安全问题。
- ❌ 顺手重构了周边函数、添加了未要求的日志、提取了"以后可能用到"的工具函数

### 执行偏差规则

> **详细锚点见 judgments.md §执行偏差分级**

在实施过程中遇到计划外的问题时，按以下分级处理：

| 偏差等级 | 权限 | 例子 | 记录要求 |
|---------|------|------|---------|
| Level 1: Bug 修复 | 自动修复 | 类型错误、import 缺失、语法错误 | 写入 session 文件记录 |
| Level 2: 关键缺失 | 自动补充 | 缺少错误处理、缺少输入验证 | 写入 session 文件记录 |
| Level 3: 阻塞问题 | 自动修复 | 依赖缺失、配置格式错误 | 写入 session 文件记录 |
| Level 4: 架构变更 | 必须问用户 | 新建数据库表、切换框架、破坏性 API 变更 | DECISION TRACE |

单个任务累计 Level 1-3 自动修复不超过 5 次，超过则停下评估 acceptance/steps 定义是否有缺陷。

### 提交规范

**提交时机**：
- 常规任务：状态到达 Done 时提交
- 超前任务：完成时标记 InReview 并立即提交（超前上限见 settings.json），阻塞解除后标记 Done（不再重复提交）

**commit message 格式**：
- 常规：`[Task#N] 任务标题 - completed`
- 超前：`[Task#N] 任务标题 - completed (超前实施 X/5, blocked_by Task#M)`

**提交内容**：代码变更 + `.claude/task.json` + 新 session 文件，同一个 commit。

**force push**：执行前必须先 `git fetch origin` 并确认远端无未合并变更，有差异须先与用户确认。

**提交粒度**：
- 每个 task 单独提交，不批量更新多个 task
- 只提交 task 相关的修改文件，不碰其他非 task 所修改的内容
- 提交内容清单：task 修改的代码文件 + task.json（如有状态变更）+ session 文件（如需记录）

**禁止行为**：
- ❌ 顺手修改其他文件（格式调整、注释补充、无关重构）
- ❌ 批量更新多个 task 的状态或内容
- ❌ 包含无关的格式调整或空白符变更

### 子代理策略

> **并行/串行选择规则见 judgments.md §并行与串行选择**

**并行条件**（同时满足才可并行）：问题域不相交、无共享写文件、files_modified 无重叠。

**串行条件**（满足任一则串行）：后一步依赖前一步的输出、需要积累上下文的实施类任务。

**专业化分工**（可选）：探索类用 haiku 只读文件/grep；验证类只运行测试/检查 acceptance；实施类只写代码继承主模型。

**Worktree 隔离** `[建议]`：并行实施类子代理可用 `isolation: "worktree"` 隔离工作目录。

**Coordinator Pattern**：task.json 状态更新由主代理负责，子代理通过返回值传回结果。

**超前计数器所有权**：超前计数器由主代理维护，子代理完成超前任务后通过返回值通知主代理。计数器在内存中维护，不持久化到 task.json。Session 重启后通过统计 task.json 中状态为 InReview 且 blocked_by 非空的任务数量来恢复计数。

**启动仪式**（所有子代理，强约束）：以下步骤由 SubagentStart Hook 自动注入：recording/ 最新 session 文件摘要、task.json 中 InProgress 任务的 title/acceptance/steps、`.claude/decisions.md` 最近 3 条设计决策。

**精简交接原则**：子代理完成后返回给主代理的内容不是全部产出，而是下一步所需的最小锚点。完整转发通常稀释注意力，最小锚点更容易稳定延续上下文。

**交接清单**（实施类子代理必须返回的内容）：
- 当前任务 acceptance 完成状态（逐条标注 PASS/FAIL）
- 代码变更摘要（文件路径 + 改动类型，如新增/修改/删除）
- 遗留阻塞点（不可自己解决的依赖或决策）
- 下一步前置条件（下一个子代理或主代理需要什么才能继续）

交接内容由主代理整合后写入 session 文件，不直接透传原始产出。

**子代理并发数**：读取优先级与行为定义见 templates.md 可调参数。

---

## 验证要求

**核心原则**：**未验证 = 未完成**。所有 acceptance 条件逐条验证通过后才能标记 InReview，验证方法和结果记录在 session 文件中。

**验证方式**：
1. 自动化验证（推荐）：`.claude/checks/task_<id>_verify.sh`，返回 0 成功 / 非0 失败
2. 手动验证：实机测试、UI 交互等不可自动化场景，Agent 提供步骤清单 → 人工执行反馈 PASS/FAIL
3. 人工审查：大幅度修改完成后输出 REVIEW 请求，等待人工确认
4. 独立验证（可选）：大幅度修改或涉及多模块的任务，可在 InReview 后启动 verifier agent 独立验证

**基线验证**：`.claude/checks/smoke.sh` 验证基线环境（依赖/构建/lint）。

**测试分层** `[建议]`：大幅度修改用浏览器测试工具验证功能和 UI；小幅度修改用 lint/build/单元测试。

**运行态验证** `[建议]`：代码层验证（lint/build/单元测试）通过后，还需验证运行时是否真的走到新链路。验证方法：
- 在关键加载点加日志或断言，确认执行路径经过新代码
- 发起一次真实请求，确认输出因改动而变化
- 对于插件类项目：验证 hooks 是否真的被触发、产物是否真的被生成

**验证失败处理**：任务状态保持 InProgress，修复后重新验证。

---

## Session 结束

在 session 结束前（包括 context window 接近上限时）：

1. 确保所有代码变更已提交
2. 写入 `.claude/recording/session-YYYY-MM-DD-HHMMSS.md` 新文件（运行 `date '+%Y-%m-%d %H:%M:%S'` 获取真实时间戳），记录：Session 标题、处理的任务及状态、验收验证结果、下次应该做什么
3. 如有重大设计决策，追加到 `.claude/decisions.md`（格式：DEC-NNN 日期 标题、背景、决策、备选方案、理由）
4. 确保 `.claude/task.json` 反映最新的任务状态

### Context Window 管理
- context window 会在接近上限时自动压缩，允许无限期继续工作
- 不要因为 token 预算担忧而提前停止任务
- 始终保持最大程度的自主性，完整完成任务

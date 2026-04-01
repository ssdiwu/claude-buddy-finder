# diwu-workflow 架构约束

> **规则约束级别说明**：本文件定义架构约束的核心规则。除非特别标注 `[建议]`，否则都是必须遵守的约束。

## Constraints

| Dimension    | Constraint                                                                                       | Verification                                                     |
|--------------|--------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| Business     | 插件命令（commands/*.md）只描述行为，不包含实现逻辑；实现逻辑在 skills/ 或 assets/ 中            | commands/ 文件内无可执行代码，仅有 Markdown 指令                  |
| Temporal     | plugin.json 的 version 字段必须在功能变更提交时同步更新，不得事后单独提交；版本号遵循语义化版本规范（X.Y.Z）：X=主版本（破坏性变更），Y=次版本（新增功能），Z=修订号（bug修复） | 每个功能 commit 的 diff 包含 plugin.json version 变更；版本号格式符合 semver |
| Cross-platform | hooks.json 中的路径引用必须兼容 macOS/Linux；禁止使用 Windows 路径分隔符                       | 路径中无 `\` 分隔符                                              |
| Concurrency  | 插件文件为静态资源，无并发写入场景；多 session 同时使用同一插件时以磁盘文件版本为准              | 无运行时状态，无需并发控制                                        |
| Perception   | smoke.sh 验证 JSON 合法性；所有 JSON 文件必须通过 `python3 -m json.tool` 校验                  | smoke.sh 全部 check 通过，exit 0                                  |

## Constraints 判断锚点

> **规则约束级别说明**：本章节为 Constraints 表中的每条约束提供现象→判断→动作框架的判断锚点，正例/反例/边界例矩阵作为判断环节的排除项。

---

### Business 约束：命令文件不包含实现逻辑

**规则来源**：Constraints 表 Business 行

**框架映射**：
- 现象 = commands/ 文件中出现了什么代码形态
- 判断 = 这是实现逻辑还是描述性引用
- 动作 = 保留描述还是分离实现

**正例**：`commands/ddemo.md` 仅包含 `/ddemo [主题]` 指令格式说明，无任何实现代码。结论：合规，无需修改。

**反例**：`commands/dinit.md` 直接在描述中引用 `node scripts/generate.js` 作为执行步骤，或包含 `if [ -d "$cache" ]; then ...` 类的条件逻辑。结论：实现逻辑混入，必须分离到 skills/ 或 assets/，commands/ 只保留行为描述。

**边界例**：`commands` 文档中使用「参考 `skills/diwu-doc/SKILL.md`」形式引用知识文件（非执行脚本）。结论：引用的是静态知识而非执行逻辑，合规。

---

### Temporal 约束：功能变更时 version 同步更新

**规则来源**：Constraints 表 Temporal 行

**框架映射**：
- 现象 = 代码发生了何种变更、version 字段当前值
- 判断 = 变更是否属于功能变更、version 是否需要同步
- 动作 = 在哪个 commit 中更新 version、更新到哪个版本号

**正例**：功能变更 commit 中 plugin.json version 从 `0.1.0` 变为 `0.1.1`（bugfix）或 `0.2.0`（新增功能），两个变更在同一个 commit 中。结论：合规，version 同步更新。

**反例**：提交了功能变更但 plugin.json version 仍为 `0.1.0`，或 version 变更单独成一个 commit。结论：违规，功能变更必须与 version 更新在同一个 commit 中，不得事后单独提交。

**边界例 A**：仅修改了 README、注释、格式调整等非功能内容，version 保持不变。结论：合规，非功能变更不强制更新 version。

**边界例 B**：破坏性变更（如改变命令参数格式、删除已有命令），version 从 `0.1.0` 变为 `1.0.0`。结论：合规，主版本号变更符合 semver 破坏性变更规则。

---

### Degradation Paths 约束：明确报错不静默失败

**规则来源**：Degradation Paths 表 + exceptions.md §BLOCKED 判定

**框架映射**：
- 现象 = 依赖出现了什么异常状态
- 判断 = 这属于哪级降级、用户是否能感知
- 动作 = 报错、警告还是静默降级

**正例**：cache 目录不存在时 `/dinit` 报错「插件缓存不存在，请重新安装」并 exit 1。结论：明确报错，合规。

**反例**：cache 目录不存在时 `/dinit` 静默退出，返回码 0，无任何错误输出。结论：静默失败，违规。用户无法判断是成功还是未执行。

**边界例**：Python3 不可用时 `smoke.sh` 打印警告「Python3 不可用，JSON 校验跳过」但 exit 0（功能部分降级，核心验证仍通过）。结论：非关键依赖降级，警告用户但不完全阻塞，合规。

---

## State Machines

插件文件发版状态机：

| Current State | Event            | New State  |
|---------------|------------------|------------|
| dev           | 提交含 version++ | published  |
| published     | 发现 bug         | dev        |
| published     | 直接修改内容无版本号 | invalid（禁止）|

## Boundaries

| Type     | Internal                               | External                         | Crossing Method          |
|----------|----------------------------------------|----------------------------------|-------------------------|
| Domain   | commands/, assets/, skills/, hooks/    | Claude Code 宿主环境             | plugin.json 描述注册       |
| Platform | .claude-plugin/ 插件描述               | 用户的 ~/.claude/ 目录            | 插件安装机制               |
| Data     | assets/dinit/assets/（模板源文件）      | 用户项目的 .claude/（生成产物）    | /dinit 命令触发复制        |

## Degradation Paths

| Dependency          | Failure                          | Fallback                               | User Perception              |
|---------------------|----------------------------------|----------------------------------------|----------------------------|
| 插件缓存             | cache 目录不存在                  | /dinit 报错提示重新安装插件             | 明确报错，不静默失败          |
| Python3             | smoke.sh 中 python3 不可用       | JSON 校验跳过，打印警告                 | 校验弱化，功能不受影响        |

## Data Ownership

Source of Truth: `.claude-plugin/plugin.json`（版本、命令列表、元数据）
生成产物链: `assets/dinit/assets/*.template` → 用户项目 `.claude/`（通过 /dinit）
冲突策略: 模板文件只写，用户项目文件不覆盖已存在内容（除非用户明确要求）

## 五维约束设计参考

基于产品特性，在设计阶段识别以下五个维度的约束：

| 维度 | 判断问题 | 例子 |
|-----|---------|------|
| **业务约束** | 100 年后还成立吗？ | 「原始录音不可变，摘要可重新生成」 |
| **时序约束** | 有没有执行路径可以绕过这个规则？ | 「停止录音后同一 session 不可恢复」 |
| **跨端约束** | 如果两个端定义不同，这是 bug 吗？ | 「CardType 在所有端完全一致」 |
| **并发约束** | 两个线程同时做这件事会出问题吗？ | 「状态机事件串行处理」 |
| **感知约束** | 超过这个阈值，用户会注意到吗？ | 「音频源切换 < 100ms」 |

使用方式：新增功能模块时，逐行过上表，把命中的约束写入本文件的 Constraints 表。

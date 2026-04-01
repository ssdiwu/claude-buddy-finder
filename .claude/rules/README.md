# 规则文件速查索引

> 本目录包含 diwu-workflow 的核心工作流规则。规则按职责分离，每个文件 < 200 行符合有界同时性原则。

## 文件列表

| 文件 | 用途 | 何时查阅 |
|------|------|---------|
| **states.md** | 任务状态机、acceptance 格式、task.json 结构、blocked_by 规范 | 写任务、改状态、处理依赖时 |
| **workflow.md** | Session 启动、任务规划、任务实施、验证要求、Session 结束 | Session 开始、规划任务、实施任务时 |
| **judgments.md** | 所有判断锚点集中管理（正例/反例/边界例） | 需要做判断决策时 |
| **exceptions.md** | 异常处理、BLOCKED 判定、阻塞恢复流程 | 遇到阻塞、需要人工介入时 |
| **templates.md** | BLOCKED、REVIEW、DECISION TRACE 格式模板、可调参数 | 输出标准格式、查配置参数时 |
| **file-layout.md** | .claude/ 目录结构、归档规则、查找历史 | 了解文件组织、归档、查历史时 |
| **constraints.md** | 架构约束（五维约束设计） | 设计新功能、定义约束时 |

## 阅读顺序建议

**首次使用**：
1. README.md（本文件）→ 了解整体结构
2. states.md → 理解任务状态机
3. workflow.md → 掌握完整工作流
4. judgments.md → 学习判断决策方法

**日常使用**：
- 遇到具体问题时，根据上表"何时查阅"列快速定位
- 需要做判断时，优先查 judgments.md 找锚点
- 需要输出标准格式时，查 templates.md

## 规则约束级别

- **默认**：必须遵守的约束
- **[建议]**：推荐但不强制的约束

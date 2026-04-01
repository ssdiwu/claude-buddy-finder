# 文件布局

> **规则约束级别说明**：本文件定义文件组织的核心规则。除非特别标注 `[建议]`，否则都是必须遵守的约束。

## .claude/ 目录结构

```
.claude/
├── CLAUDE.md                      # 全局 Agent 配置入口
├── settings.json                  # 可调参数配置
├── task.json                      # 当前任务列表
├── recording/                     # Session 进度记录目录
│   └── session-YYYY-MM-DD-HHMMSS.md  # 单个 session 记录文件
├── decisions.md                   # 设计决策记录（可选，有重大决策时创建）
├── archive/                       # 归档目录
│   ├── task_archive_YYYY-MM.json     # 归档任务（按月）
│   ├── recording_YYYY-MM-DD.md       # 按日归并的 session 归档
│   └── .last_archive_summary.json   # 最近归档摘要（归档阈值、保留起始点）
├── checks/                        # 验证脚本目录
│   ├── smoke.sh
│   └── task_<id>_verify.sh
└── init.sh                        # 环境初始化脚本（可选）
```

> 规则文件由插件 UserPromptSubmit hook 注入，不在项目 .claude/ 目录中。

## .doc/ 目录结构（SDD 规范产物）

```
.doc/
├── [domain 或分层文件]   # 见 /diwu-doc
└── adr/                  # 架构决策记录，见 /diwu-adr
    └── ADR-NNN-kebab-case-title.md
```

## 文件说明

| 路径 | 用途 | 读写方 |
|------|------|--------|
| `.claude/CLAUDE.md` | 全局配置、个人偏好、规则索引 | 共同维护 |
| `.claude/settings.json` | 可调参数配置（review_limit、归档阈值、子代理并发数等） | 人工设置，Agent 读取 |
| `.claude/task.json` | 当前所有任务的状态和内容 | Agent 读写 |
| `.claude/recording/` | Session 进度记录目录，每个 session 一个独立文件 | Agent 写 |
| `.claude/decisions.md` | 重大设计决策记录（影响范围 ≥2 模块，或引入新约束），供 Agent 快速检索历史决策理由 | Agent 写 |
| `.claude/archive/task_archive_YYYY-MM.json` | 按月归档的 Done/Cancelled 任务，保留 id 序列 | Agent 写 |
| `.claude/archive/recording_YYYY-MM-DD.md` | 按日归并的 session 归档，便于查找 | Agent 写 |
| `.claude/archive/.last_archive_summary.json` | 最近归档摘要（recording 保留阈值、活跃起止时间点） | Agent 写 |
| `.claude/checks/smoke.sh` | 基线环境验证，session 启动时运行 | Agent 提供方案，人工确认后实施 |
| `.claude/checks/task_<id>_verify.sh` | 任务专属验证脚本，id 对应 task.json | Agent 创建并执行 |
| `.claude/init.sh` | 开发环境初始化，session 启动时按需运行 | 讨论后由 Agent 实施 |

## 归档触发条件

- **archive/task_archive_YYYY-MM.json**：`task.json` 中 Done/Cancelled 任务超过归档阈值时触发（阈值见 settings.json `task_archive_threshold`）
- **archive/recording_YYYY-MM-DD.md**：`recording/` 目录中 session 文件数量超过归档阈值时触发（阈值见 settings.json `recording_archive_threshold`），保留最近 N 条活跃 session（N = 归档阈值）

## 归档执行步骤

**task.json 归档**：
1. 将 Done/Cancelled 任务移到 archive/task_archive_YYYY-MM.json（当前月份）
2. 保留 id 序列（新任务继续递增）
3. 在 recording/ 目录中记录归档操作

**recording/ 归档**：
1. 统计 `recording/` 中 session 文件数量，超过阈值时触发
2. 将 oldest session 按日期归并到 `archive/recording_YYYY-MM-DD.md`（同日期的多个 session 归并到同一文件）
3. 从 `recording/` 删除已归档的 session 文件
4. 更新 `archive/.last_archive_summary.json`（keep_recordings_from = 保留起始时间戳）
5. 在当前 session 文件中记录归档操作（归档文件列表、时间范围）

## 查找历史

- 最近任务：查 task.json
- 历史任务：查 archive/task_archive_YYYY-MM.json（按月，grep 搜索）
- 最近进度：`ls -t recording/ | head -5` 查看最新 5 个 session 文件
- 搜索活跃历史：`grep -r "关键词" recording/` 在活跃 session 中搜索
- 搜索归档历史：`grep -r "关键词" archive/recording_*.md` 在归档 session 中搜索
- 历史决策：查 decisions.md（设计方向、方案选择、边界定义）

## Session 文件管理

recording/ 目录中的 session 文件按时间戳命名（session-YYYY-MM-DD-HHMMSS.md），数量超过 settings.json `recording_archive_threshold` 时触发归档，归档后 `recording/` 保留最近 N 条活跃 session。

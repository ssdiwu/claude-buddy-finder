# claude-buddy-finder

## 工作流规则

本项目内嵌完整的 diwu 工作流规则，无需依赖全局配置。

@rules/README.md
@rules/judgments.md
@rules/states.md
@rules/workflow.md
@rules/exceptions.md
@rules/templates.md
@rules/file-layout.md
@rules/constraints.md

---

## 项目上下文

Claude Code `/buddy` companion 刷取工具——暴力搜索匹配目标的 `userId`，注入 `~/.claude.json` 配置，永久锁定想要的宠物。

详细的任务定义见 task.json。

## 技术栈

- 语言: JavaScript / Node.js
- 框架: 纯 JS，无框架，无外部依赖

## 常用命令

```bash
node src/finder.js --rarity legendary --species cat
node src/patcher.js <uid>
```

## 项目结构

```
/
├── .claude/
│   ├── CLAUDE.md          # 本文件
│   ├── task.json          # 任务定义（唯一事实来源）
│   ├── recording/          # Session 进度记录
│   ├── rules/             # 工作流规则（8个文件）
│   ├── agents/            # 子代理定义
│   ├── checks/
│   │   └── smoke.sh      # 基线验证
│   ├── lessons.md         # 经验教训
│   └── settings.json      # 可调参数
├── src/
│   ├── finder.js          # 并行暴力搜索 uid
│   └── patcher.js         # 原子写入 ~/.claude.json
├── AGENTS.md              # 跨 AI 工具入口
└── ...
```

## 编码约定

- 遵循 Node.js 惯例
- 纯 JavaScript，无框架依赖
- 使用 `crypto.randomBytes` 生成随机数

## 规则引用说明

本项目使用 @rules/ 引用自动加载工作流规则。规则文件位于 `.claude/rules/` 目录，由 UserPromptSubmit hook 在每次对话开始时注入。

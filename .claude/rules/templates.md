# 格式模板与参数

## 文档铁律（跨文档通用）

### PRD 文档铁律

**序号层级规范**：
- 必须遵循 `1. -> 1.1 -> 1.1.1 -> • -> 。` 的层级嵌套关系
- 绝对不允许层级混乱或随意更改缩进

**纯中文表达**：
- 除行业标准专有名词（如 ID、CSV、PDF、API、TTS）外，必须使用中文
- 用"轻提示"代替 Toast，用"弹窗/模态框"代替 Modal，用"骨架屏"代替 Skeleton

**业务视角**：
- 只定义业务规则、状态机、数据流向和前端表现
- 严禁干涉研发的底层技术实现

### Acceptance 文档铁律

**GWT 格式**：
- 必须使用 `Given [前置条件] When [用户动作] Then [预期结果]` 格式
- 多个条件或结果用"且"连接

**Then 子句可断言**：
- 每个 Then 子句必须能直接写成 `expect(actual).toBe(expected)` 或 `assert actual == expected`
- 不能是主观描述（如"登录成功"），必须是可观测的系统状态（如"跳转到 /dashboard，localStorage 中存在 auth_token"）

**单条不超过 3 个'且'**：
- 单条 acceptance 中"且"超过 3 个时，应拆分为多条

### Session 记录文档铁律

**时间戳格式**：
- 必须运行 `date '+%Y-%m-%d %H:%M:%S'` 获取真实时间戳
- 禁止手写日期或写"（续）"等占位符

**最新在前**：
- 最新的 session 在最前面（紧跟 # Session 记录 标题）

### Task.json 文档铁律

**steps 使用绝对路径**：
- steps 中的文件路径必须是绝对路径，不能是相对路径
- 可用 [锁定] 标注关键技术选型，[建议] 标注实现细节

## BLOCKED 格式

```
BLOCKED - 需要人工介入

当前任务: Task#N - [任务标题]
任务描述: [背景与关键约束]

已完成的工作:
- [已实现的部分]

阻塞原因:
- [具体阻塞原因]
- [环境/依赖缺失详情]

需人工帮助:
1. [具体操作步骤]
2. [配置/凭据来源]

解除阻塞后:
- 任务将从 InSpec 恢复到 InProgress
```

## PENDING REVIEW 格式

```
PENDING REVIEW - 超前实施已达上限

等待验收: Task#N
已超前完成: Task#X, Task#Y, Task#Z (N/5)

请验收 Task#N:
- 通过 → 可继续超前实施
- 失败 → 需评估已超前任务的影响并修复
```

## REVIEW 请求格式

```
REVIEW - 请求人工审查

Task#N: [任务标题]
修改范围: [文件路径（行数变更）]

验收验证:
- [x] [acceptance 条目] — [验证方法/测试结果]

等待: 人工确认后将标记为 Done
```

## DECISION TRACE 格式（判断过程模板）

**触发原则**：当需要在多个互斥选项中做出选择时，必须先输出 DECISION TRACE。

常见场景包括但不限于：任务选择、BLOCKED 判定、并行与串行选择、大幅度修改判定、blocked_by 写入判定、循环依赖识别、状态转移判定。

```
DECISION TRACE

结论: [BLOCKED | CONTINUE | REVIEW | SKIP]

规则命中:
- [命中的规则条目，例如 workflow.md §任务选择策略]

证据:
- [task.json 状态、blocked_by 明细、测试日志、git diff --stat、配置检查结果]

排除项:
- [为什么不是其他结论]

下一步:
- [立即执行的动作；例如"输出 BLOCKED 模板并等待人工配置"]
```

## Session 文件格式

```markdown
---
## Session YYYY-MM-DD HH:MM:SS

### Task#N: [任务标题] → [状态]

**实施内容**:
- [完成的工作]

**验收验证**:
- [x] [acceptance 条目] ([验证方法])

**提交**: commit [hash]

### 下一步
[下一步计划]

---
```

## 可调参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 超前上限 | 5 | 最多同时超前实施的任务数（值存储在 settings.json） |
| task_archive_threshold | 20 | task.json 中 Done/Cancelled 任务超过此数触发归档（值存储在 settings.json） |
| recording_archive_threshold | 50 | recording/ 目录中 session 文件超过此数触发归档（值存储在 settings.json） |
| recording_retention_days | 30 | recording/ 归档时保留最近 N 天的文件，超过 N 天的文件打包归档（值存储在 settings.json） |
| 子代理并发数 | 3 | 0=禁用子代理，1=串行子代理，N≥2=最多N个并发子代理（值存储在 settings.json） |
| 探索/搜索类子代理模型 | haiku | 只读操作，降低成本（值存储在 settings.json） |
| 实施类子代理模型 | 继承主模型 | 写代码保持主模型质量（值存储在 settings.json） |
| recording_session_window | 600 | Session 记录时间窗口（秒），控制 check_rec() 判断追加/新建和 git log 查询范围（值存储在 settings.json） |
| context_monitor_warning | 30 | Context Rot 监控 WARNING 阈值，工具调用次数达到此值时输出提醒（值存储在 settings.json） |
| context_monitor_critical | 50 | Context Rot 监控 CRITICAL 阈值，达到此值时触发阻塞提醒要求更新 recording/（值存储在 settings.json） |
| context_monitor_delay | 10 | Context Rot 监控延迟阈值，CRITICAL+DELAY 时检查 recording/ 是否更新，未更新则自动写入 checkpoint（值存储在 settings.json） |

## 验证脚本模板

**smoke.sh**：
```bash
#!/bin/bash
set -e

echo "=== Smoke Test ==="

# JSON 合法性检查
for file in .claude/task.json .claude/settings.json; do
  if [ -f "$file" ]; then
    python3 -m json.tool "$file" > /dev/null && echo "✓ $file"
  fi
done

echo "=== All checks passed ==="
```

**task\_\<id\>\_verify.sh**：
```bash
#!/bin/bash
set -e

echo "=== Task #<id> Verification ==="

# 根据 acceptance 条件编写验证逻辑
# 示例：
# - 检查文件是否存在
# - 运行单元测试
# - 验证 API 响应

echo "=== Verification passed ==="
exit 0
```

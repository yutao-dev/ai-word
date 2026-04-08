# AI 工作流 SSE 流式改造计划

## 需求概述

将 AI 工作流从"批量返回结果"改为"实时流式展示"，让用户能够实时看到 AI 的思考过程和操作进度。

### 目标效果

```
第 1 轮
🤔 思考中: 正在分析用户请求...
📋 计划: 步骤1, 步骤2, 步骤3
⚙️  操作: 正在查询文档《后端语言》...

第 2 轮
🤔 思考中: 正在重写文档内容...
📋 计划: 完成
⚙️  操作: 正在修改文档《后端语言》...
✅ 完成: 文档内容已更新 (1000 字符)
```

---

## 当前架构

```
┌─────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────┐
│  前端   │───▶│  后端 API   │───▶│  AI Service      │───▶│ 云端 API│
│         │    │ /workflow   │    │ chat_with_system │    │         │
└─────────┘    └─────────────┘    └──────────────────┘    └─────────┘
                    │                      │
                    │                      │ 一次性返回完整响应
                    │                      │
                    ▼                      ▼
              SSE Stream              JSON 响应
```

### 当前流程

1. 前端发起请求 `/api/v1/workflow/execute`
2. 后端调用 AI Service，等待完整响应
3. AI 返回完整 JSON（包含 thinking, plan, action, is_complete）
4. 后端执行 action
5. 后端返回 SSE（包含所有步骤）

### 问题

- AI 的思考过程用户看不到，只能看到最终结果
- 操作过程没有实时反馈，用户不知道在执行什么
- 体验不够流畅，像是等待批处理完成

---

## 目标架构

```
┌─────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────┐
│  前端   │───▶│  后端 API   │───▶│  AI Service      │───▶│ 云端 API│
│         │    │ /workflow   │    │ chat_stream      │    │         │
└─────────┘    └─────────────┘    └──────────────────┘    └─────────┘
                    │                      │
                    │                      │ SSE 流式返回
                    │                      │
                    ▼                      ▼
              SSE Stream              SSE Stream
              (思考+操作)             (token 流)
```

### 目标流程

1. 前端发起请求 `/api/v1/workflow/execute`
2. 后端建立 SSE 连接，开始流式传输
3. 后端调用 AI Service，使用流式 API
4. AI 的思考过程（thinking）通过 SSE 实时推送给前端
5. AI 返回 action 时，后端执行并实时推送操作进度
6. 循环直到 is_complete=true

---

## 修改计划

### 阶段一：AI Service 流式改造

**文件**: `d:\Program Project\ai-word\backend\app\services\ai_service.py`

1. 新增 `chat_stream` 方法
   - 使用 OpenAI/Anthropic 的流式 API
   - 返回 SSE 格式的 token 流
   - 支持自定义解析逻辑（如提取 thinking）

2. 流式响应格式
   ```
   data: {"type": "thinking", "content": "正在分析..."}
   data: {"type": "token", "content": "你"}
   data: {"type": "token", "content": "好"}
   data: {"type": "done"}
   ```

### 阶段二：Workflow Service 改造

**文件**: `d:\Program Project\ai-word\backend\app\services\workflow_service.py`

1. 新增 `execute_stream_v2` 方法
   - 使用流式 AI 调用
   - 实时推送思考过程
   - 操作进度以占位符形式推送

2. SSE 事件类型
   ```python
   yield {"type": "thinking", "content": "正在分析用户请求..."}
   yield {"type": "plan", "content": ["步骤1", "步骤2"]}
   yield {"type": "action_start", "function": "getDocumentById", "target": "后端语言"}
   yield {"type": "action_progress", "message": "正在查询文档《后端语言》..."}
   yield {"type": "action_complete", "result": "文档内容 (83 行)"}
   yield {"type": "complete", "result": {...}}
   ```

### 阶段三：前端展示改造

**文件**: `d:\Program Project\ai-word\frontend\src/components/AIWorkflowPanel.jsx`

1. 实时渲染思考过程
   - 使用 `thinking` 类型事件
   - 打字机效果展示

2. 操作进度展示
   - 使用 `action_start` / `action_progress` / `action_complete` 事件
   - 动态显示操作描述

3. 状态管理
   - 修改 `useAIWorkflow` hook
   - 支持实时事件处理

### 阶段四：API 路由改造

**文件**: `d:\Program Project\ai-word\backend\app/api/v1/workflow.py`

1. 新增路由 `/api/v1/workflow/execute-v2`
2. 或修改现有路由，根据请求参数选择版本

---

## 详细修改清单

### 后端

| 文件 | 修改内容 | 复杂度 |
|------|---------|--------|
| `ai_service.py` | 新增 `chat_stream` 流式方法 | 高 |
| `workflow_service.py` | 新增 `execute_stream_v2` | 高 |
| `workflow.py` | 新增/修改路由 | 中 |

### 前端

| 文件 | 修改内容 | 复杂度 |
|------|---------|--------|
| `useAIWorkflow.js` | 新增事件处理器 | 中 |
| `AIWorkflowPanel.jsx` | 实时渲染组件 | 中 |
| `workflowApi.js` | SSE 事件解析 | 低 |

---

## 技术实现细节

### 1. AI Service 流式方法

```python
async def chat_stream(
    self,
    system_prompt: str,
    messages: list,
    model: str = None
):
    """流式聊天，返回 SSE 格式"""
    client = self._get_client(model)
    stream = await client.chat.completions.create(
        model=self._get_model_name(model),
        messages=[{"role": "system", "content": system_prompt}] + messages,
        stream=True
    )

    thinking_buffer = ""
    thinking_started = False

    async for chunk in stream:
        content = chunk.choices[0].delta.content or ""

        # 检测思考过程（根据模型输出格式）
        if content.startswith("## thinking"):
            thinking_started = True

        if thinking_started:
            thinking_buffer += content
            yield f"data: {{'type': 'thinking', 'content': '{thinking_buffer}'}}\n\n"
        else:
            yield f"data: {{'type': 'token', 'content': '{content}'}}\n\n"
```

### 2. Workflow 流式事件

```python
async def execute_stream_v2(self, user_request: str, document_id: str, ...):
    messages = [{"role": "user", "content": user_request}]

    for iteration in range(max_iterations):
        # 1. 流式发送思考开始
        yield {"type": "thinking", "content": "正在思考..."}

        # 2. 调用 AI（带流式响应）
        async for event in self.ai_service.chat_stream(...):
            if event["type"] == "thinking":
                yield event  # 转发思考过程
            elif event["type"] == "token":
                # 收集完整响应
                response_text += event["content"]

        # 3. 解析 AI 响应
        decision = json.loads(response_text)

        # 4. 流式发送操作进度
        action = decision.get("action")
        if action:
            func_name = action["function"]
            target = self._get_action_target(action)  # 获取文档标题

            yield {"type": "action_start", "function": func_name, "target": target}
            yield {"type": "action_progress", "message": f"正在{ACTION_DESCRIPTIONS[func_name]}《{target}》..."}

            result = self._execute_action(action, document_id)

            yield {"type": "action_complete", "result": result}
```

### 3. 操作描述映射

```python
ACTION_DESCRIPTIONS = {
    "getDocumentById": "查询文档",
    "updateDocumentContent": "修改文档",
    "insertEnd": "追加内容到文档",
    "createDocument": "创建文档",
    "searchInDocument": "搜索文档",
    "getDocumentOutline": "获取文档大纲",
    # ...
}
```

### 4. 前端事件处理

```javascript
const handleStreamEvent = (data) => {
  switch (data.type) {
    case 'thinking':
      setThinking((prev) => prev + data.content);
      break;
    case 'action_start':
      setCurrentAction({
        function: data.function,
        target: data.target,
        status: 'running'
      });
      break;
    case 'action_progress':
      setActionMessage(data.message);
      break;
    case 'action_complete':
      setCurrentAction((prev) => ({ ...prev, status: 'complete' }));
      break;
  }
};
```

---

## 兼容性考虑

1. **保留旧版本**: 新增 `execute_stream_v2`，不修改原有 `execute_stream`
2. **渐进式迁移**: 前端可以先支持新格式，逐步替换
3. **降级策略**: 如果流式 API 不可用，回退到批量模式

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 云端 API 不支持流式 | 高 | 保留批量模式作为降级 |
| SSE 连接断开 | 中 | 前端重连机制 |
| 思考过程格式不统一 | 中 | 统一解析逻辑 |
| Token 消耗增加 | 低 | 仅用于调试，可关闭 |

---

## 后续优化方向

1. **可取消的工作流**: 用户可以取消正在执行的工作流
2. **操作历史回放**: 用户可以回看之前的思考过程
3. **流式预览**: 边生成边预览文档内容变化

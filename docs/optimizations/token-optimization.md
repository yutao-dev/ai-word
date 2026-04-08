# AI 工作流 Token 优化方案

## 问题背景

当前 AI 工作流在执行多轮迭代时，每轮都会发送完整的系统提示词（约 2500 tokens），导致 Token 重复计费。

### 当前实现

```
每轮 API 调用:
┌─────────────────────────────────────────────────────────────┐
│  messages = [                                                │
│    {"role": "system", "content": SYSTEM_PROMPT},  ← 约2500 tokens │
│    {"role": "user", "content": "用户请求"},                   │
│    {"role": "assistant", "content": "AI响应"},               │
│    {"role": "user", "content": "操作结果..."},               │
│    ...                                                       │
│  ]                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Token 消耗分析

| 工作流轮数 | 系统提示词消耗 | 有效对话消耗 | 浪费比例 |
|-----------|---------------|-------------|---------|
| 3 轮 | 7,500 tokens | 1,500 tokens | 83% |
| 5 轮 | 12,500 tokens | 2,000 tokens | 86% |
| 10 轮 | 25,000 tokens | 3,500 tokens | 88% |

---

## 优化方案

### 方案 1: API 原生系统消息 + Prompt Caching

#### 原理

利用 LLM 提供商的系统消息缓存机制，避免重复计费。

#### 实现方式

**OpenAI:**

```python
response = await client.chat.completions.create(
    model=model_name,
    messages=messages,  # 不包含 system
    system=system_prompt,  # 单独的系统提示词参数
    max_tokens=max_tokens,
    temperature=temperature
)
```

**Anthropic (Prompt Caching):**

```python
response = await client.messages.create(
    model=model_name,
    system=[
        {
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"}  # 启用缓存
        }
    ],
    messages=messages,
    max_tokens=max_tokens,
    temperature=temperature
)
```

#### 优化效果

```
优化后:
┌─────────────────────────────────────────────────────────────┐
│  第1轮:                                                     │
│  system: SYSTEM_PROMPT → [缓存] ← 计费 1 次                 │
│  messages: [用户请求]                                        │
│                                                              │
│  第2-5轮:                                                   │
│  system: SYSTEM_PROMPT → [命中缓存] ← 不计费或折扣计费       │
│  messages: [历史对话]                                        │
└─────────────────────────────────────────────────────────────┘
```

| 提供商 | 缓存命中计费 | 节省比例 |
|-------|-------------|---------|
| OpenAI | 自动缓存，相同内容复用 | ~50% |
| Anthropic | 缓存命中后降低 90% | ~90% |

---

### 方案 2: 精简系统提示词

#### 原理

首轮发送完整提示词，后续轮次发送精简版本，减少发送量。

#### 实现方式

**完整版 (首轮):**

```
## 📋 可用函数列表

### 文档管理
1. **createDocument** - 创建新文档
   参数: title (标题), content (内容，可选)
   
2. **getAllDocument** - 获取所有文档列表
   参数: 无
   
... (19个函数详细说明)

## 🎯 执行策略
... (详细策略)

## 💡 使用技巧
... (详细技巧)

## 📤 响应格式
... (详细格式)
```

**精简版 (后续轮):**

```
## 可用函数
createDocument, getAllDocument, getDocumentById, searchInDocument, 
findAndReplace, getDocumentOutline, getSectionByHeading, insertEnd, 
insertAt, insertAfterHeading, insertParagraph, deleteByRange, 
deleteAndSwap, updateDocumentContent, moveSection, batchOperations, 
getDocumentStats, extractKeyInfo, getTokenUsage

## 响应格式
{
    "thinking": "思考过程",
    "plan": ["步骤"],
    "action": {"function": "函数名", "params": {...}},
    "is_complete": false,
    "summary": "说明"
}

注: 详细函数说明请参考首轮系统提示词。
```

#### 优化效果

| 版本 | Token 数量 | 用途 |
|-----|-----------|------|
| 完整版 | ~2,500 tokens | 首轮 |
| 精简版 | ~500 tokens | 后续轮 |

**5轮工作流节省**: (2500 × 4) - (500 × 4) = **8,000 tokens (80%)**

---

### 方案 3: 组合方案 (推荐)

同时使用 API 缓存和精简提示词，实现双重节省。

#### 实现代码

```python
# workflow_service.py

COMPACT_SYSTEM_PROMPT = """## 可用函数
createDocument, getAllDocument, getDocumentById, searchInDocument, 
findAndReplace, getDocumentOutline, getSectionByHeading, insertEnd, 
insertAt, insertAfterHeading, insertParagraph, deleteByRange, 
deleteAndSwap, updateDocumentContent, moveSection, batchOperations, 
getDocumentStats, extractKeyInfo, getTokenUsage

## 响应格式
{
    "thinking": "思考过程",
    "plan": ["步骤"],
    "action": {"function": "函数名", "params": {...}},
    "is_complete": false,
    "summary": "说明"
}

注: 详细函数说明请参考首轮系统提示词。"""


def get_system_prompt(iteration: int) -> str:
    """根据迭代次数返回对应的系统提示词"""
    if iteration == 1:
        return SYSTEM_PROMPT  # 完整版
    return COMPACT_SYSTEM_PROMPT  # 精简版
```

```python
# ai_service.py

async def chat_with_system(
    self,
    system_prompt: str,
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    request_type: str = None
) -> ChatResponse:
    config = self._get_default_config()
    client, provider = self._get_client(config)
    
    if provider == "anthropic":
        # Anthropic: 使用 Prompt Caching
        response = await client.messages.create(
            model=model_name,
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"}
                }
            ],
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature
        )
        # ... 处理响应
    else:
        # OpenAI: 使用单独的 system 参数
        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            system=system_prompt,
            max_tokens=max_tokens,
            temperature=temperature
        )
        # ... 处理响应
```

#### 综合优化效果

| 工作流轮数 | 优化前 | 优化后 | 节省 |
|-----------|-------|-------|------|
| 3 轮 | 9,000 tokens | 3,500 tokens | 61% |
| 5 轮 | 14,500 tokens | 4,500 tokens | 69% |
| 10 轮 | 28,500 tokens | 7,000 tokens | 75% |

---

## 实施计划

### 阶段 1: API 缓存优化 (优先级: 高)

1. 修改 `ai_service.py`，使用 API 原生系统消息参数
2. 为 Anthropic 添加 Prompt Caching 支持
3. 测试验证缓存命中效果

### 阶段 2: 精简提示词优化 (优先级: 中)

1. 创建精简版系统提示词 `COMPACT_SYSTEM_PROMPT`
2. 修改 `workflow_service.py`，根据迭代次数选择提示词
3. 测试验证 AI 行为一致性

### 阶段 3: 监控与调优 (优先级: 低)

1. 添加 Token 消耗监控
2. 对比优化前后的实际消耗
3. 根据效果调整精简提示词内容

---

## 注意事项

1. **Anthropic 缓存有效期**: 5 分钟，需确保工作流在此时间内完成
2. **精简提示词效果**: 需测试 AI 在精简提示词下的表现是否一致
3. **向后兼容**: 保留完整提示词选项，便于调试和回滚

---

## 参考资料

- [OpenAI System Messages](https://platform.openai.com/docs/guides/text-generation#system-message)
- [Anthropic Prompt Caching](https://docs.anthropic.com/claude/docs/prompt-caching)

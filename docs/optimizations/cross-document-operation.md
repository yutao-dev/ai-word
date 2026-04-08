# AI 工作流跨文档操作功能

## 功能概述

AI 工作流现在支持跨文档操作，AI 可以根据 `document_id` 操作任意文档，而不仅限于当前打开的文档。

---

## 实现原理

### 1. 文档上下文注入

每轮迭代开始时，系统会自动获取最新的文档列表，并注入到系统提示词中：

```python
def build_context_message(current_doc_id: str, documents: list) -> str:
    """构建文档上下文消息，包含当前文档列表"""
    doc_list = "\n".join([
        f"  - ID: {doc.id} | 标题: {doc.title}" + 
        (" (当前文档)" if doc.id == current_doc_id else "")
        for doc in documents
    ])
    
    return f"""## 📁 当前文档上下文

当前打开的文档: {current_doc.title} (ID: {current_doc_id})

所有文档列表:
{doc_list}

⚠️ 操作文档时，请确保传入正确的 document_id 参数！"""
```

### 2. 动态文档查询

`_execute_action` 函数会根据传入的 `document_id` 参数查询对应的文档：

```python
def _execute_action(self, action: Dict[str, Any], current_doc_id: str) -> str:
    function_name = action.get("function")
    params = action.get("params", {})
    
    # 获取目标文档 ID（默认为当前文档）
    target_doc_id = params.get("document_id", current_doc_id)
    
    # 查询目标文档
    document = self.db.query(Document).filter(
        Document.id == target_doc_id, 
        Document.is_deleted == False
    ).first()
    
    if not document:
        return f"错误: 未找到文档 ID: {target_doc_id}"
    
    # 执行操作...
```

### 3. 实时上下文更新

每轮迭代都会重新获取文档列表，确保 AI 能看到最新创建的文档：

```python
for iteration in range(max_iterations):
    # 获取最新文档列表
    docs = self.db.query(Document).filter(Document.is_deleted == False).all()
    
    # 构建上下文消息
    context_message = build_context_message(document_id, docs)
    
    # 组合完整系统提示词
    full_system_prompt = SYSTEM_PROMPT + "\n\n" + context_message
    
    # 调用 AI...
```

---

## 使用示例

### 场景 1: 操作当前文档

```
用户: 在当前文档末尾添加一段总结

AI 调用: insertEnd(document_id="当前文档ID", content="总结内容...")
```

### 场景 2: 操作其他文档

```
用户: 在"项目计划"文档中添加一个新章节

AI 调用: 
1. getAllDocument() → 获取文档列表
2. insertEnd(document_id="项目计划文档ID", content="新章节内容...")
```

### 场景 3: 创建新文档

```
用户: 创建一个新文档记录会议纪要

AI 调用: createDocument(title="会议纪要", content="...")
```

---

## 安全考虑

### 1. 文档 ID 验证

所有操作都会验证目标文档是否存在：

```python
document = self.db.query(Document).filter(
    Document.id == target_doc_id, 
    Document.is_deleted == False
).first()

if not document:
    return f"错误: 未找到文档 ID: {target_doc_id}"
```

### 2. 默认文档保护

如果 AI 没有传入 `document_id`，默认操作当前打开的文档：

```python
target_doc_id = params.get("document_id", current_doc_id)
```

### 3. 实时数据同步

每轮迭代后刷新数据库会话，确保数据一致性：

```python
self.db.expire_all()
document = self.db.query(Document).filter(Document.id == document_id).first()
```

---

## 注意事项

1. **Token 消耗**: 每轮都会发送文档列表上下文，会增加少量 Token 消耗
2. **文档数量**: 如果文档数量很多，上下文消息会变长
3. **权限控制**: 当前实现未添加用户权限验证，后续可扩展

---

## 后续优化方向

1. **权限验证**: 添加用户认证，确保只能操作有权限的文档
2. **文档搜索**: 支持按标题模糊搜索文档 ID
3. **批量操作**: 支持一次操作多个文档
4. **操作日志**: 记录所有跨文档操作，便于审计

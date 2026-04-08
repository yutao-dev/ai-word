# AI 工作流 Token 消耗测试方案

## 测试目标

量化分析 AI 工作流的 Token 消耗，评估工程优化对 Token 消耗的影响。

## 测试方法

### 测试流程

1. **准备测试文档**
   - 创建测试用文档《Token 测试文档》，包含固定内容
   - 记录文档 ID

2. **执行基准测试（多批次）**
   - 分 3 批次执行，每批次 5 次
   - 每批次执行后记录 Token 消耗数据
   - 每批次执行后删除工作流创建的文档
   - 计算每批次的平均值

3. **计算基准值**
   - 计算 3 批次平均值的均值作为基准
   - 计算批次间的标准差评估稳定性

4. **优化后复测**
   - 使用相同的提示词和文档
   - 执行相同 3 批次（每批 5 次）
   - 对比优化前后的数据

### 批处理测试法

为减少单次执行异常值的影响，采用多批次测试：

```
批次 1 (5次) → 平均值 A
批次 2 (5次) → 平均值 B
批次 3 (5次) → 平均值 C
─────────────────────
基准 = (A + B + C) / 3
批次间标准差 = std(A, B, C)
```

### 测试数据记录表

#### 批次 1

| 指标 | 测试1 | 测试2 | 测试3 | 测试4 | 测试5 | 批次平均 |
|------|------|------|------|------|------|----------|
| 输入 Token | | | | | | |
| 输出 Token | | | | | | |
| 总 Token | | | | | | |
| 执行时间(s) | | | | | | |

#### 批次 2

| 指标 | 测试1 | 测试2 | 测试3 | 测试4 | 测试5 | 批次平均 |
|------|------|------|------|------|------|----------|
| 输入 Token | | | | | | |
| 输出 Token | | | | | | |
| 总 Token | | | | | | |
| 执行时间(s) | | | | | | |

#### 批次 3

| 指标 | 测试1 | 测试2 | 测试3 | 测试4 | 测试5 | 批次平均 |
|------|------|------|------|------|------|----------|
| 输入 Token | | | | | | |
| 输出 Token | | | | | | |
| 总 Token | | | | | | |
| 执行时间(s) | | | | | | |

### 基准值汇总表

| 指标 | 批次1平均 | 批次2平均 | 批次3平均 | 基准值 | 批次间标准差 |
|------|----------|----------|----------|--------|--------------|
| 总 Token | | | | | |
| 输入 Token | | | | | |
| 输出 Token | | | | | |
| 执行时间 | | | | | |

### 优化对比表

| 指标 | 优化前基准 | 优化后基准 | 变化量 | 变化率 | 评估 |
|------|----------|----------|--------|--------|------|
| 总 Token | | | | | |
| 输入 Token | | | | | |
| 输出 Token | | | | | |
| 执行时间 | | | | | |

**评估标准**：
- 变化率 > 5%：效果显著
- 变化率 1%~5%：效果一般
- 变化率 < 1%：效果不明显

## 测试步骤

### 1. 准备环境

```bash
# 确保后端服务运行中
cd backend
python -m uvicorn app.main:app --reload
```

### 2. 打开 Token 统计面板

1. 在前端界面打开 Token 使用统计面板
2. 切换到"工作流趋势"视图
3. 点击"清除记录"确保数据干净

### 3. 执行基准测试

```bash
# 使用 curl 测试（或通过前端界面）

# 测试 1
curl -X POST "http://localhost:8000/api/v1/workflow/execute" \
  -H "Content-Type: application/json" \
  -d '{"user_request": "你的提示词", "document_id": "测试文档ID", "model": "模型名", "max_iterations": 10}'

# 记录 Token 数据...

# 重复上述步骤 3-5 次
```

### 4. 记录数据

每次执行后，在 Token 统计面板中记录：
- 总 Token 数
- 输入 Token 数
- 输出 Token 数
- 请求次数

### 5. 清理环境

每次执行后删除工作流创建的文档：
- 在前端界面删除
- 或使用 API：`DELETE /api/v1/documents/{id}`

### 6. 执行优化后测试

完成优化后，重复步骤 3-5。

## 数据分析

### 计算公式

```
平均值 = sum(各次Token) / 测试次数
标准差 = sqrt(sum((各次Token - 平均值)^2) / 测试次数)
变化率 = (优化后 - 优化前) / 优化前 * 100%
```

### 判断标准

- Token 消耗降低 > 5%：优化有效
- Token 消耗变化在 ±5% 以内：效果不明显
- Token 消耗增加 > 5%：优化无效或需调整

## 注意事项

1. **模型温度**：确保使用相同的温度参数，减少随机性
2. **时间因素**：避免在高峰期测试，网络延迟可能影响结果
3. **上下文污染**：每次测试前确保文档内容一致
4. **缓存问题**：部分 API 可能有缓存机制，记录时注意区分
5. **异常值**：如果某次执行异常（如 AI 重复输出），应排除该次数据

## 优化方向参考

### 降低输入 Token
- 精简系统提示词
- 优化上下文文档信息格式
- 减少不必要的文档列表

### 降低输出 Token
- 在提示词中明确要求简洁输出
- 限制 JSON 响应格式
- 避免冗长的思考过程描述

### 减少请求次数
- 合并多次操作为一次
- 优化 AI 判断逻辑，减少无效迭代

## 附录：自动化脚本（可选）

如需自动化测试，可编写 Python 脚本：

```python
import requests
import json

API_BASE = "http://localhost:8000/api/v1"

def run_workflow_test(prompt, doc_id, model, runs=5):
    results = []
    for i in range(runs):
        # 执行工作流
        response = requests.post(
            f"{API_BASE}/workflow/execute",
            json={
                "user_request": prompt,
                "document_id": doc_id,
                "model": model,
                "max_iterations": 10
            }
        )
        # 获取工作流 ID
        workflow_id = response.json().get("workflow_id")
        
        # 获取 Token 消耗
        token_response = requests.get(
            f"{API_BASE}/token-usage/workflow/{workflow_id}"
        )
        tokens = token_response.json()
        
        results.append({
            "run": i + 1,
            "workflow_id": workflow_id,
            "total_tokens": sum(t["total_tokens"] for t in tokens),
            "prompt_tokens": sum(t["prompt_tokens"] for t in tokens),
            "completion_tokens": sum(t["completion_tokens"] for t in tokens)
        })
        
        # 清理创建的文档
        # ...
    
    return results
```

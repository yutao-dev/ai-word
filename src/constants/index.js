export const STORAGE_KEYS = {
  DOCUMENTS: 'markdown-documents',
  LLM_CONFIG: 'llm-config'
}

export const LLM_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
    modelsEndpoint: '/models'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-opus-20240229',
    modelsEndpoint: null
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    defaultBaseUrl: '',
    defaultModel: '',
    modelsEndpoint: null
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama2',
    modelsEndpoint: '/api/tags'
  },
  {
    id: 'custom',
    name: '自定义 (OpenAI 兼容)',
    defaultBaseUrl: '',
    defaultModel: '',
    modelsEndpoint: '/models'
  }
]

export const API_ENDPOINTS = {
  OPENAI_CHAT: '/chat/completions',
  OLLAMA_GENERATE: '/api/generate',
  ANTHROPIC_MESSAGES: '/v1/messages'
}

export const DEFAULT_DOCUMENTS = [
  {
    id: '1',
    title: '欢迎文档',
    content: `# 欢迎使用 Markdown 文档管理系统

这是一个支持本地存储和 AI 增强的 **Markdown** 文档编辑器。

## 功能特性

- 📁 文档管理（创建、编辑、删除）
- 💾 本地存储（数据保存在浏览器中）
- 🤖 AI 增强（集成语言模型）
- 👁️ 实时预览
- ✨ 支持 GFM (GitHub Flavored Markdown)

## 如何使用 AI 功能

1. 点击顶部的 ⚙️ 按钮打开设置
2. 选择你的 AI 服务商
3. 配置 API Key 和 Base URL
4. 拉取可用的模型列表
5. 点击编辑器顶部的 🤖 按钮使用 AI 功能

## 代码示例

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

## 表格

| 功能 | 状态 |
|------|------|
| 文档管理 | ✅ |
| 本地存储 | ✅ |
| AI 集成 | ✅ |
| 实时预览 | ✅ |

---

*开始你的创作之旅吧！*`
  },
  {
    id: '2',
    title: 'Markdown 教程',
    content: `# Markdown 快速教程

## 标题

使用 \`#\` 创建标题，支持 1-6 级：

# 一级标题
## 二级标题
### 三级标题
#### 四级标题
##### 五级标题
###### 六级标题

## 文本格式化

**粗体文本**
*斜体文本*
~~删除线~~

## 列表

### 无序列表

- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2

### 有序列表

1. 第一项
2. 第二项
3. 第三项

## 链接和图片

[访问 GitHub](https://github.com)

## 引用

> 这是一段引用文本
> 可以包含多行

## 代码

行内代码：\`console.log()\`

代码块：

\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

## 表格

| 姓名 | 年龄 | 职业 |
|------|------|------|
| 张三 | 25 | 工程师 |
| 李四 | 30 | 设计师 |

## 分隔线

---

以上就是 Markdown 的基本语法！`
  }
]

export const DEFAULT_LLM_CONFIG = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0
}

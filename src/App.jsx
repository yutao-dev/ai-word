import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const LLM_PROVIDERS = [
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

const DEFAULT_DOCUMENTS = [
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

function App() {
  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem('markdown-documents')
    return saved ? JSON.parse(saved) : DEFAULT_DOCUMENTS
  })
  const [currentDocId, setCurrentDocId] = useState(documents[0]?.id || null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [showNewDocInput, setShowNewDocInput] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  const [llmConfig, setLlmConfig] = useState(() => {
    const saved = localStorage.getItem('llm-config')
    if (saved) {
      return JSON.parse(saved)
    }
    return {
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
  })
  
  const [availableModels, setAvailableModels] = useState([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [showBeautifyBtn, setShowBeautifyBtn] = useState(false)
  const [beautifyBtnPosition, setBeautifyBtnPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 })
  const [isBeautifying, setIsBeautifying] = useState(false)

  useEffect(() => {
    localStorage.setItem('markdown-documents', JSON.stringify(documents))
  }, [documents])

  useEffect(() => {
    localStorage.setItem('llm-config', JSON.stringify(llmConfig))
  }, [llmConfig])

  const currentDoc = documents.find(doc => doc.id === currentDocId)

  const updateCurrentDoc = (content) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === currentDocId ? { ...doc, content, updatedAt: Date.now() } : doc
    ))
  }

  const createDocument = () => {
    if (!newDocTitle.trim()) return
    const newDoc = {
      id: Date.now().toString(),
      title: newDocTitle.trim(),
      content: `# ${newDocTitle.trim()}\n\n开始编辑你的文档...`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setDocuments(prev => [newDoc, ...prev])
    setCurrentDocId(newDoc.id)
    setNewDocTitle('')
    setShowNewDocInput(false)
  }

  const deleteDocument = (e, docId) => {
    e.stopPropagation()
    if (documents.length <= 1) {
      alert('至少需要保留一个文档！')
      return
    }
    if (confirm('确定要删除这个文档吗？')) {
      const newDocs = documents.filter(doc => doc.id !== docId)
      setDocuments(newDocs)
      if (currentDocId === docId) {
        setCurrentDocId(newDocs[0].id)
      }
    }
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const currentProvider = LLM_PROVIDERS.find(p => p.id === llmConfig.provider)

  const fetchModels = async () => {
    if (!llmConfig.apiKey || !llmConfig.baseUrl) {
      alert('请先填写 API Key 和 Base URL')
      return
    }

    const provider = LLM_PROVIDERS.find(p => p.id === llmConfig.provider)
    if (!provider?.modelsEndpoint) {
      alert('该提供商不支持模型列表拉取，请手动输入模型名称')
      return
    }

    setIsLoadingModels(true)
    setAvailableModels([])

    try {
      let models = []
      
      if (provider.id === 'ollama') {
        const response = await fetch(`${llmConfig.baseUrl}${provider.modelsEndpoint}`)
        const data = await response.json()
        models = data.models?.map(m => m.name) || []
      } else {
        const response = await fetch(`${llmConfig.baseUrl}${provider.modelsEndpoint}`, {
          headers: {
            'Authorization': `Bearer ${llmConfig.apiKey}`
          }
        })
        const data = await response.json()
        models = data.data?.map(m => m.id) || []
      }

      setAvailableModels(models)
      if (models.length > 0 && !models.includes(llmConfig.model)) {
        setLlmConfig(prev => ({ ...prev, model: models[0] }))
      }
    } catch (error) {
      console.error('拉取模型失败:', error)
      alert('拉取模型失败，请检查配置是否正确')
    } finally {
      setIsLoadingModels(false)
    }
  }

  const callAI = async () => {
    if (!aiPrompt.trim()) {
      alert('请输入提示词')
      return
    }

    if (!llmConfig.apiKey) {
      alert('请先在设置中配置 API Key')
      return
    }

    setIsAiGenerating(true)
    setAiResponse('')

    try {
      let response
      const provider = LLM_PROVIDERS.find(p => p.id === llmConfig.provider)

      if (provider?.id === 'anthropic') {
        response = await fetch(`${llmConfig.baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': llmConfig.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: llmConfig.model,
            max_tokens: llmConfig.maxTokens,
            temperature: llmConfig.temperature,
            messages: [{ role: 'user', content: aiPrompt }]
          })
        })
        const data = await response.json()
        setAiResponse(data.content?.[0]?.text || '无响应')
      } else if (provider?.id === 'ollama') {
        response = await fetch(`${llmConfig.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: llmConfig.model,
            prompt: aiPrompt,
            stream: false,
            options: {
              temperature: llmConfig.temperature,
              num_predict: llmConfig.maxTokens
            }
          })
        })
        const data = await response.json()
        setAiResponse(data.response || '无响应')
      } else {
        response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmConfig.apiKey}`
          },
          body: JSON.stringify({
            model: llmConfig.model,
            messages: [{ role: 'user', content: aiPrompt }],
            temperature: llmConfig.temperature,
            max_tokens: llmConfig.maxTokens,
            top_p: llmConfig.topP,
            frequency_penalty: llmConfig.frequencyPenalty,
            presence_penalty: llmConfig.presencePenalty
          })
        })
        const data = await response.json()
        setAiResponse(data.choices?.[0]?.message?.content || '无响应')
      }
    } catch (error) {
      console.error('AI 调用失败:', error)
      setAiResponse(`调用失败: ${error.message}`)
    } finally {
      setIsAiGenerating(false)
    }
  }

  const insertToEditor = () => {
    if (!aiResponse) return
    const newContent = currentDoc?.content ? `${currentDoc.content}\n\n${aiResponse}` : aiResponse
    updateCurrentDoc(newContent)
    setShowAiPanel(false)
    setAiPrompt('')
    setAiResponse('')
  }

  const handleTextSelection = (e) => {
    const textarea = e.target
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    if (start !== end) {
      const selected = textarea.value.substring(start, end)
      if (selected.trim().length > 0) {
        setSelectedText(selected)
        setSelectionRange({ start, end })
        
        const rect = textarea.getBoundingClientRect()
        setBeautifyBtnPosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top - 50
        })
        setShowBeautifyBtn(true)
      }
    } else {
      setShowBeautifyBtn(false)
    }
  }

  const handleMouseUp = (e) => {
    setTimeout(() => {
      const selection = window.getSelection()
      if (!selection || selection.toString().trim() === '') {
        setShowBeautifyBtn(false)
      }
    }, 100)
  }

  const beautifyText = async () => {
    if (!selectedText) return
    if (!llmConfig.apiKey) {
      alert('请先在设置中配置 API Key')
      return
    }

    setIsBeautifying(true)
    setShowBeautifyBtn(false)

    try {
      let response
      const provider = LLM_PROVIDERS.find(p => p.id === llmConfig.provider)
      const prompt = `请优化和美化以下文本，使其表达更清晰、更专业，保持原意不变，直接返回美化后的内容，不需要额外说明：\n\n${selectedText}`

      if (provider?.id === 'anthropic') {
        response = await fetch(`${llmConfig.baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': llmConfig.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: llmConfig.model,
            max_tokens: llmConfig.maxTokens,
            temperature: 0.7,
            messages: [{ role: 'user', content: prompt }]
          })
        })
        const data = await response.json()
        const beautified = data.content?.[0]?.text || selectedText
        replaceSelectedText(beautified)
      } else if (provider?.id === 'ollama') {
        response = await fetch(`${llmConfig.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: llmConfig.model,
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.7,
              num_predict: llmConfig.maxTokens
            }
          })
        })
        const data = await response.json()
        const beautified = data.response || selectedText
        replaceSelectedText(beautified)
      } else {
        response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmConfig.apiKey}`
          },
          body: JSON.stringify({
            model: llmConfig.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: llmConfig.maxTokens
          })
        })
        const data = await response.json()
        const beautified = data.choices?.[0]?.message?.content || selectedText
        replaceSelectedText(beautified)
      }
    } catch (error) {
      console.error('美化失败:', error)
      alert('美化失败，请检查配置')
    } finally {
      setIsBeautifying(false)
    }
  }

  const replaceSelectedText = (newText) => {
    const content = currentDoc?.content || ''
    const before = content.substring(0, selectionRange.start)
    const after = content.substring(selectionRange.end)
    const updatedContent = before + newText + after
    updateCurrentDoc(updatedContent)
    setSelectedText('')
  }

  return (
    <div className="app">
      <div className="header">
        <button 
          className="toggle-sidebar-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          ☰
        </button>
        <h1>📝 Markdown 文档管理</h1>
        <div className="header-actions">
          <button 
            className="header-btn"
            onClick={() => setShowAiPanel(!showAiPanel)}
            title="AI 助手"
          >
            🤖
          </button>
          <button 
            className="header-btn"
            onClick={() => setShowSettings(true)}
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </div>
      <div className="main-container">
        {isSidebarOpen && (
          <div className="sidebar">
            <div className="sidebar-header">
              <h2>📁 我的文档</h2>
              {!showNewDocInput ? (
                <button 
                  className="new-doc-btn"
                  onClick={() => setShowNewDocInput(true)}
                >
                  + 新建
                </button>
              ) : (
                <div className="new-doc-input-container">
                  <input
                    type="text"
                    className="new-doc-input"
                    placeholder="文档标题..."
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createDocument()
                      if (e.key === 'Escape') {
                        setShowNewDocInput(false)
                        setNewDocTitle('')
                      }
                    }}
                    autoFocus
                  />
                  <button className="confirm-btn" onClick={createDocument}>✓</button>
                  <button 
                    className="cancel-btn"
                    onClick={() => {
                      setShowNewDocInput(false)
                      setNewDocTitle('')
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className="document-list">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className={`document-item ${doc.id === currentDocId ? 'active' : ''}`}
                  onClick={() => setCurrentDocId(doc.id)}
                >
                  <div className="doc-info">
                    <div className="doc-title">{doc.title}</div>
                    <div className="doc-date">
                      {doc.updatedAt ? formatDate(doc.updatedAt) : '刚刚'}
                    </div>
                  </div>
                  <button 
                    className="delete-btn"
                    onClick={(e) => deleteDocument(e, doc.id)}
                    title="删除文档"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="editor-container">
          {showAiPanel && (
            <div className="ai-panel">
              <div className="ai-panel-header">
                <h3>🤖 AI 助手</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowAiPanel(false)}
                >
                  ✕
                </button>
              </div>
              <div className="ai-panel-content">
                <textarea
                  className="ai-prompt"
                  placeholder="输入你的需求，例如：\n• 帮我写一段关于...的介绍\n• 继续这段内容\n• 帮我优化这篇文章"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && callAI()}
                />
                <button 
                  className="ai-generate-btn"
                  onClick={callAI}
                  disabled={isAiGenerating}
                >
                  {isAiGenerating ? '生成中...' : '🚀 生成'}
                </button>
                {aiResponse && (
                  <div className="ai-response-container">
                    <div className="ai-response-header">
                      <span>AI 回复</span>
                      <button className="insert-btn" onClick={insertToEditor}>
                        ✅ 插入文档
                      </button>
                    </div>
                    <div className="ai-response">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {aiResponse}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="editor-pane">
            <div className="pane-header">
              <span className="doc-name">{currentDoc?.title || '未命名文档'}</span>
              <span className="pane-label">编辑器</span>
            </div>
            <div className="editor-wrapper" onMouseUp={handleMouseUp}>
              <textarea
                className="editor"
                value={currentDoc?.content || ''}
                onChange={(e) => updateCurrentDoc(e.target.value)}
                onSelect={handleTextSelection}
                placeholder="在这里输入 Markdown 内容，选择文本后可一键美化..."
              />
              {showBeautifyBtn && (
                <button
                  className="beautify-btn"
                  style={{
                    position: 'absolute',
                    left: beautifyBtnPosition.x,
                    top: beautifyBtnPosition.y
                  }}
                  onClick={beautifyText}
                  disabled={isBeautifying}
                >
                  {isBeautifying ? '美化中...' : '✨ 一键美化'}
                </button>
              )}
            </div>
          </div>
          <div className="preview-pane">
            <div className="pane-header">预览</div>
            <div className="preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentDoc?.content || ''}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ AI 设置</h2>
              <button 
                className="close-btn"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              <div className="setting-group">
                <label>AI 服务商</label>
                <select
                  value={llmConfig.provider}
                  onChange={(e) => {
                    const provider = LLM_PROVIDERS.find(p => p.id === e.target.value)
                    setLlmConfig(prev => ({
                      ...prev,
                      provider: e.target.value,
                      baseUrl: provider?.defaultBaseUrl || '',
                      model: provider?.defaultModel || ''
                    }))
                    setAvailableModels([])
                  }}
                >
                  {LLM_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="setting-group">
                <label>API Key</label>
                <input
                  type="password"
                  placeholder="输入你的 API Key"
                  value={llmConfig.apiKey}
                  onChange={(e) => setLlmConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>

              <div className="setting-group">
                <label>Base URL</label>
                <input
                  type="text"
                  placeholder="API 基础地址"
                  value={llmConfig.baseUrl}
                  onChange={(e) => setLlmConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                />
              </div>

              <div className="setting-group">
                <div className="setting-row">
                  <label>模型</label>
                  <button 
                    className="fetch-models-btn"
                    onClick={fetchModels}
                    disabled={isLoadingModels}
                  >
                    {isLoadingModels ? '加载中...' : '🔄 拉取模型'}
                  </button>
                </div>
                {availableModels.length > 0 ? (
                  <select
                    value={llmConfig.model}
                    onChange={(e) => setLlmConfig(prev => ({ ...prev, model: e.target.value }))}
                  >
                    {availableModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="模型名称"
                    value={llmConfig.model}
                    onChange={(e) => setLlmConfig(prev => ({ ...prev, model: e.target.value }))}
                  />
                )}
              </div>

              <hr className="divider" />
              <h3 className="params-title">模型参数</h3>

              <div className="setting-group">
                <div className="setting-row">
                  <label>Temperature: {llmConfig.temperature}</label>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={llmConfig.temperature}
                  onChange={(e) => setLlmConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                />
              </div>

              <div className="setting-group">
                <label>Max Tokens</label>
                <input
                  type="number"
                  min="1"
                  max="128000"
                  value={llmConfig.maxTokens}
                  onChange={(e) => setLlmConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                />
              </div>

              <div className="setting-group">
                <div className="setting-row">
                  <label>Top P: {llmConfig.topP}</label>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={llmConfig.topP}
                  onChange={(e) => setLlmConfig(prev => ({ ...prev, topP: parseFloat(e.target.value) }))}
                />
              </div>

              <div className="setting-group">
                <div className="setting-row">
                  <label>Frequency Penalty: {llmConfig.frequencyPenalty}</label>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={llmConfig.frequencyPenalty}
                  onChange={(e) => setLlmConfig(prev => ({ ...prev, frequencyPenalty: parseFloat(e.target.value) }))}
                />
              </div>

              <div className="setting-group">
                <div className="setting-row">
                  <label>Presence Penalty: {llmConfig.presencePenalty}</label>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={llmConfig.presencePenalty}
                  onChange={(e) => setLlmConfig(prev => ({ ...prev, presencePenalty: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="save-btn"
                onClick={() => setShowSettings(false)}
              >
                ✓ 保存并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

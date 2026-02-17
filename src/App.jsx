import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const DEFAULT_DOCUMENTS = [
  {
    id: '1',
    title: '欢迎文档',
    content: `# 欢迎使用 Markdown 文档管理系统

这是一个支持本地存储的 **Markdown** 文档编辑器。

## 功能特性

- 📁 文档管理（创建、编辑、删除）
- 💾 本地存储（数据保存在浏览器中）
- 👁️ 实时预览
- ✨ 支持 GFM (GitHub Flavored Markdown)

## 如何使用

1. 点击左侧「+ 新建文档」创建新文档
2. 在文档列表中点击文档标题进行切换
3. 点击文档右侧的 🗑️ 图标删除文档
4. 编辑内容会自动保存

## 代码示例

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

## 表格

| 功能 | 状态 |
|------|------|
| 文档管理 | ✅ |
| 本地存储 | ✅ |
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

  useEffect(() => {
    localStorage.setItem('markdown-documents', JSON.stringify(documents))
  }, [documents])

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
          <div className="editor-pane">
            <div className="pane-header">
              <span className="doc-name">{currentDoc?.title || '未命名文档'}</span>
              <span className="pane-label">编辑器</span>
            </div>
            <textarea
              className="editor"
              value={currentDoc?.content || ''}
              onChange={(e) => updateCurrentDoc(e.target.value)}
              placeholder="在这里输入 Markdown 内容..."
            />
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
    </div>
  )
}

export default App

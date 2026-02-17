import { useState } from 'react'

const MultiLinePlaceholder = ({ text }) => {
  return (
    <div className="multi-line-placeholder">
      {text.split('\n').map((line, index) => (
        <div key={index} className="placeholder-line">{line}</div>
      ))}
    </div>
  )
}

const Sidebar = ({ 
  documents, 
  currentDocId, 
  onSelectDoc, 
  onCreateDoc, 
  onDeleteDoc, 
  formatDate 
}) => {
  const [newDocTitle, setNewDocTitle] = useState('')
  const [showNewDocInput, setShowNewDocInput] = useState(false)

  const handleCreate = () => {
    if (!newDocTitle.trim()) return
    onCreateDoc(newDocTitle)
    setNewDocTitle('')
    setShowNewDocInput(false)
  }

  const handleDelete = (e, docId) => {
    e.stopPropagation()
    const result = onDeleteDoc(docId)
    if (!result.success) {
      alert(result.error)
    } else {
      if (confirm('确定要删除这个文档吗？')) {
        onDeleteDoc(docId)
      }
    }
  }

  return (
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
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setShowNewDocInput(false)
                  setNewDocTitle('')
                }
              }}
              autoFocus
            />
            <button className="confirm-btn" onClick={handleCreate}>✓</button>
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
            onClick={() => onSelectDoc(doc.id)}
          >
            <div className="doc-info">
              <div className="doc-title">{doc.title}</div>
              <div className="doc-date">
                {doc.updatedAt ? formatDate(doc.updatedAt) : '刚刚'}
              </div>
            </div>
            <button 
              className="delete-btn"
              onClick={(e) => handleDelete(e, doc.id)}
              title="删除文档"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Sidebar

import { useState, useEffect, useCallback, useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import './App.css'
import Sidebar from './components/Sidebar'
import AiPanel from './components/AiPanel'
import SettingsModal from './components/SettingsModal'
import DiffModal from './components/DiffModal'
import EditorPane from './components/EditorPane'
import ExportMenu from './components/ExportMenu'
import { useDocuments } from './hooks/useDocuments'
import { useLLMConfig } from './hooks/useLLMConfig'
import { useOptimizedHistory } from './hooks/usePerformance'
import { showSuccess, showWarning, showUndoRedoToast, showExportToast } from './utils/toast'

function App() {
  const {
    documents,
    currentDocId,
    currentDoc,
    isLoading,
    setCurrentDocId,
    updateCurrentDoc,
    createDocument,
    deleteDocument,
    formatDate
  } = useDocuments()

  const {
    config: llmConfig,
    updateConfig,
    changeProvider,
    availableModels,
    isLoadingModels,
    fetchModels
  } = useLLMConfig()

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [editorWidth, setEditorWidth] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  
  const [showDiffView, setShowDiffView] = useState(false)
  const [diffData, setDiffData] = useState({
    originalContent: '',
    modifiedContent: '',
    originalSelectedText: '',
    modifiedResultText: ''
  })

  const {
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory
  } = useOptimizedHistory(currentDoc?.content || '', updateCurrentDoc, { historyDelay: 1000 })

  const prevDocIdRef = useRef(currentDocId)

  useEffect(() => {
    if (currentDocId !== prevDocIdRef.current) {
      resetHistory(currentDoc?.content || '')
      prevDocIdRef.current = currentDocId
    }
  }, [currentDocId, currentDoc?.content, resetHistory])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey
      
      if (ctrlKey && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          const redoneContent = redo()
          if (redoneContent !== null) {
            updateCurrentDoc(redoneContent)
            showUndoRedoToast('redo')
          }
        } else {
          const undoneContent = undo()
          if (undoneContent !== null) {
            updateCurrentDoc(undoneContent)
            showUndoRedoToast('undo')
          }
        }
      }
      
      if (ctrlKey && e.key === 'y') {
        e.preventDefault()
        const redoneContent = redo()
        if (redoneContent !== null) {
          updateCurrentDoc(redoneContent)
          showUndoRedoToast('redo')
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, updateCurrentDoc])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrag = useCallback((e) => {
    if (!isDragging) return
    const rect = document.querySelector('.panes-container')?.getBoundingClientRect()
    if (!rect) return
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100
    const clampedWidth = Math.max(20, Math.min(80, newWidth))
    setEditorWidth(clampedWidth)
  }, [isDragging])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag)
      document.addEventListener('mouseup', handleDragEnd)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    } else {
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', handleDragEnd)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    return () => {
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging, handleDrag, handleDragEnd])

  const handleShowDiff = useCallback((data) => {
    setDiffData(data)
    setShowDiffView(true)
  }, [])

  const handleConfirmDiff = useCallback(() => {
    updateCurrentDoc(diffData.modifiedContent)
    setShowDiffView(false)
    showSuccess('修改已应用')
  }, [diffData.modifiedContent, updateCurrentDoc])

  const handleCancelDiff = useCallback(() => {
    setShowDiffView(false)
    showWarning('已放弃修改')
  }, [])

  const handleInsertAiContent = useCallback((newContent) => {
    updateCurrentDoc(newContent)
    setShowAiPanel(false)
    showSuccess('AI 内容已插入')
  }, [updateCurrentDoc])

  const handleFetchModels = async () => {
    await fetchModels()
  }

  const handleExportComplete = (format, filename) => {
    showExportToast(format, filename)
  }

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '8px',
            fontWeight: '500'
          }
        }}
      />
      
      <div className="header">
        <button 
          className="toggle-sidebar-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          ☰
        </button>
        <h1>📝 AI Word - 智能文档创作助手</h1>
        <div className="header-actions">
          <div className="undo-redo-buttons">
            <button 
              className="header-btn"
              onClick={() => {
                const undoneContent = undo()
                if (undoneContent !== null) {
                  updateCurrentDoc(undoneContent)
                  showUndoRedoToast('undo')
                }
              }}
              disabled={!canUndo}
              title="撤销 (Ctrl+Z)"
            >
              ↩️
            </button>
            <button 
              className="header-btn"
              onClick={() => {
                const redoneContent = redo()
                if (redoneContent !== null) {
                  updateCurrentDoc(redoneContent)
                  showUndoRedoToast('redo')
                }
              }}
              disabled={!canRedo}
              title="重做 (Ctrl+Y)"
            >
              ↪️
            </button>
          </div>
          <ExportMenu 
            currentDoc={currentDoc}
            onExportComplete={handleExportComplete}
          />
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
          <Sidebar 
            documents={documents}
            currentDocId={currentDocId}
            onSelectDoc={setCurrentDocId}
            onCreateDoc={createDocument}
            onDeleteDoc={deleteDocument}
            formatDate={formatDate}
          />
        )}
        
        <div className="editor-container">
          {showAiPanel && (
            <AiPanel 
              llmConfig={llmConfig}
              currentDoc={currentDoc}
              onInsert={handleInsertAiContent}
            />
          )}
          
          <EditorPane 
            currentDoc={currentDoc}
            editorWidth={editorWidth}
            llmConfig={llmConfig}
            onUpdateContent={updateCurrentDoc}
            onShowDiff={handleShowDiff}
          />
        </div>
      </div>

      <DiffModal 
        show={showDiffView}
        originalContent={diffData.originalContent}
        modifiedContent={diffData.modifiedContent}
        originalSelectedText={diffData.originalSelectedText}
        modifiedResultText={diffData.modifiedResultText}
        onConfirm={handleConfirmDiff}
        onCancel={handleCancelDiff}
      />

      <SettingsModal 
        show={showSettings}
        onClose={() => setShowSettings(false)}
        config={llmConfig}
        onUpdateConfig={updateConfig}
        onChangeProvider={changeProvider}
        availableModels={availableModels}
        isLoadingModels={isLoadingModels}
        onFetchModels={handleFetchModels}
      />
    </div>
  )
}

export default App

import { useState, useEffect, useCallback, useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import './App.css'
import Sidebar from './components/Sidebar'
import AiPanel from './components/AiPanel'
import AIWorkflowPanel from './components/AIWorkflowPanel'
import SettingsModal from './components/SettingsModal'
import DiffModal from './components/DiffModal'
import EditorPane from './components/EditorPane'
import ExportMenu from './components/ExportMenu'
import { useDocuments } from './hooks/useDocuments'
import { useLLMConfig } from './hooks/useLLMConfig'
import { getAllDocuments } from './utils/db'
import { showSuccess, showWarning, showExportToast } from './utils/toast'

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
    formatDate,
    setDocuments
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
  const [showAIWorkflow, setShowAIWorkflow] = useState(false)
  const [editorWidth, setEditorWidth] = useState(50)
  const [aiWorkflowWidth, setAiWorkflowWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingWorkflow, setIsDraggingWorkflow] = useState(false)
  
  const [showDiffView, setShowDiffView] = useState(false)
  const [diffData, setDiffData] = useState({
    originalContent: '',
    modifiedContent: '',
    originalSelectedText: '',
    modifiedResultText: ''
  })

  const refreshDocuments = useCallback(async () => {
    const docs = await getAllDocuments()
    setDocuments(docs)
  }, [setDocuments])

  const editorRef = useRef(null)

  const getCurrentEditorContent = useCallback(() => {
    if (editorRef.current) {
      return editorRef.current.getContent()
    }
    return currentDoc?.content || ''
  }, [currentDoc?.content])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    setIsDraggingWorkflow(false)
  }, [])

  const handleDrag = useCallback((e) => {
    if (!isDragging) return
    const rect = document.querySelector('.panes-container')?.getBoundingClientRect()
    if (!rect) return
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100
    const clampedWidth = Math.max(20, Math.min(80, newWidth))
    setEditorWidth(clampedWidth)
  }, [isDragging])

  const handleWorkflowDrag = useCallback((e) => {
    if (!isDraggingWorkflow) return
    const container = document.querySelector('.editor-container')
    if (!container) return
    const rect = container.getBoundingClientRect()
    const newWidth = rect.right - e.clientX
    const clampedWidth = Math.max(280, Math.min(600, newWidth))
    setAiWorkflowWidth(clampedWidth)
  }, [isDraggingWorkflow])

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

  useEffect(() => {
    if (isDraggingWorkflow) {
      document.addEventListener('mousemove', handleWorkflowDrag)
      document.addEventListener('mouseup', handleDragEnd)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    } else {
      document.removeEventListener('mousemove', handleWorkflowDrag)
      document.removeEventListener('mouseup', handleDragEnd)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    return () => {
      document.removeEventListener('mousemove', handleWorkflowDrag)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDraggingWorkflow, handleWorkflowDrag, handleDragEnd])

  const handleShowDiff = useCallback((data) => {
    setDiffData(data)
    setShowDiffView(true)
  }, [])

  const handleConfirmDiff = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.setContent(diffData.modifiedContent)
    }
    updateCurrentDoc(diffData.modifiedContent)
    setShowDiffView(false)
    showSuccess('修改已应用')
  }, [diffData.modifiedContent, updateCurrentDoc])

  const handleCancelDiff = useCallback(() => {
    setShowDiffView(false)
    showWarning('已放弃修改')
  }, [])

  const handleInsertAiContent = useCallback((newContent) => {
    if (editorRef.current) {
      editorRef.current.setContent(newContent)
    }
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
          <ExportMenu 
            currentDoc={currentDoc}
            onExportComplete={handleExportComplete}
          />
          <button 
            className="header-btn"
            onClick={() => setShowAIWorkflow(!showAIWorkflow)}
            title="AI 工作流"
            style={{ 
              backgroundColor: showAIWorkflow ? '#dbeafe' : 'transparent',
              color: showAIWorkflow ? '#1e40af' : 'inherit'
            }}
          >
            ⚡
          </button>
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
              getCurrentContent={getCurrentEditorContent}
              onInsert={handleInsertAiContent}
            />
          )}
          
          <EditorPane 
            ref={editorRef}
            currentDoc={currentDoc}
            editorWidth={editorWidth}
            llmConfig={llmConfig}
            onUpdateContent={updateCurrentDoc}
            onShowDiff={handleShowDiff}
          />
          
          {showAIWorkflow && (
            <>
              <div 
                className="workflow-resize-handle"
                onMouseDown={() => setIsDraggingWorkflow(true)}
              />
              <AIWorkflowPanel 
                docId={currentDocId}
                currentDocContent={currentDoc?.content}
                width={aiWorkflowWidth}
                onUpdateDocuments={refreshDocuments}
                onOperation={async () => {
                  await refreshDocuments()
                }}
              />
            </>
          )}
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

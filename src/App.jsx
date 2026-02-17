import { useState, useEffect, useCallback } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import AiPanel from './components/AiPanel'
import SettingsModal from './components/SettingsModal'
import DiffModal from './components/DiffModal'
import EditorPane from './components/EditorPane'
import ExportMenu from './components/ExportMenu'
import { useDocuments } from './hooks/useDocuments'
import { useLLMConfig } from './hooks/useLLMConfig'

function App() {
  const {
    documents,
    currentDocId,
    currentDoc,
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
    if (confirm('确定要应用这些修改吗？')) {
      updateCurrentDoc(diffData.modifiedContent)
      setShowDiffView(false)
    }
  }, [diffData.modifiedContent, updateCurrentDoc])

  const handleCancelDiff = useCallback(() => {
    if (confirm('确定要放弃这些修改吗？')) {
      setShowDiffView(false)
    }
  }, [])

  const handleInsertAiContent = useCallback((newContent) => {
    updateCurrentDoc(newContent)
    setShowAiPanel(false)
  }, [updateCurrentDoc])

  const handleFetchModels = async () => {
    const result = await fetchModels()
    if (!result.success) {
      alert(result.error)
    }
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
        <h1>📝 AI Word - 智能文档创作助手</h1>
        <div className="header-actions">
          <ExportMenu 
            currentDoc={currentDoc}
            onExportComplete={(format, filename) => {
              console.log(`Exported as ${format}: ${filename}`)
            }}
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

import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LocalEditPanel from './LocalEditPanel'
import { callLLM, buildPrompt } from '../utils/api'

const EditorPane = ({ 
  currentDoc, 
  editorWidth,
  llmConfig,
  onUpdateContent,
  onShowDiff
}) => {
  const [showBeautifyBtn, setShowBeautifyBtn] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 })
  const [isBeautifying, setIsBeautifying] = useState(false)
  const [showLocalEditPanel, setShowLocalEditPanel] = useState(false)

  const handleTextSelection = (e) => {
    const textarea = e.target
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    if (start !== end) {
      const selected = textarea.value.substring(start, end)
      if (selected.trim().length > 0) {
        setSelectedText(selected)
        setSelectionRange({ start, end })
        setShowBeautifyBtn(true)
        setShowLocalEditPanel(false)
      }
    } else {
      setShowBeautifyBtn(false)
      setShowLocalEditPanel(false)
    }
  }

  const handleMouseUp = () => {
    setTimeout(() => {
      const textarea = document.querySelector('.editor')
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        if (start === end) {
          setShowBeautifyBtn(false)
          setShowLocalEditPanel(false)
        }
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
      const prompt = buildPrompt('beautify', selectedText)
      const result = await callLLM(llmConfig, prompt)
      
      if (result.success) {
        const content = currentDoc?.content || ''
        const before = content.substring(0, selectionRange.start)
        const after = content.substring(selectionRange.end)
        const newContent = before + result.result + after

        onShowDiff({
          originalContent: content,
          modifiedContent: newContent,
          originalSelectedText: selectedText,
          modifiedResultText: result.result
        })
      } else {
        alert('美化失败，请检查配置')
      }
    } catch (error) {
      console.error('美化失败:', error)
      alert('美化失败，请检查配置')
    } finally {
      setIsBeautifying(false)
    }
  }

  const handleCustomGenerate = useCallback(async (result) => {
    const content = currentDoc?.content || ''
    const before = content.substring(0, selectionRange.start)
    const after = content.substring(selectionRange.end)
    const newContent = before + result + after

    onShowDiff({
      originalContent: content,
      modifiedContent: newContent,
      originalSelectedText: selectedText,
      modifiedResultText: result
    })
    setShowLocalEditPanel(false)
    setShowBeautifyBtn(false)
  }, [currentDoc, selectionRange, selectedText, onShowDiff])

  return (
    <div className="panes-container">
      <div className="editor-pane" style={{ flex: `${editorWidth}%` }}>
        <div className="pane-header">
          <span className="doc-name">{currentDoc?.title || '未命名文档'}</span>
          <div className="pane-actions">
            {isBeautifying && (
              <span className="status-indicator">
                <span className="spinner"></span>
                美化中...
              </span>
            )}
            {showBeautifyBtn && !showLocalEditPanel && (
              <>
                <button
                  className="beautify-btn-small"
                  onClick={beautifyText}
                  disabled={isBeautifying}
                >
                  {isBeautifying ? (
                    <>
                      <span className="btn-spinner"></span>
                      美化中...
                    </>
                  ) : (
                    '✨ 一键美化'
                  )}
                </button>
                <button
                  className="custom-edit-btn"
                  onClick={() => setShowLocalEditPanel(true)}
                  disabled={isBeautifying}
                >
                  🎨 局部编辑
                </button>
              </>
            )}
            {!showBeautifyBtn && <span className="pane-label">编辑器</span>}
          </div>
        </div>
        {showLocalEditPanel && (
          <LocalEditPanel 
            selectedText={selectedText}
            llmConfig={llmConfig}
            onGenerate={handleCustomGenerate}
            onClose={() => setShowLocalEditPanel(false)}
          />
        )}
        <textarea
          className="editor"
          value={currentDoc?.content || ''}
          onChange={(e) => onUpdateContent(e.target.value)}
          onSelect={handleTextSelection}
          onMouseUp={handleMouseUp}
          placeholder="在这里输入 Markdown 内容，选择文本后可使用美化或局部编辑功能..."
        />
      </div>
      <div 
        className="resizer"
        onMouseDown={() => {}}
      >
        <div className="resizer-handle"></div>
      </div>
      <div className="preview-pane" style={{ flex: `${100 - editorWidth}%` }}>
        <div className="pane-header">预览</div>
        <div className="preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {currentDoc?.content || ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

export default EditorPane

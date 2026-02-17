import { useState, useCallback, useEffect, useMemo, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LocalEditPanel from './LocalEditPanel'
import { callLLM, buildPrompt } from '../utils/api'
import { showWarning, showError } from '../utils/toast'
import { useDebounce } from '../hooks/usePerformance'

const MemoizedPreview = memo(({ content }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {content}
  </ReactMarkdown>
))

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
  
  const [localContent, setLocalContent] = useState(currentDoc?.content || '')
  const debouncedContent = useDebounce(localContent, 300)

  useEffect(() => {
    if (currentDoc?.id) {
      setLocalContent(currentDoc.content || '')
    }
  }, [currentDoc?.id, currentDoc?.content])

  useEffect(() => {
    if (debouncedContent !== '' && debouncedContent !== currentDoc?.content) {
      onUpdateContent(debouncedContent)
    }
  }, [debouncedContent, currentDoc?.content, onUpdateContent])

  const handleContentChange = useCallback((e) => {
    setLocalContent(e.target.value)
  }, [])

  const handleTextSelection = useCallback((e) => {
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
  }, [])

  const handleMouseUp = useCallback(() => {
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
  }, [])

  const beautifyText = useCallback(async () => {
    if (!selectedText) return
    if (!llmConfig.apiKey) {
      showWarning('请先在设置中配置 API Key')
      return
    }

    setIsBeautifying(true)
    setShowBeautifyBtn(false)

    try {
      const prompt = buildPrompt('beautify', selectedText)
      const result = await callLLM(llmConfig, prompt)
      
      if (result.success) {
        const content = localContent || ''
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
        showError('美化失败，请检查配置')
      }
    } catch (error) {
      console.error('美化失败:', error)
      showError('美化失败，请检查配置')
    } finally {
      setIsBeautifying(false)
    }
  }, [selectedText, llmConfig, localContent, selectionRange, onShowDiff])

  const handleCustomGenerate = useCallback(async (result) => {
    const content = localContent || ''
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
  }, [localContent, selectionRange, selectedText, onShowDiff])

  const previewContent = useMemo(() => localContent, [localContent])

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
          value={localContent}
          onChange={handleContentChange}
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
          <MemoizedPreview content={previewContent} />
        </div>
      </div>
    </div>
  )
}

export default memo(EditorPane)

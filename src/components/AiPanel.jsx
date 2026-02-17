import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { callLLMStream } from '../utils/api'

const MultiLinePlaceholder = ({ text }) => {
  return (
    <div className="multi-line-placeholder">
      {text.split('\n').map((line, index) => (
        <div key={index} className="placeholder-line">{line}</div>
      ))}
    </div>
  )
}

const AiPanel = ({ llmConfig, currentDoc, onInsert }) => {
  const [aiPrompt, setAiPrompt] = useState('')
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [displayedResponse, setDisplayedResponse] = useState('')
  const renderIntervalRef = useRef(null)

  useEffect(() => {
    const intervalRef = renderIntervalRef.current
    return () => {
      if (intervalRef) {
        clearInterval(intervalRef)
      }
    }
  }, [])

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
    setDisplayedResponse('')

    try {
      const fullText = await callLLMStream(
        llmConfig,
        aiPrompt,
        (chunk) => setDisplayedResponse(prev => prev + chunk),
        (text) => {
          setDisplayedResponse('')
          setAiResponse(text || '无响应')
        },
        (error) => {
          setDisplayedResponse('')
          setAiResponse(`调用失败: ${error}`)
        }
      )

      setDisplayedResponse('')
      setAiResponse(fullText || '无响应')
    } catch (error) {
      console.error('AI 调用失败:', error)
      setDisplayedResponse('')
      setAiResponse(`调用失败: ${error.message}`)
    } finally {
      setIsAiGenerating(false)
      if (renderIntervalRef.current) {
        clearInterval(renderIntervalRef.current)
      }
    }
  }

  const handleInsert = () => {
    if (!aiResponse) return
    const newContent = currentDoc?.content ? `${currentDoc.content}\n\n${aiResponse}` : aiResponse
    onInsert(newContent)
    setAiPrompt('')
    setAiResponse('')
    setDisplayedResponse('')
  }

  const handleClose = () => {
    setAiPrompt('')
    setAiResponse('')
    setDisplayedResponse('')
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <h3>🤖 AI 助手</h3>
        <button 
          className="close-btn"
          onClick={handleClose}
        >
          ✕
        </button>
      </div>
      <div className="ai-panel-content">
        <div className="textarea-with-placeholder">
          {!aiPrompt && (
            <MultiLinePlaceholder text={`输入你的需求，例如：
• 帮我写一段关于...的介绍
• 继续这段内容
• 帮我优化这篇文章`} />
          )}
          <textarea
            className="ai-prompt"
            style={{ background: aiPrompt ? 'white' : 'transparent' }}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && callAI()}
          />
        </div>
        <button 
          className="ai-generate-btn"
          onClick={callAI}
          disabled={isAiGenerating}
        >
          {isAiGenerating ? '生成中...' : '🚀 生成'}
        </button>
        {((isAiGenerating && displayedResponse) || aiResponse) && (
          <div className="ai-response-container">
            <div className="ai-response-header">
              <span>AI 回复</span>
              {aiResponse && (
                <button className="insert-btn" onClick={handleInsert}>
                  ✅ 插入文档
                </button>
              )}
            </div>
            <div className="ai-response">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {isAiGenerating ? displayedResponse : aiResponse}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AiPanel

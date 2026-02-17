import { useState } from 'react'
import { callLLM, buildPrompt } from '../utils/api'

const MultiLinePlaceholder = ({ text }) => {
  return (
    <div className="multi-line-placeholder">
      {text.split('\n').map((line, index) => (
        <div key={index} className="placeholder-line">{line}</div>
      ))}
    </div>
  )
}

const LocalEditPanel = ({ 
  selectedText, 
  llmConfig, 
  onGenerate, 
  onClose 
}) => {
  const [customPrompt, setCustomPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!selectedText) return
    if (!llmConfig.apiKey) {
      alert('请先在设置中配置 API Key')
      return
    }
    if (!customPrompt.trim()) {
      alert('请输入提示词')
      return
    }

    setIsGenerating(true)

    try {
      const prompt = buildPrompt('custom', selectedText, customPrompt)
      const result = await callLLM(llmConfig, prompt)
      
      if (result.success) {
        onGenerate(result.result)
        setCustomPrompt('')
      } else {
        alert('生成失败，请检查配置')
      }
    } catch (error) {
      console.error('生成失败:', error)
      alert('生成失败，请检查配置')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="local-edit-panel">
      <div className="local-edit-header">
        <span className="local-edit-title">🎨 局部编辑 - 选中文本:</span>
        <button 
          className="close-panel-btn"
          onClick={() => {
            onClose()
            setCustomPrompt('')
          }}
        >
          ✕
        </button>
      </div>
      <div className="selected-preview">
        {selectedText}
      </div>
      <div className="prompt-input-section">
        <label>请输入你的需求：</label>
        <div className="textarea-with-placeholder">
          {!customPrompt && (
            <MultiLinePlaceholder text={`例如：
• 翻译成英文
• 扩展成一段详细的描述
• 改成更正式的语气
• 总结成一句话
• 改成代码格式`} />
          )}
          <textarea
            className="custom-prompt-input"
            style={{ background: customPrompt ? 'white' : 'transparent' }}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && handleGenerate()}
          />
        </div>
      </div>
      {isGenerating && (
        <div className="generating-status">
          <span className="spinner"></span>
          <span>正在生成内容，请稍候...</span>
        </div>
      )}
      <div className="local-edit-actions">
        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="btn-spinner"></span>
              生成中...
            </>
          ) : (
            '🚀 生成'
          )}
        </button>
        <button
          className="cancel-edit-btn"
          onClick={() => {
            onClose()
            setCustomPrompt('')
          }}
          disabled={isGenerating}
        >
          取消
        </button>
      </div>
    </div>
  )
}

export default LocalEditPanel

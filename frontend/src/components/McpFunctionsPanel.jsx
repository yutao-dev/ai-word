import { useState } from 'react'
import { MCP_FUNCTIONS, generateFunctionDocumentation } from '../utils/mcpFunctions'

const McpFunctionsPanel = ({ show, onClose }) => {
  const [viewMode, setViewMode] = useState('list')
  const [copied, setCopied] = useState(false)

  if (!show) return null

  const systemPrompt = generateFunctionDocumentation()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(systemPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const functions = Object.values(MCP_FUNCTIONS)

  return (
    <div className="mcp-panel-overlay" onClick={onClose}>
      <div className="mcp-panel" onClick={e => e.stopPropagation()}>
        <div className="mcp-panel-header">
          <h3>🔧 MCP 函数列表</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="mcp-panel-toggle">
          <button 
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
          >
            📋 函数列表
          </button>
          <button 
            className={viewMode === 'prompt' ? 'active' : ''}
            onClick={() => setViewMode('prompt')}
          >
            📝 系统提示词
          </button>
        </div>

        <div className="mcp-panel-content">
          {viewMode === 'list' ? (
            <div className="mcp-functions-list">
              {functions.map((func, index) => (
                <div key={index} className="mcp-function-card">
                  <div className="mcp-function-name">{func.name}</div>
                  <div className="mcp-function-desc">{func.description}</div>
                  {func.parameters.length > 0 && (
                    <div className="mcp-function-params">
                      <div className="mcp-params-title">参数：</div>
                      <div className="mcp-params-list">
                        {func.parameters.map((param, pIndex) => (
                          <div key={pIndex} className="mcp-param-item">
                            <span className="mcp-param-name">{param.name}</span>
                            <span className="mcp-param-type">({param.type})</span>
                            {param.optional && <span className="mcp-param-optional">可选</span>}
                            <span className="mcp-param-desc">{param.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mcp-prompt-view">
              <div className="mcp-prompt-actions">
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? '✅ 已复制' : '📋 复制提示词'}
                </button>
              </div>
              <pre className="mcp-prompt-content">{systemPrompt}</pre>
            </div>
          )}
        </div>

        <div className="mcp-panel-footer">
          <span>共 {functions.length} 个可用函数</span>
        </div>
      </div>
    </div>
  )
}

export default McpFunctionsPanel

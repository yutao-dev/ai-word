import { LLM_PROVIDERS } from '../constants'

const SettingsModal = ({ 
  show, 
  onClose, 
  config, 
  onUpdateConfig, 
  onChangeProvider,
  availableModels, 
  isLoadingModels, 
  onFetchModels 
}) => {
  if (!show) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ AI 设置</h2>
          <button 
            className="close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal-content">
          <div className="setting-group">
            <label>AI 服务商</label>
            <select
              value={config.provider}
              onChange={(e) => onChangeProvider(e.target.value)}
            >
              {LLM_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="setting-group">
            <label>API Key</label>
            <input
              type="password"
              placeholder="输入你的 API Key"
              value={config.apiKey}
              onChange={(e) => onUpdateConfig({ apiKey: e.target.value })}
            />
          </div>

          <div className="setting-group">
            <label>Base URL</label>
            <input
              type="text"
              placeholder="API 基础地址"
              value={config.baseUrl}
              onChange={(e) => onUpdateConfig({ baseUrl: e.target.value })}
            />
          </div>

          <div className="setting-group">
            <div className="setting-row">
              <label>模型</label>
              <button 
                className="fetch-models-btn"
                onClick={onFetchModels}
                disabled={isLoadingModels}
              >
                {isLoadingModels ? '加载中...' : '🔄 拉取模型'}
              </button>
            </div>
            {availableModels.length > 0 ? (
              <select
                value={config.model}
                onChange={(e) => onUpdateConfig({ model: e.target.value })}
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="模型名称"
                value={config.model}
                onChange={(e) => onUpdateConfig({ model: e.target.value })}
              />
            )}
          </div>

          <hr className="divider" />
          <h3 className="params-title">模型参数</h3>

          <div className="setting-group">
            <div className="setting-row">
              <label>Temperature: {config.temperature}</label>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.temperature}
              onChange={(e) => onUpdateConfig({ temperature: parseFloat(e.target.value) })}
            />
          </div>

          <div className="setting-group">
            <label>Max Tokens</label>
            <input
              type="number"
              min="1"
              max="128000"
              value={config.maxTokens}
              onChange={(e) => onUpdateConfig({ maxTokens: parseInt(e.target.value) })}
            />
          </div>

          <div className="setting-group">
            <div className="setting-row">
              <label>Top P: {config.topP}</label>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.topP}
              onChange={(e) => onUpdateConfig({ topP: parseFloat(e.target.value) })}
            />
          </div>

          <div className="setting-group">
            <div className="setting-row">
              <label>Frequency Penalty: {config.frequencyPenalty}</label>
            </div>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={config.frequencyPenalty}
              onChange={(e) => onUpdateConfig({ frequencyPenalty: parseFloat(e.target.value) })}
            />
          </div>

          <div className="setting-group">
            <div className="setting-row">
              <label>Presence Penalty: {config.presencePenalty}</label>
            </div>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={config.presencePenalty}
              onChange={(e) => onUpdateConfig({ presencePenalty: parseFloat(e.target.value) })}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button 
            className="save-btn"
            onClick={onClose}
          >
            ✓ 保存并关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal

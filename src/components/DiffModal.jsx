import DiffHighlighter from './DiffHighlighter'

const DiffModal = ({ 
  show, 
  originalContent, 
  modifiedContent,
  originalSelectedText,
  modifiedResultText,
  onConfirm, 
  onCancel 
}) => {
  if (!show) return null

  return (
    <div className="diff-modal-overlay">
      <div className="diff-modal">
        <div className="diff-modal-header">
          <h2>📋 文档对比</h2>
          <button 
            className="close-btn"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>
        <div className="diff-legend">
          <div className="legend-item">
            <span className="legend-color removed-color"></span>
            <span>删除的内容</span>
          </div>
          <div className="legend-item">
            <span className="legend-color added-color"></span>
            <span>新增的内容</span>
          </div>
        </div>
        <div className="diff-container">
          <div className="diff-pane">
            <div className="diff-pane-header">📄 原始文档</div>
            <div className="diff-scroll">
              <DiffHighlighter 
                original={originalContent} 
                modified={modifiedContent} 
                originalSelection={originalSelectedText}
                modifiedResult={modifiedResultText}
                type="original"
              />
            </div>
          </div>
          <div className="diff-divider"></div>
          <div className="diff-pane">
            <div className="diff-pane-header">✨ 修改后文档</div>
            <div className="diff-scroll">
              <DiffHighlighter 
                original={originalContent} 
                modified={modifiedContent} 
                originalSelection={originalSelectedText}
                modifiedResult={modifiedResultText}
                type="modified"
              />
            </div>
          </div>
        </div>
        <div className="diff-modal-footer">
          <button 
            className="cancel-replace-btn"
            onClick={onCancel}
          >
            ❌ 放弃修改
          </button>
          <button 
            className="confirm-replace-btn"
            onClick={onConfirm}
          >
            ✅ 确认替代
          </button>
        </div>
      </div>
    </div>
  )
}

export default DiffModal

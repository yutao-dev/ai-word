import { useState, useEffect, useRef } from 'react'
import ReactDiffViewer from 'react-diff-viewer-continued'
import { useAIWorkflow, WORKFLOW_STATES } from '../hooks/useAIWorkflow'
import { showSuccess, showError, showWarning } from '../utils/toast'

const AIWorkflowPanel = ({ docId, currentDocContent, width = 400, onUpdateDocuments, onOperation }) => {
  const [userRequest, setUserRequest] = useState('')
  const [expanded, setExpanded] = useState({ decisions: true, operations: false })
  const [unlimitedContext, setUnlimitedContext] = useState(false)
  const [optimizePromptStructure, setOptimizePromptStructure] = useState(false)
  
  const {
    state,
    logs,
    operationHistory,
    decisions,
    summary,
    aiSummary,
    taskPlan,
    isRunning,
    pendingPreview,
    currentThinking,
    currentAction,
    startTask,
    confirmChanges,
    rejectChanges,
    clear
  } = useAIWorkflow({ onOperation, onUpdateDocuments })

  const logsEndRef = useRef(null)
  const operationsEndRef = useRef(null)

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    if (operationsEndRef.current) {
      operationsEndRef.current.scrollTop = operationsEndRef.current.scrollHeight
    }
  }, [operationHistory])

  const handleStart = () => {
    if (!userRequest.trim()) {
      showWarning('请输入您的需求')
      return
    }
    if (!docId) {
      showWarning('请先选择一个文档')
      return
    }

    try {
      startTask(userRequest, docId, currentDocContent, {
        context_mode: unlimitedContext ? 'unlimited' : 'limited',
        optimizePromptStructure: optimizePromptStructure
      })
    } catch (error) {
      showError('任务执行失败: ' + error.message)
    }
  }

  const handleConfirm = async () => {
    console.log('[AIWorkflowPanel] handleConfirm called')
    await confirmChanges()
    console.log('[AIWorkflowPanel] confirmChanges completed')
    showSuccess('修改已应用！')
    if (onUpdateDocuments) {
      console.log('[AIWorkflowPanel] calling onUpdateDocuments')
      await onUpdateDocuments()
      console.log('[AIWorkflowPanel] onUpdateDocuments completed')
    }
  }

  const handleReject = async () => {
    await rejectChanges()
    showSuccess('修改已撤销')
    if (onUpdateDocuments) {
      onUpdateDocuments()
    }
  }

  const getStateText = () => {
    const stateMap = {
      [WORKFLOW_STATES.IDLE]: '空闲',
      [WORKFLOW_STATES.INITIALIZING]: '初始化中...',
      [WORKFLOW_STATES.ANALYZING]: '分析中...',
      [WORKFLOW_STATES.EXECUTING]: '执行中...',
      [WORKFLOW_STATES.SUMMARIZING]: '生成总结中...',
      [WORKFLOW_STATES.COMPLETED]: '已完成',
      [WORKFLOW_STATES.ERROR]: '错误',
      [WORKFLOW_STATES.PENDING_CONFIRMATION]: '待确认'
    }
    return stateMap[state] || state
  }

  const getStateColor = () => {
    const colorMap = {
      [WORKFLOW_STATES.IDLE]: 'gray',
      [WORKFLOW_STATES.INITIALIZING]: 'blue',
      [WORKFLOW_STATES.ANALYZING]: 'yellow',
      [WORKFLOW_STATES.EXECUTING]: 'orange',
      [WORKFLOW_STATES.SUMMARIZING]: 'purple',
      [WORKFLOW_STATES.COMPLETED]: 'green',
      [WORKFLOW_STATES.ERROR]: 'red',
      [WORKFLOW_STATES.PENDING_CONFIRMATION]: '#f59e0b'
    }
    return colorMap[state] || 'gray'
  }

  return (
    <div className="ai-workflow-panel">
      <div className="ai-workflow-header">
        <h3>⚡ AI 工作流</h3>
        <div className="workflow-state" style={{ color: getStateColor() }}>
          {getStateText()}
        </div>
      </div>

      <div className="ai-workflow-content">
        {(currentThinking || currentAction) && (
          <div className="realtime-section">
            {currentThinking && (
              <div className="thinking-indicator">
                <span className="thinking-icon">🤔</span>
                <span className="thinking-text">{currentThinking}</span>
              </div>
            )}
            {currentAction && (
              <div className="action-indicator">
                <span className={`action-status ${currentAction.type === 'start' ? 'running' : 'complete'}`}>
                  {currentAction.type === 'start' ? '⚙️' : '✅'}
                </span>
                <span className="action-text">
                  {currentAction.description || currentAction.function}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="input-section">
          <textarea
            className="workflow-input"
            placeholder="描述您的需求，例如：
• 在文档末尾添加一段关于人工智能的介绍
• 删除文档的第3到第5行
• 把第2到第3行替换为新内容"
            value={userRequest}
            onChange={(e) => setUserRequest(e.target.value)}
            disabled={isRunning}
          />
          <div className="workflow-options">
            <label className="workflow-option">
              <input
                type="checkbox"
                checked={unlimitedContext}
                onChange={(e) => setUnlimitedContext(e.target.checked)}
                disabled={isRunning}
              />
              无上下文限制
            </label>
            <label className="workflow-option">
              <input
                type="checkbox"
                checked={optimizePromptStructure}
                onChange={(e) => setOptimizePromptStructure(e.target.checked)}
                disabled={isRunning}
              />
              优化提示词结构
            </label>
          </div>
          <div className="workflow-buttons">
            <button
              className="workflow-start-btn"
              onClick={handleStart}
              disabled={isRunning}
            >
              {isRunning ? '运行中...' : '🚀 开始'}
            </button>
            <button
              className="workflow-clear-btn"
              onClick={() => {
                clear()
                setUserRequest('')
                setUnlimitedContext(false)
                setOptimizePromptStructure(false)
              }}
              disabled={isRunning}
            >
              清空
            </button>
          </div>
        </div>

        {taskPlan && (
          <div className="task-plan-section">
            <div 
              className="section-header" 
              onClick={() => setExpanded(p => ({ ...p, taskPlan: !p.taskPlan }))}
            >
              <span>📋 AI 执行计划</span>
              <span>{expanded.taskPlan ? '▼' : '▶'}</span>
            </div>
            {expanded.taskPlan !== false && (
              <div className="task-plan-container">
                {Array.isArray(taskPlan) ? (
                  <div className="task-plan-tasks">
                    {taskPlan.map((task, i) => (
                      <div key={i} className="task-plan-item task-type-read">
                        <span className="task-status">⬜</span>
                        <span className="task-id">{i + 1}.</span>
                        <span className="task-desc">{task}</span>
                        <span className="task-badge badge-read">📋 计划</span>
                      </div>
                    ))}
                  </div>
                ) : taskPlan.tasks ? (
                  <>
                    <div className="task-plan-message">
                      <strong>任务概述:</strong> {taskPlan.taskMessage}
                    </div>
                    <div className="task-plan-tasks">
                      {taskPlan.tasks.map((task, i) => (
                        <div key={i} className={`task-plan-item task-type-${task.type} ${task.isComplete ? 'task-complete' : ''}`}>
                          <span className="task-status">
                            {task.isComplete ? '✅' : '⬜'}
                          </span>
                          <span className="task-id">{task.id}.</span>
                          <span className="task-desc">{task.description}</span>
                          <span className={`task-badge badge-${task.type}`}>
                            {task.type === 'read' ? '📖 读取' : 
                             task.type === 'write' ? '✏️ 写入' : 
                             task.type === 'edit' ? '🔧 编辑' : task.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="task-plan-message">
                    <strong>任务概述:</strong> {taskPlan}
                  </div>
                )}
                <div className="task-plan-note">
                  💡 注意：这只是 AI 的初步计划，实际执行时可能会根据情况动态调整
                </div>
              </div>
            )}
          </div>
        )}

        {logs.length > 0 && (
          <div className="logs-section">
            <div 
              className="section-header" 
              onClick={() => setExpanded(p => ({ ...p, logs: !p.logs }))}
            >
              <span>📋 日志</span>
              <span>{expanded.logs ? '▼' : '▶'}</span>
            </div>
            {expanded.logs && (
              <div className="logs-container" ref={logsEndRef}>
                {logs.map((log, i) => (
                  <div key={i} className={`log-entry log-${log.type}`}>
                    <span className="log-time">
                      {new Date().toLocaleTimeString()}
                    </span>
                    <span className="log-message">{log.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {decisions.length > 0 && (
          <div className="decisions-section">
            <div 
              className="section-header" 
              onClick={() => setExpanded(p => ({ ...p, decisions: !p.decisions }))}
            >
              <span>🧠 AI 决策过程</span>
              <span>{expanded.decisions ? '▼' : '▶'}</span>
            </div>
            {expanded.decisions && (
              <div className="decisions-container">
                {decisions.map((decision, i) => (
                  <div key={i} className="decision-entry decision-action">
                    <div className="decision-header">
                      <span className="decision-iteration">第 {decision.iteration} 轮</span>
                      <span className="decision-type type-action">
                        {decision.action ? '执行操作' : '思考'}
                      </span>
                    </div>
                    {decision.thinking && (
                      <div className="decision-message">{decision.thinking}</div>
                    )}
                    {decision.action && (
                      <div className="decision-operation">
                        <span className="op-label">操作:</span>
                        <span className="op-name">{decision.action.function}</span>
                        {decision.action.params && (
                          <span className="op-args">
                            ({Object.entries(decision.action.params).map(([key, value], idx) => (
                              <span key={idx} className="op-arg">
                                {key}: {typeof value === 'string' && value.length > 30 
                                  ? value.substring(0, 30) + '...' 
                                  : JSON.stringify(value)}
                                {idx < Object.entries(decision.action.params).length - 1 ? ', ' : ''}
                              </span>
                            ))})
                          </span>
                        )}
                      </div>
                    )}
                    {decision.summary && (
                      <div className="decision-message">
                        <strong>总结:</strong> {decision.summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {operationHistory.length > 0 && (
          <div className="operations-section">
            <div 
              className="section-header" 
              onClick={() => setExpanded(p => ({ ...p, operations: !p.operations }))}
            >
              <span>🔧 操作记录</span>
              <span>{expanded.operations ? '▼' : '▶'}</span>
            </div>
            {expanded.operations && (
              <div className="operations-container" ref={operationsEndRef}>
                {operationHistory.map((op, i) => (
                  <div key={i} className="operation-entry success">
                    <div className="op-status">
                      ✅
                    </div>
                    <div className="op-details">
                      {op.action?.function || '操作'} - {op.summary || '执行成功'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="summary-section">
            <div className="section-header">
              <span>📊 任务总结</span>
            </div>
            <div className="summary-container">
              {typeof summary === 'string' ? (
                <p>{summary}</p>
              ) : (
                <>
                  <p><strong>任务用时:</strong> {summary.duration}ms</p>
                  <p><strong>迭代次数:</strong> {summary.iterations}</p>
                  <p><strong>执行操作:</strong> {summary.operations?.length || 0} 个</p>
                  <p><strong>状态:</strong> {summary.success ? '✅ 成功' : '❌ 失败'}</p>
                </>
              )}
            </div>
          </div>
        )}

        {aiSummary && (
          <div className="ai-summary-section">
            <div className="section-header">
              <span>🤖 AI 总结</span>
            </div>
            <div className="ai-summary-container">
              {aiSummary}
            </div>
          </div>
        )}
      </div>

      {pendingPreview && (
        <div className="preview-modal-overlay">
          <div className="preview-modal">
            <div className="preview-modal-header">
              <h3>📝 修改预览</h3>
              <button className="preview-close-btn" onClick={handleReject}>✕</button>
            </div>
            <div className="preview-modal-content">
              <ReactDiffViewer
                oldValue={pendingPreview.originalContent || ''}
                newValue={pendingPreview.modifiedContent || ''}
                splitView={true}
                leftTitle="原始内容"
                rightTitle="修改后内容"
                styles={{
                  variables: {
                    light: {
                      diffViewerBackground: '#ffffff',
                      diffViewerColor: '#1f2937',
                      addedBackground: '#dcfce7',
                      addedColor: '#166534',
                      removedBackground: '#fee2e2',
                      removedColor: '#991b1b',
                      wordAddedBackground: '#bbf7d0',
                      wordRemovedBackground: '#fecaca',
                      addedGutterBackground: '#d1fae5',
                      removedGutterBackground: '#fecaca',
                      gutterBackground: '#f3f4f6',
                      gutterBackgroundDark: '#e5e7eb',
                      highlightBackground: '#fef3c7',
                      highlightGutterBackground: '#fef3c7',
                      codeFoldGutterBackground: '#f3f4f6',
                      codeFoldBackground: '#f9fafb',
                      emptyLineBackground: '#f9fafb',
                      gutterColor: '#6b7280',
                      addedGutterColor: '#166534',
                      removedGutterColor: '#991b1b',
                      codeFoldContentColor: '#6b7280',
                      diffViewerTitleBackground: '#f3f4f6',
                      diffViewerTitleColor: '#374151',
                      diffViewerTitleBorderColor: '#e5e7eb',
                    }
                  }
                }}
              />
            </div>
            <div className="preview-modal-actions">
              <button className="preview-reject-btn" onClick={handleReject}>
                ❌ 拒绝修改
              </button>
              <button className="preview-confirm-btn" onClick={handleConfirm}>
                ✅ 接受修改
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ai-workflow-panel {
          background: var(--bg-secondary, white);
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          padding: 16px;
          width: ${width}px;
          min-width: 280px;
          max-width: 600px;
          flex-shrink: 0;
          overflow-y: auto;
          max-height: calc(100vh - 120px);
          color: var(--text-primary, #333);
          transition: all 0.3s ease;
        }

        .task-plan-container {
          background: var(--bg-tertiary, linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%));
          border-radius: 6px;
          padding: 12px;
          border-left: 3px solid var(--accent-color, #0ea5e9);
        }

        .task-plan-message {
          font-size: 14px;
          color: var(--text-secondary, #0c4a6e);
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .task-plan-tasks {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }

        .task-plan-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background-color: var(--bg-primary, white);
          border-radius: 6px;
          font-size: 13px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: all 0.2s ease;
        }

        .task-plan-item.task-complete {
          background-color: var(--bg-tertiary, #f0fdf4);
          opacity: 0.8;
        }

        .task-status {
          font-size: 14px;
          min-width: 20px;
        }

        .task-id {
          font-weight: 600;
          color: var(--accent-color, #0369a1);
          min-width: 20px;
        }

        .task-plan-item.task-complete .task-id {
          color: var(--success-color, #15803d);
        }

        .task-desc {
          flex: 1;
          color: var(--text-primary, #374151);
        }

        .task-plan-item.task-complete .task-desc {
          color: var(--text-secondary, #6b7280);
          text-decoration: line-through;
        }

        .task-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
          white-space: nowrap;
        }

        .badge-read {
          background-color: var(--bg-tertiary, #dbeafe);
          color: var(--accent-color, #1d4ed8);
        }

        .badge-write {
          background-color: var(--bg-tertiary, #fef3c7);
          color: var(--warning-color, #b45309);
        }

        .badge-edit {
          background-color: var(--bg-tertiary, #dcfce7);
          color: var(--success-color, #15803d);
        }

        .task-plan-note {
          font-size: 12px;
          color: var(--text-secondary, #475569);
          background-color: rgba(255,255,255,0.7);
          padding: 8px 12px;
          border-radius: 4px;
          line-height: 1.4;
        }
        .ai-workflow-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .ai-workflow-header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary, #333);
        }
        .workflow-state {
          font-weight: bold;
        }
        .ai-workflow-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .input-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .workflow-input {
          width: 100%;
          min-height: 100px;
          padding: 12px;
          border: 1px solid var(--border-color, #ddd);
          border-radius: 8px;
          resize: vertical;
          font-family: inherit;
          font-size: 14px;
          background-color: var(--bg-primary, white);
          color: var(--text-primary, #333);
        }
        .workflow-input:disabled {
          background-color: var(--bg-tertiary, #f5f5f5);
        }
        .workflow-options {
          margin: 8px 0;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .workflow-option {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: var(--text-secondary, #6b7280);
          cursor: pointer;
        }
        .workflow-option input[type="checkbox"] {
          cursor: pointer;
        }
        .workflow-option input[type="checkbox"]:disabled {
          cursor: not-allowed;
        }
        .workflow-buttons {
          display: flex;
          gap: 8px;
        }
        .workflow-start-btn {
          flex: 1;
          padding: 10px 16px;
          background-color: var(--success-color, #10b981);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.2s;
        }
        .workflow-start-btn:hover:not(:disabled) {
          background-color: #059669;
          transform: translateY(-1px);
        }
        .workflow-start-btn:disabled {
          background-color: var(--border-color, #94a3b8);
          cursor: not-allowed;
        }
        .workflow-clear-btn {
          padding: 10px 16px;
          background-color: var(--bg-tertiary, #e5e7eb);
          color: var(--text-primary, #374151);
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.2s;
        }
        .workflow-clear-btn:hover:not(:disabled) {
          background-color: var(--border-color, #d1d5db);
          transform: translateY(-1px);
        }
        .workflow-clear-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-weight: 600;
          cursor: pointer;
          user-select: none;
          color: var(--text-primary, #333);
        }
        .section-header:hover {
          color: var(--accent-color, #3b82f6);
        }
        .logs-container, .operations-container {
          max-height: 200px;
          overflow-y: auto;
          background-color: var(--bg-tertiary, #f9fafb);
          border-radius: 6px;
          padding: 8px;
        }
        .log-entry {
          padding: 4px 8px;
          border-radius: 4px;
          margin-bottom: 4px;
          font-size: 13px;
        }
        .log-info {
          background-color: var(--bg-tertiary, #dbeafe);
          color: var(--accent-color, #1e40af);
        }
        .log-warn {
          background-color: var(--bg-tertiary, #fef3c7);
          color: var(--warning-color, #92400e);
        }
        .log-error {
          background-color: var(--bg-tertiary, #fee2e2);
          color: var(--error-color, #991b1b);
        }
        .log-time {
          opacity: 0.7;
          margin-right: 8px;
        }
        .decisions-container {
          max-height: 300px;
          overflow-y: auto;
          background-color: var(--bg-tertiary, #f8fafc);
          border-radius: 6px;
          padding: 8px;
        }
        .decision-entry {
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 8px;
          border-left: 3px solid var(--accent-color, #3b82f6);
          background-color: var(--bg-primary, white);
        }
        .decision-entry.decision-action {
          border-left-color: var(--accent-color, #3b82f6);
        }
        .decision-entry.decision-complete {
          border-left-color: var(--success-color, #10b981);
          background-color: var(--bg-tertiary, #f0fdf4);
        }
        .decision-entry.decision-early_termination {
          border-left-color: var(--warning-color, #f59e0b);
          background-color: var(--bg-tertiary, #fffbeb);
        }
        .decision-entry.decision-validation_continue {
          border-left-color: var(--accent-color, #8b5cf6);
          background-color: var(--bg-tertiary, #f5f3ff);
        }
        .decision-entry.decision-retry {
          border-left-color: var(--warning-color, #f59e0b);
          background-color: var(--bg-tertiary, #fffbeb);
        }
        .decision-entry.decision-operation_failed {
          border-left-color: var(--error-color, #ef4444);
          background-color: var(--bg-tertiary, #fef2f2);
        }
        .decision-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .decision-iteration {
          font-weight: 600;
          color: var(--text-primary, #374151);
          font-size: 13px;
        }
        .decision-type {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }
        .type-action {
          background-color: var(--bg-tertiary, #dbeafe);
          color: var(--accent-color, #1e40af);
        }
        .type-complete {
          background-color: var(--bg-tertiary, #dcfce7);
          color: var(--success-color, #166534);
        }
        .type-early_termination {
          background-color: var(--bg-tertiary, #fef3c7);
          color: var(--warning-color, #92400e);
        }
        .type-validation_continue {
          background-color: var(--bg-tertiary, #ede9fe);
          color: var(--accent-color, #6d28d9);
        }
        .type-retry {
          background-color: var(--bg-tertiary, #fef3c7);
          color: var(--warning-color, #92400e);
        }
        .type-operation_failed {
          background-color: var(--bg-tertiary, #fee2e2);
          color: var(--error-color, #991b1b);
        }
        .decision-message {
          font-size: 13px;
          color: var(--text-secondary, #4b5563);
          line-height: 1.4;
          margin-bottom: 6px;
        }
        .decision-operation {
          font-size: 12px;
          color: var(--text-secondary, #6b7280);
          background-color: var(--bg-tertiary, #f3f4f6);
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .op-label {
          color: var(--text-secondary, #9ca3af);
        }
        .op-name {
          font-weight: 600;
          color: var(--accent-color, #4f46e5);
        }
        .op-args {
          color: var(--text-secondary, #6b7280);
        }
        .op-arg {
          color: var(--success-color, #059669);
        }
        .decision-reason {
          font-size: 12px;
          color: var(--warning-color, #d97706);
          margin-top: 4px;
        }
        .decision-validation-count {
          font-size: 12px;
          color: var(--accent-color, #6366f1);
          margin-top: 4px;
        }
        .decision-retry-count {
          font-size: 12px;
          color: var(--warning-color, #f59e0b);
          margin-top: 4px;
        }
        .decision-error {
          font-size: 12px;
          color: var(--error-color, #ef4444);
          margin-top: 4px;
        }
        .operation-entry {
          display: flex;
          gap: 8px;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 4px;
          font-size: 13px;
        }
        .operation-entry.success {
          background-color: var(--bg-tertiary, #dcfce7);
        }
        .operation-entry.error {
          background-color: var(--bg-tertiary, #fee2e2);
        }
        .summary-container {
          background-color: var(--bg-tertiary, #f0fdf4);
          border-radius: 6px;
          padding: 12px;
        }
        .summary-container p {
          margin: 4px 0;
          color: var(--text-primary, #333);
        }
        .ai-summary-section {
          margin-top: 12px;
        }
        .ai-summary-container {
          background: var(--bg-tertiary, linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%));
          border-radius: 6px;
          padding: 12px;
          font-size: 14px;
          line-height: 1.6;
          color: var(--accent-color, #3730a3);
          border-left: 3px solid var(--accent-color, #667eea);
        }
        .preview-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .preview-modal {
          background: var(--bg-secondary, white);
          border-radius: 12px;
          width: 90%;
          max-width: 1200px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
        }
        .preview-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }
        .preview-modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary, #1f2937);
        }
        .preview-close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--text-secondary, #6b7280);
          padding: 4px 8px;
          border-radius: 4px;
        }
        .preview-close-btn:hover {
          background-color: var(--bg-tertiary, #f3f4f6);
          color: var(--text-primary, #1f2937);
        }
        .preview-modal-content {
          flex: 1;
          overflow: auto;
          padding: 16px;
          min-height: 300px;
        }
        .preview-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--border-color, #e5e7eb);
          background-color: var(--bg-tertiary, #f9fafb);
          border-radius: 0 0 12px 12px;
        }
        .preview-reject-btn {
          padding: 10px 20px;
          background-color: var(--bg-tertiary, #fee2e2);
          color: var(--error-color, #991b1b);
          border: 1px solid var(--border-color, #fecaca);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preview-reject-btn:hover {
          background-color: var(--bg-tertiary, #fecaca);
          transform: translateY(-1px);
        }
        .preview-confirm-btn {
          padding: 10px 20px;
          background-color: var(--success-color, #10b981);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.2s;
        }
        .preview-confirm-btn:hover {
          background-color: #059669;
          transform: translateY(-1px);
        }

        /* 深色模式适配 */
        .dark-mode .ai-workflow-panel {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .dark-mode .task-plan-container {
          background: var(--bg-tertiary);
          border-left: 3px solid var(--accent-color);
        }

        .dark-mode .task-plan-item {
          background-color: var(--bg-primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .dark-mode .workflow-input {
          background-color: var(--bg-primary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .dark-mode .logs-container,
        .dark-mode .operations-container,
        .dark-mode .decisions-container {
          background-color: var(--bg-tertiary);
        }

        .dark-mode .decision-entry {
          background-color: var(--bg-primary);
        }

        .dark-mode .preview-modal {
          background: var(--bg-secondary);
        }

        .dark-mode .preview-modal-header {
          border-bottom: 1px solid var(--border-color);
        }

        .dark-mode .preview-modal-actions {
          background-color: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
        }
      `}</style>
    </div>
  )
}

export default AIWorkflowPanel

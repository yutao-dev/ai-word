import { useState, useEffect, useRef } from 'react'
import ReactDiffViewer from 'react-diff-viewer-continued'
import { useAIWorkflow } from '../hooks/useAIWorkflow'
import { WORKFLOW_STATES } from '../utils/aiWorkflow'
import { showSuccess, showError, showWarning } from '../utils/toast'

const AIWorkflowPanel = ({ docId, currentDocContent, width = 400, onUpdateDocuments, onOperation }) => {
  const [userRequest, setUserRequest] = useState('')
  const [expanded, setExpanded] = useState({ decisions: true, operations: false })
  
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
    startTask,
    confirmChanges,
    rejectChanges,
    clear
  } = useAIWorkflow({ onOperation })

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

  const handleStart = async () => {
    if (!userRequest.trim()) {
      showWarning('请输入您的需求')
      return
    }
    if (!docId) {
      showWarning('请先选择一个文档')
      return
    }

    try {
      await startTask(userRequest, docId, currentDocContent)
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
                  <div key={i} className={`log-entry log-${log.level}`}>
                    <span className="log-time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="log-message">{log.message}</span>
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
                  <div key={i} className={`decision-entry decision-${decision.type}`}>
                    <div className="decision-header">
                      <span className="decision-iteration">第 {decision.iteration} 轮</span>
                      <span className={`decision-type type-${decision.type}`}>
                        {decision.type === 'action' ? '执行操作' : 
                         decision.type === 'complete' ? '任务完成' : 
                         decision.type === 'early_termination' ? '提前终止' : 
                         decision.type === 'validation_continue' ? '验证后继续' : 
                         decision.type === 'retry' ? '重试操作' : 
                         decision.type === 'operation_failed' ? '操作失败' : decision.type}
                      </span>
                    </div>
                    {decision.message && (
                      <div className="decision-message">{decision.message}</div>
                    )}
                    {decision.operation && (
                      <div className="decision-operation">
                        <span className="op-label">操作:</span>
                        <span className="op-name">{decision.operation.option}</span>
                        {decision.operation.args && decision.operation.args.length > 0 && (
                          <span className="op-args">
                            ({decision.operation.args.slice(0, 2).map((arg, idx) => (
                              <span key={idx} className="op-arg">
                                {typeof arg === 'string' && arg.length > 30 
                                  ? arg.substring(0, 30) + '...' 
                                  : arg}
                                {idx < decision.operation.args.length - 1 && idx < 1 ? ', ' : ''}
                              </span>
                            ))}
                            {decision.operation.args.length > 2 && '...'})
                          </span>
                        )}
                      </div>
                    )}
                    {decision.type === 'early_termination' && (
                      <div className="decision-reason">
                        <span>原因: {decision.reason}</span>
                      </div>
                    )}
                    {decision.validationCount !== undefined && (
                      <div className="decision-validation-count">
                        <span>验证次数: {decision.validationCount}</span>
                      </div>
                    )}
                    {decision.retryCount !== undefined && (
                      <div className="decision-retry-count">
                        <span>重试次数: {decision.retryCount}</span>
                      </div>
                    )}
                    {decision.error && (
                      <div className="decision-error">
                        <span>错误: {decision.error}</span>
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
                  <div key={i} className={`operation-entry ${op.success ? 'success' : 'error'}`}>
                    <div className="op-status">
                      {op.success ? '✅' : '❌'}
                    </div>
                    <div className="op-details">
                      {op.success ? '操作成功' : op.error}
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
              <p><strong>任务用时:</strong> {summary.duration}ms</p>
              <p><strong>迭代次数:</strong> {summary.iterations}</p>
              <p><strong>执行操作:</strong> {summary.operations.length} 个</p>
              <p><strong>状态:</strong> {summary.success ? '✅ 成功' : '❌ 失败'}</p>
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
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          padding: 16px;
          width: ${width}px;
          min-width: 280px;
          max-width: 600px;
          flex-shrink: 0;
          overflow-y: auto;
          max-height: calc(100vh - 120px);
        }

        .task-plan-container {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 6px;
          padding: 12px;
          border-left: 3px solid #0ea5e9;
        }

        .task-plan-message {
          font-size: 14px;
          color: #0c4a6e;
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
          background-color: white;
          border-radius: 6px;
          font-size: 13px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: all 0.2s ease;
        }

        .task-plan-item.task-complete {
          background-color: #f0fdf4;
          opacity: 0.8;
        }

        .task-status {
          font-size: 14px;
          min-width: 20px;
        }

        .task-id {
          font-weight: 600;
          color: #0369a1;
          min-width: 20px;
        }

        .task-plan-item.task-complete .task-id {
          color: #15803d;
        }

        .task-desc {
          flex: 1;
          color: #374151;
        }

        .task-plan-item.task-complete .task-desc {
          color: #6b7280;
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
          background-color: #dbeafe;
          color: #1d4ed8;
        }

        .badge-write {
          background-color: #fef3c7;
          color: #b45309;
        }

        .badge-edit {
          background-color: #dcfce7;
          color: #15803d;
        }

        .task-plan-note {
          font-size: 12px;
          color: #475569;
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
          border: 1px solid #ddd;
          border-radius: 8px;
          resize: vertical;
          font-family: inherit;
          font-size: 14px;
        }
        .workflow-input:disabled {
          background-color: #f5f5f5;
        }
        .workflow-buttons {
          display: flex;
          gap: 8px;
        }
        .workflow-start-btn {
          flex: 1;
          padding: 10px 16px;
          background-color: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .workflow-start-btn:hover:not(:disabled) {
          background-color: #059669;
        }
        .workflow-start-btn:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
        }
        .workflow-clear-btn {
          padding: 10px 16px;
          background-color: #e5e7eb;
          color: #374151;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .workflow-clear-btn:hover:not(:disabled) {
          background-color: #d1d5db;
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
        }
        .section-header:hover {
          color: #3b82f6;
        }
        .logs-container, .operations-container {
          max-height: 200px;
          overflow-y: auto;
          background-color: #f9fafb;
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
          background-color: #dbeafe;
          color: #1e40af;
        }
        .log-warn {
          background-color: #fef3c7;
          color: #92400e;
        }
        .log-error {
          background-color: #fee2e2;
          color: #991b1b;
        }
        .log-time {
          opacity: 0.7;
          margin-right: 8px;
        }
        .decisions-container {
          max-height: 300px;
          overflow-y: auto;
          background-color: #f8fafc;
          border-radius: 6px;
          padding: 8px;
        }
        .decision-entry {
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 8px;
          border-left: 3px solid #3b82f6;
          background-color: white;
        }
        .decision-entry.decision-action {
          border-left-color: #3b82f6;
        }
        .decision-entry.decision-complete {
          border-left-color: #10b981;
          background-color: #f0fdf4;
        }
        .decision-entry.decision-early_termination {
          border-left-color: #f59e0b;
          background-color: #fffbeb;
        }
        .decision-entry.decision-validation_continue {
          border-left-color: #8b5cf6;
          background-color: #f5f3ff;
        }
        .decision-entry.decision-retry {
          border-left-color: #f59e0b;
          background-color: #fffbeb;
        }
        .decision-entry.decision-operation_failed {
          border-left-color: #ef4444;
          background-color: #fef2f2;
        }
        .decision-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .decision-iteration {
          font-weight: 600;
          color: #374151;
          font-size: 13px;
        }
        .decision-type {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }
        .type-action {
          background-color: #dbeafe;
          color: #1e40af;
        }
        .type-complete {
          background-color: #dcfce7;
          color: #166534;
        }
        .type-early_termination {
          background-color: #fef3c7;
          color: #92400e;
        }
        .type-validation_continue {
          background-color: #ede9fe;
          color: #6d28d9;
        }
        .type-retry {
          background-color: #fef3c7;
          color: #92400e;
        }
        .type-operation_failed {
          background-color: #fee2e2;
          color: #991b1b;
        }
        .decision-message {
          font-size: 13px;
          color: #4b5563;
          line-height: 1.4;
          margin-bottom: 6px;
        }
        .decision-operation {
          font-size: 12px;
          color: #6b7280;
          background-color: #f3f4f6;
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .op-label {
          color: #9ca3af;
        }
        .op-name {
          font-weight: 600;
          color: #4f46e5;
        }
        .op-args {
          color: #6b7280;
        }
        .op-arg {
          color: #059669;
        }
        .decision-reason {
          font-size: 12px;
          color: #d97706;
          margin-top: 4px;
        }
        .decision-validation-count {
          font-size: 12px;
          color: #6366f1;
          margin-top: 4px;
        }
        .decision-retry-count {
          font-size: 12px;
          color: #f59e0b;
          margin-top: 4px;
        }
        .decision-error {
          font-size: 12px;
          color: #ef4444;
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
          background-color: #dcfce7;
        }
        .operation-entry.error {
          background-color: #fee2e2;
        }
        .summary-container {
          background-color: #f0fdf4;
          border-radius: 6px;
          padding: 12px;
        }
        .summary-container p {
          margin: 4px 0;
        }
        .ai-summary-section {
          margin-top: 12px;
        }
        .ai-summary-container {
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          border-radius: 6px;
          padding: 12px;
          font-size: 14px;
          line-height: 1.6;
          color: #3730a3;
          border-left: 3px solid #667eea;
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
          background: white;
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
          border-bottom: 1px solid #e5e7eb;
        }
        .preview-modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: #1f2937;
        }
        .preview-close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .preview-close-btn:hover {
          background-color: #f3f4f6;
          color: #1f2937;
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
          border-top: 1px solid #e5e7eb;
          background-color: #f9fafb;
          border-radius: 0 0 12px 12px;
        }
        .preview-reject-btn {
          padding: 10px 20px;
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preview-reject-btn:hover {
          background-color: #fecaca;
        }
        .preview-confirm-btn {
          padding: 10px 20px;
          background-color: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .preview-confirm-btn:hover {
          background-color: #059669;
        }
      `}</style>
    </div>
  )
}

export default AIWorkflowPanel

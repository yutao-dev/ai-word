import { useState, useCallback } from 'react'
import { workflowApi } from '../services/api'
import { useLLMConfig } from './useLLMConfig'

// 工作流状态常量
export const WORKFLOW_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
  PENDING_CONFIRMATION: 'pending_confirmation'
}

export const useAIWorkflow = (options = {}) => {
  const [state, setState] = useState(WORKFLOW_STATES.IDLE)
  const [logs, setLogs] = useState([])
  const [operationHistory, setOperationHistory] = useState([])
  const [decisions, setDecisions] = useState([])
  const [summary, setSummary] = useState(null)
  const [aiSummary, setAiSummary] = useState(null)
  const [taskPlan, setTaskPlan] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [pendingPreview, setPendingPreview] = useState(null)
  
  const { config } = useLLMConfig()

  const startTask = useCallback((userRequest, docId, originalContent) => {
    setLogs([])
    setOperationHistory([])
    setDecisions([])
    setSummary(null)
    setAiSummary(null)
    setTaskPlan(null)
    setPendingPreview(null)
    setState(WORKFLOW_STATES.RUNNING)
    setIsRunning(true)
    
    // 检查 config 是否存在
    if (!config || !config.model) {
      setLogs(prev => [...prev, {
        type: 'error',
        content: '请先配置 LLM 模型'
      }])
      setState(WORKFLOW_STATES.ERROR)
      setIsRunning(false)
      return
    }
    
    // 使用 SSE 流式请求
    const eventSource = workflowApi.executeStream(
      {
        user_request: userRequest,
        document_id: docId,
        model: config.model,
        max_iterations: 10
      },
      (data) => {
        switch (data.type) {
          case 'init':
            setLogs(prev => [...prev, {
              type: 'info',
              content: data.message
            }])
            break
          case 'step':
            const step = data.step
            setLogs(prev => [...prev, {
              type: 'info',
              content: `步骤 ${data.iteration}: ${step.summary || '执行操作'}`
            }])
            
            if (step.action) {
              setOperationHistory(prev => [...prev, step])
              // 安全调用 onOperation
              if (options?.onOperation) {
                try {
                  options.onOperation(step)
                } catch (error) {
                  console.error('onOperation error:', error)
                }
              }
            }
            
            if (step.thinking) {
              setDecisions(prev => [...prev, step])
            }
            
            if (step.plan) {
              setTaskPlan(step.plan)
            }
            break
          case 'complete':
            const result = data.result
            setSummary(`任务完成，共执行 ${result.iterations} 轮操作`)
            setAiSummary(result.message)
            setState(WORKFLOW_STATES.COMPLETED)
            eventSource.close()
            setIsRunning(false)
            // 工作流完成后更新文档列表，确保前端显示最新内容
            if (options?.onUpdateDocuments) {
              try {
                options.onUpdateDocuments()
              } catch (error) {
                console.error('onUpdateDocuments error:', error)
              }
            }
            break
          case 'error':
            setLogs(prev => [...prev, {
              type: 'error',
              content: `执行失败: ${data.message}`
            }])
            setState(WORKFLOW_STATES.ERROR)
            eventSource.close()
            setIsRunning(false)
            break
        }
      },
      (error) => {
        console.error('SSE error:', error)
        setLogs(prev => [...prev, {
          type: 'error',
          content: `API 错误: ${error.message || '未知错误'}`
        }])
        setState(WORKFLOW_STATES.ERROR)
        setIsRunning(false)
      },
      () => {
        console.log('SSE connection closed')
      }
    )
    
    // 保存 eventSource 以便后续可以关闭
    return eventSource
  }, [config, options])

  const clear = useCallback(() => {
    setLogs([])
    setOperationHistory([])
    setDecisions([])
    setSummary(null)
    setAiSummary(null)
    setTaskPlan(null)
    setPendingPreview(null)
    setState(WORKFLOW_STATES.IDLE)
  }, [])

  // 后端工作流不需要确认和拒绝操作，因为后端直接执行
  const confirmChanges = useCallback(() => {
    setPendingPreview(null)
  }, [])

  const rejectChanges = useCallback(() => {
    setPendingPreview(null)
    if (options.onOperation) {
      options.onOperation({ success: true, rejected: true })
    }
  }, [options])

  // 后端工作流不需要初始化
  const initializeWorkflow = useCallback(() => {
    return Promise.resolve()
  }, [])

  return {
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
    clear,
    initializeWorkflow
  }
}

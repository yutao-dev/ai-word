import { useState, useRef, useCallback } from 'react'
import { AIWorkflow, WORKFLOW_STATES } from '../utils/aiWorkflow'
import { fetchLLMResponse } from '../utils/api'
import { useLLMConfig } from './useLLMConfig'

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
  const workflowRef = useRef(null)

  const initializeWorkflow = useCallback(() => {
    workflowRef.current = new AIWorkflow({
      maxIterations: 30,
      maxRetries: 3,
      onStateChange: (newState) => {
        setState(newState)
        setIsRunning(newState !== WORKFLOW_STATES.IDLE && newState !== WORKFLOW_STATES.COMPLETED && newState !== WORKFLOW_STATES.ERROR && newState !== WORKFLOW_STATES.PENDING_CONFIRMATION)
      },
      onLog: (log) => {
        setLogs(prev => [...prev, log])
      },
      onOperation: (operation) => {
        setOperationHistory(prev => [...prev, operation])
        if (options.onOperation) {
          options.onOperation(operation)
        }
      },
      onDecision: (decision) => {
        setDecisions(prev => [...prev, decision])
      },
      onSummary: (sum) => {
        setSummary(sum)
      },
      onPendingConfirmation: (previewData) => {
        setPendingPreview(previewData)
      },
      onAISummary: (summary) => {
        setAiSummary(summary)
      },
      onTaskPlan: (plan) => {
        setTaskPlan(plan)
      },
      onTaskUpdate: (plan) => {
        setTaskPlan({ ...plan })
      },
      llmCaller: async (prompt) => {
        const result = await fetchLLMResponse(config, prompt)
        if (result.success) {
          return result.content
        }
        throw new Error(result.error)
      }
    })

    return workflowRef.current.initialize()
  }, [config, options])

  const startTask = useCallback(async (userRequest, docId, originalContent) => {
    if (!workflowRef.current) {
      await initializeWorkflow()
    }
    
    setLogs([])
    setOperationHistory([])
    setDecisions([])
    setSummary(null)
    setAiSummary(null)
    setTaskPlan(null)
    setPendingPreview(null)
    
    try {
      await workflowRef.current.startTask(userRequest, docId, originalContent)
    } catch (error) {
      console.error('Workflow error:', error)
    }
  }, [initializeWorkflow])

  const confirmChanges = useCallback(async () => {
    if (workflowRef.current) {
      setPendingPreview(null)
      await workflowRef.current.confirmChanges()
    }
  }, [])

  const rejectChanges = useCallback(async () => {
    if (workflowRef.current) {
      setPendingPreview(null)
      workflowRef.current.rejectChanges()
      if (options.onOperation) {
        options.onOperation({ success: true, rejected: true })
      }
    }
  }, [options])

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

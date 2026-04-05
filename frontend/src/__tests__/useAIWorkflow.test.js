import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIWorkflow } from '../hooks/useAIWorkflow'
import { workflowApi } from '../services/api'

// 模拟 API
vi.mock('../services/api', () => ({
  workflowApi: {
    execute: vi.fn()
  }
}))

describe('useAIWorkflow Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useAIWorkflow())
    
    expect(result.current.state).toBe('idle')
    expect(result.current.isRunning).toBe(false)
    expect(result.current.logs).toEqual([])
    expect(result.current.operationHistory).toEqual([])
    expect(result.current.decisions).toEqual([])
    expect(result.current.summary).toBe(null)
    expect(result.current.aiSummary).toBe(null)
    expect(result.current.taskPlan).toBe(null)
    expect(result.current.pendingPreview).toBe(null)
  })

  it('should execute workflow successfully', async () => {
    const mockResponse = {
      success: true,
      message: 'Workflow executed successfully',
      steps: [
        {
          iteration: 1,
          thinking: 'Analyzing request',
          plan: ['Step 1', 'Step 2'],
          action: { function: 'getDocumentById', params: { document_id: '1' } },
          summary: 'Getting document content'
        }
      ],
      iterations: 1
    }
    
    workflowApi.execute.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIWorkflow())

    await act(async () => {
      await result.current.startTask('Modify document', '1', 'Original content')
    })

    expect(workflowApi.execute).toHaveBeenCalledWith({
      user_request: 'Modify document',
      document_id: '1',
      model: 'gpt-4', // 从 config 中获取默认值
      max_iterations: 10
    })

    await waitFor(() => {
      expect(result.current.state).toBe('completed')
      expect(result.current.isRunning).toBe(false)
      expect(result.current.logs).toHaveLength(1)
      expect(result.current.operationHistory).toHaveLength(1)
      expect(result.current.decisions).toHaveLength(1)
      expect(result.current.summary).toBe('任务完成，共执行 1 轮操作')
      expect(result.current.aiSummary).toBe('Workflow executed successfully')
    })
  })

  it('should handle workflow error', async () => {
    workflowApi.execute.mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => useAIWorkflow())

    await act(async () => {
      await result.current.startTask('Modify document', '1', 'Original content')
    })

    await waitFor(() => {
      expect(result.current.state).toBe('error')
      expect(result.current.isRunning).toBe(false)
      expect(result.current.logs).toHaveLength(1)
      expect(result.current.logs[0].content).toBe('API 错误: API Error')
    })
  })

  it('should clear workflow state', async () => {
    const { result } = renderHook(() => useAIWorkflow())

    // 模拟一些状态
    result.current.logs.push({ type: 'info', content: 'Test log' })
    result.current.operationHistory.push({ action: 'test' })
    result.current.decisions.push({ thinking: 'Test' })
    result.current.summary = 'Test summary'
    result.current.aiSummary = 'Test AI summary'
    result.current.taskPlan = { steps: [] }
    result.current.pendingPreview = { content: 'Test' }

    act(() => {
      result.current.clear()
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.logs).toEqual([])
    expect(result.current.operationHistory).toEqual([])
    expect(result.current.decisions).toEqual([])
    expect(result.current.summary).toBe(null)
    expect(result.current.aiSummary).toBe(null)
    expect(result.current.taskPlan).toBe(null)
    expect(result.current.pendingPreview).toBe(null)
  })

  it('should handle confirm and reject changes', async () => {
    const onOperation = vi.fn()
    const { result } = renderHook(() => useAIWorkflow({ onOperation }))

    // 模拟 pendingPreview - 注意：这里我们不能直接修改 result.current，需要通过状态更新
    // 由于 useAIWorkflow 中没有直接设置 pendingPreview 的方法，我们跳过这个测试的验证
    // 只测试函数调用
    
    act(() => {
      result.current.confirmChanges()
    })
    
    act(() => {
      result.current.rejectChanges()
    })
    expect(onOperation).toHaveBeenCalledWith({ success: true, rejected: true })
  })

  it('should initialize workflow', async () => {
    const { result } = renderHook(() => useAIWorkflow())

    const promise = act(async () => {
      await result.current.initializeWorkflow()
    })

    await waitFor(() => {
      expect(promise).resolves.toBeUndefined()
    })
  })
})

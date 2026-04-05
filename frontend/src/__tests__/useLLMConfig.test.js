import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLLMConfig } from '../hooks/useLLMConfig'
import { aiApi } from '../services/api'
import { showError } from '../utils/toast'

// 模拟 API 和工具函数
vi.mock('../services/api', () => ({
  aiApi: {
    getConfigs: vi.fn(),
    createConfig: vi.fn()
  }
}))

vi.mock('../utils/toast', () => ({
  showError: vi.fn()
}))

describe('useLLMConfig Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default config when no backend configs', async () => {
    aiApi.getConfigs.mockResolvedValue([])

    const { result } = renderHook(() => useLLMConfig())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.config).toEqual({
        provider: 'openai',
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
      })
    })
  })

  it('should load config from backend', async () => {
    const mockConfigs = [
      {
        id: '1',
        name: 'Default Config',
        provider: 'openai',
        api_key: 'test-api-key',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        is_default: true
      }
    ]
    
    aiApi.getConfigs.mockResolvedValue(mockConfigs)
    aiApi.createConfig.mockResolvedValue(mockConfigs[0])

    const { result } = renderHook(() => useLLMConfig())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.config).toEqual({
        provider: 'openai',
        apiKey: 'test-api-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o'
      })
    })
  })

  it('should update config', async () => {
    aiApi.getConfigs.mockResolvedValue([])
    aiApi.createConfig.mockResolvedValue({})

    const { result } = renderHook(() => useLLMConfig())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.updateConfig({ apiKey: 'new-api-key', model: 'gpt-4-turbo' })
    })

    expect(result.current.config.apiKey).toBe('new-api-key')
    expect(result.current.config.model).toBe('gpt-4-turbo')
    expect(aiApi.createConfig).toHaveBeenCalledWith({
      name: 'Default',
      provider: 'openai',
      api_key: 'new-api-key',
      base_url: 'https://api.openai.com/v1',
      model: 'gpt-4-turbo',
      is_default: true
    })
  })

  it('should change provider', async () => {
    aiApi.getConfigs.mockResolvedValue([])
    aiApi.createConfig.mockResolvedValue({})

    const { result } = renderHook(() => useLLMConfig())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.changeProvider('anthropic')
    })

    expect(result.current.config.provider).toBe('anthropic')
    expect(result.current.config.baseUrl).toBe('https://api.anthropic.com')
    expect(result.current.config.model).toBe('claude-3-opus-20240229')
    expect(result.current.availableModels).toEqual([])
  })

  it('should handle fetch models without API key', async () => {
    aiApi.getConfigs.mockResolvedValue([])

    const { result } = renderHook(() => useLLMConfig())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      const response = await result.current.fetchModels()
      expect(response.success).toBe(false)
      expect(response.error).toBe('请先填写 API Key 和 Base URL')
    })

    expect(showError).toHaveBeenCalledWith('请先填写 API Key 和 Base URL')
  })

  it('should handle fetch models for provider without models endpoint', async () => {
    aiApi.getConfigs.mockResolvedValue([])

    const { result } = renderHook(() => useLLMConfig())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // 先设置 API Key 和 Base URL
    act(() => {
      result.current.updateConfig({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.anthropic.com'
      })
    })

    // 切换到没有 modelsEndpoint 的提供商
    act(() => {
      result.current.changeProvider('anthropic')
    })

    await act(async () => {
      const response = await result.current.fetchModels()
      expect(response.success).toBe(false)
      expect(response.error).toBe('该提供商不支持模型列表拉取，请手动输入模型名称')
    })

    expect(showError).toHaveBeenCalledWith('该提供商不支持模型列表拉取，请手动输入模型名称')
  })
})

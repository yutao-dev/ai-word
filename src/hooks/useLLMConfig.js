import { useState, useEffect, useCallback } from 'react'
import { LLM_PROVIDERS, DEFAULT_LLM_CONFIG } from '../constants'
import { getLLMConfig, saveLLMConfig } from '../utils/db'
import { fetchModels as fetchModelsApi } from '../utils/api'
import { showError } from '../utils/toast'

export const useLLMConfig = () => {
  const [config, setConfig] = useState(DEFAULT_LLM_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [availableModels, setAvailableModels] = useState([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await getLLMConfig()
        setConfig(savedConfig)
      } catch (error) {
        console.error('Load LLM config error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadConfig()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      saveLLMConfig(config)
    }
  }, [config, isLoading])

  const currentProvider = LLM_PROVIDERS.find(p => p.id === config.provider)

  const updateConfig = useCallback((updates) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const changeProvider = useCallback((providerId) => {
    const provider = LLM_PROVIDERS.find(p => p.id === providerId)
    setConfig(prev => ({
      ...prev,
      provider: providerId,
      baseUrl: provider?.defaultBaseUrl || '',
      model: provider?.defaultModel || ''
    }))
    setAvailableModels([])
  }, [])

  const fetchModels = useCallback(async () => {
    if (!config.apiKey || !config.baseUrl) {
      showError('请先填写 API Key 和 Base URL')
      return { success: false, error: '请先填写 API Key 和 Base URL' }
    }

    const provider = LLM_PROVIDERS.find(p => p.id === config.provider)
    if (!provider?.modelsEndpoint) {
      showError('该提供商不支持模型列表拉取，请手动输入模型名称')
      return { success: false, error: '该提供商不支持模型列表拉取，请手动输入模型名称' }
    }

    setIsLoadingModels(true)
    setAvailableModels([])

    const result = await fetchModelsApi(config)
    
    if (result.success) {
      setAvailableModels(result.models)
      if (result.models.length > 0 && !result.models.includes(config.model)) {
        setConfig(prev => ({ ...prev, model: result.models[0] }))
      }
    } else {
      showError('拉取模型失败：' + result.error)
    }

    setIsLoadingModels(false)
    return result
  }, [config])

  return {
    config,
    setConfig,
    updateConfig,
    changeProvider,
    currentProvider,
    availableModels,
    isLoadingModels,
    isLoading,
    fetchModels
  }
}

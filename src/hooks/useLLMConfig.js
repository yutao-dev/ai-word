import { useState, useEffect, useCallback } from 'react'
import { STORAGE_KEYS, LLM_PROVIDERS, DEFAULT_LLM_CONFIG } from '../constants'
import { fetchModels as fetchModelsApi } from '../utils/api'

export const useLLMConfig = () => {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LLM_CONFIG)
    if (saved) {
      return JSON.parse(saved)
    }
    return DEFAULT_LLM_CONFIG
  })

  const [availableModels, setAvailableModels] = useState([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LLM_CONFIG, JSON.stringify(config))
  }, [config])

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
      return { success: false, error: '请先填写 API Key 和 Base URL' }
    }

    const provider = LLM_PROVIDERS.find(p => p.id === config.provider)
    if (!provider?.modelsEndpoint) {
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
    fetchModels
  }
}

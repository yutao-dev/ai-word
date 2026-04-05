import { useState, useEffect, useCallback } from 'react'
import { LLM_PROVIDERS, DEFAULT_LLM_CONFIG } from '../constants'
import { aiApi } from '../services/api'
import { showError } from '../utils/toast'

export const useLLMConfig = () => {
  const [config, setConfig] = useState(DEFAULT_LLM_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [availableModels, setAvailableModels] = useState([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configs = await aiApi.getConfigs()
        // 找到默认配置或使用第一个配置
        const defaultConfig = configs.find(c => c.is_default) || configs[0]
        if (defaultConfig) {
          setConfig({
            provider: defaultConfig.provider,
            apiKey: defaultConfig.api_key,
            baseUrl: defaultConfig.base_url,
            model: defaultConfig.model
          })
        }
      } catch (error) {
        console.error('Load LLM config error:', error)
        // 如果后端没有配置，使用默认配置
      } finally {
        setIsLoading(false)
      }
    }
    
    loadConfig()
  }, [])

  // 保存配置到后端
  const saveConfigToBackend = useCallback(async (configData) => {
    try {
      await aiApi.createConfig({
        name: 'Default',
        provider: configData.provider,
        api_key: configData.apiKey,
        base_url: configData.baseUrl,
        model: configData.model,
        is_default: true
      })
    } catch (error) {
      console.error('Save LLM config error:', error)
    }
  }, [])

  const currentProvider = LLM_PROVIDERS.find(p => p.id === config.provider)

  const updateConfig = useCallback((updates) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    saveConfigToBackend(newConfig)
  }, [config, saveConfigToBackend])

  const changeProvider = useCallback((providerId) => {
    const provider = LLM_PROVIDERS.find(p => p.id === providerId)
    const newConfig = {
      ...config,
      provider: providerId,
      baseUrl: provider?.defaultBaseUrl || '',
      model: provider?.defaultModel || ''
    }
    setConfig(newConfig)
    saveConfigToBackend(newConfig)
    setAvailableModels([])
  }, [config, saveConfigToBackend])

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

    // 暂时使用原有实现，后续可迁移到后端
    const result = await (async () => {
      try {
        const response = await fetch(`${config.baseUrl}${provider.modelsEndpoint}`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          // 对于 401 错误，给出更明确的提示
          if (response.status === 401) {
            throw new Error('API Key 无效或已过期，请检查 API Key')
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        let models = []
        
        // 处理不同提供商的模型列表格式
        if (provider.id === 'openai' || provider.id === 'custom') {
          // OpenAI 兼容 API（包括 SiliconFlow）
          models = data.data?.map(m => m.id) || []
        } else if (provider.id === 'anthropic') {
          models = data.models?.map(m => m.name) || []
        } else if (provider.id === 'ollama') {
          models = data.models?.map(m => m.name) || []
        }
        
        if (models.length === 0) {
          throw new Error('未找到可用模型，请检查 API Key 和 Base URL')
        }
        
        return { success: true, models }
      } catch (error) {
        console.error('Fetch models error:', error)
        return { success: false, error: error.message || '未知错误' }
      }
    })()
    
    if (result.success) {
      setAvailableModels(result.models)
      if (result.models.length > 0 && !result.models.includes(config.model)) {
        const newConfig = { ...config, model: result.models[0] }
        setConfig(newConfig)
        saveConfigToBackend(newConfig)
      }
    } else {
      showError('拉取模型失败：' + result.error)
    }

    setIsLoadingModels(false)
    return result
  }, [config, saveConfigToBackend])

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

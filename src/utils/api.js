import { LLM_PROVIDERS, API_ENDPOINTS } from '../constants'

export const fetchModels = async (config) => {
  const { apiKey, baseUrl, provider: providerId } = config
  const provider = LLM_PROVIDERS.find(p => p.id === providerId)
  
  if (!provider?.modelsEndpoint) {
    return { success: false, error: '该提供商不支持模型列表拉取，请手动输入模型名称' }
  }

  try {
    let models = []
    
    if (provider.id === 'ollama') {
      const response = await fetch(`${baseUrl}${provider.modelsEndpoint}`)
      const data = await response.json()
      models = data.models?.map(m => m.name) || []
    } else {
      const response = await fetch(`${baseUrl}${provider.modelsEndpoint}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })
      const data = await response.json()
      models = data.data?.map(m => m.id) || []
    }

    return { success: true, models }
  } catch (error) {
    console.error('拉取模型失败:', error)
    return { success: false, error: '拉取模型失败，请检查配置是否正确' }
  }
}

export const callLLMStream = async (config, prompt, onChunk, onComplete, onError) => {
  const provider = LLM_PROVIDERS.find(p => p.id === config.provider)
  let fullText = ''

  try {
    if (provider?.id === 'ollama') {
      const response = await fetch(`${config.baseUrl}${API_ENDPOINTS.OLLAMA_GENERATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt: prompt,
          stream: true,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens
          }
        })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.response) {
                fullText += data.response
                onChunk?.(data.response)
              }
            } catch {
              continue
            }
          }
        }
      }
    } else if (provider?.id === 'anthropic') {
      const response = await fetch(`${config.baseUrl}${API_ENDPOINTS.ANTHROPIC_MESSAGES}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await response.json()
      fullText = data.content?.[0]?.text || '无响应'
      onChunk?.(fullText)
    } else {
      const response = await fetch(`${config.baseUrl}${API_ENDPOINTS.OPENAI_CHAT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          top_p: config.topP,
          frequency_penalty: config.frequencyPenalty,
          presence_penalty: config.presencePenalty,
          stream: true
        })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim()
              if (dataStr === '[DONE]') continue
              
              try {
                const data = JSON.parse(dataStr)
                const delta = data.choices?.[0]?.delta?.content
                if (delta) {
                  fullText += delta
                  onChunk?.(delta)
                }
              } catch {
                continue
              }
            }
          }
        }
      }
    }

    onComplete?.(fullText || '无响应')
    return fullText
  } catch (error) {
    console.error('AI 调用失败:', error)
    onError?.(error.message)
    throw error
  }
}

export const callLLM = async (config, prompt) => {
  const provider = LLM_PROVIDERS.find(p => p.id === config.provider)

  try {
    let result = ''
    
    if (provider?.id === 'anthropic') {
      const response = await fetch(`${config.baseUrl}${API_ENDPOINTS.ANTHROPIC_MESSAGES}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await response.json()
      result = data.content?.[0]?.text || ''
    } else if (provider?.id === 'ollama') {
      const response = await fetch(`${config.baseUrl}${API_ENDPOINTS.OLLAMA_GENERATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens,
            top_p: config.topP,
            frequency_penalty: config.frequencyPenalty,
            presence_penalty: config.presencePenalty
          }
        })
      })
      const data = await response.json()
      result = data.response || ''
    } else {
      const response = await fetch(`${config.baseUrl}${API_ENDPOINTS.OPENAI_CHAT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          top_p: config.topP,
          frequency_penalty: config.frequencyPenalty,
          presence_penalty: config.presencePenalty
        })
      })
      const data = await response.json()
      result = data.choices?.[0]?.message?.content || ''
    }

    return { success: true, result }
  } catch (error) {
    console.error('AI 调用失败:', error)
    return { success: false, error: error.message }
  }
}

export const buildPrompt = (type, content, customInstruction = '') => {
  switch (type) {
    case 'beautify':
      return `请优化和美化以下文本，使其表达更清晰、更专业，保持原意不变，直接返回美化后的内容，不需要额外说明：\n\n${content}`
    case 'custom':
      return `参考以下内容：\n\n${content}\n\n请根据以下要求处理：${customInstruction}\n\n直接返回处理后的内容，不需要额外说明。`
    default:
      return content
  }
}

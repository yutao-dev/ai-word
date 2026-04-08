export const STORAGE_KEYS = {
  DOCUMENTS: 'markdown-documents',
  LLM_CONFIG: 'llm-config'
}

export const LLM_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
    modelsEndpoint: '/models'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-opus-20240229',
    modelsEndpoint: null
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    defaultBaseUrl: '',
    defaultModel: '',
    modelsEndpoint: null
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama2',
    modelsEndpoint: '/api/tags'
  },
  {
    id: 'custom',
    name: '自定义 (OpenAI 兼容)',
    defaultBaseUrl: '',
    defaultModel: '',
    modelsEndpoint: '/models'
  }
]

export const API_ENDPOINTS = {
  OPENAI_CHAT: '/chat/completions',
  OLLAMA_GENERATE: '/api/generate',
  ANTHROPIC_MESSAGES: '/v1/messages'
}

export const DEFAULT_LLM_CONFIG = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, documentApi, aiApi, workflowApi } from '../../services/api'

// 模拟 fetch 函数
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Service', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('documentApi', () => {
    it('should get all documents', async () => {
      const mockDocuments = [
        { id: '1', title: 'Document 1', content: 'Content 1' },
        { id: '2', title: 'Document 2', content: 'Content 2' }
      ]
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockDocuments
      })

      const documents = await documentApi.getAll()
      expect(documents).toEqual(mockDocuments)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/documents/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })

    it('should get document by id', async () => {
      const mockDocument = { id: '1', title: 'Document 1', content: 'Content 1' }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockDocument
      })

      const document = await documentApi.getById('1')
      expect(document).toEqual(mockDocument)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/documents/1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })

    it('should create document', async () => {
      const mockDocument = { id: '1', title: 'New Document', content: 'New Content' }
      const createData = { title: 'New Document', content: 'New Content' }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockDocument
      })

      const document = await documentApi.create(createData)
      expect(document).toEqual(mockDocument)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/documents/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createData)
      })
    })

    it('should update document', async () => {
      const mockDocument = { id: '1', title: 'Updated Document', content: 'Updated Content' }
      const updateData = { title: 'Updated Document', content: 'Updated Content' }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockDocument
      })

      const document = await documentApi.update('1', updateData)
      expect(document).toEqual(mockDocument)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/documents/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })
    })

    it('should delete document', async () => {
      const mockResponse = { message: 'Document deleted successfully' }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const response = await documentApi.delete('1')
      expect(response).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/documents/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })
  })

  describe('aiApi', () => {
    it('should get LLM configs', async () => {
      const mockConfigs = [
        { id: '1', name: 'Config 1', provider: 'openai', model: 'gpt-4o' },
        { id: '2', name: 'Config 2', provider: 'anthropic', model: 'claude-3-opus-20240229' }
      ]
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockConfigs
      })

      const configs = await aiApi.getConfigs()
      expect(configs).toEqual(mockConfigs)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/ai/configs', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })

    it('should create LLM config', async () => {
      const mockConfig = { id: '1', name: 'New Config', provider: 'openai', model: 'gpt-4o' }
      const createData = { name: 'New Config', provider: 'openai', model: 'gpt-4o' }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockConfig
      })

      const config = await aiApi.createConfig(createData)
      expect(config).toEqual(mockConfig)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/ai/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createData)
      })
    })

    it('should chat with AI', async () => {
      const mockResponse = { content: 'Hello, I am AI!', model: 'gpt-4o', usage: { prompt_tokens: 10, completion_tokens: 5 } }
      const chatData = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o'
      }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const response = await aiApi.chat(chatData)
      expect(response).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatData)
      })
    })
  })

  describe('workflowApi', () => {
    it('should execute workflow', async () => {
      const mockResponse = {
        success: true,
        message: 'Workflow executed successfully',
        steps: [],
        iterations: 1
      }
      const workflowData = {
        user_request: 'Modify document',
        document_id: '1',
        model: 'gpt-4o'
      }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const response = await workflowApi.execute(workflowData)
      expect(response).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/workflow/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workflowData)
      })
    })
  })

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'API Error' })
    })

    await expect(documentApi.getAll()).rejects.toThrow('API Error')
  })
})

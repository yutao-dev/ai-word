import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDocuments } from '../hooks/useDocuments'
import { documentApi } from '../services/api'
import { showSuccess, showError, showWarning } from '../utils/toast'

// 模拟 API 和工具函数
vi.mock('../services/api', () => ({
  documentApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../utils/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn()
}))

// 模拟 localStorage
const mockLocalStorage = (() => {
  let store = {}
  return {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString() }),
    clear: vi.fn(() => { store = {} })
  }
})()

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

describe('useDocuments Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('should initialize with documents', async () => {
    const mockDocuments = [
      { id: '1', title: 'Document 1', content: 'Content 1' },
      { id: '2', title: 'Document 2', content: 'Content 2' }
    ]
    
    documentApi.getAll.mockResolvedValue(mockDocuments)

    const { result } = renderHook(() => useDocuments())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.documents).toEqual(mockDocuments)
      expect(result.current.currentDocId).toBe('1') // 第一个文档
    })
  })

  it('should create new document', async () => {
    const mockDocuments = [{ id: '1', title: 'Document 1', content: 'Content 1' }]
    const newDocument = { id: '2', title: 'New Document', content: '' }
    
    documentApi.getAll.mockResolvedValue(mockDocuments)
    documentApi.create.mockResolvedValue(newDocument)

    const { result } = renderHook(() => useDocuments())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createDocument('New Document')
    })

    expect(documentApi.create).toHaveBeenCalledWith({ title: 'New Document' })
    expect(showSuccess).toHaveBeenCalledWith('文档创建成功')
    expect(result.current.documents).toEqual([newDocument, ...mockDocuments])
    expect(result.current.currentDocId).toBe('2')
  })

  it('should update current document', async () => {
    const mockDocuments = [{ id: '1', title: 'Document 1', content: 'Old Content' }]
    const updatedDocument = { id: '1', title: 'Document 1', content: 'New Content' }
    
    documentApi.getAll.mockResolvedValue(mockDocuments)
    documentApi.update.mockResolvedValue(updatedDocument)

    const { result } = renderHook(() => useDocuments())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updateCurrentDoc('New Content')
    })

    expect(documentApi.update).toHaveBeenCalledWith('1', { content: 'New Content' })
    expect(result.current.documents).toEqual([updatedDocument])
  })

  it('should delete document', async () => {
    const mockDocuments = [
      { id: '1', title: 'Document 1', content: 'Content 1' },
      { id: '2', title: 'Document 2', content: 'Content 2' }
    ]
    
    documentApi.getAll.mockResolvedValue(mockDocuments)
    documentApi.delete.mockResolvedValue({ message: 'Document deleted successfully' })

    const { result } = renderHook(() => useDocuments())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteDocument('1')
    })

    expect(documentApi.delete).toHaveBeenCalledWith('1')
    expect(showSuccess).toHaveBeenCalledWith('文档已删除')
    expect(result.current.documents).toEqual([mockDocuments[1]])
    expect(result.current.currentDocId).toBe('2')
  })

  it('should handle create document error', async () => {
    const mockDocuments = [{ id: '1', title: 'Document 1', content: 'Content 1' }]
    
    documentApi.getAll.mockResolvedValue(mockDocuments)
    documentApi.create.mockRejectedValue(new Error('Create failed'))

    const { result } = renderHook(() => useDocuments())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      const createResult = await result.current.createDocument('New Document')
      expect(createResult).toBe(null)
    })

    expect(showError).toHaveBeenCalledWith('创建失败：Create failed')
  })

  it('should handle empty title', async () => {
    const mockDocuments = [{ id: '1', title: 'Document 1', content: 'Content 1' }]
    
    documentApi.getAll.mockResolvedValue(mockDocuments)

    const { result } = renderHook(() => useDocuments())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      const createResult = await result.current.createDocument('')
      expect(createResult).toBe(null)
    })

    expect(showWarning).toHaveBeenCalledWith('请输入文档标题')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MCP_FUNCTIONS,
  generateFunctionDocumentation,
  executeFunction,
  parseAndExecute,
  startTransaction,
  commitTransaction,
  rollbackTransaction
} from './mcpFunctions'
import * as db from './db'

vi.mock('./db', () => ({
  getAllDocuments: vi.fn(),
  getDocumentById: vi.fn(),
  deleteByRange: vi.fn(),
  deleteAndSwap: vi.fn(),
  insertEnd: vi.fn(),
  saveDocument: vi.fn()
}))

describe('mcpFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateFunctionDocumentation', () => {
    it('should generate markdown documentation for all functions', () => {
      const docs = generateFunctionDocumentation()
      expect(docs).toContain('# 文档操作函数接口说明')
      expect(docs).toContain('getAllDocument')
      expect(docs).toContain('getDocumentById')
      expect(docs).toContain('deleteByRange')
      expect(docs).toContain('deleteAndSwap')
      expect(docs).toContain('insertEnd')
    })
  })

  describe('executeFunction', () => {
    it('should return error for unknown function', async () => {
      const result = await executeFunction('unknownFunction')
      expect(result.success).toBe(false)
      expect(result.error).toContain('未知函数')
    })

    it('should execute getAllDocument successfully', async () => {
      db.getAllDocuments.mockResolvedValue([
        { id: '1', title: 'Test', createdAt: 123, updatedAt: 456 }
      ])
      
      const result = await executeFunction('getAllDocument')
      expect(result.success).toBe(true)
      expect(result.data.length).toBe(1)
      expect(result.data[0].id).toBe('1')
    })

    it('should execute getDocumentById with validation', async () => {
      const result1 = await executeFunction('getDocumentById')
      expect(result1.success).toBe(false)

      db.getDocumentById.mockResolvedValue({ id: '1', content: 'test' })
      const result2 = await executeFunction('getDocumentById', '1')
      expect(result2.success).toBe(true)
    })
  })

  describe('parseAndExecute', () => {
    it('should parse JSON and execute function', async () => {
      db.getAllDocuments.mockResolvedValue([])
      const jsonStr = JSON.stringify({
        option: 'getAllDocument',
        args: []
      })
      const result = await parseAndExecute(jsonStr)
      expect(result.success).toBe(true)
    })

    it('should return error for invalid JSON', async () => {
      const result = await parseAndExecute('invalid json')
      expect(result.success).toBe(false)
      expect(result.error).toContain('JSON解析失败')
    })
  })

  describe('transaction management', () => {
    it('should handle transaction lifecycle', () => {
      startTransaction()
      expect(() => commitTransaction()).not.toThrow()
      
      startTransaction()
      expect(() => rollbackTransaction()).not.toThrow()
    })
  })
})

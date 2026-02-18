import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  deleteAndSwap,
  deleteByRange,
  insertEnd
} from './db'

const mockDb = {
  get: vi.fn(),
  put: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn()
}

vi.mock('idb', () => ({
  openDB: () => Promise.resolve(mockDb)
}))

describe('deleteAndSwap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parameter validation', () => {
    it('should reject non-numeric line numbers', async () => {
      mockDb.get.mockResolvedValue({ id: '1', content: 'test' })
      
      const result1 = await deleteAndSwap('1', 'abc', '2', 'new')
      expect(result1.success).toBe(false)
      expect(result1.error).toContain('行号必须是数字')
      
      const result2 = await deleteAndSwap('1', '1', 'xyz', 'new')
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('行号必须是数字')
    })

    it('should reject invalid line number ranges', async () => {
      mockDb.get.mockResolvedValue({ id: '1', content: 'test' })
      
      const result1 = await deleteAndSwap('1', '0', '2', 'new')
      expect(result1.success).toBe(false)
      expect(result1.error).toContain('无效的行号范围')
      
      const result2 = await deleteAndSwap('1', '3', '2', 'new')
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('无效的行号范围')
      
      const result3 = await deleteAndSwap('1', '-1', '2', 'new')
      expect(result3.success).toBe(false)
      expect(result3.error).toContain('无效的行号范围')
    })

    it('should reject line numbers exceeding document length', async () => {
      mockDb.get.mockResolvedValue({ id: '1', content: 'line1\nline2\nline3' })
      
      const result1 = await deleteAndSwap('1', '1', '10', 'new')
      expect(result1.success).toBe(false)
      expect(result1.error).toContain('行号超出文档范围')
      
      const result2 = await deleteAndSwap('1', '10', '10', 'new')
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('行号超出文档范围')
    })

    it('should reject non-existent document', async () => {
      mockDb.get.mockResolvedValue(null)
      
      const result = await deleteAndSwap('nonexistent', '1', '2', 'new')
      expect(result.success).toBe(false)
      expect(result.error).toContain('文档不存在')
    })
  })

  describe('basic functionality', () => {
    it('should delete and replace single line', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '2', '2', 'newLine2')
      
      expect(result.success).toBe(true)
      expect(result.newContent).toBe('line1\nnewLine2\nline3')
      expect(result.originalContent).toBe('line1\nline2\nline3')
    })

    it('should delete and replace multiple lines', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3\nline4\nline5',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '2', '4', 'newLine')
      
      expect(result.success).toBe(true)
      expect(result.newContent).toBe('line1\nnewLine\nline5')
    })

    it('should delete first line', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '1', '1', 'newFirstLine')
      
      expect(result.success).toBe(true)
      expect(result.newContent).toBe('newFirstLine\nline2\nline3')
    })

    it('should delete last line', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '3', '3', 'newLastLine')
      
      expect(result.success).toBe(true)
      expect(result.newContent).toBe('line1\nline2\nnewLastLine')
    })

    it('should delete all lines and replace with new content', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '1', '3', 'completely new content')
      
      expect(result.success).toBe(true)
      expect(result.newContent).toBe('completely new content')
    })
  })

  describe('edge cases', () => {
    it('should handle empty replacement string', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '2', '2', '')
      
      expect(result.success).toBe(true)
      expect(result.newContent).toBe('line1\nline3')
    })

    it('should handle null replacement string', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '2', '2', null)
      
      expect(result.success).toBe(true)
    })

    it('should handle undefined replacement string', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '2', '2', undefined)
      
      expect(result.success).toBe(true)
    })

    it('should handle replacement with multiple lines', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '2', '2', 'new2a\nnew2b\nnew2c')
      
      expect(result.success).toBe(true)
      expect(result.newContent).toBe('line1\nnew2a\nnew2b\nnew2c\nline3')
    })

    it('should handle single-line document', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'onlyLine',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '1', '1', 'replaced')
      
      expect(result.success).toBe(true)
      expect(result.newContent).toBe('replaced')
    })

    it('should handle document with trailing newline', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3\n',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '2', '2', 'newLine2')
      
      expect(result.success).toBe(true)
    })

    it('should handle document with CRLF line endings', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\r\nline2\r\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '2', '2', 'newLine2')
      
      expect(result.success).toBe(true)
    })

    it('should handle empty document', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: '',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '1', '1', 'newContent')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('行号超出文档范围')
    })
  })

  describe('return value structure', () => {
    it('should return correct structure on success', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '1', '1', 'new')
      
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('doc')
      expect(result).toHaveProperty('originalContent')
      expect(result).toHaveProperty('newContent')
      expect(result.doc).toHaveProperty('id', '1')
      expect(result.doc).toHaveProperty('updatedAt')
    })

    it('should return correct structure on failure', async () => {
      mockDb.get.mockResolvedValue(null)
      
      const result = await deleteAndSwap('1', '1', '1', 'new')
      
      expect(result).toHaveProperty('success', false)
      expect(result).toHaveProperty('error')
    })
  })

  describe('string parameter handling', () => {
    it('should accept string line numbers', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', '1', '2', 'new')
      
      expect(result.success).toBe(true)
    })

    it('should handle whitespace in line numbers', async () => {
      mockDb.get.mockResolvedValue({ 
        id: '1', 
        content: 'line1\nline2\nline3',
        title: 'Test'
      })
      mockDb.put.mockResolvedValue(undefined)
      
      const result = await deleteAndSwap('1', ' 1 ', ' 2 ', 'new')
      
      expect(result.success).toBe(true)
    })
  })
})

describe('deleteByRange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete lines without replacement', async () => {
    mockDb.get.mockResolvedValue({ 
      id: '1', 
      content: 'line1\nline2\nline3\nline4',
      title: 'Test'
    })
    mockDb.put.mockResolvedValue(undefined)
    
    const result = await deleteByRange('1', '2', '3')
    
    expect(result.success).toBe(true)
    expect(result.newContent).toBe('line1\nline4')
  })
})

describe('insertEnd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should append content to document end', async () => {
    mockDb.get.mockResolvedValue({ 
      id: '1', 
      content: 'existing content',
      title: 'Test'
    })
    mockDb.put.mockResolvedValue(undefined)
    
    const result = await insertEnd('1', 'new content')
    
    expect(result.success).toBe(true)
    expect(result.newContent).toBe('existing content\nnew content')
  })

  it('should handle document without trailing newline', async () => {
    mockDb.get.mockResolvedValue({ 
      id: '1', 
      content: 'existing',
      title: 'Test'
    })
    mockDb.put.mockResolvedValue(undefined)
    
    const result = await insertEnd('1', 'new')
    
    expect(result.success).toBe(true)
    expect(result.newContent).toBe('existing\nnew')
  })

  it('should not add extra newline when content already has trailing newline', async () => {
    mockDb.get.mockResolvedValue({ 
      id: '1', 
      content: 'existing content\n',
      title: 'Test'
    })
    mockDb.put.mockResolvedValue(undefined)
    
    const result = await insertEnd('1', 'new content')
    
    expect(result.success).toBe(true)
    expect(result.newContent).toBe('existing content\nnew content')
  })

  it('should handle empty document', async () => {
    mockDb.get.mockResolvedValue({ 
      id: '1', 
      content: '',
      title: 'Test'
    })
    mockDb.put.mockResolvedValue(undefined)
    
    const result = await insertEnd('1', 'new content')
    
    expect(result.success).toBe(true)
    expect(result.newContent).toBe('new content')
  })
})

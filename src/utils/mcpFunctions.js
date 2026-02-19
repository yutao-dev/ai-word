import {
  getAllDocuments,
  getDocumentById,
  deleteByRange,
  deleteAndSwap,
  insertEnd,
  saveDocument,
  updateDocumentContent
} from './db'

const transactionStack = []

export const startTransaction = () => {
  transactionStack.push([])
}

export const commitTransaction = () => {
  if (transactionStack.length > 0) {
    transactionStack.pop()
  }
}

export const rollbackTransaction = async () => {
  if (transactionStack.length > 0) {
    const operations = transactionStack[transactionStack.length - 1]
    for (let i = operations.length - 1; i >= 0; i--) {
      const op = operations[i]
      if (op.type === 'update' && op.originalContent !== undefined) {
        await saveDocument({ ...op.doc, content: op.originalContent })
      }
    }
    transactionStack.pop()
  }
}

const recordOperation = (op) => {
  if (transactionStack.length > 0) {
    transactionStack[transactionStack.length - 1].push(op)
  }
}

export const MCP_FUNCTIONS = {
  getAllDocument: {
    name: 'getAllDocument',
    description: '获取系统中所有文档的元数据信息，包括文档ID、创建时间、更新时间等',
    parameters: [],
    execute: async () => {
      try {
        const docs = await getAllDocuments()
        const metadata = docs.map(doc => ({
          id: doc.id,
          title: doc.title,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        }))
        return { success: true, data: metadata }
      } catch (error) {
        console.error('getAllDocument error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  getDocumentById: {
    name: 'getDocumentById',
    description: '根据文档ID获取完整文档内容，返回MarkDown格式的详细内容',
    parameters: [
      { name: 'id', type: 'string', description: '文档ID' }
    ],
    execute: async (id) => {
      try {
        if (!id || typeof id !== 'string') {
          return { success: false, error: '文档ID不能为空且必须是字符串' }
        }
        const doc = await getDocumentById(id)
        if (!doc) {
          return { success: false, error: '文档不存在' }
        }
        return { success: true, data: doc }
      } catch (error) {
        console.error('getDocumentById error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  deleteByRange: {
    name: 'deleteByRange',
    description: '删除指定文档中从start行到end行的内容',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'start', type: 'string', description: '起始行号（从1开始）' },
      { name: 'end', type: 'string', description: '结束行号' }
    ],
    execute: async (docId, start, end) => {
      try {
        if (!docId || typeof docId !== 'string') {
          return { success: false, error: '文档ID不能为空且必须是字符串' }
        }
        if (!start || !end) {
          return { success: false, error: '起始行号和结束行号不能为空' }
        }
        const result = await deleteByRange(docId, start, end)
        if (result.success) {
          recordOperation({
            type: 'update',
            doc: result.doc,
            originalContent: result.originalContent
          })
        }
        return result
      } catch (error) {
        console.error('deleteByRange error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  deleteAndSwap: {
    name: 'deleteAndSwap',
    description: '删除指定文档中从deleteStart行到deleteEnd行的内容，并替换为swapMarkdownStr',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'deleteStart', type: 'string', description: '删除起始行号' },
      { name: 'deleteEnd', type: 'string', description: '删除结束行号' },
      { name: 'swapMarkdownStr', type: 'string', description: '替换的MarkDown文本' }
    ],
    execute: async (docId, deleteStart, deleteEnd, swapMarkdownStr) => {
      try {
        if (!docId || typeof docId !== 'string') {
          return { success: false, error: '文档ID不能为空且必须是字符串' }
        }
        if (!deleteStart || !deleteEnd) {
          return { success: false, error: '起始行号和结束行号不能为空' }
        }
        const result = await deleteAndSwap(docId, deleteStart, deleteEnd, swapMarkdownStr)
        if (result.success) {
          recordOperation({
            type: 'update',
            doc: result.doc,
            originalContent: result.originalContent
          })
        }
        return result
      } catch (error) {
        console.error('deleteAndSwap error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  insertEnd: {
    name: 'insertEnd',
    description: '在指定文档末尾追加MarkDown格式内容',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'markdownStr', type: 'string', description: '要追加的MarkDown文本' }
    ],
    execute: async (docId, markdownStr) => {
      try {
        if (!docId || typeof docId !== 'string') {
          return { success: false, error: '文档ID不能为空且必须是字符串' }
        }
        const result = await insertEnd(docId, markdownStr)
        if (result.success) {
          recordOperation({
            type: 'update',
            doc: result.doc,
            originalContent: result.originalContent
          })
        }
        return result
      } catch (error) {
        console.error('insertEnd error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  updateDocumentContent: {
    name: 'updateDocumentContent',
    description: '直接更新指定文档的完整内容，用于写入总结、改写等操作',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'newContent', type: 'string', description: '新的MarkDown完整内容' }
    ],
    execute: async (docId, newContent) => {
      try {
        if (!docId || typeof docId !== 'string') {
          return { success: false, error: '文档ID不能为空且必须是字符串' }
        }
        const result = await updateDocumentContent(docId, newContent)
        if (result.success) {
          recordOperation({
            type: 'update',
            doc: result.doc,
            originalContent: result.originalContent
          })
        }
        return result
      } catch (error) {
        console.error('updateDocumentContent error:', error)
        return { success: false, error: error.message }
      }
    }
  }
}

export const generateFunctionDocumentation = () => {
  let md = '# 文档操作函数接口说明\n\n'
  
  Object.values(MCP_FUNCTIONS).forEach(func => {
    md += `## ${func.name}\n\n`
    md += `${func.description}\n\n`
    if (func.parameters.length > 0) {
      md += '### 参数说明\n\n'
      md += '| 参数名 | 类型 | 描述 |\n'
      md += '|--------|------|------|\n'
      func.parameters.forEach(param => {
        md += `| ${param.name} | ${param.type} | ${param.description} |\n`
      })
      md += '\n'
    }
    md += '---\n\n'
  })
  
  return md
}

export const executeFunction = async (functionName, args = []) => {
  console.log('[MCP] executeFunction called:', { functionName, args })
  const func = MCP_FUNCTIONS[functionName]
  if (!func) {
    console.log('[MCP] Function not found:', functionName)
    return { success: false, error: `未知函数: ${functionName}` }
  }
  console.log('[MCP] Executing function:', functionName, 'with args:', args)
  const result = await func.execute(...args)
  console.log('[MCP] Function result:', result)
  return result
}

export const parseAndExecute = async (jsonStr) => {
  console.log('[MCP] parseAndExecute called with:', jsonStr)
  try {
    const parsed = JSON.parse(jsonStr)
    console.log('[MCP] Parsed JSON:', parsed)
    if (!parsed.option) {
      console.log('[MCP] Missing option field')
      return { success: false, error: 'JSON中缺少option字段' }
    }
    return await executeFunction(parsed.option, parsed.args || [])
  } catch (error) {
    console.error('Parse and execute error:', error)
    return { success: false, error: `JSON解析失败: ${error.message}` }
  }
}

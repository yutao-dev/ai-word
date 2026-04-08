import { documentApi, tokenUsageApi } from '../services/api'

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
        await documentApi.updateContent(op.docId, op.originalContent)
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
  createDocument: {
    name: 'createDocument',
    description: '创建一个新文档，可指定标题和初始内容',
    parameters: [
      { name: 'title', type: 'string', description: '文档标题' },
      { name: 'content', type: 'string', description: '文档初始内容（可选，默认为空）', optional: true }
    ],
    execute: async (title, content = '') => {
      try {
        if (!title || typeof title !== 'string') {
          return { success: false, error: '文档标题不能为空且必须是字符串' }
        }
        const doc = await documentApi.create({ title, content })
        return { 
          success: true, 
          data: doc,
          message: `文档 "${title}" 创建成功`
        }
      } catch (error) {
        console.error('createDocument error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  getAllDocument: {
    name: 'getAllDocument',
    description: '获取系统中所有文档的元数据信息，包括文档ID、创建时间、更新时间等',
    parameters: [],
    execute: async () => {
      try {
        const docs = await documentApi.getAll()
        const metadata = docs.map(doc => ({
          id: doc.id,
          title: doc.title,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at
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
        const doc = await documentApi.getById(id)
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
        const startNum = parseInt(start, 10)
        const endNum = parseInt(end, 10)
        const result = await documentApi.deleteByRange(docId, startNum, endNum)
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return {
          success: result.success,
          doc: result.doc,
          originalContent: result.original_content,
          newContent: result.new_content,
          error: result.error
        }
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
        const startNum = parseInt(deleteStart, 10)
        const endNum = parseInt(deleteEnd, 10)
        const result = await documentApi.deleteAndSwap(docId, startNum, endNum, swapMarkdownStr)
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return {
          success: result.success,
          doc: result.doc,
          originalContent: result.original_content,
          newContent: result.new_content,
          error: result.error
        }
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
        const result = await documentApi.insertEnd(docId, markdownStr)
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return {
          success: result.success,
          doc: result.doc,
          originalContent: result.original_content,
          newContent: result.new_content,
          error: result.error
        }
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
        const result = await documentApi.updateContent(docId, newContent)
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return {
          success: result.success,
          doc: result.doc,
          originalContent: result.original_content,
          newContent: result.new_content,
          error: result.error
        }
      } catch (error) {
        console.error('updateDocumentContent error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  searchInDocument: {
    name: 'searchInDocument',
    description: '在指定文档中搜索关键词，返回匹配位置和上下文',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'keyword', type: 'string', description: '搜索关键词' },
      { name: 'caseSensitive', type: 'string', description: '是否区分大小写（true/false）', optional: true },
      { name: 'useRegex', type: 'string', description: '是否使用正则表达式（true/false）', optional: true },
      { name: 'contextLines', type: 'string', description: '上下文行数（默认2）', optional: true }
    ],
    execute: async (docId, keyword, caseSensitive = 'false', useRegex = 'false', contextLines = '2') => {
      try {
        if (!docId || !keyword) {
          return { success: false, error: '文档ID和关键词不能为空' }
        }
        const result = await documentApi.search(docId, keyword, {
          caseSensitive: caseSensitive === 'true',
          useRegex: useRegex === 'true',
          contextLines: parseInt(contextLines, 10) || 2
        })
        return result
      } catch (error) {
        console.error('searchInDocument error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  findAndReplace: {
    name: 'findAndReplace',
    description: '在指定文档中查找并替换文本',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'findText', type: 'string', description: '要查找的文本' },
      { name: 'replaceText', type: 'string', description: '替换后的文本' },
      { name: 'replaceAll', type: 'string', description: '是否替换所有匹配（true/false，默认false只替换第一个）', optional: true },
      { name: 'caseSensitive', type: 'string', description: '是否区分大小写（true/false）', optional: true }
    ],
    execute: async (docId, findText, replaceText, replaceAll = 'false', caseSensitive = 'false') => {
      try {
        if (!docId || !findText) {
          return { success: false, error: '文档ID和查找文本不能为空' }
        }
        const result = await documentApi.findReplace(docId, findText, replaceText, {
          replaceAll: replaceAll === 'true',
          caseSensitive: caseSensitive === 'true'
        })
        if (result.success && result.replacements_made > 0) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return result
      } catch (error) {
        console.error('findAndReplace error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  getDocumentOutline: {
    name: 'getDocumentOutline',
    description: '获取指定文档的大纲结构（标题树）',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' }
    ],
    execute: async (docId) => {
      try {
        if (!docId) {
          return { success: false, error: '文档ID不能为空' }
        }
        const result = await documentApi.getOutline(docId)
        return result
      } catch (error) {
        console.error('getDocumentOutline error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  getSectionByHeading: {
    name: 'getSectionByHeading',
    description: '根据标题获取文档中指定章节的内容',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'headingText', type: 'string', description: '标题文本（支持模糊匹配）' }
    ],
    execute: async (docId, headingText) => {
      try {
        if (!docId || !headingText) {
          return { success: false, error: '文档ID和标题不能为空' }
        }
        const result = await documentApi.getSection(docId, headingText)
        return result
      } catch (error) {
        console.error('getSectionByHeading error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  insertAfterHeading: {
    name: 'insertAfterHeading',
    description: '在指定标题后插入内容',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'headingText', type: 'string', description: '标题文本' },
      { name: 'content', type: 'string', description: '要插入的内容' },
      { name: 'headingLevel', type: 'string', description: '标题级别（1-6，可选）', optional: true }
    ],
    execute: async (docId, headingText, content, headingLevel = null) => {
      try {
        if (!docId || !headingText || !content) {
          return { success: false, error: '文档ID、标题和内容不能为空' }
        }
        const result = await documentApi.insertAfterHeading(docId, headingText, content, headingLevel ? parseInt(headingLevel, 10) : null)
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return result
      } catch (error) {
        console.error('insertAfterHeading error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  insertAt: {
    name: 'insertAt',
    description: '在指定位置插入内容（支持行号、标题、关键词定位）',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'positionType', type: 'string', description: '位置类型：line/heading/keyword/start/end' },
      { name: 'positionValue', type: 'string', description: '位置值（行号/标题/关键词）' },
      { name: 'content', type: 'string', description: '要插入的内容' }
    ],
    execute: async (docId, positionType, positionValue, content) => {
      try {
        if (!docId || !positionType || !content) {
          return { success: false, error: '文档ID、位置类型和内容不能为空' }
        }
        const validTypes = ['line', 'heading', 'keyword', 'start', 'end']
        if (!validTypes.includes(positionType)) {
          return { success: false, error: `无效的位置类型：${positionType}` }
        }
        const result = await documentApi.insertAt(docId, positionType, positionValue, content)
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return result
      } catch (error) {
        console.error('insertAt error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  insertParagraph: {
    name: 'insertParagraph',
    description: '智能段落插入（自动处理空行、缩进）',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'content', type: 'string', description: '要插入的段落内容' },
      { name: 'afterLine', type: 'string', description: '在指定行后插入（可选）', optional: true },
      { name: 'beforeLine', type: 'string', description: '在指定行前插入（可选）', optional: true }
    ],
    execute: async (docId, content, afterLine = null, beforeLine = null) => {
      try {
        if (!docId || !content) {
          return { success: false, error: '文档ID和内容不能为空' }
        }
        const result = await documentApi.insertParagraph(docId, content, {
          afterLine: afterLine ? parseInt(afterLine, 10) : undefined,
          beforeLine: beforeLine ? parseInt(beforeLine, 10) : undefined
        })
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return result
      } catch (error) {
        console.error('insertParagraph error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  getDocumentStats: {
    name: 'getDocumentStats',
    description: '获取文档统计信息（字数、段落数、标题数、阅读时间等）',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' }
    ],
    execute: async (docId) => {
      try {
        if (!docId) {
          return { success: false, error: '文档ID不能为空' }
        }
        const result = await documentApi.getStats(docId)
        return result
      } catch (error) {
        console.error('getDocumentStats error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  extractKeyInfo: {
    name: 'extractKeyInfo',
    description: '提取文档中的关键信息（链接、图片、代码块、表格、标题）',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'extractType', type: 'string', description: '提取类型：links/images/code/tables/headings' }
    ],
    execute: async (docId, extractType) => {
      try {
        if (!docId || !extractType) {
          return { success: false, error: '文档ID和提取类型不能为空' }
        }
        const validTypes = ['links', 'images', 'code', 'tables', 'headings']
        if (!validTypes.includes(extractType)) {
          return { success: false, error: `无效的提取类型：${extractType}` }
        }
        const result = await documentApi.extract(docId, extractType)
        return result
      } catch (error) {
        console.error('extractKeyInfo error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  batchOperations: {
    name: 'batchOperations',
    description: '批量执行多个文档操作（事务性）',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'operations', type: 'string', description: '操作列表（JSON数组格式）', optional: true },
      { name: 'stopOnError', type: 'string', description: '遇错是否停止（true/false）', optional: true }
    ],
    execute: async (docId, operations, stopOnError = 'false') => {
      try {
        if (!docId) {
          return { success: false, error: '文档ID不能为空' }
        }
        let ops = []
        if (typeof operations === 'string') {
          try {
            ops = JSON.parse(operations)
          } catch {
            return { success: false, error: '操作列表必须是有效的JSON数组' }
          }
        } else if (Array.isArray(operations)) {
          ops = operations
        } else {
          return { success: false, error: '操作列表格式无效' }
        }
        const result = await documentApi.batchOperations(docId, ops, stopOnError === 'true')
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.final_content
          })
        }
        return result
      } catch (error) {
        console.error('batchOperations error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  moveSection: {
    name: 'moveSection',
    description: '移动文档中的章节到指定位置',
    parameters: [
      { name: 'docId', type: 'string', description: '文档ID' },
      { name: 'fromHeading', type: 'string', description: '源章节标题' },
      { name: 'toPosition', type: 'string', description: '目标位置类型：line/heading/start/end' },
      { name: 'toPositionValue', type: 'string', description: '目标位置值' }
    ],
    execute: async (docId, fromHeading, toPosition, toPositionValue) => {
      try {
        if (!docId || !fromHeading || !toPosition) {
          return { success: false, error: '文档ID、源标题和目标位置不能为空' }
        }
        const validTypes = ['line', 'heading', 'start', 'end']
        if (!validTypes.includes(toPosition)) {
          return { success: false, error: `无效的位置类型：${toPosition}` }
        }
        const result = await documentApi.moveSection(docId, fromHeading, toPosition, toPositionValue)
        if (result.success) {
          recordOperation({
            type: 'update',
            docId: docId,
            originalContent: result.original_content
          })
        }
        return result
      } catch (error) {
        console.error('moveSection error:', error)
        return { success: false, error: error.message }
      }
    }
  },

  getTokenUsage: {
    name: 'getTokenUsage',
    description: '获取Token使用统计信息',
    parameters: [
      { name: 'workflowId', type: 'string', description: '工作流ID（可选，不填则返回全局统计）', optional: true }
    ],
    execute: async (workflowId = null) => {
      try {
        const result = workflowId 
          ? await documentApi.getByWorkflowTokenUsage(workflowId)
          : await tokenUsageApi.getStats()
        return result
      } catch (error) {
        console.error('getTokenUsage error:', error)
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

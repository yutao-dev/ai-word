import { 
  generateFunctionDocumentation, 
  parseAndExecute, 
  startTransaction, 
  commitTransaction, 
  rollbackTransaction,
  MCP_FUNCTIONS
} from './mcpFunctions'

const WORKFLOW_STATES = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  ANALYZING: 'analyzing',
  EXECUTING: 'executing',
  SUMMARIZING: 'summarizing',
  COMPLETED: 'completed',
  ERROR: 'error',
  PENDING_CONFIRMATION: 'pending_confirmation'
}

class WorkflowLogger {
  constructor() {
    this.logs = []
  }

  log(level, message, data = null) {
    const entry = {
      timestamp: Date.now(),
      level,
      message,
      data
    }
    this.logs.push(entry)
    console.log(`[${level.toUpperCase()}] ${message}`, data || '')
  }

  info(message, data) { this.log('info', message, data) }
  warn(message, data) { this.log('warn', message, data) }
  error(message, data) { this.log('error', message, data) }

  getLogs() {
    return [...this.logs]
  }

  clear() {
    this.logs = []
  }
}

export class AIWorkflow {
  constructor(options = {}) {
    this.state = WORKFLOW_STATES.IDLE
    this.logger = new WorkflowLogger()
    this.currentTask = null
    this.operationHistory = []
    this.decisions = []
    this.currentDocContent = null
    this.originalDocContent = null
    this.aiSummary = null
    this.allDocumentsMeta = null
    this.readDocuments = new Map()
    this.maxIterations = options.maxIterations || 30
    this.maxRetries = options.maxRetries || 3
    this.retryCount = 0
    this.lastFailedOperation = null
    this.isSummaryTask = false
    this.taskPlan = null
    this.completedTaskIds = new Set()
    this.currentTaskIndex = 0
    this.onStateChange = options.onStateChange || (() => {})
    this.onLog = options.onLog || (() => {})
    this.onOperation = options.onOperation || (() => {})
    this.onDecision = options.onDecision || (() => {})
    this.onSummary = options.onSummary || (() => {})
    this.onPendingConfirmation = options.onPendingConfirmation || (() => {})
    this.onAISummary = options.onAISummary || (() => {})
    this.onTaskPlan = options.onTaskPlan || (() => {})
    this.onTaskUpdate = options.onTaskUpdate || (() => {})
    this.llmCaller = options.llmCaller || null
  }

  setState(newState) {
    this.state = newState
    this.onStateChange(newState)
  }

  async initialize() {
    this.setState(WORKFLOW_STATES.INITIALIZING)
    this.logger.info('Initializing AI workflow')
    
    const docs = generateFunctionDocumentation()
    this.logger.info('Function documentation generated', docs)
    
    this.setState(WORKFLOW_STATES.IDLE)
    return docs
  }

  async startTask(userRequest, docId, originalContent) {
    this.logger.clear()
    this.operationHistory = []
    this.decisions = []
    this.currentDocContent = null
    this.originalDocContent = originalContent || null
    this.allDocumentsMeta = null
    this.readDocuments = new Map()
    this.retryCount = 0
    this.lastFailedOperation = null
    this.isSummaryTask = userRequest.includes('总结') || userRequest.includes('summary')
    this.taskPlan = null
    this.completedTaskIds = new Set()
    this.currentTaskIndex = 0
    this.currentTask = {
      userRequest,
      docId,
      startTime: Date.now(),
      iterations: 0
    }

    this.logger.info('Starting new task', { userRequest, docId })
    
    this.setState(WORKFLOW_STATES.INITIALIZING)
    
    try {
      startTransaction()
      
      this.generateTaskPlan(userRequest, docId).catch(err => {
        this.logger.warn('Task plan generation failed, continuing without plan', err)
      })
      
      await this.runWorkflow()
    } catch (error) {
      this.logger.error('Workflow error', error)
      await rollbackTransaction()
      this.setState(WORKFLOW_STATES.ERROR)
      throw error
    }
  }

  markTaskComplete(taskId) {
    if (!this.completedTaskIds.has(taskId)) {
      this.completedTaskIds.add(taskId)
      this.logger.info('Task marked as complete', { taskId })
      
      if (this.taskPlan) {
        const task = this.taskPlan.tasks.find(t => t.id === taskId)
        if (task) {
          task.isComplete = true
          this.onTaskUpdate(this.taskPlan)
        }
      }
    }
  }

  areAllTasksComplete() {
    if (!this.taskPlan || !this.taskPlan.tasks) {
      return false
    }
    return this.taskPlan.tasks.every(task => this.completedTaskIds.has(task.id))
  }

  getTaskPlanWithStatus() {
    if (!this.taskPlan) {
      return null
    }
    return {
      ...this.taskPlan,
      tasks: this.taskPlan.tasks.map(task => ({
        ...task,
        isComplete: this.completedTaskIds.has(task.id)
      }))
    }
  }

  async runWorkflow() {
    const { userRequest, docId } = this.currentTask

    while (this.currentTask.iterations < this.maxIterations) {
      this.currentTask.iterations++
      this.logger.info(`Iteration ${this.currentTask.iterations}/${this.maxIterations}`)

      if (this.areAllTasksComplete()) {
        this.logger.info('All tasks in plan are complete, validating final result...')
        const validationResult = await this.validateRequirements(userRequest, docId)
        
        if (!validationResult.needsMoreWork) {
          const decision = {
            iteration: this.currentTask.iterations,
            type: 'complete',
            reason: '所有任务已完成且验证通过',
            message: validationResult.reason
          }
          this.decisions.push(decision)
          this.onDecision(decision)
          break
        } else {
          this.logger.info('Validation shows more work needed, continuing...', validationResult)
        }
      }

      this.setState(WORKFLOW_STATES.ANALYZING)
      const analysisResult = await this.analyzeRequest(userRequest, docId)
      this.logger.info('Analysis complete', analysisResult)

      const decision = {
        iteration: this.currentTask.iterations,
        type: analysisResult.needsAction ? 'action' : 'complete',
        message: analysisResult.message,
        operation: analysisResult.operation
      }
      this.decisions.push(decision)
      this.onDecision(decision)

      if (!analysisResult.needsAction) {
        if (this.shouldForceContinueForSummaryTask()) {
          this.logger.info('Summary task not actually complete, forcing continue')
          const forceOperation = {
            option: 'updateDocumentContent',
            args: [docId, this.generateSummaryFromReadDocs()]
          }
          const forceDecision = {
            iteration: this.currentTask.iterations,
            type: 'action',
            message: '总结任务尚未完成写入操作，继续执行',
            operation: forceOperation
          }
          this.decisions.push(forceDecision)
          this.onDecision(forceDecision)
          
          this.setState(WORKFLOW_STATES.EXECUTING)
          const forceResult = await this.executeOperation(forceOperation)
          forceResult.operation = forceOperation
          this.operationHistory.push(forceResult)
          this.onOperation(forceResult)
          
          this.logger.info('Force write result', {
            success: forceResult.success,
            hasDoc: !!forceResult.doc,
            hasNewContent: forceResult.newContent !== undefined,
            docContentLength: forceResult.doc?.content?.length,
            newContentLength: forceResult.newContent?.length,
            error: forceResult.error
          })
          
          if (forceResult.success) {
            if (forceResult.newContent !== undefined) {
              this.currentDocContent = forceResult.newContent
            } else if (forceResult.doc && forceResult.doc.content !== undefined) {
              this.currentDocContent = forceResult.doc.content
            } else if (forceResult.data) {
              if (forceResult.data.content !== undefined) {
                this.currentDocContent = forceResult.data.content
              } else if (forceResult.data.doc && forceResult.data.doc.content !== undefined) {
                this.currentDocContent = forceResult.data.doc.content
              }
            }
            this.logger.info('Force write updated currentDocContent', { 
              contentLength: this.currentDocContent?.length || 0 
            })
          }
        }
        break
      }

      this.setState(WORKFLOW_STATES.EXECUTING)
      const executionResult = await this.executeOperation(analysisResult.operation)
      this.operationHistory.push(executionResult)
      
      this.tryMarkRelevantTaskComplete(analysisResult.operation, executionResult)
      
      if (executionResult.success) {
        if (executionResult.newContent !== undefined) {
          this.currentDocContent = executionResult.newContent
          this.logger.info('Updated currentDocContent from newContent', { contentLength: this.currentDocContent.length })
        } else if (executionResult.doc && executionResult.doc.content !== undefined) {
          this.currentDocContent = executionResult.doc.content
          this.logger.info('Updated currentDocContent from doc', { contentLength: this.currentDocContent.length })
        } else if (executionResult.data) {
          if (Array.isArray(executionResult.data)) {
            this.allDocumentsMeta = executionResult.data
            this.logger.info('Saved allDocumentsMeta', { count: executionResult.data.length })
          } else if (executionResult.data.id && executionResult.data.content !== undefined) {
            this.readDocuments.set(executionResult.data.id, executionResult.data)
            this.logger.info('Saved document to readDocuments', { 
              docId: executionResult.data.id, 
              title: executionResult.data.title,
              contentLength: executionResult.data.content?.length,
              totalReadDocs: this.readDocuments.size
            })
            console.log('[AIWorkflow] Document saved to readDocuments:', {
              id: executionResult.data.id,
              title: executionResult.data.title,
              readDocumentsKeys: Array.from(this.readDocuments.keys())
            })
            if (!this.currentDocContent) {
              this.currentDocContent = executionResult.data.content
              this.logger.info('Also set as currentDocContent')
            }
          } else if (executionResult.data.content !== undefined) {
            this.currentDocContent = executionResult.data.content
            this.logger.info('Updated currentDocContent from data.content', { contentLength: this.currentDocContent.length })
          } else if (executionResult.data.doc && executionResult.data.doc.content !== undefined) {
            this.currentDocContent = executionResult.data.doc.content
            this.logger.info('Updated currentDocContent from data.doc', { contentLength: this.currentDocContent.length })
          }
        }
        this.retryCount = 0
        this.lastFailedOperation = null
      } else {
        const isLineError = executionResult.error && 
                            (executionResult.error.includes('行号超出') || 
                             executionResult.error.includes('line out of range') ||
                             executionResult.error.includes('invalid line'))
        
        const isParamError = executionResult.error && 
                           (executionResult.error.includes('参数') || 
                            executionResult.error.includes('参数不足'))
        
        if (isLineError || isParamError) {
          this.retryCount++
          this.lastFailedOperation = analysisResult.operation
          
          const errorType = isLineError ? '行号错误' : '参数错误'
          this.logger.warn(`${errorType} detected, checking retry count`, { 
            retryCount: this.retryCount, 
            maxRetries: this.maxRetries,
            error: executionResult.error
          })
          
          if (this.retryCount < this.maxRetries) {
            const retryDecision = {
              iteration: this.currentTask.iterations,
              type: 'retry',
              reason: `${errorType}，重试 (${this.retryCount}/${this.maxRetries})`,
              error: executionResult.error,
              retryCount: this.retryCount
            }
            this.decisions.push(retryDecision)
            this.onDecision(retryDecision)
            
            this.currentTask.iterations--
            continue
          } else {
            this.logger.error('Max retries reached, rolling back transaction')
            
            const failDecision = {
              iteration: this.currentTask.iterations,
              type: 'operation_failed',
              reason: `${errorType}，已重试${this.maxRetries}次，回退所有操作`,
              error: executionResult.error,
              retryCount: this.retryCount
            }
            this.decisions.push(failDecision)
            this.onDecision(failDecision)
            
            await rollbackTransaction()
            this.setState(WORKFLOW_STATES.ERROR)
            return
          }
        } else {
          this.logger.error('Operation failed', executionResult.error)
          break
        }
      }
      
      this.onOperation(executionResult)
      this.logger.info('Operation executed', executionResult)

      if (analysisResult.isComplete) {
        break
      }
    }

    await this.summarize()
    
    this.logger.info('Workflow finished, checking for content changes', {
      hasOriginalContent: !!this.originalDocContent,
      hasCurrentContent: !!this.currentDocContent,
      originalLength: this.originalDocContent?.length,
      currentLength: this.currentDocContent?.length,
      hasChanges: this.hasContentChanges()
    })
    
    if (this.hasContentChanges()) {
      this.setState(WORKFLOW_STATES.PENDING_CONFIRMATION)
      this.onPendingConfirmation({
        originalContent: this.originalDocContent,
        modifiedContent: this.currentDocContent
      })
      this.logger.info('Pending confirmation set', {
        originalPreview: this.originalDocContent?.substring(0, 100),
        modifiedPreview: this.currentDocContent?.substring(0, 100)
      })
    } else {
      commitTransaction()
      this.setState(WORKFLOW_STATES.COMPLETED)
    }
  }

  tryMarkRelevantTaskComplete(operation, executionResult) {
    if (!this.taskPlan || !executionResult.success) {
      return
    }

    const operationType = operation?.option
    const incompleteTasks = this.taskPlan.tasks.filter(t => !this.completedTaskIds.has(t.id))
    
    if (incompleteTasks.length === 0) {
      return
    }

    const firstIncomplete = incompleteTasks[0]
    
    if (operationType === 'getAllDocument' || operationType === 'getDocumentById') {
      if (firstIncomplete.type === 'read') {
        this.markTaskComplete(firstIncomplete.id)
      }
    } else if (operationType === 'insertEnd' || operationType === 'deleteAndSwap' || 
               operationType === 'deleteByRange' || operationType === 'updateDocumentContent') {
      if (firstIncomplete.type === 'write' || firstIncomplete.type === 'edit') {
        this.markTaskComplete(firstIncomplete.id)
      }
    }
  }

  hasContentChanges() {
    if (!this.originalDocContent || !this.currentDocContent) {
      return false
    }
    return this.originalDocContent !== this.currentDocContent
  }

  async validateRequirements(userRequest, docId) {
    if (!this.llmCaller) {
      return { needsMoreWork: false, reason: 'LLM caller not configured' }
    }

    if (!this.currentDocContent) {
      return { needsMoreWork: true, reason: '尚未获取文档内容，需要继续工作' }
    }

    const prompt = this.buildValidationPrompt(userRequest)
    try {
      this.setState(WORKFLOW_STATES.ANALYZING)
      const response = await this.llmCaller(prompt)
      return this.parseValidationResponse(response)
    } catch (error) {
      this.logger.error('Failed to validate requirements', error)
      return { needsMoreWork: false, reason: '验证失败，终止工作流' }
    }
  }

  buildValidationPrompt(userRequest) {
    return `
请检查当前文档内容是否满足用户的需求。

用户需求: ${userRequest}

当前文档内容:
\`\`\`
${this.currentDocContent}
\`\`\`

请分析：
1. 用户的需求是否已经完全满足？
2. 如果没有满足，还需要做什么修改？

请输出JSON格式的回答：
{
  "needsMoreWork": true/false,
  "reason": "简短说明原因",
  "suggestion": "如果需要继续工作，请简要说明还需要做什么"
}

要求：
- 如果需求已完全满足，needsMoreWork设为false
- 如果需求未满足或还有改进空间，needsMoreWork设为true
- 直接输出JSON，不要包含其他文字说明
`
  }

  extractAndFixJson(response) {
    let jsonStr = null
    
    try {
      const firstBrace = response.indexOf('{')
      const lastBrace = response.lastIndexOf('}')
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = response.substring(firstBrace, lastBrace + 1)
        
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
        jsonStr = jsonStr.replace(/\n/g, ' ')
        jsonStr = jsonStr.replace(/\r/g, '')
        jsonStr = jsonStr.replace(/\.\.\./g, '')
        
        let inString = false
        let escapeNext = false
        let result = ''
        let bracketStack = []
        let lastNonSpaceChar = ''
        
        for (let i = 0; i < jsonStr.length; i++) {
          const char = jsonStr[i]
          
          if (escapeNext) {
            result += char
            escapeNext = false
            if (char !== ' ' && char !== '\t') {
              lastNonSpaceChar = char
            }
            continue
          }
          
          if (char === '\\') {
            result += char
            escapeNext = true
            continue
          }
          
          if (char === '"') {
            inString = !inString
            result += char
            lastNonSpaceChar = char
            continue
          }
          
          if (!inString) {
            if (char === '{' || char === '[') {
              bracketStack.push(char)
              result += char
              lastNonSpaceChar = char
              continue
            }
            
            if (char === '}' || char === ']') {
              if (lastNonSpaceChar === ',') {
                result = result.slice(0, -1)
              }
              bracketStack.pop()
              result += char
              lastNonSpaceChar = char
              continue
            }
            
            if (char === ',') {
              if (lastNonSpaceChar === '{' || lastNonSpaceChar === '[' || lastNonSpaceChar === ',') {
                continue
              }
              result += char
              lastNonSpaceChar = char
              continue
            }
            
            if (char === ' ' || char === '\t') {
              continue
            }
            
            result += char
            lastNonSpaceChar = char
          } else {
            result += char
            if (char !== ' ' && char !== '\t') {
              lastNonSpaceChar = char
            }
          }
        }
        
        while (bracketStack.length > 0) {
          const bracket = bracketStack.pop()
          result += (bracket === '{' ? '}' : ']')
        }
        
        if (inString) {
          result += '"'
        }
        
        return result
      }
    } catch (e) {
      this.logger.error('Error extracting JSON', e)
    }
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        return jsonMatch[0]
      }
    } catch (e) {
      this.logger.error('Fallback JSON extraction failed', e)
    }
    
    return null
  }

  parseValidationResponse(response) {
    try {
      let jsonStr = this.extractAndFixJson(response)
      if (jsonStr) {
        try {
          const result = JSON.parse(jsonStr)
          return {
            needsMoreWork: !!result.needsMoreWork,
            reason: result.reason || '验证完成'
          }
        } catch (parseError) {
          this.logger.warn('Validation JSON parse failed, trying fallback parsing', { jsonStr, error: parseError })
          return this.fallbackParseValidation(response)
        }
      }
      return this.fallbackParseValidation(response)
    } catch (error) {
      this.logger.error('Parse validation error', error)
      return { needsMoreWork: false, reason: '验证解析失败，终止工作流' }
    }
  }

  fallbackParseValidation(response) {
    this.logger.info('Using fallback validation parsing')
    
    const lowerResponse = response.toLowerCase()
    
    const needsMoreWork = lowerResponse.includes('needsmorework": true') ||
                         lowerResponse.includes('needsmorework":true') ||
                         lowerResponse.includes('需要继续') ||
                         lowerResponse.includes('还需要') ||
                         lowerResponse.includes('未满足')
    
    return {
      needsMoreWork: needsMoreWork,
      reason: needsMoreWork ? '通过备用解析判断需要继续工作' : '通过备用解析判断任务已完成'
    }
  }

  async generateAISummary() {
    if (!this.llmCaller) {
      return null
    }

    const prompt = this.buildSummaryPrompt()
    try {
      this.setState(WORKFLOW_STATES.SUMMARIZING)
      const response = await this.llmCaller(prompt)
      return response
    } catch (error) {
      this.logger.error('Failed to generate AI summary', error)
      return null
    }
  }

  buildSummaryPrompt() {
    const operations = this.operationHistory
      .filter(op => op.success && !op.rejected)
      .map((op, i) => {
        if (op.newContent) {
          return `操作 ${i + 1}: 内容修改`
        }
        return `操作 ${i + 1}: ${op.success ? '成功' : '失败'}`
      })
      .join('\n')

    const contentDiff = this.hasContentChanges()
      ? `\n原始内容长度: ${this.originalDocContent?.length || 0} 字符\n修改后内容长度: ${this.currentDocContent?.length || 0} 字符`
      : '\n内容未发生变化'

    return `
请为以下 AI 工作流任务生成一段简洁的中文总结。

用户需求: ${this.currentTask?.userRequest || '未知'}
迭代次数: ${this.currentTask?.iterations || 0}
执行的操作数: ${this.operationHistory.length}

操作记录:
${operations || '无操作记录'}
${contentDiff}

请用 2-3 句话总结：
1. AI 完成了什么任务
2. 做了哪些主要修改
3. 最终结果如何

直接输出总结内容，不要包含其他说明。
`
  }

  async confirmChanges() {
    this.logger.info('Confirming changes', {
      hasContentChanges: this.hasContentChanges(),
      originalContentLength: this.originalDocContent?.length,
      currentContentLength: this.currentDocContent?.length
    })
    
    const aiSummary = await this.generateAISummary()
    if (aiSummary) {
      this.aiSummary = aiSummary
      if (this.onAISummary) {
        this.onAISummary(aiSummary)
      }
    }
    commitTransaction()
    this.setState(WORKFLOW_STATES.COMPLETED)
    this.logger.info('Changes confirmed and transaction committed')
  }

  rejectChanges() {
    rollbackTransaction()
    this.setState(WORKFLOW_STATES.IDLE)
  }

  async analyzeRequest(userRequest, docId) {
    if (this.llmCaller) {
      const prompt = this.buildAnalysisPrompt(userRequest, docId)
      this.logger.info('Sending prompt to LLM', { promptLength: prompt.length })
      const response = await this.llmCaller(prompt)
      this.logger.info('LLM response received', { response })
      return this.parseAnalysisResponse(response)
    }

    return {
      needsAction: false,
      message: 'LLM caller not configured',
      isComplete: true
    }
  }

  buildAnalysisPrompt(userRequest, docId) {
    const docs = generateFunctionDocumentation()
    const docContentSection = this.currentDocContent 
      ? `\n当前文档内容:\n\`\`\`\n${this.currentDocContent.substring(0, 2000)}${this.currentDocContent.length > 2000 ? '...(内容过长已截断)' : ''}\n\`\`\`\n`
      : '\n当前文档内容: 尚未获取，请先调用 getDocumentById 获取文档内容\n'
    
    let docsMetaSection = ''
    let unreadDocsList = []
    if (this.allDocumentsMeta && this.allDocumentsMeta.length > 0) {
      docsMetaSection = '\n=== 所有文档列表 ===\n'
      this.allDocumentsMeta.forEach((doc, index) => {
        const isRead = this.readDocuments.has(doc.id)
        const isCurrent = doc.id === docId
        docsMetaSection += `${index + 1}. ${doc.title} (ID: ${doc.id})${isRead ? ' [已读取]' : ''}${isCurrent ? ' [当前文档]' : ''}\n`
        if (!isRead && !isCurrent) {
          unreadDocsList.push(doc)
        }
      })
      docsMetaSection += '====================\n'
      docsMetaSection += `\n未读取的文档数量: ${unreadDocsList.length}\n`
      if (unreadDocsList.length > 0) {
        docsMetaSection += `下一个应该读取的文档: ${unreadDocsList[0].title} (ID: ${unreadDocsList[0].id})\n`
      }
    }
    
    let readDocsSection = ''
    if (this.readDocuments.size > 0) {
      readDocsSection = '\n=== 已读取的文档内容 ===\n'
      readDocsSection += `（已读取 ${this.readDocuments.size} 个文档，请勿重复读取）\n`
      this.readDocuments.forEach((doc, docId) => {
        readDocsSection += `\n--- 文档: ${doc.title} (ID: ${docId}) ---\n`
        readDocsSection += `${doc.content.substring(0, 1000)}${doc.content.length > 1000 ? '...(内容过长已截断)' : ''}\n`
      })
      readDocsSection += '\n========================\n'
    }
    
    const iterationInfo = `\n当前迭代次数: ${this.currentTask.iterations}/${this.maxIterations}\n`
    
    const isSummaryTask = userRequest.includes('总结') || userRequest.includes('summary')
    
    return `
你是一个高效的文档操作助手。请根据用户需求分析需要执行的操作。

可用的函数接口:
${docs}

用户需求: ${userRequest}
当前文档ID: ${docId}
${docContentSection}${docsMetaSection}${readDocsSection}${iterationInfo}
重要规则:
1. 如果已经获取了文档内容（上方已列出），请直接执行编辑操作，不要重复获取
2. 【非常重要】不要重复读取同一个文档！已读取的文档会在上方列出，并有 [已读取] 标记
3. 如果任务只需要一个操作就能完成，执行后立即设置 isComplete: true
4. 编辑操作后，如果用户需求已满足，立即标记任务完成
5. 不要进行不必要的重复操作
6. 行号从1开始计数
${isSummaryTask ? `
7. 【总结任务特殊规则】:
   - 第一步: 如果还没有文档列表，使用 getAllDocument 获取所有文档元信息
   - 第二步: 根据文档列表，用 getDocumentById 逐一读取【未读取】的文档（每次只读一个！）
   - 第三步: 当读取了足够的文档后，使用 updateDocumentContent 把总结写入当前文档
   - 总结完成后设置 isComplete: true
   - 【关键】每次只读取一个未读取的文档，不要重复读取已标记 [已读取] 的文档！
   - 【关键】查看上方"下一个应该读取的文档"提示，读取该文档
` : ''}

操作类型说明:
- getDocumentById: 获取单个文档内容（仅在未获取时使用！已读取的文档不要再读取！）
- getAllDocument: 获取所有文档的元信息列表（ID、标题等）
- insertEnd: 在文档末尾追加内容
- deleteAndSwap: 删除指定行并替换为新内容
- deleteByRange: 删除指定行范围
- updateDocumentContent: 直接更新整个文档内容（用于写入总结、改写等）

请输出JSON格式的决策:

如果需要执行操作:
{
  "message": "简短分析",
  "needsAction": true,
  "isComplete": false,
  "operation": {
    "option": "函数名",
    "args": ["参数1", "参数2", ...]
  }
}

如果任务已完成:
{
  "message": "任务完成说明",
  "needsAction": false,
  "isComplete": true
}
`
  }

  parseAnalysisResponse(response) {
    try {
      let jsonStr = this.extractAndFixJson(response)
      if (jsonStr) {
        try {
          return JSON.parse(jsonStr)
        } catch (parseError) {
          this.logger.warn('JSON parse failed, trying fallback parsing', { jsonStr, error: parseError })
          return this.fallbackParseAnalysis(response)
        }
      }
      return this.fallbackParseAnalysis(response)
    } catch (error) {
      this.logger.error('Parse analysis error', error)
      return { needsAction: false, message: '解析失败', isComplete: true }
    }
  }

  fallbackParseAnalysis(response) {
    this.logger.info('Using fallback analysis parsing')
    
    const lowerResponse = response.toLowerCase()
    
    const operationMatch = response.match(/"option"\s*:\s*"([^"]+)"/)
    const argsMatch = response.match(/"args"\s*:\s*(\[[^\]]*\])/)
    
    let operation = null
    let needsAction = false
    let isComplete = false
    
    if (operationMatch) {
      const optionName = operationMatch[1]
      operation = { option: optionName, args: [] }
      needsAction = true
      
      if (argsMatch) {
        try {
          operation.args = JSON.parse(argsMatch[1])
        } catch (e) {
          this.logger.warn('Failed to parse args in fallback, will try to infer args', e)
        }
      }
      
      operation = this.inferMissingArgs(operation)
    } else {
      const hasNeedsActionTrue = lowerResponse.includes('needsaction": true') || 
                                  lowerResponse.includes('needsaction":true')
      const hasIsCompleteTrue = lowerResponse.includes('iscomplete": true') ||
                                 lowerResponse.includes('iscomplete":true')
      
      if (hasIsCompleteTrue && !hasNeedsActionTrue) {
        isComplete = true
        needsAction = false
      } else if (hasNeedsActionTrue) {
        needsAction = true
        isComplete = false
      } else {
        const hasTaskComplete = lowerResponse.includes('任务完成') || lowerResponse.includes('需求已满足')
        const hasExecuteAction = lowerResponse.includes('需要执行') || lowerResponse.includes('执行操作')
        
        if (hasExecuteAction && !hasTaskComplete) {
          needsAction = true
        } else if (hasTaskComplete && !hasExecuteAction) {
          isComplete = true
        }
      }
    }
    
    return {
      needsAction: needsAction,
      isComplete: isComplete,
      message: '通过备用解析方式解析',
      operation: operation
    }
  }

  inferMissingArgs(operation) {
    if (!operation || !operation.option) {
      return operation
    }

    const { docId } = this.currentTask
    const func = MCP_FUNCTIONS[operation.option]
    if (!func) {
      return operation
    }

    const requiredParams = func.parameters || []
    const currentArgs = operation.args || []
    
    if (currentArgs.length >= requiredParams.length) {
      return operation
    }

    const newArgs = [...currentArgs]
    
    for (let i = currentArgs.length; i < requiredParams.length; i++) {
      const param = requiredParams[i]
      
      if (param.name === 'docId') {
        newArgs.push(docId)
        this.logger.info('Inferred docId parameter', { docId })
      } else if (param.name === 'newContent' && operation.option === 'updateDocumentContent') {
        const summary = this.generateSummaryFromReadDocs()
        if (summary) {
          newArgs.push(summary)
          this.logger.info('Generated and inferred newContent parameter')
        } else {
          this.logger.warn('Could not generate summary, cannot infer newContent')
          return operation
        }
      } else if (param.name === 'markdownStr' && operation.option === 'insertEnd') {
        const summary = this.generateSummaryFromReadDocs()
        if (summary) {
          newArgs.push(summary)
          this.logger.info('Generated and inferred markdownStr parameter')
        } else {
          this.logger.warn('Could not generate summary, cannot infer markdownStr')
          return operation
        }
      } else if (param.name === 'id' && operation.option === 'getDocumentById') {
        const unreadDoc = this.allDocumentsMeta?.find(doc => !this.readDocuments.has(doc.id))
        if (unreadDoc) {
          newArgs.push(unreadDoc.id)
          this.logger.info('Inferred id parameter for getDocumentById', { docId: unreadDoc.id })
        }
      }
    }
    
    return { ...operation, args: newArgs }
  }

  generateSummaryFromReadDocs() {
    if (this.readDocuments.size === 0) {
      return null
    }

    let summary = '# 文档总结\n\n'
    
    this.readDocuments.forEach((doc, docId) => {
      summary += `## ${doc.title}\n\n`
      const firstLines = doc.content.split('\n').slice(0, 10).join('\n')
      summary += firstLines
      if (doc.content.split('\n').length > 10) {
        summary += '\n...\n'
      }
      summary += '\n\n'
    })
    
    return summary
  }

  shouldForceContinueForSummaryTask() {
    if (!this.isSummaryTask) {
      return false
    }

    if (!this.allDocumentsMeta || this.allDocumentsMeta.length === 0) {
      this.logger.info('Summary task: no documents meta available')
      return false
    }

    const totalDocs = this.allDocumentsMeta.length
    const readDocs = this.readDocuments.size
    
    this.logger.info('Summary task check', {
      totalDocs,
      readDocs,
      operationHistoryLength: this.operationHistory.length
    })

    const hasWriteOperation = this.operationHistory.some(op => 
      op.success && (
        op.operation?.option === 'updateDocumentContent' ||
        op.operation?.option === 'insertEnd' ||
        op.operation?.option === 'deleteAndSwap'
      )
    )

    if (hasWriteOperation) {
      this.logger.info('Summary task: already has write operation, no need to force')
      return false
    }

    if (readDocs > 0) {
      this.logger.info('Summary task: has read documents but no write operation, should force write', {
        readDocs,
        totalDocs,
        hasWriteOperation
      })
      return true
    }

    this.logger.info('Summary task: no documents read yet, cannot force write')
    return false
  }

  validateOperation(operation) {
    if (!operation) {
      return { valid: false, error: '没有操作指令' }
    }

    if (!operation.option) {
      return { valid: false, error: '操作缺少 option 字段' }
    }

    const func = MCP_FUNCTIONS[operation.option]
    if (!func) {
      return { valid: false, error: `未知的操作函数: ${operation.option}` }
    }

    const args = operation.args || []
    const requiredParams = func.parameters || []
    
    if (args.length < requiredParams.length) {
      return { 
        valid: false, 
        error: `参数不足: ${operation.option} 需要 ${requiredParams.length} 个参数，但只提供了 ${args.length} 个` 
      }
    }

    for (let i = 0; i < requiredParams.length; i++) {
      const param = requiredParams[i]
      const arg = args[i]
      
      if (arg === undefined || arg === null || arg === '') {
        return { 
          valid: false, 
          error: `参数无效: ${param.name} 不能为空` 
        }
      }
    }

    if (operation.option === 'getDocumentById' && args[0] && this.readDocuments.has(args[0])) {
      const doc = this.readDocuments.get(args[0])
      this.logger.info('Document already read, skipping', { 
        docId: args[0], 
        title: doc.title 
      })
      console.log('[AIWorkflow] Duplicate read detected, skipping:', {
        requestedId: args[0],
        readDocumentsKeys: Array.from(this.readDocuments.keys())
      })
      return { 
        valid: false, 
        error: `文档已读取，无需重复读取: ${doc.title}`,
        skipExecution: true,
        alreadyReadDoc: doc
      }
    }
    
    console.log('[AIWorkflow] validateOperation passed:', {
      option: operation.option,
      args: args,
      readDocumentsKeys: Array.from(this.readDocuments.keys())
    })

    return { valid: true }
  }

  async executeOperation(operation) {
    const validation = this.validateOperation(operation)
    if (!validation.valid) {
      if (validation.skipExecution && validation.alreadyReadDoc) {
        this.logger.info('Skipping execution, returning cached document', validation.alreadyReadDoc.title)
        return { 
          success: true, 
          data: validation.alreadyReadDoc,
          skipped: true,
          message: `使用已缓存的文档: ${validation.alreadyReadDoc.title}`
        }
      }
      this.logger.error('Operation validation failed', validation.error)
      return { success: false, error: validation.error }
    }

    this.logger.info('Executing operation', operation)
    const jsonStr = JSON.stringify(operation)
    this.logger.info('JSON string to execute', jsonStr)
    const result = await parseAndExecute(jsonStr)
    this.logger.info('Execution result', result)
    return result
  }

  async generateTaskPlan(userRequest, docId) {
    if (!this.llmCaller) {
      this.logger.warn('LLM caller not configured, skipping task plan generation')
      return null
    }

    this.logger.info('Generating task plan')
    const prompt = this.buildTaskPlanPrompt(userRequest, docId)
    
    try {
      const response = await this.llmCaller(prompt)
      this.logger.info('Task plan response received', { response })
      
      const taskPlan = this.parseTaskPlanResponse(response)
      if (taskPlan) {
        this.taskPlan = taskPlan
        this.onTaskPlan(taskPlan)
        this.logger.info('Task plan generated', taskPlan)
      }
      return taskPlan
    } catch (error) {
      this.logger.error('Failed to generate task plan', error)
      return null
    }
  }

  buildTaskPlanPrompt(userRequest, docId) {
    const docs = generateFunctionDocumentation()
    
    return `
请分析用户需求，并生成一个执行计划。这个计划仅用于展示给用户参考，不会直接用于执行。

可用的函数接口:
${docs}

用户需求: ${userRequest}
当前文档ID: ${docId}

请输出JSON格式的任务计划：
{
  "taskMessage": "对整个任务的简短描述",
  "tasks": [
    {
      "id": "1",
      "description": "第一步要做什么",
      "type": "read"
    },
    {
      "id": "2", 
      "description": "第二步要做什么",
      "type": "read"
    },
    {
      "id": "3",
      "description": "第三步要做什么",
      "type": "write"
    }
  ]
}

要求：
1. type 只能是 "read"（读取操作）、"write"（写入操作）或 "edit"（编辑操作）
2. 每个任务描述要简洁明了
3. 任务数量要合理，不要过度分解（建议3-8个任务）
4. 这只是一个计划展示，实际执行时会根据情况动态调整
`
  }

  parseTaskPlanResponse(response) {
    try {
      let jsonStr = this.extractAndFixJson(response)
      if (jsonStr) {
        try {
          const result = JSON.parse(jsonStr)
          if (result.taskMessage && Array.isArray(result.tasks)) {
            return result
          }
        } catch (parseError) {
          this.logger.warn('Task plan JSON parse failed', { jsonStr, error: parseError })
        }
      }
      return this.fallbackParseTaskPlan(response)
    } catch (error) {
      this.logger.error('Parse task plan error', error)
      return null
    }
  }

  fallbackParseTaskPlan(response) {
    this.logger.info('Using fallback task plan parsing')
    return {
      taskMessage: 'AI 正在处理您的需求',
      tasks: [
        { id: '1', description: '分析需求', type: 'read' },
        { id: '2', description: '执行操作', type: 'edit' },
        { id: '3', description: '完成任务', type: 'write' }
      ]
    }
  }

  async summarize() {
    this.setState(WORKFLOW_STATES.SUMMARIZING)
    this.logger.info('Generating summary')

    const summary = {
      task: this.currentTask,
      taskPlan: this.taskPlan,
      duration: Date.now() - this.currentTask.startTime,
      iterations: this.currentTask.iterations,
      operations: this.operationHistory,
      logs: this.logger.getLogs(),
      success: this.state !== WORKFLOW_STATES.ERROR
    }

    this.onSummary(summary)
    this.logger.info('Summary generated', summary)
    return summary
  }

  getState() {
    return this.state
  }

  getLogs() {
    return this.logger.getLogs()
  }

  getOperationHistory() {
    return [...this.operationHistory]
  }

  getDecisions() {
    return [...this.decisions]
  }
}

export { WORKFLOW_STATES }

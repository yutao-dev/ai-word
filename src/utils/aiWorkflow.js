import { 
  generateFunctionDocumentation, 
  parseAndExecute, 
  startTransaction, 
  commitTransaction, 
  rollbackTransaction 
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
    this.maxIterations = options.maxIterations || 10
    this.maxValidations = options.maxValidations || 3
    this.maxRetries = options.maxRetries || 3
    this.progressScore = 0
    this.lastOperationType = null
    this.consecutiveReads = 0
    this.validationCount = 0
    this.retryCount = 0
    this.lastFailedOperation = null
    this.onStateChange = options.onStateChange || (() => {})
    this.onLog = options.onLog || (() => {})
    this.onOperation = options.onOperation || (() => {})
    this.onDecision = options.onDecision || (() => {})
    this.onSummary = options.onSummary || (() => {})
    this.onPendingConfirmation = options.onPendingConfirmation || (() => {})
    this.onAISummary = options.onAISummary || (() => {})
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
    this.progressScore = 0
    this.lastOperationType = null
    this.consecutiveReads = 0
    this.validationCount = 0
    this.retryCount = 0
    this.lastFailedOperation = null
    this.currentTask = {
      userRequest,
      docId,
      startTime: Date.now(),
      iterations: 0
    }

    this.logger.info('Starting new task', { userRequest, docId })
    
    try {
      startTransaction()
      await this.runWorkflow()
    } catch (error) {
      this.logger.error('Workflow error', error)
      await rollbackTransaction()
      this.setState(WORKFLOW_STATES.ERROR)
      throw error
    }
  }

  async runWorkflow() {
    const { userRequest, docId } = this.currentTask

    while (this.currentTask.iterations < this.maxIterations) {
      this.currentTask.iterations++
      this.logger.info(`Iteration ${this.currentTask.iterations}/${this.maxIterations}`)

      if (this.shouldTerminateEarly()) {
        this.logger.info('Threshold reached, checking validation count...', { 
          validationCount: this.validationCount, 
          maxValidations: this.maxValidations 
        })

        if (this.validationCount < this.maxValidations) {
          this.logger.info('Starting validation check...')
          const validationResult = await this.validateRequirements(userRequest, docId)
          
          if (validationResult.needsMoreWork) {
            this.validationCount++
            const reduction = Math.max(1, 3 - this.validationCount + 1)
            this.progressScore = Math.max(0, this.progressScore - reduction)
            this.logger.info('Validation: Needs more work, continuing workflow', { 
              validationCount: this.validationCount,
              reduction,
              newProgressScore: this.progressScore 
            })
            
            const decision = {
              iteration: this.currentTask.iterations,
              type: 'validation_continue',
              reason: validationResult.reason,
              progressScore: this.progressScore,
              validationCount: this.validationCount
            }
            this.decisions.push(decision)
            this.onDecision(decision)
            continue
          } else {
            this.validationCount++
            this.logger.info('Validation: Requirements met, terminating workflow')
            
            const decision = {
              iteration: this.currentTask.iterations,
              type: 'early_termination',
              reason: validationResult.reason || '进度阈值已达到且需求已验证满足',
              progressScore: this.progressScore,
              consecutiveReads: this.consecutiveReads,
              validationCount: this.validationCount
            }
            this.decisions.push(decision)
            this.onDecision(decision)
            break
          }
        } else {
          const decision = {
            iteration: this.currentTask.iterations,
            type: 'early_termination',
            reason: `已达到最大验证次数(${this.maxValidations})，强制终止`,
            progressScore: this.progressScore,
            consecutiveReads: this.consecutiveReads,
            validationCount: this.validationCount
          }
          this.decisions.push(decision)
          this.onDecision(decision)
          this.logger.info('Early termination due to max validations reached', decision)
          break
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
        break
      }

      this.setState(WORKFLOW_STATES.EXECUTING)
      const executionResult = await this.executeOperation(analysisResult.operation)
      this.operationHistory.push(executionResult)
      
      this.updateProgressMetrics(analysisResult.operation, executionResult)
      
      if (executionResult.success) {
        if (executionResult.newContent !== undefined) {
          this.currentDocContent = executionResult.newContent
          this.logger.info('Updated currentDocContent from newContent', { contentLength: this.currentDocContent.length })
        } else if (executionResult.doc && executionResult.doc.content !== undefined) {
          this.currentDocContent = executionResult.doc.content
          this.logger.info('Updated currentDocContent from doc', { contentLength: this.currentDocContent.length })
        } else if (executionResult.data) {
          if (executionResult.data.content !== undefined) {
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
        
        if (isLineError) {
          this.retryCount++
          this.lastFailedOperation = analysisResult.operation
          
          this.logger.warn('Line error detected, checking retry count', { 
            retryCount: this.retryCount, 
            maxRetries: this.maxRetries,
            error: executionResult.error
          })
          
          if (this.retryCount < this.maxRetries) {
            const retryDecision = {
              iteration: this.currentTask.iterations,
              type: 'retry',
              reason: `行号错误，重试 (${this.retryCount}/${this.maxRetries})`,
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
              reason: `行号错误，已重试${this.maxRetries}次，回退所有操作`,
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
    
    if (this.hasContentChanges()) {
      this.setState(WORKFLOW_STATES.PENDING_CONFIRMATION)
      this.onPendingConfirmation({
        originalContent: this.originalDocContent,
        modifiedContent: this.currentDocContent
      })
    } else {
      commitTransaction()
      this.setState(WORKFLOW_STATES.COMPLETED)
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
    const aiSummary = await this.generateAISummary()
    if (aiSummary) {
      this.aiSummary = aiSummary
      if (this.onAISummary) {
        this.onAISummary(aiSummary)
      }
    }
    commitTransaction()
    this.setState(WORKFLOW_STATES.COMPLETED)
  }

  rejectChanges() {
    rollbackTransaction()
    this.setState(WORKFLOW_STATES.IDLE)
  }

  updateProgressMetrics(operation, executionResult) {
    const operationType = operation?.option
    
    if (operationType === 'getDocumentById' || operationType === 'getAllDocument') {
      this.consecutiveReads++
      this.progressScore += 0.5
    } else if (operationType === 'insertEnd' || operationType === 'deleteAndSwap' || operationType === 'deleteByRange') {
      this.consecutiveReads = 0
      this.progressScore += 2
      if (executionResult.success) {
        this.progressScore += 1
      }
    }
    
    if (this.lastOperationType === operationType && operationType === 'getDocumentById') {
      this.progressScore -= 1
    }
    
    this.lastOperationType = operationType
    this.logger.info('Progress metrics updated', {
      progressScore: this.progressScore,
      consecutiveReads: this.consecutiveReads,
      lastOperationType: this.lastOperationType
    })
  }

  shouldTerminateEarly() {
    if (this.progressScore >= 5) {
      return true
    }
    
    if (this.consecutiveReads >= 2 && this.currentDocContent) {
      this.logger.warn('Detected redundant read operations, forcing termination')
      return true
    }
    
    if (this.progressScore < 0) {
      this.logger.warn('Negative progress score detected, terminating')
      return true
    }
    
    return false
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
      ? `\n当前文档内容:\n\`\`\`\n${this.currentDocContent}\n\`\`\`\n`
      : '\n当前文档内容: 尚未获取，请先调用 getDocumentById 获取文档内容\n'
    
    const iterationInfo = `\n当前迭代次数: ${this.currentTask.iterations}/${this.maxIterations}\n`
    
    return `
你是一个高效的文档操作助手。请根据用户需求分析需要执行的操作。

可用的函数接口:
${docs}

用户需求: ${userRequest}
当前文档ID: ${docId}
${docContentSection}${iterationInfo}
重要规则:
1. 如果已经获取了文档内容，请直接执行编辑操作，不要重复获取
2. 如果任务只需要一个操作就能完成，执行后立即设置 isComplete: true
3. 编辑操作后，如果用户需求已满足，立即标记任务完成
4. 不要进行不必要的重复操作
5. 行号从1开始计数

操作类型说明:
- getDocumentById: 获取文档内容（仅在未获取时使用）
- insertEnd: 在文档末尾追加内容
- deleteAndSwap: 删除指定行并替换为新内容
- deleteByRange: 删除指定行范围

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
    
    const needsAction = lowerResponse.includes('needsaction": true') || 
                       lowerResponse.includes('needsaction":true') ||
                       lowerResponse.includes('需要执行') ||
                       lowerResponse.includes('执行操作')
    
    const isComplete = lowerResponse.includes('iscomplete": true') ||
                      lowerResponse.includes('iscomplete":true') ||
                      lowerResponse.includes('任务完成') ||
                      lowerResponse.includes('需求已满足')
    
    const operationMatch = response.match(/"option"\s*:\s*"([^"]+)"/)
    const argsMatch = response.match(/"args"\s*:\s*(\[[^\]]*\])/)
    
    let operation = null
    if (operationMatch) {
      operation = { option: operationMatch[1] }
      if (argsMatch) {
        try {
          operation.args = JSON.parse(argsMatch[1])
        } catch (e) {
          operation.args = []
        }
      }
    }
    
    return {
      needsAction: needsAction,
      isComplete: isComplete || !needsAction,
      message: '通过备用解析方式解析',
      operation: operation
    }
  }

  async executeOperation(operation) {
    if (!operation) {
      return { success: false, error: '没有操作指令' }
    }

    this.logger.info('Executing operation', operation)
    const jsonStr = JSON.stringify(operation)
    this.logger.info('JSON string to execute', jsonStr)
    const result = await parseAndExecute(jsonStr)
    this.logger.info('Execution result', result)
    return result
  }

  async summarize() {
    this.setState(WORKFLOW_STATES.SUMMARIZING)
    this.logger.info('Generating summary')

    const summary = {
      task: this.currentTask,
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

import { describe, it, expect, beforeEach } from 'vitest'
import { AIWorkflow, WORKFLOW_STATES } from './aiWorkflow'

describe('AIWorkflow', () => {
  let workflow

  beforeEach(() => {
    workflow = new AIWorkflow()
  })

  describe('initialization', () => {
    it('should initialize with idle state', () => {
      expect(workflow.getState()).toBe(WORKFLOW_STATES.IDLE)
    })

    it('should generate documentation on initialize', async () => {
      const docs = await workflow.initialize()
      expect(docs).toContain('# 文档操作函数接口说明')
    })
  })

  describe('state management', () => {
    it('should track state changes', () => {
      let lastState = null
      workflow.onStateChange = (state) => { lastState = state }
      
      workflow.setState(WORKFLOW_STATES.ANALYZING)
      expect(workflow.getState()).toBe(WORKFLOW_STATES.ANALYZING)
      expect(lastState).toBe(WORKFLOW_STATES.ANALYZING)
    })
  })

  describe('logging', () => {
    it('should log messages', () => {
      workflow.logger.info('Test info message')
      workflow.logger.warn('Test warning')
      workflow.logger.error('Test error')
      
      const logs = workflow.getLogs()
      expect(logs.length).toBe(3)
      expect(logs[0].level).toBe('info')
      expect(logs[1].level).toBe('warn')
      expect(logs[2].level).toBe('error')
    })
  })

  describe('analysis prompt', () => {
    it('should build analysis prompt with docs', () => {
      workflow.currentTask = {
        userRequest: 'test request',
        docId: 'doc-123',
        iterations: 1
      }
      const prompt = workflow.buildAnalysisPrompt('test request', 'doc-123')
      expect(prompt).toContain('test request')
      expect(prompt).toContain('doc-123')
      expect(prompt).toContain('# 文档操作函数接口说明')
    })
  })

  describe('analysis response parsing', () => {
    it('should parse valid JSON response', () => {
      const response = `
        Some text
        {
          "message": "Analysis complete",
          "needsAction": false,
          "isComplete": true
        }
        More text
      `
      const result = workflow.parseAnalysisResponse(response)
      expect(result.needsAction).toBe(false)
      expect(result.isComplete).toBe(true)
    })

    it('should handle invalid response gracefully', () => {
      const result = workflow.parseAnalysisResponse('not json')
      expect(result.needsAction).toBe(false)
    })
  })
})

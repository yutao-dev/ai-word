import React, { useState, useRef, useEffect } from 'react';
import { ragApi } from '../services/api';
import { toast } from '../utils/toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const RAGPanel = ({ onClose }) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [model, setModel] = useState(null);
  const [expandedContexts, setExpandedContexts] = useState(new Set());
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) {
      toast.error('请输入问题');
      return;
    }

    const userMessage = {
      role: 'user',
      content: question
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setQuestion('');

    try {
      const response = await ragApi.query(question, model, messages);
      const assistantMessage = {
        role: 'assistant',
        content: response.answer,
        context: response.context
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error(`查询失败: ${error.message}`);
      console.error('RAG query error:', error);
      // 移除用户消息，因为查询失败
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshIndex = async () => {
    setIsLoading(true);
    try {
      await ragApi.refreshIndex();
      toast.success('索引刷新成功');
    } catch (error) {
      toast.error(`索引刷新失败: ${error.message}`);
      console.error('Refresh index error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setExpandedContexts(new Set());
  };

  const toggleContext = (index) => {
    setExpandedContexts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="rag-panel">
      <div className="rag-panel-header">
        <h3>AI 知识库问答</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={clearHistory}
            disabled={isLoading}
            className="rag-clear-btn"
          >
            清空历史
          </button>
          <button 
            onClick={handleRefreshIndex} 
            disabled={isLoading}
            className="rag-refresh-btn"
          >
            {isLoading ? '刷新中...' : '刷新索引'}
          </button>
          <button 
            onClick={onClose} 
            className="rag-close-btn"
          >
            ×
          </button>
        </div>
      </div>

      <div className="rag-panel-content">
        {/* 历史消息区域 */}
        {messages.length > 0 && (
          <div className="rag-messages-container">
            {messages.map((message, index) => (
              <div key={index} className={`rag-message ${message.role}`}>
                <div className="rag-message-header">
                  <span className="rag-message-role">
                    {message.role === 'user' ? '您' : 'AI'}
                  </span>
                </div>
                <div className="rag-message-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.role === 'assistant' && message.context && (
                  <div className="rag-message-context-container">
                    <button 
                      className="rag-context-toggle"
                      onClick={() => toggleContext(index)}
                    >
                      {expandedContexts.has(index) ? '隐藏参考资料' : '查看参考资料'}
                    </button>
                    {expandedContexts.has(index) && (
                      <div className="rag-message-context">
                        <h6>参考资料</h6>
                        <div className="rag-context-sources">
                          {message.context.split('来源:').filter(Boolean).map((source, sourceIndex) => {
                            const sourceContent = source.trim();
                            if (!sourceContent) return null;
                            return (
                              <div key={sourceIndex} className="rag-context-source-block">
                                <div className="rag-context-source-header">
                                  来源: {sourceContent.split(' ')[0]}
                                </div>
                                <div className="rag-context-source-content">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {sourceContent}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {isLoading && (
          <div className="rag-loading">
            <div className="spinner"></div>
            <span>处理中...</span>
          </div>
        )}

        {/* 输入表单 */}
        <form onSubmit={handleSubmit} className="rag-query-form">
          <label htmlFor="question">问题</label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="输入您的问题，例如：AI Word 的核心功能是什么？"
            disabled={isLoading}
            className="rag-question-input"
          />

          <label htmlFor="model">模型 (可选)</label>
          <input
            id="model"
            type="text"
            value={model || ''}
            onChange={(e) => setModel(e.target.value || null)}
            placeholder="例如：gpt-4"
            disabled={isLoading}
            className="rag-model-select"
          />

          <button 
            type="submit" 
            disabled={isLoading}
            className="rag-submit-btn"
          >
            {isLoading ? '查询中...' : '提交查询'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RAGPanel;
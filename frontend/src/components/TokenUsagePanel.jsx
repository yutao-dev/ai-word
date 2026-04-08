import { useState, useEffect } from 'react'
import { tokenUsageApi } from '../services/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const StatCard = ({ title, data, active, onClick }) => (
  <div 
    className={`stat-card ${active ? 'active' : ''}`}
    onClick={onClick}
  >
    <div className="stat-title">{title}</div>
    <div className="stat-value">{formatNumber(data.total_tokens)}</div>
    <div className="stat-details">
      <span>输入: {formatNumber(data.total_prompt_tokens)}</span>
      <span>输出: {formatNumber(data.total_completion_tokens)}</span>
    </div>
    <div className="stat-requests">{data.total_requests} 次请求</div>
  </div>
)

const ModelBreakdown = ({ data }) => {
  if (!data || data.by_model.length === 0) {
    return <div className="no-data">暂无数据</div>
  }

  return (
    <div className="model-breakdown">
      <h4>按模型分布</h4>
      <div className="breakdown-list">
        {data.by_model.map((item, index) => (
          <div key={index} className="breakdown-item">
            <span className="breakdown-label">{item.model}</span>
            <div className="breakdown-bar-container">
              <div 
                className="breakdown-bar" 
                style={{ 
                  width: `${(item.total_tokens / data.total_tokens) * 100}%` 
                }}
              />
            </div>
            <span className="breakdown-value">{formatNumber(item.total_tokens)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const TokenUsagePanel = ({ show, onClose, workflowId = null }) => {
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [activePeriod, setActivePeriod] = useState('today')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('stats')
  const [workflowStats, setWorkflowStats] = useState([])

  useEffect(() => {
    if (show) {
      fetchData()
    }
  }, [show, workflowId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const statsData = await tokenUsageApi.getStats()
      setStats(statsData)

      const workflowStatsData = await tokenUsageApi.getRecentWorkflowStats(10)
      setWorkflowStats(workflowStatsData)

      if (workflowId) {
        const historyData = await tokenUsageApi.getByWorkflow(workflowId)
        setHistory(historyData)
      } else {
        const historyData = await tokenUsageApi.getHistory({ limit: 20 })
        setHistory(historyData)
      }
    } catch (error) {
      console.error('Failed to fetch token usage:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (confirm('确定要清除所有 Token 使用记录吗？')) {
      await tokenUsageApi.clear()
      fetchData()
    }
  }

  if (!show) return null

  const currentData = stats ? stats[activePeriod] : null

  return (
    <div className="token-usage-panel">
      <div className="panel-header">
        <h3>📊 Token 使用统计</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="view-toggle">
        <button
          className={viewMode === 'stats' ? 'active' : ''}
          onClick={() => setViewMode('stats')}
        >
          统计概览
        </button>
        <button
          className={viewMode === 'workflow' ? 'active' : ''}
          onClick={() => setViewMode('workflow')}
        >
          工作流趋势
        </button>
        <button
          className={viewMode === 'history' ? 'active' : ''}
          onClick={() => setViewMode('history')}
        >
          使用记录
        </button>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : viewMode === 'stats' ? (
        <div className="stats-view">
          <div className="period-cards">
            <StatCard 
              title="今日" 
              data={stats?.today || {}} 
              active={activePeriod === 'today'}
              onClick={() => setActivePeriod('today')}
            />
            <StatCard 
              title="本周" 
              data={stats?.week || {}} 
              active={activePeriod === 'week'}
              onClick={() => setActivePeriod('week')}
            />
            <StatCard 
              title="本月" 
              data={stats?.month || {}} 
              active={activePeriod === 'month'}
              onClick={() => setActivePeriod('month')}
            />
            <StatCard 
              title="总计" 
              data={stats?.all_time || {}} 
              active={activePeriod === 'all_time'}
              onClick={() => setActivePeriod('all_time')}
            />
          </div>

          <div className="details-section">
            <ModelBreakdown data={currentData} />
          </div>

          <div className="actions">
            <button className="refresh-btn" onClick={fetchData}>
              🔄 刷新
            </button>
            <button className="clear-btn" onClick={handleClear}>
              🗑️ 清除记录
            </button>
          </div>
        </div>
      ) : viewMode === 'workflow' ? (
        <div className="workflow-view">
          {workflowStats.length === 0 ? (
            <div className="no-data">暂无工作流数据</div>
          ) : (
            <>
              <div className="workflow-chart-container">
                <h4>Token 消耗趋势</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[...workflowStats].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="first_request"
                      tickFormatter={(val) => new Date(val).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      tickFormatter={(val) => formatNumber(val)}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value) => formatNumber(value)}
                      labelFormatter={(val) => new Date(val).toLocaleString('zh-CN')}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="total_tokens" name="总Token" stroke="#8884d8" strokeWidth={2} />
                    <Line type="monotone" dataKey="prompt_tokens" name="输入" stroke="#82ca9d" strokeWidth={1} />
                    <Line type="monotone" dataKey="completion_tokens" name="输出" stroke="#ffc658" strokeWidth={1} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="workflow-list">
                <h4>最近工作流</h4>
                {workflowStats.map((wf, index) => (
                  <div key={index} className="workflow-item">
                    <div className="workflow-main">
                      <span className="workflow-id">{wf.workflow_id.substring(0, 8)}...</span>
                      <span className="workflow-tokens">
                        {formatNumber(wf.total_tokens)} tokens
                      </span>
                    </div>
                    <div className="workflow-details">
                      <span>请求: {wf.request_count}次</span>
                      <span>模型: {wf.model}</span>
                    </div>
                    <div className="workflow-time">
                      {wf.first_request ? new Date(wf.first_request).toLocaleString('zh-CN') : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="history-view">
          <div className="history-list">
            {history.length === 0 ? (
              <div className="no-data">暂无使用记录</div>
            ) : (
              history.map((item, index) => (
                <div key={index} className="history-item">
                  <div className="history-main">
                    <span className="history-model">{item.model}</span>
                    <span className="history-tokens">
                      {formatNumber(item.total_tokens)} tokens
                    </span>
                  </div>
                  <div className="history-details">
                    <span>输入: {item.prompt_tokens}</span>
                    <span>输出: {item.completion_tokens}</span>
                    <span className="history-type">{item.request_type || 'chat'}</span>
                  </div>
                  <div className="history-time">
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenUsagePanel
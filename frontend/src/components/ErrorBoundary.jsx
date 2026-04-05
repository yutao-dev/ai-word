import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // 更新状态，下次渲染将显示错误界面
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // 记录错误信息
    console.error('Error caught by ErrorBoundary:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      // 自定义错误界面
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '8px',
          margin: '1rem'
        }}>
          <h2>应用发生错误</h2>
          <p>很抱歉，应用遇到了问题。请刷新页面重试。</p>
          <details style={{ textAlign: 'left', marginTop: '1rem' }}>
            <summary>错误详情</summary>
            <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
              {this.state.error?.toString()}
              {this.state.errorInfo ? `\n\n组件堆栈:\n${this.state.errorInfo.componentStack}` : ''}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#721c24',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }

    // 正常渲染子组件
    return this.props.children
  }
}

export default ErrorBoundary

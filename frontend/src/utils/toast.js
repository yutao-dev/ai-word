import toast from 'react-hot-toast'

export const showSuccess = (message, duration = 3000) => {
  toast.success(message, {
    duration,
    style: {
      background: '#10b981',
      color: '#fff',
      fontWeight: '500',
      borderRadius: '8px',
      padding: '12px 16px'
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10b981'
    }
  })
}

export const showError = (message, duration = 4000) => {
  toast.error(message, {
    duration,
    style: {
      background: '#ef4444',
      color: '#fff',
      fontWeight: '500',
      borderRadius: '8px',
      padding: '12px 16px'
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#ef4444'
    }
  })
}

export const showWarning = (message, duration = 3500) => {
  toast(message, {
    duration,
    icon: '⚠️',
    style: {
      background: '#f59e0b',
      color: '#fff',
      fontWeight: '500',
      borderRadius: '8px',
      padding: '12px 16px'
    }
  })
}

export const showInfo = (message, duration = 3000) => {
  toast(message, {
    duration,
    icon: 'ℹ️',
    style: {
      background: '#3b82f6',
      color: '#fff',
      fontWeight: '500',
      borderRadius: '8px',
      padding: '12px 16px'
    }
  })
}

export const showLoading = (message) => {
  return toast.loading(message, {
    style: {
      background: '#6366f1',
      color: '#fff',
      fontWeight: '500',
      borderRadius: '8px',
      padding: '12px 16px'
    }
  })
}

export const dismissToast = (toastId) => {
  toast.dismiss(toastId)
}

export const showPromise = (promise, messages) => {
  return toast.promise(promise, {
    loading: messages.loading || '处理中...',
    success: messages.success || '操作成功！',
    error: messages.error || '操作失败'
  }, {
    style: {
      borderRadius: '8px',
      padding: '12px 16px',
      fontWeight: '500'
    },
    success: {
      style: {
        background: '#10b981',
        color: '#fff'
      }
    },
    error: {
      style: {
        background: '#ef4444',
        color: '#fff'
      }
    }
  })
}

export const showUndoRedoToast = (type) => {
  const message = type === 'undo' ? '已撤销操作' : '已重做操作'
  
  toast(message, {
    duration: 2000,
    icon: type === 'undo' ? '↩️' : '↪️',
    style: {
      background: '#6366f1',
      color: '#fff',
      fontWeight: '500',
      borderRadius: '8px',
      padding: '12px 16px'
    }
  })
}

export const showExportToast = (format, filename) => {
  const formatNames = {
    md: 'Markdown',
    html: 'HTML',
    pdf: 'PDF',
    word: 'Word'
  }
  
  showSuccess(`已导出 ${formatNames[format]} 文件：${filename}`)
}

export const showSaveToast = () => {
  toast('已自动保存', {
    duration: 1500,
    icon: '💾',
    style: {
      background: '#10b981',
      color: '#fff',
      fontWeight: '500',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '13px'
    }
  })
}

export { toast }

import { useState, useRef, useEffect } from 'react'
import { exportDocument } from '../utils/exportUtils'

const ExportMenu = ({ currentDoc, onExportComplete }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [exporting, setExporting] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (format) => {
    if (!currentDoc?.content) {
      alert('没有可导出的内容')
      return
    }

    setExporting(format)
    setIsOpen(false)

    try {
      const result = await exportDocument(format, currentDoc.content, currentDoc.title)
      if (result.success) {
        onExportComplete?.(format, result.filename)
      } else {
        alert(`导出失败: ${result.error}`)
      }
    } catch (error) {
      alert(`导出失败: ${error.message}`)
    } finally {
      setExporting(null)
    }
  }

  const exportOptions = [
    { format: 'md', label: 'Markdown (.md)', icon: '📄', description: '纯文本格式' },
    { format: 'html', label: 'HTML (.html)', icon: '🌐', description: '网页格式' },
    { format: 'word', label: 'Word (.docx)', icon: '📘', description: 'Word 文档' },
    { format: 'pdf', label: 'PDF (.pdf)', icon: '📕', description: 'PDF 文档' }
  ]

  return (
    <div className="export-menu-container" ref={menuRef}>
      <button
        className="header-btn export-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting !== null}
        title="导出文档"
      >
        {exporting ? (
          <span className="export-spinner"></span>
        ) : (
          '📥'
        )}
      </button>
      
      {isOpen && (
        <div className="export-dropdown">
          <div className="export-dropdown-header">
            <span>导出文档</span>
            <span className="export-doc-name">{currentDoc?.title || '未命名文档'}</span>
          </div>
          <div className="export-options">
            {exportOptions.map((option) => (
              <button
                key={option.format}
                className="export-option"
                onClick={() => handleExport(option.format)}
                disabled={exporting === option.format}
              >
                <span className="export-icon">{option.icon}</span>
                <div className="export-info">
                  <span className="export-label">{option.label}</span>
                  <span className="export-desc">{option.description}</span>
                </div>
                {exporting === option.format && (
                  <span className="export-option-spinner"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ExportMenu

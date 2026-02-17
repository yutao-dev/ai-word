const DiffHighlighter = ({ original, modified, originalSelection, modifiedResult, type }) => {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')
  const selectionLines = originalSelection ? originalSelection.split('\n') : []
  const resultLines = modifiedResult ? modifiedResult.split('\n') : []

  const findChangedLines = () => {
    const changedLines = new Set()
    
    if (type === 'original' && originalSelection) {
      const selectionStartIndex = original.indexOf(originalSelection)
      if (selectionStartIndex !== -1) {
        const startLine = original.substring(0, selectionStartIndex).split('\n').length - 1
        const endLine = startLine + selectionLines.length
        
        for (let i = startLine; i < endLine && i < originalLines.length; i++) {
          changedLines.add(i)
        }
      }
    } else if (type === 'modified' && modifiedResult) {
      const resultStartIndex = modified.indexOf(modifiedResult)
      if (resultStartIndex !== -1) {
        const startLine = modified.substring(0, resultStartIndex).split('\n').length - 1
        const endLine = startLine + resultLines.length
        
        for (let i = startLine; i < endLine && i < modifiedLines.length; i++) {
          changedLines.add(i)
        }
      }
    } else {
      const maxLength = Math.max(originalLines.length, modifiedLines.length)
      
      for (let i = 0; i < maxLength; i++) {
        const originalLine = originalLines[i] || ''
        const modifiedLine = modifiedLines[i] || ''
        
        if (originalLine !== modifiedLine) {
          changedLines.add(i)
        }
      }
    }
    
    return changedLines
  }

  const changedLines = findChangedLines()
  const lines = type === 'original' ? originalLines : modifiedLines

  return (
    <div className="diff-content">
      {lines.map((line, index) => {
        const isChanged = changedLines.has(index)
        const bgClass = type === 'original' 
          ? (isChanged ? 'diff-removed' : '')
          : (isChanged ? 'diff-added' : '')
        
        return (
          <div 
            key={index} 
            className={`diff-line ${bgClass}`}
          >
            {line || '\u00A0'}
          </div>
        )
      })}
    </div>
  )
}

export default DiffHighlighter

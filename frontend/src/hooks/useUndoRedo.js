import { useState, useCallback } from 'react'

const MAX_HISTORY_SIZE = 50

export const useUndoRedo = (initialState) => {
  const [state, setState] = useState(initialState)
  const [history, setHistory] = useState([initialState])
  const [pointer, setPointer] = useState(0)

  const set = useCallback((newState) => {
    const resolvedState = typeof newState === 'function' ? newState(state) : newState
    
    const newHistory = history.slice(0, pointer + 1)
    newHistory.push(resolvedState)
    
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift()
      setHistory(newHistory)
      setPointer(newHistory.length - 1)
    } else {
      setHistory(newHistory)
      setPointer(pointer + 1)
    }
    
    setState(resolvedState)
  }, [state, history, pointer])

  const undo = useCallback(() => {
    if (pointer > 0) {
      const newPointer = pointer - 1
      setPointer(newPointer)
      setState(history[newPointer])
      return true
    }
    return false
  }, [pointer, history])

  const redo = useCallback(() => {
    if (pointer < history.length - 1) {
      const newPointer = pointer + 1
      setPointer(newPointer)
      setState(history[newPointer])
      return true
    }
    return false
  }, [pointer, history])

  const reset = useCallback((newState) => {
    setHistory([newState])
    setPointer(0)
    setState(newState)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([state])
    setPointer(0)
  }, [state])

  return {
    state,
    set,
    undo,
    redo,
    canUndo: pointer > 0,
    canRedo: pointer < history.length - 1,
    reset,
    clearHistory,
    historyLength: history.length,
    pointer
  }
}

export const useDocumentHistory = (initialContent, onSave) => {
  const [content, setContent] = useState(initialContent)
  const [history, setHistory] = useState([initialContent])
  const [pointer, setPointer] = useState(0)

  const set = useCallback((newContent) => {
    const resolvedContent = typeof newContent === 'function' ? newContent(content) : newContent
    
    const newHistory = history.slice(0, pointer + 1)
    newHistory.push(resolvedContent)
    
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift()
      setHistory(newHistory)
      setPointer(newHistory.length - 1)
    } else {
      setHistory(newHistory)
      setPointer(pointer + 1)
    }
    
    setContent(resolvedContent)
    
    if (onSave) {
      setTimeout(() => onSave(resolvedContent), 500)
    }
  }, [content, history, pointer, onSave])

  const undo = useCallback(() => {
    if (pointer > 0) {
      const newPointer = pointer - 1
      setPointer(newPointer)
      const prevContent = history[newPointer]
      setContent(prevContent)
      return prevContent
    }
    return null
  }, [pointer, history])

  const redo = useCallback(() => {
    if (pointer < history.length - 1) {
      const newPointer = pointer + 1
      setPointer(newPointer)
      const nextContent = history[newPointer]
      setContent(nextContent)
      return nextContent
    }
    return null
  }, [pointer, history])

  const reset = useCallback((newContent) => {
    setHistory([newContent])
    setPointer(0)
    setContent(newContent)
  }, [])

  return {
    content,
    set,
    undo,
    redo,
    canUndo: pointer > 0,
    canRedo: pointer < history.length - 1,
    reset
  }
}

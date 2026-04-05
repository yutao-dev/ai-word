import { useState, useEffect, useRef, useCallback } from 'react'

export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

export const useDebouncedCallback = (callback, delay) => {
  const timeoutRef = useRef(null)

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

export const useThrottle = (callback, delay) => {
  const lastCallRef = useRef(0)
  const timeoutRef = useRef(null)

  const throttledCallback = useCallback((...args) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallRef.current

    if (timeSinceLastCall >= delay) {
      lastCallRef.current = now
      callback(...args)
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now()
        callback(...args)
      }, delay - timeSinceLastCall)
    }
  }, [callback, delay])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return throttledCallback
}

export const useOptimizedHistory = (initialContent, onSave, options = {}) => {
  const { 
    historyDelay = 1000,
    maxHistorySize = 50 
  } = options

  const [content, setContent] = useState(initialContent)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const historyRef = useRef([initialContent])
  const pointerRef = useRef(0)
  const lastHistoryTimeRef = useRef(null)
  const saveTimeoutRef = useRef(null)
  const lastSavedRef = useRef(initialContent)
  const isInitializedRef = useRef(false)

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      lastHistoryTimeRef.current = Date.now()
    }
  }, [])

  const updateCanFlags = useCallback(() => {
    setCanUndo(pointerRef.current > 0)
    setCanRedo(pointerRef.current < historyRef.current.length - 1)
  }, [])

  const addToHistory = useCallback((newContent) => {
    const now = Date.now()
    const timeSinceLastHistory = now - (lastHistoryTimeRef.current || 0)

    if (timeSinceLastHistory < historyDelay) {
      historyRef.current[pointerRef.current] = newContent
    } else {
      const newHistory = historyRef.current.slice(0, pointerRef.current + 1)
      newHistory.push(newContent)
      
      if (newHistory.length > maxHistorySize) {
        newHistory.shift()
      } else {
        pointerRef.current++
      }
      
      historyRef.current = newHistory
      lastHistoryTimeRef.current = now
    }
    
    updateCanFlags()
  }, [historyDelay, maxHistorySize, updateCanFlags])

  const set = useCallback((newContent) => {
    const resolvedContent = typeof newContent === 'function' ? newContent(content) : newContent
    setContent(resolvedContent)
    addToHistory(resolvedContent)
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (resolvedContent !== lastSavedRef.current && onSave) {
        onSave(resolvedContent)
        lastSavedRef.current = resolvedContent
      }
    }, 500)
  }, [content, addToHistory, onSave])

  const undo = useCallback(() => {
    if (pointerRef.current > 0) {
      pointerRef.current--
      const prevContent = historyRef.current[pointerRef.current]
      setContent(prevContent)
      lastHistoryTimeRef.current = Date.now()
      updateCanFlags()
      return prevContent
    }
    return null
  }, [updateCanFlags])

  const redo = useCallback(() => {
    if (pointerRef.current < historyRef.current.length - 1) {
      pointerRef.current++
      const nextContent = historyRef.current[pointerRef.current]
      setContent(nextContent)
      lastHistoryTimeRef.current = Date.now()
      updateCanFlags()
      return nextContent
    }
    return null
  }, [updateCanFlags])

  const reset = useCallback((newContent) => {
    historyRef.current = [newContent]
    pointerRef.current = 0
    lastHistoryTimeRef.current = Date.now()
    lastSavedRef.current = newContent
    setContent(newContent)
    updateCanFlags()
  }, [updateCanFlags])

  return {
    content,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset
  }
}

export const useRequestAnimationFrame = () => {
  const rafRef = useRef(null)
  
  const scheduleRaf = useCallback((callback) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = requestAnimationFrame(callback)
  }, [])
  
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])
  
  return scheduleRaf
}

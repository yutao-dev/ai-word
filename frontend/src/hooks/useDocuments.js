import { useState, useEffect, useCallback } from 'react'
import { 
  getAllDocuments, 
  saveDocument, 
  createDocument, 
  deleteDocument,
  migrateFromLocalStorage,
  getAppState,
  saveAppState
} from '../utils/db'
import { showSuccess, showError, showWarning } from '../utils/toast'

export const useDocuments = () => {
  const [documents, setDocuments] = useState([])
  const [currentDocId, setCurrentDocId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initDocuments = async () => {
      try {
        await migrateFromLocalStorage()
        
        const docs = await getAllDocuments()
        setDocuments(docs)
        
        const savedDocId = await getAppState('currentDocId')
        const validDocId = savedDocId && docs.find(d => d.id === savedDocId)
          ? savedDocId
          : docs[0]?.id
        
        if (validDocId) {
          setCurrentDocId(validDocId)
        }
      } catch (error) {
        console.error('Init documents error:', error)
        showError('加载文档失败')
      } finally {
        setIsLoading(false)
      }
    }
    
    initDocuments()
  }, [])

  useEffect(() => {
    if (currentDocId) {
      saveAppState('currentDocId', currentDocId)
    }
  }, [currentDocId])

  const currentDoc = documents.find(doc => doc.id === currentDocId)

  const updateCurrentDoc = useCallback(async (content) => {
    if (!currentDocId) return
    
    const doc = documents.find(d => d.id === currentDocId)
    if (!doc) return
    
    const result = await saveDocument({ ...doc, content })
    
    if (result.success) {
      setDocuments(prev => prev.map(d => 
        d.id === currentDocId ? result.doc : d
      ))
    } else {
      showError('保存失败：' + result.error)
    }
  }, [currentDocId, documents])

  const createNewDocument = useCallback(async (title) => {
    if (!title.trim()) {
      showWarning('请输入文档标题')
      return null
    }
    
    const result = await createDocument(title)
    
    if (result.success) {
      setDocuments(prev => [result.doc, ...prev])
      setCurrentDocId(result.doc.id)
      showSuccess('文档创建成功')
      return result.doc
    } else {
      showError('创建失败：' + result.error)
      return null
    }
  }, [])

  const deleteDoc = useCallback(async (docId) => {
    const result = await deleteDocument(docId)
    
    if (result.success) {
      setDocuments(prev => prev.filter(d => d.id !== docId))
      
      if (currentDocId === docId) {
        const remainingDocs = documents.filter(d => d.id !== docId)
        if (remainingDocs.length > 0) {
          setCurrentDocId(remainingDocs[0].id)
        }
      }
      
      showSuccess('文档已删除')
      return { success: true }
    } else {
      showWarning(result.error)
      return { success: false, error: result.error }
    }
  }, [currentDocId, documents])

  const formatDate = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  const selectDocument = useCallback((docId) => {
    const doc = documents.find(d => d.id === docId)
    if (doc) {
      setCurrentDocId(docId)
    }
  }, [documents])

  return {
    documents,
    currentDocId,
    currentDoc,
    isLoading,
    setDocuments,
    setCurrentDocId: selectDocument,
    updateCurrentDoc,
    createDocument: createNewDocument,
    deleteDocument: deleteDoc,
    formatDate
  }
}

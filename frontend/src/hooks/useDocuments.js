import { useState, useEffect, useCallback } from 'react'
import { documentApi } from '../services/api'
import { showSuccess, showError, showWarning } from '../utils/toast'

// 本地存储用于保存当前文档ID（临时方案，后续可迁移到后端）
const getCurrentDocId = () => localStorage.getItem('currentDocId')
const saveCurrentDocId = (docId) => localStorage.setItem('currentDocId', docId)

export const useDocuments = () => {
  const [documents, setDocuments] = useState([])
  const [currentDocId, setCurrentDocId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initDocuments = async () => {
      try {
        const docs = await documentApi.getAll()
        setDocuments(docs)
        
        const savedDocId = getCurrentDocId()
        const validDocId = savedDocId && docs.find(d => d.id === savedDocId)
          ? savedDocId
          : docs[0]?.id
        
        if (validDocId) {
          setCurrentDocId(validDocId)
        }
      } catch (error) {
        console.error('Init documents error:', error)
        showError('加载文档失败：' + (error.message || '未知错误'))
      } finally {
        setIsLoading(false)
      }
    }
    
    initDocuments()
  }, [])

  useEffect(() => {
    if (currentDocId) {
      saveCurrentDocId(currentDocId)
    }
  }, [currentDocId])

  const currentDoc = documents.find(doc => doc.id === currentDocId)

  const updateCurrentDoc = useCallback(async (content) => {
    if (!currentDocId) return
    
    const doc = documents.find(d => d.id === currentDocId)
    if (!doc) return
    
    try {
      const updatedDoc = await documentApi.update(currentDocId, { content })
      setDocuments(prev => prev.map(d => 
        d.id === currentDocId ? updatedDoc : d
      ))
      // showSuccess('保存成功')
    } catch (error) {
      console.error('Update document error:', error)
      showError('保存失败：' + (error.message || '未知错误'))
    }
  }, [currentDocId, documents])

  const createNewDocument = useCallback(async (title) => {
    if (!title.trim()) {
      showWarning('请输入文档标题')
      return null
    }
    
    try {
      const newDoc = await documentApi.create({ title })
      setDocuments(prev => [newDoc, ...prev])
      setCurrentDocId(newDoc.id)
      showSuccess('文档创建成功')
      return newDoc
    } catch (error) {
      console.error('Create document error:', error)
      showError('创建失败：' + (error.message || '未知错误'))
      return null
    }
  }, [])

  const deleteDoc = useCallback(async (docId) => {
    try {
      await documentApi.delete(docId)
      setDocuments(prev => prev.filter(d => d.id !== docId))
      
      if (currentDocId === docId) {
        const remainingDocs = documents.filter(d => d.id !== docId)
        if (remainingDocs.length > 0) {
          setCurrentDocId(remainingDocs[0].id)
        }
      }
      
      showSuccess('文档已删除')
      return { success: true }
    } catch (error) {
      console.error('Delete document error:', error)
      showWarning('删除失败：' + (error.message || '未知错误'))
      return { success: false, error: error.message || '未知错误' }
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

  const selectDocument = useCallback(async (docId) => {
    try {
      // 调用后端 API 获取文档的最新内容
      const doc = await documentApi.getById(docId)
      if (doc) {
        // 更新本地文档列表中的对应文档
        setDocuments(prev => prev.map(d => d.id === docId ? doc : d))
        // 设置当前文档 ID
        setCurrentDocId(docId)
      }
    } catch (error) {
      console.error('Select document error:', error)
      // 如果 API 调用失败，使用本地存储的文档
      const doc = documents.find(d => d.id === docId)
      if (doc) {
        setCurrentDocId(docId)
      }
    }
  }, [documents])

  const refreshCurrentDocument = useCallback(async () => {
    if (!currentDocId) return
    
    try {
      const doc = await documentApi.getById(currentDocId)
      if (doc) {
        setDocuments(prev => prev.map(d => d.id === currentDocId ? doc : d))
        console.log('Current document refreshed:', doc.title)
      }
    } catch (error) {
      console.error('Refresh current document error:', error)
    }
  }, [currentDocId])

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
    formatDate,
    refreshCurrentDocument
  }
}

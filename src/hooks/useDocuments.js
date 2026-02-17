import { useState, useEffect, useCallback } from 'react'
import { STORAGE_KEYS, DEFAULT_DOCUMENTS } from '../constants'

export const useDocuments = () => {
  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DOCUMENTS)
    return saved ? JSON.parse(saved) : DEFAULT_DOCUMENTS
  })

  const [currentDocId, setCurrentDocId] = useState(documents[0]?.id || null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(documents))
  }, [documents])

  const currentDoc = documents.find(doc => doc.id === currentDocId)

  const updateCurrentDoc = useCallback((content) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === currentDocId ? { ...doc, content, updatedAt: Date.now() } : doc
    ))
  }, [currentDocId])

  const createDocument = useCallback((title) => {
    if (!title.trim()) return null
    const newDoc = {
      id: Date.now().toString(),
      title: title.trim(),
      content: `# ${title.trim()}\n\n开始编辑你的文档...`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setDocuments(prev => [newDoc, ...prev])
    setCurrentDocId(newDoc.id)
    return newDoc
  }, [])

  const deleteDocument = useCallback((docId) => {
    if (documents.length <= 1) {
      return { success: false, error: '至少需要保留一个文档！' }
    }
    const newDocs = documents.filter(doc => doc.id !== docId)
    setDocuments(newDocs)
    if (currentDocId === docId) {
      setCurrentDocId(newDocs[0].id)
    }
    return { success: true }
  }, [documents, currentDocId])

  const formatDate = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  return {
    documents,
    currentDocId,
    currentDoc,
    setCurrentDocId,
    updateCurrentDoc,
    createDocument,
    deleteDocument,
    formatDate
  }
}

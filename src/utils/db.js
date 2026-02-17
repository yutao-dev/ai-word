import { openDB } from 'idb'
import { STORAGE_KEYS, DEFAULT_DOCUMENTS, DEFAULT_LLM_CONFIG } from '../constants'

const DB_NAME = 'ai-word-db'
const DB_VERSION = 1

const STORES = {
  DOCUMENTS: 'documents',
  LLM_CONFIG: 'llm-config',
  APP_STATE: 'app-state'
}

let dbInstance = null

const getDB = async () => {
  if (dbInstance) return dbInstance
  
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
        db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.LLM_CONFIG)) {
        db.createObjectStore(STORES.LLM_CONFIG, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
        db.createObjectStore(STORES.APP_STATE, { keyPath: 'id' })
      }
    }
  })
  
  return dbInstance
}

export const migrateFromLocalStorage = async () => {
  try {
    const db = await getDB()
    
    const savedDocs = localStorage.getItem(STORAGE_KEYS.DOCUMENTS)
    if (savedDocs) {
      const docs = JSON.parse(savedDocs)
      const tx = db.transaction(STORES.DOCUMENTS, 'readwrite')
      for (const doc of docs) {
        await tx.store.put(doc)
      }
      await tx.done
      localStorage.removeItem(STORAGE_KEYS.DOCUMENTS)
    }
    
    const savedConfig = localStorage.getItem(STORAGE_KEYS.LLM_CONFIG)
    if (savedConfig) {
      const config = JSON.parse(savedConfig)
      await db.put(STORES.LLM_CONFIG, { id: 'default', ...config })
      localStorage.removeItem(STORAGE_KEYS.LLM_CONFIG)
    }
    
    return { success: true }
  } catch (error) {
    console.error('Migration error:', error)
    return { success: false, error: error.message }
  }
}

export const getAllDocuments = async () => {
  try {
    const db = await getDB()
    const docs = await db.getAll(STORES.DOCUMENTS)
    
    if (docs.length === 0) {
      for (const doc of DEFAULT_DOCUMENTS) {
        await db.put(STORES.DOCUMENTS, doc)
      }
      return DEFAULT_DOCUMENTS
    }
    
    return docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  } catch (error) {
    console.error('Get documents error:', error)
    return DEFAULT_DOCUMENTS
  }
}

export const getDocument = async (id) => {
  try {
    const db = await getDB()
    return await db.get(STORES.DOCUMENTS, id)
  } catch (error) {
    console.error('Get document error:', error)
    return null
  }
}

export const saveDocument = async (doc) => {
  try {
    const db = await getDB()
    const updatedDoc = { ...doc, updatedAt: Date.now() }
    await db.put(STORES.DOCUMENTS, updatedDoc)
    return { success: true, doc: updatedDoc }
  } catch (error) {
    console.error('Save document error:', error)
    return { success: false, error: error.message }
  }
}

export const createDocument = async (title) => {
  try {
    const db = await getDB()
    const newDoc = {
      id: Date.now().toString(),
      title: title.trim(),
      content: `# ${title.trim()}\n\n开始编辑你的文档...`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await db.put(STORES.DOCUMENTS, newDoc)
    return { success: true, doc: newDoc }
  } catch (error) {
    console.error('Create document error:', error)
    return { success: false, error: error.message }
  }
}

export const deleteDocument = async (id) => {
  try {
    const db = await getDB()
    const docs = await db.getAll(STORES.DOCUMENTS)
    
    if (docs.length <= 1) {
      return { success: false, error: '至少需要保留一个文档！' }
    }
    
    await db.delete(STORES.DOCUMENTS, id)
    return { success: true }
  } catch (error) {
    console.error('Delete document error:', error)
    return { success: false, error: error.message }
  }
}

export const getLLMConfig = async () => {
  try {
    const db = await getDB()
    const config = await db.get(STORES.LLM_CONFIG, 'default')
    
    if (!config) {
      const defaultConfig = { id: 'default', ...DEFAULT_LLM_CONFIG }
      await db.put(STORES.LLM_CONFIG, defaultConfig)
      return defaultConfig
    }
    
    return config
  } catch (error) {
    console.error('Get LLM config error:', error)
    return { id: 'default', ...DEFAULT_LLM_CONFIG }
  }
}

export const saveLLMConfig = async (config) => {
  try {
    const db = await getDB()
    const configToSave = { id: 'default', ...config }
    await db.put(STORES.LLM_CONFIG, configToSave)
    return { success: true }
  } catch (error) {
    console.error('Save LLM config error:', error)
    return { success: false, error: error.message }
  }
}

export const getAppState = async (key) => {
  try {
    const db = await getDB()
    const state = await db.get(STORES.APP_STATE, key)
    return state?.value
  } catch (error) {
    console.error('Get app state error:', error)
    return null
  }
}

export const saveAppState = async (key, value) => {
  try {
    const db = await getDB()
    await db.put(STORES.APP_STATE, { id: key, value })
    return { success: true }
  } catch (error) {
    console.error('Save app state error:', error)
    return { success: false, error: error.message }
  }
}

export const clearAllData = async () => {
  try {
    const db = await getDB()
    await db.clear(STORES.DOCUMENTS)
    await db.clear(STORES.LLM_CONFIG)
    await db.clear(STORES.APP_STATE)
    return { success: true }
  } catch (error) {
    console.error('Clear data error:', error)
    return { success: false, error: error.message }
  }
}

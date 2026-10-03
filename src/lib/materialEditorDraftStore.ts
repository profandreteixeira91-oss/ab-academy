import type { EditorModelNode, EditorOperation, EditorSelectionState } from './materialEditorModel'

export type LocalMaterialDraft = {
  materialId: string
  titulo: string
  idioma: 'ingles' | 'alemao' | ''
  model: EditorModelNode
  selection: EditorSelectionState | null
  operations: EditorOperation[]
  version: number
  savedAt: string
}

const DB_NAME = 'ab-academy-material-editor'
const STORE_NAME = 'drafts'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'materialId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB indisponível.'))
  })
}

export async function saveLocalMaterialDraft(draft: LocalMaterialDraft) {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(draft)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('Falha ao salvar rascunho local.'))
  })
  db.close()
}

export async function loadLocalMaterialDraft(materialId: string) {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  const draft = await new Promise<LocalMaterialDraft | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(materialId)
    request.onsuccess = () => resolve((request.result as LocalMaterialDraft | undefined) || null)
    request.onerror = () => reject(request.error || new Error('Falha ao recuperar rascunho local.'))
  })
  db.close()
  return draft
}

export async function removeLocalMaterialDraft(materialId: string) {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(materialId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('Falha ao limpar rascunho local.'))
  })
  db.close()
}

export async function listLocalMaterialDrafts() {
  if (typeof indexedDB === 'undefined') return []
  const db = await openDb()
  const drafts = await new Promise<LocalMaterialDraft[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result as LocalMaterialDraft[]) || [])
    request.onerror = () => reject(request.error || new Error('Falha ao listar rascunhos locais.'))
  })
  db.close()
  return drafts.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
}

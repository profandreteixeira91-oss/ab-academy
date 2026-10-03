const DB_NAME = 'ab-academy-materials-cache'
const DB_VERSION = 1
const STORE_NAME = 'images'

type CachedImage = {
  path: string
  blob: Blob
  updatedAt: number
}

const objectUrls = new Map<string, string>()

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'path' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o cache local de imagens.'))
  })
}

export async function cacheMaterialImage(path: string, blob: Blob): Promise<void> {
  if (typeof indexedDB === 'undefined') return

  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({
      path,
      blob,
      updatedAt: Date.now(),
    } satisfies CachedImage)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Não foi possível salvar a imagem no cache local.'))
  })
  db.close()
}

export async function getCachedMaterialImage(path: string): Promise<string | null> {
  if (typeof indexedDB === 'undefined') return null

  const existingUrl = objectUrls.get(path)
  if (existingUrl) return existingUrl

  const db = await openDb()
  const cached = await new Promise<CachedImage | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(path)
    request.onsuccess = () => resolve(request.result as CachedImage | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()

  if (!cached?.blob) return null

  const url = URL.createObjectURL(cached.blob)
  objectUrls.set(path, url)
  return url
}

export async function resolveMaterialImage(
  path: string,
  createSignedUrl: () => Promise<string | null>,
  downloadImage?: () => Promise<Blob | null>,
): Promise<string | null> {
  let cachedUrl: string | null = null
  try {
    cachedUrl = await getCachedMaterialImage(path)
  } catch {
    // Se o cache local estiver indisponível, continua usando o armazenamento remoto.
  }
  if (cachedUrl) return cachedUrl

  let signedUrl: string | null = null
  try {
    signedUrl = await createSignedUrl()
  } catch {
    signedUrl = null
  }

  if (!signedUrl && downloadImage) {
    try {
      const blob = await downloadImage()
      if (blob) {
        await cacheMaterialImage(path, blob)
        const cachedObjectUrl = objectUrls.get(path)
        if (cachedObjectUrl) return cachedObjectUrl
        const objectUrl = URL.createObjectURL(blob)
        objectUrls.set(path, objectUrl)
        return objectUrl
      }
    } catch {
      // Continua para o erro final sem derrubar o restante do material.
    }
  }

  if (!signedUrl) return null

  try {
    const response = await fetch(signedUrl, { cache: 'no-store' })
    if (!response.ok) return signedUrl

    const blob = await response.blob()
    await cacheMaterialImage(path, blob)
    const cachedObjectUrl = objectUrls.get(path)
    if (cachedObjectUrl) return cachedObjectUrl

    const objectUrl = URL.createObjectURL(blob)
    objectUrls.set(path, objectUrl)
    return objectUrl
  } catch {
    return signedUrl
  }
}

import type { ISODate, Ms } from '../core/types'
import { newId } from './plan'

const DB = 'gym-dtwin-photos'
const STORE = 'photos'
const MAX_SIDE = 1280
const QUALITY = 0.8

export interface Photo {
  id: string
  date: ISODate
  t: Ms
  w: number
  h: number
  blob: Blob
}

/** Scale down to fit max on the long side; never scale up. */
export function fitSize(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no indexedDB'))
      return
    }
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = run(t.objectStore(STORE))
      t.oncomplete = () => resolve(req.result)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  } finally {
    db.close()
  }
}

export const listPhotos = async (): Promise<Photo[]> =>
  (await tx<Photo[]>('readonly', s => s.getAll())).sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t)

export const putPhoto = (p: Photo) => tx('readwrite', s => s.put(p))
export const removePhoto = (id: string) => tx('readwrite', s => s.delete(id))

/** Redraw on a canvas: resized, JPEG, and anything like EXIF stays behind. */
export async function encodePhoto(file: Blob): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const { w, h } = fitSize(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')
    if (!g) throw new Error('no canvas')
    g.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', QUALITY))
    if (!blob) throw new Error('encode failed')
    return { blob, w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function addPhoto(file: Blob, date: ISODate, now: Ms = Date.now()): Promise<Photo> {
  const photo: Photo = { id: newId(), date, t: now, ...(await encodePhoto(file)) }
  await putPhoto(photo)
  return photo
}

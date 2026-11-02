import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Lock, Plus, Trash2, X } from 'lucide-react'
import { t, type Key, type Lang } from '../../i18n'
import Sheet from '../../app/Sheet'
import { fmtDate } from '../../app/format'
import { addPhoto, listPhotos, removePhoto, type Photo } from '../../app/photos'
import { toast } from '../../app/toast'
import { isoDate } from '../../core/history'

const MAX_FILE = 30_000_000

function Compare({ photos, urls, lang }: { photos: Photo[]; urls: Record<string, string>; lang: Lang }) {
  const L = (k: Key) => t(lang, k)
  const [a, setA] = useState(photos[0].id)
  const [b, setB] = useState(photos[photos.length - 1].id)
  const [at, setAt] = useState(50)
  const before = photos.find(p => p.id === a) ?? photos[0]
  const after = photos.find(p => p.id === b) ?? photos[photos.length - 1]
  const options = photos.map(p => <option key={p.id} value={p.id}>{fmtDate(p.date, lang)}</option>)
  return (
    <div className="compare">
      <h3 className="sec">{L('beforeAfter')}</h3>
      <div className="form-grid">
        <label className="field">{L('before')}<select className="input" data-before value={before.id} onChange={e => setA(e.target.value)}>{options}</select></label>
        <label className="field">{L('after')}<select className="input" data-after value={after.id} onChange={e => setB(e.target.value)}>{options}</select></label>
      </div>
      <div className="compare-view" style={{ aspectRatio: `${after.w} / ${after.h}` }}>
        <img src={urls[after.id]} alt={`${L('after')}: ${fmtDate(after.date, lang)}`} />
        <img src={urls[before.id]} alt={`${L('before')}: ${fmtDate(before.date, lang)}`} className="over" style={{ clipPath: `inset(0 ${100 - at}% 0 0)` }} />
        <span className="compare-line" style={{ left: `${at}%` }} />
      </div>
      <input type="range" className="compare-range" min={0} max={100} value={at} aria-label={L('beforeAfter')} onChange={e => setAt(Number(e.target.value))} />
    </div>
  )
}

export default function Photos({ lang }: { lang: Lang }) {
  const L = (k: Key) => t(lang, k)
  const today = isoDate(new Date())
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Photo | null>(null)
  const [confirm, setConfirm] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    listPhotos().then(list => { if (live) setPhotos(list) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!photos) return
    const next = Object.fromEntries(photos.map(p => [p.id, URL.createObjectURL(p.blob)]))
    setUrls(next)
    return () => { Object.values(next).forEach(u => URL.revokeObjectURL(u)) }
  }, [photos])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE || !file.type.startsWith('image/')) {
      toast(L('photoBad'))
      return
    }
    setBusy(true)
    try {
      const photo = await addPhoto(file, date && date <= today ? date : today)
      setPhotos(list => [...(list ?? []), photo].sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t))
    } catch {
      toast(L('photoBad'))
    }
    setBusy(false)
  }

  const del = async (photo: Photo) => {
    setConfirm(false)
    setOpen(null)
    try {
      await removePhoto(photo.id)
      setPhotos(list => (list ?? []).filter(p => p.id !== photo.id))
      toast(L('photoDeleted'))
    } catch {
      toast(L('photoBad'))
    }
  }

  const months: { month: string; items: Photo[] }[] = []
  for (const p of [...(photos ?? [])].reverse()) {
    const month = p.date.slice(0, 7)
    const last = months.at(-1)
    if (last?.month === month) last.items.push(p)
    else months.push({ month, items: [p] })
  }
  const ready = photos ? photos.every(p => urls[p.id]) : false

  return (
    <section className="card photos">
      <h2>{L('photos')}</h2>
      <p className="muted photos-private"><Lock size={14} />{L('photosPrivate')}</p>
      {failed ? <p className="empty pad" data-photos-off>{L('photosOff')}</p> : (
        <>
          <div className="photo-add">
            <label className="field">{L('date')}<input className="input" type="date" max={today} value={date} onChange={e => setDate(e.target.value)} /></label>
            <button type="button" className="btn primary" disabled={busy || !photos} onClick={() => input.current?.click()}><Plus size={16} />{L('addPhoto')}</button>
            <input ref={input} type="file" accept="image/*" hidden data-photo-file onChange={onFile} aria-label={L('addPhoto')} />
          </div>
          {photos?.length === 0 && <p className="empty pad">{L('noPhotos')}</p>}
          {photos && photos.length >= 2 && ready && <Compare photos={photos} urls={urls} lang={lang} />}
          {ready && months.map(g => (
            <div key={g.month}>
              <h3 className="sec photo-month">{fmtDate(`${g.month}-01`, lang, { month: 'long', year: 'numeric' })}</h3>
              <div className="photo-grid">
                {g.items.map(p => (
                  <button type="button" key={p.id} className="photo-thumb" data-photo={p.id} aria-label={fmtDate(p.date, lang)} onClick={() => setOpen(p)}>
                    <img src={urls[p.id]} alt="" loading="lazy" />
                    <span>{fmtDate(p.date, lang, { day: 'numeric', month: 'short' })}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      {open && urls[open.id] && (
        <Sheet onClose={() => setOpen(null)} label={fmtDate(open.date, lang)} className="photo-sheet">
          <header className="sheet-head">
            <h2>{fmtDate(open.date, lang)}</h2>
            <button type="button" className="icon-btn" onClick={() => setOpen(null)} aria-label={L('close')}><X size={20} /></button>
          </header>
          <img className="photo-full" src={urls[open.id]} alt={fmtDate(open.date, lang)} />
          <div className="row center"><button type="button" className="btn danger" data-photo-del onClick={() => setConfirm(true)}><Trash2 size={16} />{L('remove')}</button></div>
          {confirm && (
            <Sheet onClose={() => setConfirm(false)} label={L('photoDelAsk')} className="confirm">
              <h2>{L('photoDelAsk')}</h2>
              <p className="muted">{L('photoDelText')}</p>
              <div className="row between">
                <button type="button" className="btn" onClick={() => setConfirm(false)}>{L('cancel')}</button>
                <button type="button" className="btn danger" data-photo-del-yes onClick={() => del(open)}>{L('remove')}</button>
              </div>
            </Sheet>
          )}
        </Sheet>
      )}
    </section>
  )
}

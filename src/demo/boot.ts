import { getProfile, replaceProfile, subscribeProfile } from '../app/store'
import { putPhoto, listPhotos, removePhoto } from '../app/photos'
import { addDays, isoDate, parseIso } from '../core/history'
import { demoProfile } from './seed'

const PILL: Record<'uz' | 'ru' | 'en', string> = {
  uz: 'Demo · namuna ma\'lumotlar, qayta yuklanganda tiklanadi',
  ru: 'Демо · примерные данные, сбрасываются при перезагрузке',
  en: 'Demo · sample data, changes reset on reload',
}

function pill() {
  const el = document.createElement('div')
  el.className = 'demo-pill'
  el.setAttribute('role', 'note')
  el.style.cssText = [
    'position:fixed', 'right:12px', 'bottom:calc(76px + env(safe-area-inset-bottom))', 'z-index:9999',
    'padding:6px 12px', 'border-radius:999px', 'font:500 12px/1.3 Inter,system-ui,sans-serif',
    'background:rgba(15,16,18,.86)', 'color:#e9ecef', 'border:1px solid rgba(198,244,50,.45)',
    'box-shadow:0 4px 18px rgba(0,0,0,.35)', 'pointer-events:none', 'max-width:calc(100vw - 24px)',
    'backdrop-filter:blur(6px)',
  ].join(';')
  const dot = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#c6f432;margin-right:7px;vertical-align:1px"></span>'
  const paint = () => { el.innerHTML = dot + PILL[getProfile().settings.lang] }
  paint()
  subscribeProfile(paint)
  const style = document.createElement('style')
  style.textContent = '@media (max-width: 600px){.demo-pill{font-size:11px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}@media (min-width: 900px){.demo-pill{bottom:16px!important;right:16px!important}}@media (min-width: 1240px){.demo-pill{max-width:224px!important;border-radius:14px!important}}'
  document.head.append(style)
  document.body.append(el)
}

/** A drawn stand-in for a progress photo: the real feature keeps photos only on the device. */
async function drawPhoto(i: number, date: string): Promise<{ blob: Blob; w: number; h: number } | null> {
  const w = 600
  const h = 800
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return null
  const bg = g.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#22262d')
  bg.addColorStop(1, '#0f1012')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  const waist = 118 - i * 7
  g.fillStyle = '#3a4150'
  g.beginPath()
  g.arc(w / 2, 150, 56, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.moveTo(w / 2 - 150 - i * 4, 240)
  g.quadraticCurveTo(w / 2, 214, w / 2 + 150 + i * 4, 240)
  g.lineTo(w / 2 + waist, 520)
  g.lineTo(w / 2 + 104, 760)
  g.lineTo(w / 2 - 104, 760)
  g.lineTo(w / 2 - waist, 520)
  g.closePath()
  g.fill()
  g.strokeStyle = 'rgba(198,244,50,.5)'
  g.setLineDash([8, 8])
  g.beginPath()
  g.moveTo(w / 2 - waist - 30, 520)
  g.lineTo(w / 2 + waist + 30, 520)
  g.stroke()
  g.fillStyle = '#c6f432'
  g.font = '600 30px Inter, sans-serif'
  g.fillText(date, 32, 56)
  g.fillStyle = '#9aa3ae'
  g.font = '500 22px Inter, sans-serif'
  g.fillText('namuna', 32, 90)
  const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/jpeg', 0.7))
  return blob ? { blob, w, h } : null
}

async function seedPhotos() {
  try {
    for (const old of await listPhotos()) await removePhoto(old.id)
    const today = isoDate(new Date())
    for (let i = 0; i < 4; i++) {
      const date = addDays(today, -(3 - i) * 42 - 3)
      const img = await drawPhoto(i, date)
      if (img) await putPhoto({ id: `demo-photo-${i}`, date, t: parseIso(date).getTime() + 9 * 3_600_000, ...img })
    }
  } catch {
    // no IndexedDB here: the photos tab explains itself
  }
}

export async function startDemo() {
  if (!location.hash || location.hash === '#' || location.hash === '#/') history.replaceState(null, '', '#/home')
  replaceProfile(demoProfile())
  pill()
  await seedPhotos()
}

(() => {
  const Q = new URLSearchParams(location.search)
  const LANG = window.OV_LANG || 'uz'
  if (LANG === 'uz' && location.pathname === '/overview/' && !Q.has('lang')) {
    let want = null
    try { want = (JSON.parse(localStorage.getItem('gym-dtwin:v1') || '{}').lang) || null } catch {}
    if (!want) { const b = (navigator.language || '').toLowerCase(); want = b.startsWith('ru') ? 'ru' : b.startsWith('en') ? 'en' : 'uz' }
    if (want === 'ru' || want === 'en') { location.replace('/overview/' + want + '/' + location.search + location.hash); return }
  }
  const SHOT = Q.has('shot')
  const REDUCED = SHOT || matchMedia('(prefers-reduced-motion: reduce)').matches
  const deck = document.getElementById('deck')
  const slides = [...deck.querySelectorAll('.sl')]
  const tpl = slides.map(s => s.innerHTML)
  const segs = document.getElementById('segs')
  const cnt = document.getElementById('cnt')
  const glow = document.querySelector('.glow')
  const N = slides.length
  segs.innerHTML = slides.map(() => '<div class="seg"><i></i></div>').join('')
  const segEls = [...segs.children]

  const fmt = (v, d = 0) => {
    const s = Math.abs(v).toFixed(d).split('.')
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, LANG === 'en' ? ',' : ' ')
    return (v < 0 ? '−' : '') + s.join(LANG === 'en' ? '.' : ',')
  }
  window.DT = {
    fmt,
    count(tl, el, to, at, o = {}) {
      const node = typeof el === 'string' ? cur().querySelector(el) : el
      if (!node) return
      const st = { v: o.from ?? 0 }
      node.textContent = (o.pre || '') + fmt(st.v, o.d || 0) + (o.suf || '')
      tl.to(st, { v: to, duration: o.dur ?? 1.3, ease: o.ease || 'power3.out',
        onUpdate: () => { node.textContent = (o.pre || '') + fmt(st.v, o.d || 0) + (o.suf || '') } }, at)
    },
    type(tl, el, text, at, cps = 22) {
      const node = typeof el === 'string' ? cur().querySelector(el) : el
      const st = { n: 0 }
      node.textContent = ''
      tl.to(st, { n: text.length, duration: text.length / cps, ease: 'none',
        onUpdate: () => { node.textContent = text.slice(0, Math.round(st.n)) } }, at)
    },
    arc(r, a0, a1) {
      const p = a => [r * Math.cos((a - 90) * Math.PI / 180), r * Math.sin((a - 90) * Math.PI / 180)]
      const [x0, y0] = p(a0), [x1, y1] = p(a1)
      return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
    }
  }
  let loops = []
  DT.loop = tw => { if (REDUCED) { tw.kill(); return tw } loops.push(tw); return tw }
  DT.reduced = REDUCED
  const SCENES = window.SCENES || {}

  let i = -1, tl = null, elapsed = 0, total = 8, paused = false, holding = false, last = performance.now()
  const cur = () => slides[i]

  function fit(root) {
    const portrait = innerHeight > innerWidth
    root.querySelectorAll('.vis').forEach(v => {
      const b = v.querySelector('.vbox'); if (!b) return
      const bw = b.offsetWidth, bh = b.offsetHeight
      if (portrait && !v.classList.contains('bgv')) {
        const sl = v.closest('.sl'), cs = getComputedStyle(sl), t = sl.querySelector('.txt')
        const avail = sl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (t ? t.offsetHeight : 0) - 28
        const s = Math.max(.3, Math.min(v.clientWidth / bw, avail / bh, 1.1))
        v.style.height = Math.round(bh * s) + 'px'
        b.style.setProperty('--vs', s.toFixed(3))
        return
      }
      v.style.height = ''
      const s = Math.max(.3, Math.min(v.clientWidth / bw, v.clientHeight / bh, 1.3))
      b.style.setProperty('--vs', s.toFixed(3))
    })
  }
  function split(root) {
    root.querySelectorAll('.h').forEach(h => {
      const walk = n => [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) {
          const f = document.createDocumentFragment()
          c.textContent.split(/(\s+)/).forEach(t => {
            if (!t) return
            if (/^\s+$/.test(t)) { f.append(document.createTextNode(t)); return }
            const w = document.createElement('span'); w.className = 'w'
            const s = document.createElement('span'); s.textContent = t
            w.append(s); f.append(w)
          })
          c.replaceWith(f)
        } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c)
      })
      walk(h)
    })
  }

  function build(s, idx) {
    const t = gsap.timeline({ paused: true })
    const k = s.querySelector('.kick'), ws = s.querySelectorAll('.h .w>span'), l = s.querySelectorAll('.lead,.pts li,.txt .after')
    if (k) t.from(k, { opacity: 0, x: -16, duration: .5, ease: 'power2.out' }, 0)
    if (ws.length) t.from(ws, { yPercent: 110, duration: .75, ease: 'power4.out', stagger: .045 }, .08)
    if (l.length) t.from(l, { opacity: 0, y: 14, duration: .6, ease: 'power2.out', stagger: .09 }, .45)
    const fn = SCENES[s.dataset.id]
    if (fn) { const st = gsap.timeline(); fn(st, s, DT); t.add(st, s.dataset.at ? +s.dataset.at : .35) }
    return t
  }

  function go(n, dir = 1) {
    n = Math.max(0, Math.min(N - 1, n))
    if (n === i && tl) return
    if (tl) tl.kill()
    loops.forEach(k => k.kill()); loops = []
    const prevI = i
    i = n
    if (prevI >= 0) {
      const old = slides[prevI]
      const done = () => { if (prevI === i) return; old.classList.remove('on'); old.innerHTML = tpl[prevI] }
      if (REDUCED) { gsap.killTweensOf(old); done() } else gsap.to(old, { opacity: 0, duration: .35, onComplete: done })
    }
    const s = slides[i]
    s.innerHTML = tpl[i]
    s.classList.add('on')
    gsap.killTweensOf(s)
    gsap.set(s, { opacity: 1 })
    split(s); fit(s)
    if (!REDUCED) gsap.from(s.querySelector('.vis') || s, { opacity: 0, y: 30 * dir, scale: .97, duration: .8, ease: 'power3.out' })
    tl = build(s, i)
    if (REDUCED) tl.progress(1); else tl.play(0)
    total = tl.duration() + (+s.dataset.hold || 4.5)
    elapsed = 0
    segEls.forEach((g, j) => { g.classList.toggle('done', j < i); g.firstChild.style.transform = j < i ? 'none' : 'scaleX(0)' })
    cnt.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0')
    history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1))
    if (glow && !REDUCED) glow.style.transform = `translate(${(i % 3 - 1) * 6}%, ${((i * 7) % 5 - 2) * 3}%) rotate(${i * 9}deg)`
    document.querySelectorAll('.ov-g button').forEach((b, j) => b.classList.toggle('cur', j === i))
    window.dispatchEvent(new CustomEvent('dt-slide', { detail: { i, id: s.dataset.id } }))
  }
  const next = () => (i < N - 1 ? go(i + 1, 1) : (setPaused(true)))
  const prev = () => go(i - 1, -1)
  function setPaused(p) { paused = p; document.body.classList.toggle('paused', p); if (tl) p ? tl.pause() : (tl.progress() < 1 && tl.play()) ; syncPlay() }
  function syncPlay() { const b = document.getElementById('play'); if (b) b.innerHTML = paused ? ICON.play : ICON.pause }

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>'
  }

  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now
    if (!paused && !holding && !document.hidden && i >= 0 && !SHOT) {
      elapsed += dt
      const p = Math.min(1, elapsed / total)
      segEls[i].firstChild.style.transform = 'scaleX(' + p.toFixed(4) + ')'
      if (p >= 1) next()
    }
    requestAnimationFrame(loop)
  }

  // input
  let down = null
  deck.addEventListener('pointerdown', e => {
    if (e.target.closest('a,button,input,.noswipe')) return
    down = { x: e.clientX, y: e.clientY, t: performance.now() }
    down.timer = setTimeout(() => { holding = true; document.body.classList.add('paused'); tl && tl.pause() }, 260)
  })
  const release = e => {
    if (!down) return
    clearTimeout(down.timer)
    const dx = e.clientX - down.x, dy = e.clientY - down.y, dtm = performance.now() - down.t
    const wasHold = holding
    if (holding) { holding = false; if (!paused) { document.body.classList.remove('paused'); tl && tl.progress() < 1 && tl.play() } }
    down = null
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); return }
    if (wasHold || dtm > 260 || Math.abs(dx) > 12 || Math.abs(dy) > 12) return
    e.clientX < innerWidth * .3 ? prev() : next()
  }
  deck.addEventListener('pointerup', release)
  deck.addEventListener('pointercancel', () => { if (down) clearTimeout(down.timer); down = null; holding = false })
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); next() }
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev() }
    else if (k === 'Home') go(0)
    else if (k === 'End') go(N - 1)
    else if (k === 'p' || k === 'P' || k === 'k' || k === 'K') setPaused(!paused)
    else if (k === 'o' || k === 'O' || k === 'Escape') toggleOv(k === 'Escape' ? false : undefined)
    else if (k === 'f' || k === 'F') fs()
    else if (k === 'r' || k === 'R') go(i, 1) || (tl && tl.play(0))
  })
  function fs() { const d = document; if (!d.fullscreenElement) d.documentElement.requestFullscreen?.().catch(() => {}); else d.exitFullscreen?.() }
  const ov = document.getElementById('ov')
  function toggleOv(v) { const on = v ?? !ov.classList.contains('on'); ov.classList.toggle('on', on); if (on) setPaused(true) }
  ov.querySelector('.ov-g').innerHTML = slides.map((s, j) =>
    `<button data-j="${j}"><b>${String(j + 1).padStart(2, '0')} · ${s.querySelector('.kick')?.textContent || ''}</b><span>${s.dataset.title || s.querySelector('.h')?.textContent || ''}</span></button>`).join('')
  ov.addEventListener('click', e => { const b = e.target.closest('[data-j]'); if (b) { toggleOv(false); go(+b.dataset.j); setPaused(false) } })
  document.getElementById('menu').onclick = () => toggleOv()
  document.getElementById('ovx').onclick = () => toggleOv(false)
  document.getElementById('play').onclick = () => setPaused(!paused)
  document.getElementById('fs').onclick = fs
  document.getElementById('pv').onclick = prev
  document.getElementById('nx').onclick = next
  document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(+a.dataset.go) } })
  addEventListener('resize', () => i >= 0 && fit(slides[i]))
  addEventListener('hashchange', () => { const n = (parseInt(location.hash.slice(1)) || 1) - 1; if (n !== i) go(n, n > i ? 1 : -1) })
  document.addEventListener('visibilitychange', () => { if (tl) document.hidden ? tl.pause() : (!paused && !holding && tl.progress() < 1 && tl.play()) })

  const start = Math.max(1, Math.min(N, parseInt((location.hash || '#1').slice(1)) || 1)) - 1
  const boot = () => { go(start); syncPlay(); requestAnimationFrame(loop) }
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(boot); else boot()
  if (SHOT) document.documentElement.classList.add('shot')
})()

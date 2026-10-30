;
(() => {
const $ = (s, q) => s.querySelector(q), $$ = (s, q) => [...s.querySelectorAll(q)]
const NS = 'http://www.w3.org/2000/svg'
const sv = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e }
const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>'
const beat = u => { const g = (c, w) => Math.exp(-((u - c) * (u - c)) / (2 * w * w)); return .12 * g(.18, .025) - .14 * g(.3, .008) + g(.33, .009) - .28 * g(.36, .01) + .24 * g(.56, .04) }
const ecgPath = (w, h, period, amp, x0 = 0) => { let d = ''; for (let x = 0; x <= w; x += 2) { const u = (((x + x0) / period) % 1 + 1) % 1; d += (x ? 'L' : 'M') + x + ' ' + (h / 2 - beat(u) * amp).toFixed(1) } return d }

function draw(tl, path, at, dur = 1.2) {
  const L = path.getTotalLength()
  path.style.strokeDasharray = L
  tl.fromTo(path, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power2.inOut' }, at)
}
function ring(tl, c, p, at, dur = 1.4) {
  const len = +c.getAttribute('stroke-dasharray')
  tl.fromTo(c, { attr: { 'stroke-dashoffset': len } }, { attr: { 'stroke-dashoffset': len * (1 - p) }, duration: dur, ease: 'power3.out' }, at)
}
function pop(tl, t, at, o = {}) { if (!t || (t.length === 0)) return; tl.from(t, { opacity: 0, scale: o.s ?? .85, y: o.y ?? 16, duration: o.d ?? .55, ease: o.e || 'back.out(1.7)', stagger: o.st ?? .08 }, at) }
function tick(tl, ck, at) { tl.call(() => ck.classList.add('on'), null, at); tl.fromTo(ck, { scale: .6 }, { scale: 1, duration: .4, ease: 'back.out(3)' }, at) }
function tap(tl, b, at) { tl.to(b, { scale: .92, duration: .12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, at) }
function ecgInto(svg, w, h, amp, period, color, width = 2.4) {
  const p = sv('path', { d: ecgPath(w, h, period, amp), fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })
  svg.append(p); return p
}

window.SCENES = {
cover(tl, s, D) {
  const g = $(s, '#cv-plates')
  const C = [['229 50 45', 250], ['47 111 228', 214], ['245 197 24', 178], ['47 179 90', 142]]
  C.forEach(([c, r], k) => {
    g.append(sv('circle', { r, fill: 'none', stroke: `rgb(${c} / .55)`, 'stroke-width': 18, 'stroke-dasharray': k % 2 ? '60 18' : '120 14' }))
  })
  g.append(sv('circle', { r: 112, fill: 'none', stroke: 'rgb(255 255 255 / .08)', 'stroke-width': 1 }))
  tl.from(g.children, { attr: { r: 0 }, opacity: 0, duration: 1.3, stagger: .12, ease: 'power3.out' }, 0)
  const e = $(s, '#cv-ecg'), p = ecgInto(e, 1200, 160, 70, 300, 'rgb(255 90 54)', 3)
  draw(tl, p, .3, 2.6)
  tl.call(() => { D.loop(gsap.to(g, { rotation: 360, svgOrigin: '0 0', duration: 90, repeat: -1, ease: 'none' })) }, null, 0)
},

plan(tl, s, D) {
  const cards = $$(s, '.pl-c')
  pop(tl, cards, .2, { st: .12 })
  const order = [0, 1, 2, 3, 0]
  order.forEach((k, j) => {
    const at = 1 + j * .75
    tl.call(() => { cards.forEach((c, i) => c.classList.toggle('on', i === k)); $$(s, '.pl-d').forEach(d => d.classList.toggle('show', +d.dataset.p === k)) }, null, at)
    tl.fromTo(cards[k], { scale: 1.04 }, { scale: 1, duration: .45, ease: 'back.out(3)' }, at)
  })
  pop(tl, $(s, '#pl-rot'), .6, { s: .95 })
},

today(tl, s, D) {
  pop(tl, $(s, '.phone'), 0, { s: .94, y: 30 })
  pop(tl, $$(s, '.td-li'), .5, { st: .08, s: .96, y: 8 })
  D.count(tl, '#td-w', 3, 1, { dur: 1 })
  D.count(tl, '#td-t', 24, 1, { dur: 1.2 })
  D.count(tl, '#td-v', 18.4, 1, { dur: 1.3, d: 1, suf: ' t' })
  tap(tl, $(s, '#td-go'), 2.6)
  tl.to($(s, '#td-go'), { boxShadow: '0 0 0 10px rgb(198 244 50 / 0)', duration: .6 }, 2.7)
  pop(tl, $(s, '#td-side'), 1.6, { s: .95 })
},

log(tl, s, D) {
  const rows = $$(s, '.lg-r')
  pop(tl, $(s, '#lg-card'), 0, { s: .96 })
  rows.forEach((r, k) => {
    const at = .7 + k * .75
    tl.from(r, { opacity: 0, x: 18, duration: .4, ease: 'power3.out' }, at - .4)
    tap(tl, $(r, '.ck'), at)
    tick(tl, $(r, '.ck'), at + .15)
    tl.call(() => r.classList.add('done'), null, at + .15)
  })
  pop(tl, $(s, '#lg-auto'), 3.6, { s: .95 })
},

rest(tl, s, D) {
  const c = $(s, '#rs-ring')
  const len = +c.getAttribute('stroke-dasharray')
  tl.fromTo(c, { attr: { 'stroke-dashoffset': 0 } }, { attr: { 'stroke-dashoffset': len * .5 }, duration: 3.4, ease: 'none' }, .4)
  const n = $(s, '#rs-n'), st = { v: 90 }
  n.textContent = '1:30'
  tl.to(st, { v: 45, duration: 3.4, ease: 'none', onUpdate: () => { const v = Math.ceil(st.v); n.textContent = Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0') } }, .4)
  pop(tl, $$(s, '.rs-p'), .2, { st: .1 })
  pop(tl, $(s, '#rs-next'), 3.9, { s: .9 })
  tl.call(() => D.loop(gsap.to($(s, '#rs-pulse'), { scale: 1.08, opacity: .2, duration: .9, yoyo: true, repeat: -1, transformOrigin: '50% 50%' })), null, .4)
},

pr(tl, s, D) {
  pop(tl, $(s, '#pr-tr'), .2, { s: .4, e: 'back.out(2.4)', d: .8 })
  const rays = $(s, '#pr-rays')
  for (let k = 0; k < 16; k++) { const a = k * 22.5 * Math.PI / 180; rays.append(sv('line', { x1: Math.cos(a) * 70, y1: Math.sin(a) * 70, x2: Math.cos(a) * 112, y2: Math.sin(a) * 112, stroke: k % 2 ? 'rgb(255 198 64 / .7)' : 'rgb(255 90 54 / .6)', 'stroke-width': 3, 'stroke-linecap': 'round' })) }
  tl.from(rays.children, { opacity: 0, scale: 0, svgOrigin: '0 0', duration: .6, stagger: .02, ease: 'back.out(2)' }, .5)
  tl.call(() => D.loop(gsap.to(rays, { rotation: 360, svgOrigin: '0 0', duration: 30, repeat: -1, ease: 'none' })), null, .5)
  pop(tl, $$(s, '.pr-f'), 1.2, { st: .2, s: .9 })
  D.count(tl, '#pr-v', 102, 2, { dur: 1.4, suf: ' kg' })
  pop(tl, $(s, '#pr-old'), 3, { s: .95 })
},

exercises(tl, s, D) {
  pop(tl, $(s, '#ex-card'), 0, { s: .96 })
  D.type(tl, $(s, '#ex-q'), $(s, '#ex-q').dataset.t, .5, 8)
  const chips = $$(s, '.ex-ch')
  tl.call(() => { chips.forEach(c => c.classList.remove('acc')); chips[1].classList.add('acc') }, null, 1.5)
  pop(tl, $$(s, '.ex-it'), 1.6, { st: .1, s: .96, y: 10 })
  pop(tl, $$(s, '.ex-m'), 2.6, { st: .06 })
},

progress(tl, s, D) {
  const box = $(s, '#hm')
  for (let i = 0; i < 84; i++) {
    const w = Math.floor(i / 7), d = i % 7
    const on = (d === 0 || d === 2 || d === 4 || (d === 5 && w % 3 === 1)) && !(w === 3 && d === 2) && w > 0
    const c = document.createElement('i'); if (on) c.className = w > 8 ? 'l2' : 'l1'; box.append(c)
  }
  pop(tl, $(s, '#hm-card'), 0, { s: .96 })
  tl.from($$(box, 'i.l1, i.l2'), { scale: 0, opacity: 0, duration: .3, stagger: .03, ease: 'back.out(2)' }, .5)
  D.count(tl, '#hm-n', 38, .5, { dur: 1.9 })
  D.count(tl, '#hm-s', 6, 1.6, { dur: .9 })
  pop(tl, $$(s, '.hm-k'), 2.5, { st: .1 })
},

weight(tl, s, D) {
  pop(tl, $(s, '#wt-card'), 0, { s: .96 })
  draw(tl, $(s, '#wt-line'), .5, 2)
  D.count(tl, '#wt-v', 78.3, .5, { from: 82.4, dur: 2, d: 1, suf: ' kg' })
  pop(tl, $$(s, '.wt-r'), 1.4, { st: .12, s: .96, y: 8 })
  tl.from($$(s, '.wt-r i b'), { width: 0, duration: 1, stagger: .12, ease: 'power3.out' }, 1.6)
},

langs(tl, s, D) {
  const hs = $$(s, '.lg-h'), ps = $$(s, '.lg-p')
  pop(tl, $(s, '#ln-card'), 0, { s: .96 })
  ;[0, 1, 2, 0].forEach((k, j) => {
    const at = .6 + j * .9
    tl.call(() => { hs.forEach((h, i) => h.classList.toggle('show', i === k)); ps.forEach((p, i) => p.classList.toggle('acc', i === k)) }, null, at)
  })
  pop(tl, $$(s, '.ln-t'), 1, { st: .12, s: .95 })
  $$(s, '.ln-t .ck').forEach((c, k) => tick(tl, c, 1.4 + k * .3))
},

coach(tl, s, D) {
  const m = $$(s, '.msg')
  pop(tl, $(s, '.phone'), 0, { s: .95, y: 24 })
  tl.from(m[0], { opacity: 0, y: 14, duration: .45 }, .5)
  tl.from(m[1], { opacity: 0, y: 14, duration: .45 }, 1.2)
  pop(tl, m.slice(2), 3.6, { st: .4, s: .94, y: 12 })
  D.type(tl, $(s, '#co-ans'), $(s, '#co-ans').dataset.t, 1.4, 45)
  pop(tl, $(s, '#co-plan'), 3, { s: .94 })
  pop(tl, $$(s, '#co-plan .co-x'), 3.3, { st: .15 })
},

wear(tl, s, D) {
  const svg = $(s, '#wr-ecg')
  const p = ecgInto(svg, 560, 120, 46, 140, 'rgb(255 90 54)', 3)
  draw(tl, p, .4, 2.4)
  pop(tl, $(s, '#wr-watch'), 0, { s: .9 })
  D.count(tl, '#wr-bpm', 142, .4, { from: 68, dur: 2.4 })
  pop(tl, $$(s, '.wr-src'), 1.2, { st: .14 })
  $$(s, '.wr-src .ck').forEach((c, k) => tick(tl, c, 1.8 + k * .35))
  pop(tl, $$(s, '.wr-z'), 2.6, { st: .08 })
  tl.call(() => D.loop(gsap.to($(s, '#wr-heart'), { scale: 1.2, duration: .21, yoyo: true, repeat: -1, repeatDelay: .2, transformOrigin: '50% 50%' })), null, .4)
},

food(tl, s, D) {
  pop(tl, $(s, '#fd-card'), 0, { s: .96 })
  $$(s, '.fd-ring').forEach((c, k) => ring(tl, c, +c.dataset.p, .5 + k * .2))
  D.count(tl, '#fd-k', 2140, .5, { dur: 1.6 })
  pop(tl, $$(s, '.fd-i'), 1.4, { st: .14, s: .96, y: 10 })
},

form(tl, s, D) {
  pop(tl, $(s, '#fm-cam'), 0, { s: .96 })
  const bones = $$(s, '.fm-b')
  bones.forEach((b, k) => draw(tl, b, .5 + k * .15, .5))
  pop(tl, $$(s, '.fm-j'), .5, { st: .07, s: .3 })
  D.count(tl, '#fm-a', 92, 1.4, { from: 160, dur: 1.4, suf: '°' })
  pop(tl, $$(s, '.fm-c'), 2.4, { st: .2 })
  $$(s, '.fm-c .ck').forEach((c, k) => tick(tl, c, 2.6 + k * .2))
  tl.call(() => D.loop(gsap.to($(s, '#fm-scan'), { y: 300, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' })), null, .4)
},

gyms(tl, s, D) {
  pop(tl, $$(s, '.gy-t'), .2, { st: .15, s: .95 })
  pop(tl, $(s, '#gy-qr'), 1.4, { s: .85 })
  tl.from($$(s, '#gy-qr rect.q'), { opacity: 0, duration: .02, stagger: .006 }, 1.5)
  tl.from($(s, '#gy-scan'), { scaleX: 0, duration: .5, transformOrigin: '0 50%' }, 2.6)
  pop(tl, $(s, '#gy-ok'), 3.1, { s: .8, e: 'back.out(3)' })
},

social(tl, s, D) {
  pop(tl, $(s, '.phone'), 0, { s: .95, y: 24 })
  pop(tl, $$(s, '.msg'), .5, { st: .5, s: .94, y: 12 })
  pop(tl, $(s, '#sc-board'), 1.2, { s: .95 })
  $$(s, '.sc-b').forEach((b, k) => tl.from(b, { width: 0, duration: 1.1, ease: 'power3.out' }, 1.5 + k * .12))
  pop(tl, $(s, '#sc-badge'), 3, { s: .7, e: 'back.out(3)' })
},

dtwin(tl, s, D) {
  pop(tl, $(s, '#dt-card'), 0, { s: .96 })
  pop(tl, $$(s, '.dt-s:not(#dt-w)'), .4, { st: .1, s: .96, y: 8 })
  const w = $(s, '#dt-w')
  tl.from(w, { opacity: 0, x: 120, scale: .9, duration: .8, ease: 'back.out(1.6)' }, 1.4)
  tl.to(w, { boxShadow: '0 0 0 3px rgb(198 244 50 / .5)', duration: .3, yoyo: true, repeat: 1 }, 2.2)
  pop(tl, $$(s, '.dt-dev'), 2.4, { st: .12 })
  $$(s, '.dt-dev .ck').forEach((c, k) => tick(tl, c, 2.7 + k * .2))
},

final(tl, s, D) {
  const g = $(s, '#fn-rings')
  ;[[120, '229 50 45'], [170, '47 111 228'], [220, '245 197 24'], [270, '47 179 90']].forEach(([r, c], k) => g.append(sv('circle', { r, fill: 'none', stroke: `rgb(${c} / ${.42 - k * .07})`, 'stroke-width': 2, 'stroke-dasharray': k % 2 ? '3 9' : 'none' })))
  tl.from(g.children, { attr: { r: 0 }, opacity: 0, duration: 1.4, stagger: .15, ease: 'power3.out' }, 0)
  tl.call(() => D.loop(gsap.to(g.ownerSVGElement, { rotation: 360, duration: 120, repeat: -1, ease: 'none' })), null, 0)
}
}
window.OV_CHECK = CHECK
})()

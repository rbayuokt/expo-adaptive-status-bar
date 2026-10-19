#!/usr/bin/env node
// Builds docs/how-it-works.svg and docs/benchmark.svg, then renders both to 2x PNG with headless
// Chrome. Colors follow the example app. Benchmark numbers are the measured runs in the README,
// edit RUNS when they are re-measured.
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..', '..')
const DOCS = path.join(ROOT, 'docs')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const C = {
  ink: '#0B0B0F',
  surface: '#15151C',
  raised: '#1E1E27',
  line: 'rgba(255,255,255,0.08)',
  grid: 'rgba(255,255,255,0.07)',
  text: '#F4F4F6',
  muted: '#9C9CA8',
  faint: '#5E5E6A',
  sun: '#FFB547',
  moon: '#7C8CFF',
}
// Chart series, validated with the dataviz palette checker on the dark surface (all pairs).
const SERIES = ['#6C7CF5', '#C9841C', '#1FA67E']
const FONT = "-apple-system, 'SF Pro Display', Inter, Helvetica, Arial, sans-serif"
const MONO = "'SF Mono', Menlo, monospace"

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
<rect width="${w}" height="${h}" fill="${C.ink}"/>
${body}
</svg>
`
}

function text(x, y, s, { size = 14, fill = C.text, weight = 400, anchor = 'start', mono = false, spacing } = {}) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${
    mono ? ` font-family="${MONO}"` : ''
  }${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(s)}</text>`
}

function lines(x, y, rows, opts = {}) {
  const lh = opts.lh ?? (opts.size ?? 14) * 1.45
  return rows.map((r, i) => text(x, y + i * lh, r, opts)).join('\n')
}

function card(x, y, w, h, r = 20, fill = C.surface) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${C.line}"/>`
}

function header(kicker, title, subtitle) {
  return [
    text(48, 64, kicker, { size: 13, fill: C.moon, weight: 700, spacing: 2.4 }),
    text(48, 104, title, { size: 34, weight: 800, spacing: -0.8 }),
    text(48, 136, subtitle, { size: 16, fill: C.muted }),
  ].join('\n')
}

// Horizontal bar from x0, rounded only at the data end.
function hbar(x0, y, len, thick, fill) {
  if (len <= 0) return ''
  const r = Math.min(4, len / 2, thick / 2)
  const x1 = x0 + len
  return `<path d="M${x0} ${y} H${x1 - r} Q${x1} ${y} ${x1} ${y + r} V${y + thick - r} Q${x1} ${y + thick} ${x1 - r} ${
    y + thick
  } H${x0} Z" fill="${fill}"/>`
}

function arrow(x1, y, x2) {
  return `<path d="M${x1} ${y} H${x2 - 8}" stroke="${C.faint}" stroke-width="2" fill="none"/>
<path d="M${x2 - 9} ${y - 5} L${x2} ${y} L${x2 - 9} ${y + 5}" stroke="${C.faint}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
}

// ---------------------------------------------------------------------------------------------
// How it works

function howItWorks() {
  const W = 1600
  const H = 950
  const out = [header('UNDER THE HOOD', 'One sample, from a drawn frame to the icons', 'All of it runs in Swift and Kotlin. JavaScript sends the config once and only hears back when the style changes.')]

  const steps = [
    ['Signal', 'Something drew', ['Android: OnDrawListener,', 'once per drawn frame.', 'iOS: a run loop turn that', 'did work, or a touch.']],
    ['Schedule', 'Sample now or wait', ['100 ms while it changes,', 'backing off to 300 then', '900 ms while it doesn\'t.', 'One sample in flight.']],
    ['Capture', 'Copy the strip', ['Android: PixelCopy into a', '96×8 bitmap, GPU scaled.', 'iOS: draw only the layers', 'that touch the strip.']],
    ['Measure', 'Read the icon zones', ['Linear sRGB luminance in', 'the left and right zones,', 'combined where white and', 'black tie on contrast.']],
    ['Decide', 'Hysteresis', ['Dark icons from 0.58,', 'white icons below 0.42.', 'Near a threshold, two', 'readings must agree.']],
    ['Apply', 'Set the icons', ['override › hint › sample.', 'Android: insets controller.', 'iOS: setStatusBarStyle.', 'Only when it changed.']],
  ]
  const top = 180
  const gap = 20
  const cw = (W - 96 - gap * 5) / 6
  const ch = 210
  steps.forEach(([k, title, body], i) => {
    const x = 48 + i * (cw + gap)
    out.push(card(x, top, cw, ch))
    out.push(`<circle cx="${x + 30}" cy="${top + 32}" r="13" fill="${C.raised}" stroke="${C.line}"/>`)
    out.push(text(x + 30, top + 37, String(i + 1), { size: 13, weight: 700, anchor: 'middle', fill: C.sun }))
    out.push(text(x + 52, top + 37, k.toUpperCase(), { size: 11, weight: 700, fill: C.faint, spacing: 1.6 }))
    out.push(text(x + 20, top + 78, title, { size: 19, weight: 700 }))
    out.push(lines(x + 20, top + 110, body, { size: 13.5, fill: C.muted, lh: 21 }))
    if (i < steps.length - 1) out.push(arrow(x + cw + 2, top + ch / 2, x + cw + gap - 2))
  })

  // Panel A: what gets measured.
  const py = top + ch + 36
  const ph = 400
  const aw = 560
  out.push(card(48, py, aw, ph))
  out.push(text(76, py + 44, 'WHAT GETS MEASURED', { size: 11, weight: 700, fill: C.faint, spacing: 1.6 }))
  out.push(text(76, py + 74, 'Only where the icons are', { size: 19, weight: 700 }))
  // Two status bar strips, iPhone and Android. Same zone columns on both: the rule is identical.
  const labelCol = 72
  const sx = 76 + labelCol
  const sw = aw - 56 - labelCol
  const sh = 58
  const zone = sw * 0.35
  const rows = [
    { label: 'iOS', y: py + 104, grad: 'skyIos', cutout: 'island' },
    { label: 'Android', y: py + 104 + sh + 14, grad: 'skyAndroid', cutout: 'hole' },
  ]
  out.push(`<defs>
  <linearGradient id="skyIos" x1="0" x2="1"><stop offset="0" stop-color="#14121F"/><stop offset="0.55" stop-color="#4B3E7A"/><stop offset="1" stop-color="#F3E3C8"/></linearGradient>
  <linearGradient id="skyAndroid" x1="0" x2="1"><stop offset="0" stop-color="#EDE6DA"/><stop offset="0.5" stop-color="#5E7C78"/><stop offset="1" stop-color="#14201F"/></linearGradient>
  <linearGradient id="lum" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
  ${rows.map((r, i) => `<clipPath id="strip${i}"><rect x="${sx}" y="${r.y}" width="${sw}" height="${sh}" rx="18"/></clipPath>`).join('')}
</defs>`)
  const icon = '#8C8C98'
  rows.forEach((r, i) => {
    const mid = r.y + sh / 2
    out.push(`<g clip-path="url(#strip${i})">`)
    out.push(`<rect x="${sx}" y="${r.y}" width="${sw}" height="${sh}" fill="url(#${r.grad})"/>`)
    // Zones, clipped to the strip so they follow its rounded ends.
    out.push(`<rect x="${sx}" y="${r.y}" width="${zone}" height="${sh}" fill="${C.moon}" fill-opacity="0.2"/>`)
    out.push(`<rect x="${sx + sw - zone}" y="${r.y}" width="${zone}" height="${sh}" fill="${C.sun}" fill-opacity="0.2"/>`)
    out.push(`<line x1="${sx + zone}" x2="${sx + zone}" y1="${r.y}" y2="${r.y + sh}" stroke="${C.moon}" stroke-width="2"/>`)
    out.push(`<line x1="${sx + sw - zone}" x2="${sx + sw - zone}" y1="${r.y}" y2="${r.y + sh}" stroke="${C.sun}" stroke-width="2"/>`)
    out.push('</g>')
    out.push(`<rect x="${sx}" y="${r.y}" width="${sw}" height="${sh}" rx="18" fill="none" stroke="${C.line}" stroke-width="1.5"/>`)
    // Status bar contents, drawn in a neutral grey: they mark positions, not a style.
    out.push(text(sx + 30, mid + 5, '9:41', { size: 14, weight: 700, fill: icon }))
    if (r.cutout === 'island') {
      out.push(`<rect x="${sx + sw / 2 - 48}" y="${mid - 11}" width="96" height="22" rx="11" fill="#000"/>`)
      out.push(`<rect x="${sx + sw - 62}" y="${mid - 6}" width="26" height="12" rx="3.5" fill="none" stroke="${icon}" stroke-width="1.6"/><rect x="${sx + sw - 59}" y="${mid - 3}" width="17" height="6" rx="1.5" fill="${icon}"/>`)
    } else {
      out.push(`<circle cx="${sx + 82}" cy="${mid}" r="4" fill="${icon}"/>`)
      out.push(`<circle cx="${sx + sw / 2}" cy="${mid}" r="10" fill="#000"/>`)
      out.push(`<path d="M${sx + sw - 88} ${mid + 6} L${sx + sw - 76} ${mid - 6} L${sx + sw - 76} ${mid + 6} Z" fill="${icon}"/>`)
      out.push(`<rect x="${sx + sw - 62}" y="${mid - 7}" width="11" height="15" rx="2.5" fill="none" stroke="${icon}" stroke-width="1.6"/><rect x="${sx + sw - 59.5}" y="${mid - 2}" width="6" height="7.5" rx="1" fill="${icon}"/>`)
    }
    out.push(text(76, mid + 5, r.label, { size: 13.5, weight: 700, fill: C.text }))
  })
  const ly = rows[1].y + sh + 26
  out.push(text(sx + zone / 2, ly, 'left zone, 35%', { size: 12.5, fill: C.moon, anchor: 'middle' }))
  out.push(text(sx + sw / 2, ly, 'ignored', { size: 12.5, fill: C.muted, anchor: 'middle' }))
  out.push(text(sx + sw / 2, ly + 17, 'camera here', { size: 11.5, fill: C.faint, anchor: 'middle' }))
  out.push(text(sx + sw - zone / 2, ly, 'right zone, 35%', { size: 12.5, fill: C.sun, anchor: 'middle' }))
  out.push(
    lines(76, ly + 44, [
      'Each zone averages linear light. The darker and the brighter zone are',
      'combined where white and black icons get the same WCAG contrast,',
      'so a split background picks what is safest for the worse side.',
    ], { size: 13.5, fill: C.muted, lh: 21 })
  )
  out.push(text(76, ly + 118, 'Dark-left or dark-right, both read the same: near 0.5', { size: 13.5, fill: C.text }))

  // Panel B: hysteresis.
  const bx = 48 + aw + 20
  const bw = 440
  out.push(card(bx, py, bw, ph))
  out.push(text(bx + 28, py + 44, 'DECIDE', { size: 11, weight: 700, fill: C.faint, spacing: 1.6 }))
  out.push(text(bx + 28, py + 74, 'Hysteresis keeps it calm', { size: 19, weight: 700 }))
  const tx = bx + 28
  const tw = bw - 56
  const ty = py + 130
  out.push(`<rect x="${tx}" y="${ty}" width="${tw}" height="16" rx="8" fill="url(#lum)"/>`)
  const at = (v) => tx + v * tw
  out.push(`<rect x="${at(0.42)}" y="${ty - 6}" width="${at(0.58) - at(0.42)}" height="28" rx="5" fill="${C.sun}" fill-opacity="0.12" stroke="${C.sun}" stroke-width="1.5"/>`)
  out.push(text(at(0.42), ty + 48, '0.42', { size: 12.5, fill: C.muted, anchor: 'middle', mono: true }))
  out.push(text(at(0.58), ty + 48, '0.58', { size: 12.5, fill: C.muted, anchor: 'middle', mono: true }))
  out.push(text(tx, ty - 16, 'white icons', { size: 12.5, fill: C.muted }))
  out.push(text(at(0.5), ty - 16, 'keep current', { size: 12.5, fill: C.sun, anchor: 'middle' }))
  out.push(text(tx + tw, ty - 16, 'dark icons', { size: 12.5, fill: C.muted, anchor: 'end' }))
  // A slow gradient scroll: readings over time and the style that results.
  const gx = tx
  const gy = ty + 84
  const gw = tw
  const gh = 120
  const vals = [0.82, 0.74, 0.63, 0.55, 0.5, 0.53, 0.47, 0.44, 0.39, 0.33, 0.37, 0.45, 0.52, 0.56, 0.61, 0.68]
  const yv = (v) => gy + gh - v * gh
  out.push(`<rect x="${gx}" y="${yv(0.58)}" width="${gw}" height="${yv(0.42) - yv(0.58)}" fill="${C.sun}" fill-opacity="0.08"/>`)
  out.push(`<line x1="${gx}" x2="${gx + gw}" y1="${gy + gh}" y2="${gy + gh}" stroke="${C.grid}"/>`)
  const step = gw / (vals.length - 1)
  out.push(`<polyline points="${vals.map((v, i) => `${gx + i * step},${yv(v)}`).join(' ')}" fill="none" stroke="${C.moon}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`)
  // Style track: dark until a reading crosses below 0.42 twice, white until it crosses 0.58.
  let style = 'dark'
  let pend = 0
  const track = vals.map((v) => {
    const cand = v >= 0.58 ? 'dark' : v < 0.42 ? 'light' : style
    if (cand !== style) {
      pend += 1
      if (pend >= 2) {
        style = cand
        pend = 0
      }
    } else pend = 0
    return style
  })
  track.forEach((s, i) => {
    const x = gx + i * step - step / 2
    out.push(`<rect x="${Math.max(gx, x)}" y="${gy + gh + 14}" width="${Math.min(step, gx + gw - Math.max(gx, x))}" height="12" fill="${s === 'dark' ? '#000' : '#fff'}" stroke="${C.faint}" stroke-width="1"/>`)
  })
  out.push(text(gx + gw, yv(vals[vals.length - 1]) - 10, 'lightness', { size: 12, fill: C.moon, anchor: 'end' }))
  out.push(text(gx + gw, gy + gh + 44, 'icons', { size: 12, fill: C.muted, anchor: 'end' }))
  out.push(text(gx, gy + gh + 44, 'scrolling a slow gradient, one reading per sample', { size: 12.5, fill: C.muted }))

  // Panel C: threads.
  const cx = bx + bw + 20
  const cw2 = W - 48 - cx
  out.push(card(cx, py, cw2, ph))
  out.push(text(cx + 28, py + 44, 'THREADS', { size: 11, weight: 700, fill: C.faint, spacing: 1.6 }))
  out.push(text(cx + 28, py + 74, 'Who does what', { size: 19, weight: 700 }))
  // Equal 28px margins all round, lanes vertically centred in what's left under the title.
  const lanes = [
    ['JavaScript', ['enable(config) once, on both platforms', 'onStyleChange, only when the style changes']],
    ['Main thread', ['Android: schedule, request the copy, apply', 'iOS: schedule, capture (about 1 ms), apply']],
    ['Worker / GPU', ['Android: copy on the GPU, read and analyse', 'iOS: unused, UIKit layers are main thread only']],
  ]
  const laneH = 84
  const laneGap = 10
  const laneTop = py + ph - 28 - lanes.length * laneH - (lanes.length - 1) * laneGap
  lanes.forEach(([name, rows], i) => {
    const y = laneTop + i * (laneH + laneGap)
    out.push(`<rect x="${cx + 28}" y="${y}" width="${cw2 - 56}" height="${laneH}" rx="14" fill="${C.raised}"/>`)
    out.push(`<rect x="${cx + 44}" y="${y + 18}" width="4" height="${laneH - 36}" rx="2" fill="${[C.faint, C.moon, C.sun][i]}"/>`)
    out.push(text(cx + 64, y + 30, name, { size: 15, weight: 700 }))
    out.push(lines(cx + 64, y + 51, rows, { size: 12.5, fill: C.muted, lh: 18 }))
  })

  // Footer strip: the JS boundary.
  const fy = py + ph + 24
  out.push(card(48, fy, W - 96, 64, 16))
  out.push(text(76, fy + 39, 'JS → native', { size: 14, weight: 700 }))
  out.push(text(186, fy + 39, 'enable(config) · configure · setOverride · setHint', { size: 14, fill: C.muted, mono: true }))
  out.push(text(860, fy + 39, 'native → JS', { size: 14, weight: 700 }))
  out.push(text(970, fy + 39, 'onStyleChange { style, source, lightness }', { size: 14, fill: C.muted, mono: true }))

  return svg(W, H, out.join('\n'))
}

// ---------------------------------------------------------------------------------------------
// Benchmark

const DEVICES = ['iPhone 16 Pro sim · iOS 18.6', 'Pixel 9 Pro XL emulator · Android 16', 'OPPO CPH2217 · low-end · Android 13']
const SCENARIOS = ['Static dark photo', 'Static light photo', 'Continuous scroll', 'Animated gradient', 'Photo every second', 'Black / white flips']
const RUNS = {
  samples: [
    [1.2, 1.2, 7.8, 8.3, 4.0, 3.9],
    [0, 0, 8.9, 8.8, 1.9, 1.8],
    [0, 0, 8.2, 8.9, 2.0, 1.8],
  ],
  // iOS only: Android's copy runs off the main thread, so it isn't the same measure.
  capture: [[[0.69, 1.3], [0.73, 0.8], [0.26, 0.6], [0.18, 0.3], [0.79, 1.3], [0.17, 0.3]]],
  latency: [
    [185, 327],
    [28, 33],
    [27, 30],
  ],
}

function benchmark() {
  const W = 1600
  const H = 1130
  const out = [header('BENCHMARK', 'Library off vs on, six scenarios', 'Release builds, balanced preset, 10 s per phase. The OPPO is a real low-end phone, the others are a simulator and an emulator.')]

  // Legend.
  let lx = 48
  DEVICES.forEach((d, i) => {
    out.push(`<rect x="${lx}" y="166" width="14" height="14" rx="4" fill="${SERIES[i]}"/>`)
    out.push(text(lx + 22, 178, d, { size: 14, fill: C.muted }))
    lx += 22 + d.length * 7.6 + 36
  })

  // Headline tiles.
  const tiles = [
    ['0', 'slow UI frames on a low-end phone', 'OPPO CPH2217, all six scenarios, library on'],
    ['27 ms', 'median switch on the low-end phone', 'flip to style event · iOS 18.6 sim: 185 ms'],
    ['0 per second', 'samples on a still Android screen', 'iOS backs off to about one per second'],
  ]
  const tw = (W - 96 - 40) / 3
  tiles.forEach(([big, label, sub], i) => {
    const x = 48 + i * (tw + 20)
    out.push(card(x, 206, tw, 132))
    out.push(text(x + 28, 268, big, { size: 40, weight: 800, spacing: -1 }))
    out.push(text(x + 28, 298, label, { size: 15, fill: C.text, weight: 600 }))
    out.push(text(x + 28, 320, sub, { size: 13, fill: C.muted }))
  })

  // Panel A: samples per second.
  const ay = 362
  const aw = 860
  const ah = 690
  out.push(card(48, ay, aw, ah))
  out.push(text(76, ay + 44, 'SAMPLING RATE', { size: 11, weight: 700, fill: C.faint, spacing: 1.6 }))
  out.push(text(76, ay + 74, 'Samples per second, library on', { size: 19, weight: 700 }))
  const labelW = 190
  const px0 = 76 + labelW
  const pw = aw - 56 - labelW - 50
  const max = 10
  const rowH = 92
  const thick = 16
  const gtop = ay + 112
  for (let t = 0; t <= max; t += 2) {
    const x = px0 + (t / max) * pw
    out.push(`<line x1="${x}" x2="${x}" y1="${gtop - 8}" y2="${gtop + rowH * 6 - 10}" stroke="${C.grid}"/>`)
    out.push(text(x, gtop + rowH * 6 + 12, String(t), { size: 12, fill: C.faint, anchor: 'middle' }))
  }
  SCENARIOS.forEach((s, r) => {
    const y = gtop + r * rowH
    out.push(text(76, y + 32, s, { size: 14, fill: C.text }))
    RUNS.samples.forEach((series, d) => {
      const v = series[r]
      const by = y + 6 + d * (thick + 4)
      out.push(hbar(px0, by, (v / max) * pw, thick, SERIES[d]))
      out.push(text(px0 + (v / max) * pw + 8, by + 12.5, v.toFixed(1), { size: 12, fill: C.muted, mono: true }))
    })
  })

  // Panel B: switch latency.
  const bx = 48 + aw + 20
  const bw = W - 48 - bx
  const bh = 250
  out.push(card(bx, ay, bw, bh))
  out.push(text(bx + 28, ay + 44, 'REACTION', { size: 11, weight: 700, fill: C.faint, spacing: 1.6 }))
  out.push(text(bx + 28, ay + 74, 'Switch latency, median and max', { size: 19, weight: 700 }))
  const lmax = 400
  const lx0 = bx + 28
  const lw = bw - 56 - 110
  RUNS.latency.forEach(([p50, mx], d) => {
    const y = ay + 104 + d * 44
    out.push(`<line x1="${lx0}" x2="${lx0 + lw}" y1="${y + 9}" y2="${y + 9}" stroke="${C.grid}"/>`)
    out.push(hbar(lx0, y, (p50 / lmax) * lw, 18, SERIES[d]))
    const mxX = lx0 + (mx / lmax) * lw
    out.push(`<line x1="${lx0 + (p50 / lmax) * lw}" x2="${mxX}" y1="${y + 9}" y2="${y + 9}" stroke="${SERIES[d]}" stroke-opacity="0.55" stroke-width="2"/>`)
    out.push(`<line x1="${mxX}" x2="${mxX}" y1="${y - 3}" y2="${y + 21}" stroke="${C.text}" stroke-width="2" stroke-linecap="round"/>`)
    out.push(text(lx0 + lw + 14, y + 14, `${p50} / ${mx} ms`, { size: 13, fill: C.text, mono: true }))
  })
  out.push(text(lx0, ay + bh - 18, 'bar = median, tick = max, black/white flips every 1.2 s', { size: 12.5, fill: C.muted }))

  // Panel C: iOS capture cost.
  const cy = ay + bh + 20
  const chh = ah - bh - 20
  out.push(card(bx, cy, bw, chh))
  out.push(text(bx + 28, cy + 44, 'COST', { size: 11, weight: 700, fill: C.faint, spacing: 1.6 }))
  out.push(text(bx + 28, cy + 74, 'iOS capture per sample, ms', { size: 19, weight: 700 }))
  const cl = 150
  const cx0 = bx + 28 + cl
  const cwid = bw - 56 - cl - 50
  const cmax = 1.5
  const crow = 44
  const ctop = cy + 100
  ;[0, 0.5, 1, 1.5].forEach((t) => {
    const x = cx0 + (t / cmax) * cwid
    out.push(`<line x1="${x}" x2="${x}" y1="${ctop - 6}" y2="${ctop + crow * 6 - 14}" stroke="${C.grid}"/>`)
    out.push(text(x, ctop + crow * 6 + 4, String(t), { size: 12, fill: C.faint, anchor: 'middle' }))
  })
  SCENARIOS.forEach((s, r) => {
    const y = ctop + r * crow
    out.push(text(bx + 28, y + 20, s, { size: 13, fill: C.text }))
    RUNS.capture.forEach((series, d) => {
      const [avg, mx] = series[r]
      const by = y + 8 + d * 15
      out.push(hbar(cx0, by, (avg / cmax) * cwid, 12, SERIES[d]))
      const mxX = cx0 + (mx / cmax) * cwid
      out.push(`<line x1="${cx0 + (avg / cmax) * cwid}" x2="${mxX}" y1="${by + 6}" y2="${by + 6}" stroke="${SERIES[d]}" stroke-opacity="0.55" stroke-width="2"/>`)
      out.push(`<line x1="${mxX}" x2="${mxX}" y1="${by}" y2="${by + 12}" stroke="${C.text}" stroke-width="2" stroke-linecap="round"/>`)
    })
  })
  out.push(text(bx + 28, cy + chh - 18, 'bar = average, tick = max · luminance analysis adds 2 to 4 µs', { size: 12.5, fill: C.muted }))

  // Footnote.
  out.push(
    text(48, H - 34, 'The emulator showed 0.2% slow UI frames with the library on during continuous scroll and the gradient. The real low-end phone showed 0.0% everywhere.', {
      size: 13,
      fill: C.muted,
    })
  )
  return svg(W, H, out.join('\n'))
}

function render(name) {
  const svgPath = path.join(DOCS, `${name}.svg`)
  const pngPath = path.join(DOCS, `${name}.png`)
  const [, w, h] = fs.readFileSync(svgPath, 'utf8').match(/width="(\d+)" height="(\d+)"/)
  const html = path.join(DOCS, `.${name}.html`)
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:${C.ink}">${fs.readFileSync(svgPath, 'utf8')}</body></html>`)
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=${w},${h}`, `--screenshot=${pngPath}`, `file://${html}`], { stdio: 'ignore' })
  fs.rmSync(html)
  if (r.status !== 0) throw new Error(`Chrome failed rendering ${name}`)
  console.log(`docs/${name}.png`)
}

fs.mkdirSync(DOCS, { recursive: true })
fs.writeFileSync(path.join(DOCS, 'how-it-works.svg'), howItWorks())
fs.writeFileSync(path.join(DOCS, 'benchmark.svg'), benchmark())
render('how-it-works')
render('benchmark')

/* ==========================================================================
 * charts.js — tiny dependency-free SVG charts (donut + grouped bars).
 * Each returns an <svg> element that scales to its container via viewBox.
 * ========================================================================== */
window.App = window.App || {}

App.charts = (function () {
  const SVGNS = 'http://www.w3.org/2000/svg'
  const svgEl = (tag, attrs = {}) => {
    const n = document.createElementNS(SVGNS, tag)
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
    return n
  }

  /**
   * Donut chart. `segments` = [{ value, color, label }].
   * Uses the stroke-dasharray technique — no arc math needed.
   */
  function donut(segments, { size = 180, thickness = 24 } = {}) {
    const total = segments.reduce((s, x) => s + x.value, 0)
    const r = (size - thickness) / 2
    const cx = size / 2
    const circ = 2 * Math.PI * r

    const svg = svgEl('svg', {
      viewBox: `0 0 ${size} ${size}`,
      class: 'chart donut',
      role: 'img',
    })

    // Track ring.
    svg.appendChild(
      svgEl('circle', {
        cx, cy: cx, r, fill: 'none', stroke: 'var(--track)', 'stroke-width': thickness,
      }),
    )

    if (total > 0) {
      const g = svgEl('g', { transform: `rotate(-90 ${cx} ${cx})` })
      let offset = 0
      for (const seg of segments) {
        if (seg.value <= 0) continue
        const len = (seg.value / total) * circ
        const arc = svgEl('circle', {
          cx, cy: cx, r, fill: 'none',
          stroke: seg.color, 'stroke-width': thickness,
          'stroke-dasharray': `${len} ${circ - len}`,
          'stroke-dashoffset': -offset,
        })
        arc.appendChild(svgEl('title')).textContent =
          `${seg.label}: ${App.util.money(seg.value)}`
        g.appendChild(arc)
        offset += len
      }
      svg.appendChild(g)
    }
    return svg
  }

  /**
   * Grouped bar chart.
   * data = { labels: [...], series: [{ name, color, values: [...] }] }
   */
  function bars(data, { width = 460, height = 220 } = {}) {
    const { money, moneyCompact } = App.util
    const padL = 46
    const padB = 26
    const padT = 10
    const padR = 8
    const plotW = width - padL - padR
    const plotH = height - padT - padB

    const max = Math.max(1, ...data.series.flatMap((s) => s.values))
    // Round the axis max up to something tidy.
    const niceMax = niceCeil(max)
    const y = (v) => padT + plotH - (v / niceMax) * plotH

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart bars', role: 'img' })

    // Horizontal gridlines + y labels.
    const ticks = 4
    for (let i = 0; i <= ticks; i++) {
      const val = (niceMax / ticks) * i
      const yy = y(val)
      svg.appendChild(svgEl('line', { x1: padL, y1: yy, x2: width - padR, y2: yy, class: 'grid' }))
      const label = svgEl('text', { x: padL - 6, y: yy + 3, class: 'axis-label', 'text-anchor': 'end' })
      label.textContent = moneyCompact(val)
      svg.appendChild(label)
    }

    const groups = data.labels.length
    const groupW = plotW / groups
    const seriesN = data.series.length
    const barGap = 4
    const barW = Math.max(4, (groupW * 0.62 - barGap * (seriesN - 1)) / seriesN)

    data.labels.forEach((label, gi) => {
      const gx = padL + gi * groupW + (groupW - (barW * seriesN + barGap * (seriesN - 1))) / 2
      data.series.forEach((s, si) => {
        const v = s.values[gi] || 0
        const bx = gx + si * (barW + barGap)
        const by = y(v)
        const rect = svgEl('rect', {
          x: bx, y: by, width: barW, height: Math.max(0, padT + plotH - by),
          rx: 3, fill: s.color, class: 'bar',
        })
        rect.appendChild(svgEl('title')).textContent = `${s.name} · ${label}: ${money(v)}`
        svg.appendChild(rect)
      })
      const xl = svgEl('text', { x: padL + gi * groupW + groupW / 2, y: height - 8, class: 'axis-label', 'text-anchor': 'middle' })
      xl.textContent = label
      svg.appendChild(xl)
    })

    return svg
  }

  function niceCeil(n) {
    if (n <= 0) return 1
    const mag = Math.pow(10, Math.floor(Math.log10(n)))
    const norm = n / mag
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
    return nice * mag
  }

  return { donut, bars }
})()

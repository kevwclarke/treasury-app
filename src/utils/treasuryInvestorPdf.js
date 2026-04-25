import { jsPDF } from 'jspdf'
import { formatGBP, formatPct } from './treasuryFormat'

/** Royal blue brand */
const ACCENT = [27, 43, 140]
/** Primary text */
const INK = [15, 15, 15]
const HEADER_BG = [27, 43, 140]
const MUTED = [107, 114, 128]
const PAGE_W = 210
const PAGE_H = 297
const M = 18
const FOOTER_Y = PAGE_H - 12

function setAccent(doc) {
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2])
}

function setInk(doc) {
  doc.setTextColor(INK[0], INK[1], INK[2])
}

function setMuted(doc) {
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
}

function drawFooter(doc, companyName, pageIndex, pageTotal) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  const left = `${companyName} · Confidential`
  const right = `Page ${pageIndex} of ${pageTotal}`
  doc.text(left, M, FOOTER_Y)
  doc.text(right, PAGE_W - M, FOOTER_Y, { align: 'right' })
  setInk(doc)
}

function drawPageHeader(doc, title) {
  doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2])
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text(title, M, 14)
  setInk(doc)
  return 30
}

function fmtMo(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1)} months`
}

/** @param {object} payload — output of `buildTreasuryReportPdfPayload` */
export function downloadTreasuryInvestorPdf(payload) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const company = payload.companyName || 'Company'

  // —— Page 1: Cover ——
  doc.setFillColor(254, 252, 248)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  setMuted(doc)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('CONFIDENTIAL', M, 28)

  setInk(doc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(company, M, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(15)
  setMuted(doc)
  doc.text('Treasury Health Report', M, 58)

  const dateStr = payload.generatedAt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  doc.setFontSize(10)
  doc.text(`Generated ${dateStr}`, M, 68)

  const score = payload.healthScore
  doc.setFont('helvetica', 'bold')
  setAccent(doc)
  doc.setFontSize(56)
  doc.text(String(score), M, 118)

  setInk(doc)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.text('Treasury Health Score', M, 128)
  doc.setFontSize(10)
  setMuted(doc)
  doc.text('out of 100', M, 135)

  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2])
  doc.setLineWidth(0.6)
  doc.line(M, 144, PAGE_W - M, 144)

  setInk(doc)
  doc.setFontSize(9)
  const foot =
    'This report summarises cash, yield, runway, concentration, and recent AI recommendations. ' +
    'Figures derive from uploaded transaction data and illustrative market benchmarks.'
  const footLines = doc.splitTextToSize(foot, PAGE_W - 2 * M)
  doc.text(footLines, M, 154)

  // —— Page 2: Cash ——
  doc.addPage()
  let y = drawPageHeader(doc, 'Cash position')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setInk(doc)

  const rows2 = [
    ['Total cash', formatGBP(Math.round(payload.yieldSummary.totalCash))],
    ['Effective yield', formatPct(payload.effectiveYieldPct, 2)],
    ['Best available rate (benchmark)', formatPct(payload.bestYieldPct, 2)],
    ['Annual opportunity cost', formatGBP(Math.round(payload.yieldSummary.annualOppCost))],
    ['Monthly opportunity cost', formatGBP(Math.round(payload.yieldSummary.monthlyOppCost))],
  ]
  for (const [k, v] of rows2) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(k, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(v, PAGE_W - M, y, { align: 'right' })
    y += 9
  }

  // —— Page 3: Runway ——
  doc.addPage()
  y = drawPageHeader(doc, 'Runway analysis')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const rm = payload.runwayMetrics
  const rows3 = [
    ['Base case runway', fmtMo(rm.baseRunwayMo)],
    ['Bear case runway', fmtMo(rm.bearRunwayMo)],
    ['Bull case runway', fmtMo(rm.bullRunwayMo)],
    ['Monthly burn (90-day basis)', formatGBP(Math.round(rm.monthlyBurn || 0))],
  ]
  for (const [k, v] of rows3) {
    doc.setFont('helvetica', 'bold')
    doc.text(k, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(v, PAGE_W - M, y, { align: 'right' })
    y += 9
  }
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setAccent(doc)
  doc.text('Top burn categories (last 90 days)', M, y)
  y += 8
  setInk(doc)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const top3 = payload.topBurnCategories
  if (!top3.length) {
    doc.setFont('helvetica', 'italic')
    setMuted(doc)
    doc.text('No category spend detected in the period.', M, y)
  } else {
    top3.forEach((c, i) => {
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}. ${c.name}`, M, y)
      doc.setFont('helvetica', 'normal')
      doc.text(formatGBP(Math.round(c.amount)), PAGE_W - M, y, { align: 'right' })
      y += 9
    })
  }

  // —— Page 4: Concentration ——
  doc.addPage()
  y = drawPageHeader(doc, 'Concentration risk')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('FSCS coverage (illustrative)', M, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.text('Total protected (within £85k / institution)', M, y)
  doc.text(formatGBP(Math.round(payload.concentration.protectedTotal)), PAGE_W - M, y, { align: 'right' })
  y += 9
  doc.text('Total unprotected above FSCS limit', M, y)
  doc.text(formatGBP(Math.round(payload.concentration.unprotectedTotal)), PAGE_W - M, y, { align: 'right' })
  y += 12

  doc.setFont('helvetica', 'bold')
  setAccent(doc)
  doc.text(`Risk rating: ${payload.concentration.riskLabel}`, M, y)
  y += 10
  setInk(doc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Institution', M, y)
  doc.text('Balance', PAGE_W - M - 35, y, { align: 'right' })
  doc.text('% of cash', PAGE_W - M, y, { align: 'right' })
  y += 6
  doc.setLineWidth(0.2)
  doc.setDrawColor(220, 215, 210)
  doc.line(M, y, PAGE_W - M, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const instRows = payload.institutionRowsForPdf.length
    ? payload.institutionRowsForPdf
    : payload.concentration.institutionRows.filter((r) => r.balance > 0)
  for (const r of instRows) {
    if (y > PAGE_H - 40) break
    doc.text(r.name, M, y)
    doc.text(formatGBP(Math.round(r.balance)), PAGE_W - M - 35, y, { align: 'right' })
    doc.text(formatPct(r.pctOfTotal, 1), PAGE_W - M, y, { align: 'right' })
    y += 8
  }

  // —— Page 5: AI ——
  doc.addPage()
  y = drawPageHeader(doc, 'AI actions summary')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setMuted(doc)
  const intro = doc.splitTextToSize(
    'The three most recent autopilot recommendations (from Treasury Autopilot). Refresh actions there to update.',
    PAGE_W - 2 * M,
  )
  doc.text(intro, M, y)
  y += intro.length * 4.5 + 6

  const actions = payload.aiActions
  if (!actions.length) {
    doc.setFont('helvetica', 'italic')
    setMuted(doc)
    doc.text('No cached actions yet. Open Treasury Autopilot and use “Refresh Actions”.', M, y)
  } else {
    actions.forEach((a, idx) => {
      if (y > PAGE_H - 50) return
      doc.setFont('helvetica', 'bold')
      setAccent(doc)
      doc.setFontSize(11)
      doc.text(`${idx + 1}. ${a.title}`, M, y)
      y += 7
      setInk(doc)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const body = doc.splitTextToSize(String(a.action || ''), PAGE_W - 2 * M)
      doc.text(body, M, y)
      y += body.length * 4.2 + 2
      doc.setFont('helvetica', 'bold')
      doc.text(`Est. impact: ${formatGBP(Math.round(Number(a.impactGbpPerYear) || 0))} / year`, M, y)
      y += 10
    })
  }

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i)
    drawFooter(doc, company, i, total)
  }

  const slug = payload.generatedAt.toISOString().slice(0, 10)
  doc.save(`Treasury-Health-Report-${slug}.pdf`)
}

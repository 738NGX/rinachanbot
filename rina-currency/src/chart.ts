import sharp from 'sharp'
import { BANK_LABELS, RateType, RATE_TYPE_LABELS, TrendMetrics } from './types'
import { formatDateTime, formatRate, formatMoney, costForYen } from './formatter'

export interface ChartOptions {
  width: number
  height: number
  days: number
}

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&apos;',
    '"': '&quot;',
  })[character]!)
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
  }).format(value)
}

/** Renders a compact, decision-focused trend card. */
export async function renderTrendChart(
  metrics: TrendMetrics,
  rateType: RateType,
  options: ChartOptions,
) {
  const { width, height } = options
  const padding = { top: 184, right: 72, bottom: 76, left: 88 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const rangeStart = metrics.rangeStart.getTime()
  const rangeEnd = metrics.rangeEnd.getTime()
  const chartPoints = metrics.points.map((point) => ({
    ...point,
    collectedAt: new Date(Math.max(point.collectedAt.getTime(), rangeStart)),
  }))
  const lastPoint = chartPoints.at(-1)!
  // The last known quote remains effective through the time the chart is made.
  if (lastPoint.collectedAt.getTime() < rangeEnd) {
    chartPoints.push({ ...metrics.latest, collectedAt: new Date(rangeEnd) })
  }
  const values = chartPoints.map((point) => point[rateType])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = Math.max(max - min, Math.max(max, 1) * 0.002)
  const lower = min - spread * 0.14
  const upper = max + spread * 0.14
  const range = upper - lower
  const timeRange = Math.max(rangeEnd - rangeStart, 1)
  const xFor = (time: number) => padding.left + (time - rangeStart) / timeRange * plotWidth
  const yFor = (value: number) => padding.top + (upper - value) / range * plotHeight
  const coordinates = chartPoints.map((point) => `${xFor(point.collectedAt.getTime()).toFixed(1)},${yFor(point[rateType]).toFixed(1)}`).join(' ')
  const latestX = xFor(rangeEnd)
  const latestY = yFor(metrics.latest[rateType])
  const highPoint = metrics.points.reduce((best, point) => point[rateType] > best[rateType] ? point : best)
  const lowPoint = metrics.points.reduce((best, point) => point[rateType] < best[rateType] ? point : best)
  const highX = xFor(Math.max(highPoint.collectedAt.getTime(), rangeStart))
  const highY = yFor(highPoint[rateType])
  const lowX = xFor(Math.max(lowPoint.collectedAt.getTime(), rangeStart))
  const lowY = yFor(lowPoint[rateType])
  const change = metrics.change == null ? '暂无前日数据' : `${metrics.change >= 0 ? '+' : ''}${formatRate(metrics.change)}  ${metrics.changePercent! >= 0 ? '+' : ''}${metrics.changePercent!.toFixed(2)}%`
  const changeColor = metrics.change == null ? '#94a3b8' : metrics.change > 0 ? '#fb7185' : '#34d399'
  const ticks = Array.from({ length: 4 }, (_, index) => lower + (upper - lower) * index / 3)
  const labels = [
    new Date(rangeStart),
    new Date((rangeStart + rangeEnd) / 2),
    new Date(rangeEnd),
  ]

  const grid = ticks.map((value) => {
    const y = yFor(value)
    return `<line x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}" stroke="#26334a" stroke-width="1" />
      <text x="${padding.left - 14}" y="${y + 5}" text-anchor="end" class="axis">${formatRate(value)}</text>`
  }).join('')
  const xLabels = labels.map((point, index) => {
    const anchor = index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'
    return `<text x="${xFor(point.getTime())}" y="${height - 30}" text-anchor="${anchor}" class="axis">${dateLabel(point)}</text>`
  }).join('')

  const title = `${BANK_LABELS[metrics.latest.bank]} · 日元${RATE_TYPE_LABELS[rateType]}走势`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <style>
      text { font-family: 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif; }
      .title { fill: #f8fafc; font-size: 30px; font-weight: 700; }
      .subtitle { fill: #94a3b8; font-size: 16px; }
      .metric-label { fill: #94a3b8; font-size: 15px; }
      .metric-value { fill: #f8fafc; font-size: 27px; font-weight: 700; }
      .axis { fill: #94a3b8; font-size: 13px; }
      .annotation { fill: #dbeafe; font-size: 13px; font-weight: 600; }
    </style>
    <rect width="100%" height="100%" fill="#0f172a" rx="28" />
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="#111c33" stroke="#24324a" rx="20" />
    <text x="${padding.left}" y="66" class="title">${escapeXml(title)}</text>
    <text x="${padding.left}" y="94" class="subtitle">100 JPY / CNY · 最近 ${options.days} 天 · ${escapeXml(formatDateTime(metrics.latest.publishedAt))}</text>

    <text x="${padding.left}" y="136" class="metric-label">当前</text>
    <text x="${padding.left}" y="166" class="metric-value">${formatRate(metrics.latest[rateType])}</text>
    <text x="${padding.left + 230}" y="136" class="metric-label">较约 24 小时前</text>
    <text x="${padding.left + 230}" y="166" fill="${changeColor}" class="metric-value">${escapeXml(change)}</text>
    <text x="${width - padding.right}" y="136" text-anchor="end" class="metric-label">10,000 JPY 参考成本</text>
    <text x="${width - padding.right}" y="166" text-anchor="end" class="metric-value">${formatMoney(costForYen(10_000, metrics.latest, rateType))} CNY</text>

    ${grid}
    <polyline points="${coordinates}" fill="none" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="${latestX}" x2="${latestX}" y1="${padding.top}" y2="${padding.top + plotHeight}" stroke="#60a5fa" stroke-opacity="0.25" stroke-dasharray="5 6" />
    <circle cx="${latestX}" cy="${latestY}" r="6" fill="#dbeafe" stroke="#60a5fa" stroke-width="4" />
    <circle cx="${highX}" cy="${highY}" r="4" fill="#fbbf24" />
    <circle cx="${lowX}" cy="${lowY}" r="4" fill="#34d399" />
    <text x="${Math.min(highX + 10, width - padding.right - 84)}" y="${Math.max(highY - 12, padding.top + 14)}" class="annotation">高 ${formatRate(highPoint[rateType])}</text>
    <text x="${Math.min(lowX + 10, width - padding.right - 84)}" y="${Math.min(lowY + 22, padding.top + plotHeight - 6)}" class="annotation">低 ${formatRate(lowPoint[rateType])}</text>
    <text x="${Math.min(latestX + 12, width - padding.right - 76)}" y="${Math.max(latestY - 14, padding.top + 14)}" class="annotation">当前 ${formatRate(metrics.latest[rateType])}</text>
    ${xLabels}
    <text x="${width - padding.right}" y="${height - 30}" text-anchor="end" class="axis">数据来源：中国银行、工商银行</text>
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

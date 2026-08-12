import { BankId, BANK_LABELS, ExchangeRateQuote, RATE_TYPE_LABELS, RateType, TrendMetrics } from './types'

const chinaDateTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatRate(value: number) {
  return value.toFixed(4)
}

export function formatDateTime(value: Date) {
  return chinaDateTime.format(value).replace(/\//g, '-')
}

export function costForYen(amount: number, quote: ExchangeRateQuote, type: RateType = 'spotSell') {
  return amount * quote[type] / quote.unit
}

export function formatMoney(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDetailed(quote: ExchangeRateQuote) {
  return [
    `【${BANK_LABELS[quote.bank]} 日元牌价】`,
    `现汇买入：${formatRate(quote.spotBuy)}`,
    `现钞买入：${formatRate(quote.cashBuy)}`,
    `现汇卖出：${formatRate(quote.spotSell)}`,
    `现钞卖出：${formatRate(quote.cashSell)}`,
    `牌价时间：${formatDateTime(quote.publishedAt)}`,
    `单位：100 JPY / CNY`,
  ].join('\n')
}

export function formatSnapshot(
  snapshot: Partial<Record<BankId, ExchangeRateQuote>>,
  defaultBank: BankId,
  rateType: RateType,
) {
  const lines = [
    '【日元汇率】',
    `主参考：${RATE_TYPE_LABELS[rateType]}（100 JPY / CNY）`,
    '',
  ]

  for (const bank of ['boc', 'icbc'] as const) {
    const quote = snapshot[bank]
    if (quote) lines.push(`${BANK_LABELS[bank]}：${RATE_TYPE_LABELS[rateType]} ${formatRate(quote[rateType])}`)
  }

  const reference = snapshot[defaultBank]
  if (reference) {
    lines.push('', `按${BANK_LABELS[defaultBank]}估算：`)
    lines.push(`10,000 JPY ≈ ${formatMoney(costForYen(10_000, reference, rateType))} CNY`)
    lines.push(`50,000 JPY ≈ ${formatMoney(costForYen(50_000, reference, rateType))} CNY`)
    lines.push(`牌价时间：${formatDateTime(reference.publishedAt)}`)
  }

  const boc = snapshot.boc
  const icbc = snapshot.icbc
  if (boc && icbc) {
    const difference = icbc[rateType] - boc[rateType]
    const sign = difference >= 0 ? '+' : ''
    lines.push(`工行较中行：${sign}${formatRate(difference)}（购汇 100,000 JPY 约${difference >= 0 ? '多' : '少'} ${formatMoney(Math.abs(difference) * 1000)} CNY）`)
  }

  return lines.join('\n')
}

export function formatCost(amount: number, quote: ExchangeRateQuote, type: RateType) {
  return [
    '【购汇成本参考】',
    `按${BANK_LABELS[quote.bank]}${RATE_TYPE_LABELS[type]}计算：`,
    `${amount.toLocaleString('zh-CN')} JPY ≈ ${formatMoney(costForYen(amount, quote, type))} CNY`,
    `牌价：100 JPY = ${formatRate(quote[type])} CNY`,
    `牌价时间：${formatDateTime(quote.publishedAt)}`,
  ].join('\n')
}

export function formatTrendSummary(bank: BankId, type: RateType, metrics: TrendMetrics, days: number) {
  const change = metrics.change == null
    ? '暂无足够的前一日数据'
    : `${metrics.change >= 0 ? '+' : ''}${formatRate(metrics.change)}（${metrics.changePercent! >= 0 ? '+' : ''}${metrics.changePercent!.toFixed(2)}%）`
  return [
    `【${BANK_LABELS[bank]} 日元${RATE_TYPE_LABELS[type]}趋势】`,
    `当前：${formatRate(metrics.latest[type])}`,
    `较约 24 小时前：${change}`,
    `近 ${days} 天最高：${formatRate(metrics.high)}`,
    `近 ${days} 天最低：${formatRate(metrics.low)}`,
    `10,000 JPY 参考成本：${formatMoney(costForYen(10_000, metrics.latest, type))} CNY`,
    `牌价时间：${formatDateTime(metrics.latest.publishedAt)}`,
  ].join('\n')
}

export const RATE_TYPES = ['spotBuy', 'cashBuy', 'spotSell', 'cashSell'] as const

export type RateType = (typeof RATE_TYPES)[number]
export type BankId = 'boc' | 'icbc'

export interface ExchangeRateQuote {
  bank: BankId
  currency: 'JPY'
  unit: number
  spotBuy: number
  cashBuy: number
  spotSell: number
  cashSell: number
  publishedAt: Date
  collectedAt: Date
  sourceUrl: string
}

export interface TrendMetrics {
  latest: ExchangeRateQuote
  previous?: ExchangeRateQuote
  change?: number
  changePercent?: number
  high: number
  low: number
  points: ExchangeRateQuote[]
  rangeStart: Date
  rangeEnd: Date
}

export const BANK_LABELS: Record<BankId, string> = {
  boc: '中国银行',
  icbc: '中国工商银行',
}

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  spotBuy: '现汇买入价',
  cashBuy: '现钞买入价',
  spotSell: '现汇卖出价',
  cashSell: '现钞卖出价',
}

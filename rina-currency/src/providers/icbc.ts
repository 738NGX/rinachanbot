import { ICBC_SOURCE_URL, asRate, chinaTime, postJsonText, RateProvider } from './common'
import { ExchangeRateQuote } from '../types'

interface IcbcResponse {
  code: number
  message?: string
  data?: Array<{
    currencyENName?: string
    foreignBuy?: string
    cashBuy?: string
    foreignSell?: string
    cashSell?: string
    publishDate?: string
    publishTime?: string
  }>
}

export function parseIcbcJpy(payload: IcbcResponse, collectedAt = new Date()): ExchangeRateQuote {
  const row = payload.data?.find((item) => item.currencyENName === 'JPY')
  if (payload.code !== 0 || !row) {
    throw new Error(`工行接口未返回日元记录：${payload.message || payload.code}`)
  }

  return {
    bank: 'icbc',
    currency: 'JPY',
    unit: 100,
    spotBuy: asRate(row.foreignBuy, '工行现汇买入价'),
    cashBuy: asRate(row.cashBuy, '工行现钞买入价'),
    spotSell: asRate(row.foreignSell, '工行现汇卖出价'),
    cashSell: asRate(row.cashSell, '工行现钞卖出价'),
    publishedAt: chinaTime(row.publishDate || '', row.publishTime),
    collectedAt,
    sourceUrl: ICBC_SOURCE_URL,
  }
}

export class IcbcProvider implements RateProvider {
  readonly id = 'icbc' as const

  constructor(
    private timeoutMs: number,
    private attempts: number,
    private retryDelay: number,
  ) {}

  async fetch() {
    const body = await postJsonText(ICBC_SOURCE_URL, this.timeoutMs, {
      attempts: this.attempts,
      retryDelay: this.retryDelay,
    })
    return parseIcbcJpy(JSON.parse(body) as IcbcResponse)
  }
}

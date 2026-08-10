import { BOC_SOURCE_URL, asRate, chinaTime, fetchText, RateProvider } from './common'
import { ExchangeRateQuote } from '../types'

function decodeCell(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .trim()
}

/** Parses the public BOC table without relying on a third-party scraper. */
export function parseBocJpy(html: string, collectedAt = new Date()): ExchangeRateQuote {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []

  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => decodeCell(match[1]))
    if (cells[0] !== '日元' || cells.length < 8) continue

    return {
      bank: 'boc',
      currency: 'JPY',
      unit: 100,
      spotBuy: asRate(cells[1], '中行现汇买入价'),
      cashBuy: asRate(cells[2], '中行现钞买入价'),
      spotSell: asRate(cells[3], '中行现汇卖出价'),
      cashSell: asRate(cells[4], '中行现钞卖出价'),
      publishedAt: chinaTime(cells[6], cells[7]),
      collectedAt,
      sourceUrl: BOC_SOURCE_URL,
    }
  }

  throw new Error('未在中行外汇牌价页找到日元（JPY）记录')
}

export class BocProvider implements RateProvider {
  readonly id = 'boc' as const

  constructor(
    private timeoutMs: number,
    private attempts: number,
    private retryDelay: number,
  ) {}

  async fetch() {
    const html = await fetchText(BOC_SOURCE_URL, this.timeoutMs, {
      headers: { 'user-agent': 'koishi-plugin-rina-currency/0.1' },
    }, { attempts: this.attempts, retryDelay: this.retryDelay })
    return parseBocJpy(html)
  }
}

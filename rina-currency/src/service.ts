import { Context, Logger } from 'koishi'
import { ExchangeRateHistory } from './model'
import { RateProvider } from './providers/common'
import { BankId, ExchangeRateQuote, RateType, TrendMetrics } from './types'

export interface CollectedRate {
  quote: ExchangeRateQuote
  previous?: ExchangeRateQuote
  isNew: boolean
}

export interface CollectionResult {
  collected: CollectedRate[]
  errors: Array<{ bank: BankId, error: unknown }>
}

export interface CollectOptions {
  /** Store an unchanged quote as a scheduled confirmation point. */
  recordUnchanged?: boolean
  /** The scheduler slot represented by this collection. */
  collectedAt?: Date
}

function toQuote(record: ExchangeRateHistory): ExchangeRateQuote {
  return { ...record }
}

function sortByCollectedAt(records: ExchangeRateQuote[]) {
  return records.sort((left, right) => left.collectedAt.getTime() - right.collectedAt.getTime())
}

export class RateService {
  constructor(
    private ctx: Context,
    private logger: Logger,
    private providers: RateProvider[],
  ) {}

  async collect(options: CollectOptions = {}): Promise<CollectionResult> {
    const settled = await Promise.allSettled(this.providers.map(async (provider) => {
      const previous = await this.getLatest(provider.id)
      const quote = await provider.fetch()
      if (options.collectedAt) quote.collectedAt = options.collectedAt
      // The upstream timestamp is the natural identity of a bank quote.  Avoid
      // storing a duplicate when a source has not published a new price yet,
      // except for an explicit scheduled confirmation point.
      if (previous?.publishedAt.getTime() === quote.publishedAt.getTime() && !options.recordUnchanged) {
        return { quote: previous, previous, isNew: false }
      }
      await this.ctx.database.create('rina_currency_rate', quote)
      return { quote, previous, isNew: true }
    }))

    const collected: CollectedRate[] = []
    const errors: CollectionResult['errors'] = []
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        collected.push(result.value)
      } else {
        const bank = this.providers[index].id
        errors.push({ bank, error: result.reason })
        this.logger.warn(`采集${bank}日元牌价失败：${String(result.reason)}`)
      }
    })
    return { collected, errors }
  }

  async getLatest(bank: BankId): Promise<ExchangeRateQuote | undefined> {
    const rows = await this.ctx.database.get('rina_currency_rate', { bank, currency: 'JPY' })
    if (!rows.length) return
    return sortByCollectedAt(rows.map(toQuote)).at(-1)!
  }

  async getLatestAll(): Promise<Partial<Record<BankId, ExchangeRateQuote>>> {
    const entries = await Promise.all((['boc', 'icbc'] as const).map(async (bank) => [bank, await this.getLatest(bank)] as const))
    return Object.fromEntries(entries.filter(([, value]) => value)) as Partial<Record<BankId, ExchangeRateQuote>>
  }

  async ensureSnapshot() {
    let snapshot = await this.getLatestAll()
    if (Object.keys(snapshot).length) return snapshot
    await this.collect()
    snapshot = await this.getLatestAll()
    return snapshot
  }

  async getTrend(bank: BankId, rateType: RateType, days: number, now = new Date()): Promise<TrendMetrics | undefined> {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const rows = await this.ctx.database.get('rina_currency_rate', {
      bank,
      currency: 'JPY',
    })
    const history = sortByCollectedAt(rows.map(toQuote))
    const prior = [...history].reverse().find((point) => point.collectedAt.getTime() < since.getTime())
    const points = history.filter((point) => point.collectedAt.getTime() >= since.getTime())
    if (prior) points.unshift(prior)
    if (!points.length) return

    const latest = points.at(-1)!
    const dayBefore = now.getTime() - 24 * 60 * 60 * 1000
    const previous = [...history].reverse().find((point) => point.collectedAt.getTime() <= dayBefore)
    const values = points.map((point) => point[rateType])
    const change = previous ? latest[rateType] - previous[rateType] : undefined

    return {
      latest,
      previous,
      change,
      changePercent: change == null ? undefined : change / previous![rateType] * 100,
      high: Math.max(...values),
      low: Math.min(...values),
      points,
      rangeStart: since,
      rangeEnd: now,
    }
  }
}

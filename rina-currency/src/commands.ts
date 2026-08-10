import { Context, h } from 'koishi'
import { Config } from './config'
import { renderTrendChart } from './chart'
import { formatCost, formatDetailed, formatSnapshot, formatTrendSummary } from './formatter'
import { RateService } from './service'
import { BankId, BANK_LABELS, RateType } from './types'

function parseBank(input: string | undefined, fallback: BankId): BankId {
  const value = input || ''
  if (/工行|工商|icbc/i.test(value)) return 'icbc'
  if (/中行|中国银行|boc/i.test(value)) return 'boc'
  return fallback
}

function parseRateType(input: string | undefined, fallback: RateType): RateType {
  const value = input || ''
  if (/现钞\s*卖出|现金\s*卖出/i.test(value)) return 'cashSell'
  if (/现钞\s*买入|现金\s*买入/i.test(value)) return 'cashBuy'
  if (/现汇\s*买入|买入/i.test(value)) return 'spotBuy'
  if (/现汇\s*卖出|卖出/i.test(value)) return 'spotSell'
  return fallback
}

function parseDays(input: string | undefined) {
  const match = input?.match(/(\d{1,3})\s*天?/)
  const days = match ? Number(match[1]) : 7
  return Math.min(Math.max(days, 1), 365)
}

export function registerCommands(ctx: Context, service: RateService, config: Config) {
  ctx.command('汇率 [query:text]', '查询日元银行牌价。默认展示现汇卖出价。')
    .alias('日元')
    .usage('示例：汇率 日元；汇率 中行 日元 详细；汇率 工行 现钞卖出')
    .action(async (_, query) => {
      const snapshot = await service.ensureSnapshot()
      if (!Object.keys(snapshot).length) return '暂时无法获取日元牌价，请稍后重试。'

      const bank = parseBank(query, config.defaultBank)
      const type = parseRateType(query, config.defaultRateType)
      if (/详细|详情/.test(query || '')) {
        const requested = /中行|中国银行|boc|工行|工商|icbc/i.test(query || '')
        const quotes = requested ? [snapshot[bank]] : [snapshot.boc, snapshot.icbc]
        return quotes.filter(Boolean).map((quote) => formatDetailed(quote!)).join('\n\n')
      }
      const specifiedBank = /中行|中国银行|boc|工行|工商|icbc/i.test(query || '')
      return formatSnapshot(specifiedBank ? { [bank]: snapshot[bank] } : snapshot, bank, type)
    })

  ctx.command('购汇成本 <amount:number> [query:text]', '按银行日元卖出价估算购汇成本。')
    .alias('换日元')
    .usage('示例：购汇成本 50000；购汇成本 50000 工行 现钞卖出')
    .action(async (_, amount, query) => {
      if (!Number.isFinite(amount) || amount <= 0) return '请输入大于 0 的日元金额。'
      const snapshot = await service.ensureSnapshot()
      const bank = parseBank(query, config.defaultBank)
      const type = parseRateType(query, config.defaultRateType)
      const quote = snapshot[bank]
      if (!quote) return `暂时无法获取${BANK_LABELS[bank]}日元牌价，请稍后重试。`
      return formatCost(amount, quote, type)
    })

  ctx.command('汇率趋势 [query:text]', '生成日元牌价趋势图。')
    .alias('日元趋势')
    .usage('示例：汇率趋势 日元 7天；汇率趋势 中行 现汇卖出 30天')
    .action(async ({ session }, query) => {
      const bank = parseBank(query, config.defaultBank)
      const type = parseRateType(query, config.defaultRateType)
      const days = parseDays(query)
      let metrics = await service.getTrend(bank, type, days)
      if (!metrics) {
        await service.collect()
        metrics = await service.getTrend(bank, type, days)
      }
      if (!metrics) return `暂无${BANK_LABELS[bank]}的历史牌价，已尝试采集，请稍后重试。`

      const summary = formatTrendSummary(bank, type, metrics, days)
      if (!session) return summary
      await session.send(summary)
      try {
        const image = await renderTrendChart(metrics, type, {
          width: config.chartWidth,
          height: config.chartHeight,
          days,
        })
        await session.send(h.image(image, 'image/png'))
      } catch (error) {
        ctx.logger('rina-currency').warn(`生成趋势图失败：${String(error)}`)
        await session.send('趋势图生成失败，已返回文字摘要。')
      }
    })
}

import { Context, h, Logger } from 'koishi'
import { BroadcastTarget, Config, ThresholdAlert } from './config'
import { renderTrendChart } from './chart'
import { formatRate, formatSnapshot, formatTrendSummary } from './formatter'
import { CollectedRate, CollectOptions, RateService } from './service'
import { BANK_LABELS, RATE_TYPE_LABELS } from './types'

function chinaClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value
    return result
  }, {})
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

export class Scheduler {
  private sentBroadcasts = new Set<string>()
  private lastCollectionSlot?: string

  constructor(
    private ctx: Context,
    private logger: Logger,
    private service: RateService,
    private config: Config,
  ) {}

  start() {
    this.ctx.on('ready', async () => {
      const due = this.getDueCollection()
      if (due) {
        this.lastCollectionSlot = due.key
        await this.collectAndAlert({
          recordUnchanged: due.isDailyAnchor,
          collectedAt: due.at,
        })
      } else if (this.config.collectOnStart) {
        await this.collectAndAlert()
      }
      this.ctx.cron('* * * * *', () => {
        void this.collectIfDue()
        void this.runBroadcasts()
      })
    })
  }

  private getDueCollection(now = new Date()) {
    const clock = chinaClock(now)
    const minutesSinceMidnight = clock.hour * 60 + clock.minute
    const dailyAnchor = 17 * 60
    const minutesSinceAnchor = minutesSinceMidnight >= dailyAnchor
      ? minutesSinceMidnight - dailyAnchor
      : minutesSinceMidnight + 24 * 60 - dailyAnchor
    const isDailyAnchor = minutesSinceMidnight === dailyAnchor
    if (!isDailyAnchor && minutesSinceAnchor % this.config.collectIntervalMinutes !== 0) return

    const at = new Date(now)
    at.setSeconds(0, 0)
    return {
      key: `${clock.date}:${clock.hour}:${clock.minute}`,
      at,
      isDailyAnchor,
    }
  }

  private async collectIfDue() {
    const due = this.getDueCollection()
    if (!due || due.key === this.lastCollectionSlot) return
    this.lastCollectionSlot = due.key
    await this.collectAndAlert({
      recordUnchanged: due.isDailyAnchor,
      collectedAt: due.at,
    })
  }

  private getBot(target: Pick<BroadcastTarget | ThresholdAlert, 'platform' | 'selfId'>) {
    return this.ctx.bots.find((bot) => bot.platform === target.platform && bot.selfId === target.selfId)
  }

  private async send(target: BroadcastTarget | ThresholdAlert, content: string, image?: Buffer) {
    const bot = this.getBot(target)
    if (!bot) {
      this.logger.warn(`未找到机器人 ${target.platform}:${target.selfId}，无法向 ${target.channelId} 发送汇率消息。`)
      return
    }
    await bot.sendMessage(target.channelId, content)
    if (image) await bot.sendMessage(target.channelId, h.image(image, 'image/png'))
  }

  private async collectAndAlert(options: CollectOptions = {}) {
    try {
      const result = await this.service.collect(options)
      await Promise.all(result.collected.map((item) => this.maybeAlert(item)))
    } catch (error) {
      this.logger.warn(`定时采集日元牌价失败：${String(error)}`)
    }
  }

  private async maybeAlert({ quote, previous, isNew }: CollectedRate) {
    if (!isNew || !previous) return
    const alerts = this.config.thresholdAlerts.filter((alert) => alert.enabled && alert.bank === quote.bank)
    for (const alert of alerts) {
      const changePercent = (quote[alert.rateType] - previous[alert.rateType]) / previous[alert.rateType] * 100
      const direction = Math.abs(changePercent) >= alert.changePercent ? Math.sign(changePercent) : 0
      const key = [
        alert.platform, alert.selfId, alert.channelId, alert.bank,
        alert.rateType, alert.changePercent,
      ].join(':')
      const states = await this.ctx.database.get('rina_currency_alert_state', { key })
      const state = states[0]
      if (direction && state?.direction !== direction) {
        const elapsedMinutes = Math.max(1, Math.round((quote.publishedAt.getTime() - previous.publishedAt.getTime()) / 60_000))
        await this.send(alert, [
          '【日元汇率波动提醒】',
          `${BANK_LABELS[quote.bank]}${RATE_TYPE_LABELS[alert.rateType]}较上次采样（约 ${elapsedMinutes} 分钟前）${direction > 0 ? '上涨' : '下跌'} ${Math.abs(changePercent).toFixed(2)}%。`,
          `当前：${formatRate(quote[alert.rateType])}（100 JPY / CNY）`,
          `上次采样：${formatRate(previous[alert.rateType])}`,
          '实际成交以银行渠道为准。',
        ].join('\n'))
      }
      if (state) {
        await this.ctx.database.set('rina_currency_alert_state', state.id, { direction, updatedAt: new Date() })
      } else {
        await this.ctx.database.create('rina_currency_alert_state', { key, direction, updatedAt: new Date() })
      }
    }
  }

  private async runBroadcasts() {
    const clock = chinaClock()
    const targets = this.config.broadcasts.filter((target) => target.enabled && target.hour === clock.hour && target.minute === clock.minute)
    for (const [index, target] of targets.entries()) {
      const key = `${clock.date}:${index}:${target.platform}:${target.selfId}:${target.channelId}`
      if (this.sentBroadcasts.has(key)) continue
      this.sentBroadcasts.add(key)
      try {
        const snapshot = await this.service.ensureSnapshot()
        if (!Object.keys(snapshot).length) throw new Error('没有可播报的牌价')
        const metrics = await this.service.getTrend(this.config.defaultBank, this.config.defaultRateType, target.chartDays)
        const content = metrics
          ? `${formatSnapshot(snapshot, this.config.defaultBank, this.config.defaultRateType)}\n\n${formatTrendSummary(this.config.defaultBank, this.config.defaultRateType, metrics, target.chartDays)}`
          : formatSnapshot(snapshot, this.config.defaultBank, this.config.defaultRateType)
        const image = target.includeChart && metrics
          ? await renderTrendChart(metrics, this.config.defaultRateType, { width: this.config.chartWidth, height: this.config.chartHeight, days: target.chartDays })
          : undefined
        await this.send(target, content, image)
      } catch (error) {
        this.logger.warn(`日元定时播报失败：${String(error)}`)
      }
    }
  }
}

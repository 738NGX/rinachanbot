import { Context, h, Logger } from 'koishi'
import { Config, BroadcastTarget } from './config'
import { formatReminder, formatSetlistCaption } from './formatter'
import { LlConcert, LlEvent, LlPerformance } from './model'
import { captureSetlistPage } from './renderer'
import { canonicalUrl, EMPTY_SETLIST_HASH, LlEventService, performanceStart } from './service'

export class Scheduler {
  private running = false

  constructor(
    private ctx: Context,
    private logger: Logger,
    private service: LlEventService,
    private config: Config,
  ) {}

  start() {
    this.ctx.on('ready', async () => {
      if (this.config.syncOnStart && this.activeTargets().length) {
        await this.service.syncIfDue(true).catch(error => this.logger.warn(`初始活动同步失败：${String(error)}`))
      }
      this.ctx.cron('* * * * *', () => void this.run())
    })
  }

  private async run() {
    if (this.running) return
    this.running = true
    try {
      if (!this.activeTargets().length) return
      await this.service.syncIfDue().catch(error => this.logger.warn(`活动列表同步失败：${String(error)}`))
      await this.sendReminders()
      await this.pollSetlists()
    } finally {
      this.running = false
    }
  }

  private activeTargets() {
    return this.config.targets.filter(target => target.enabled)
  }

  private targetKey(target: BroadcastTarget) {
    return `${target.platform}:${target.selfId}:${target.channelId}`
  }

  private async send(target: BroadcastTarget, content: string, image?: Buffer) {
    const bot = this.ctx.bots.find(bot => bot.platform === target.platform && bot.selfId === target.selfId)
    if (!bot) throw new Error(`找不到机器人 ${target.platform}:${target.selfId}`)
    await bot.sendMessage(target.channelId, content)
    if (image) await bot.sendMessage(target.channelId, h.image(image, 'image/png'))
  }

  private async sendOnce(target: BroadcastTarget, performanceId: string, kind: string, contentHash: string, content: string, image?: Buffer) {
    const targetKey = this.targetKey(target)
    const id = `${performanceId}:${targetKey}:${kind}`
    const old = (await this.ctx.database.get('rina_llevent_delivery', { id }))[0]
    if (old?.contentHash === contentHash) return false
    await this.send(target, content, image)
    if (old) await this.ctx.database.set('rina_llevent_delivery', id, { contentHash, sentAt: new Date() })
    else await this.ctx.database.create('rina_llevent_delivery', { id, contentHash, sentAt: new Date() })
    return true
  }

  private async maps() {
    const [events, concerts] = await Promise.all([
      this.ctx.database.get('rina_llevent_event', {}), this.ctx.database.get('rina_llevent_concert', {}),
    ])
    return {
      events: new Map(events.map(event => [event.id, event])),
      concerts: new Map(concerts.map(concert => [concert.id, concert])),
    }
  }

  private async sendReminders() {
    const targets = this.activeTargets()
    if (!targets.length) return
    const now = new Date()
    const performances = await this.ctx.database.get('rina_llevent_performance', { canceled: false })
    const { events, concerts } = await this.maps()
    for (const performance of performances) {
      const start = performanceStart(performance)
      if (!start) continue
      const due = start.getTime() - this.config.reminderMinutes * 60_000
      if (now.getTime() < due || now.getTime() >= due + 2 * 60_000) continue
      const content = formatReminder(events.get(performance.eventId), concerts.get(performance.concertId), performance, start, this.config.reminderMinutes)
      for (const target of targets) {
        try {
          await this.sendOnce(target, performance.id, 'reminder', String(due), content)
        } catch (error) {
          this.logger.warn(`发送开演提醒失败：${String(error)}`)
        }
      }
    }
  }

  private async pollSetlists() {
    const targets = this.activeTargets()
    if (!targets.length) return
    const now = new Date()
    const performances = await this.ctx.database.get('rina_llevent_performance', { canceled: false })
    const { events, concerts } = await this.maps()
    for (const performance of performances) {
      const start = performanceStart(performance)
      if (!start) continue
      const pollStart = start.getTime() + this.config.expectedDurationMinutes * 60_000
      const pollEnd = pollStart + this.config.setlistPollHours * 60 * 60_000
      const last = performance.setlistCheckedAt?.getTime() || 0
      if (now.getTime() < pollStart || now.getTime() > pollEnd || now.getTime() - last < this.config.setlistPollIntervalMinutes * 60_000) continue
      try {
        const oldHash = performance.setlistHash
        const result = await this.service.refreshSetlist(performance)
        if (!result?.setlist.length) continue
        const refreshed = result.performance
        const updated = oldHash !== refreshed.setlistHash && oldHash !== EMPTY_SETLIST_HASH
        const content = formatSetlistCaption(events.get(refreshed.eventId), concerts.get(refreshed.concertId), refreshed, updated)
        const image = await captureSetlistPage(this.ctx, canonicalUrl(refreshed.eventId, refreshed.concertId, refreshed.id))
        for (const target of targets) {
          await this.sendOnce(target, refreshed.id, updated ? 'setlist-update' : 'setlist', refreshed.setlistHash, content, image)
        }
      } catch (error) {
        this.logger.warn(`轮询歌单失败（${performance.id}）：${String(error)}`)
      }
    }
  }
}

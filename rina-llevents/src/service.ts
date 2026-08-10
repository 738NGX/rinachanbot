import { createHash } from 'node:crypto'
import { Context, Logger } from 'koishi'
import { Config } from './config'
import { LlFansClient, PerformanceDetail, SetlistItem, TourDetail, TourSummary } from './graphql'
import { LlConcert, LlEvent, LlPerformance } from './model'

const DAY = 24 * 60 * 60 * 1000

export interface StoredSetlistItem {
  index: string
  name: string
  note: string
  premiere: boolean
}

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export const EMPTY_SETLIST_HASH = hash([])

function dateAtEnd(date?: string) {
  return date ? new Date(`${date}T23:59:59+09:00`) : undefined
}

export function performanceStart(performance: Pick<LlPerformance, 'date' | 'startTime'>) {
  if (!performance.date || !performance.startTime) return
  const time = /^\d{2}:\d{2}$/.test(performance.startTime) ? `${performance.startTime}:00` : performance.startTime
  const value = new Date(`${performance.date}T${time}+09:00`)
  return Number.isNaN(value.getTime()) ? undefined : value
}

export function canonicalUrl(eventId: string, concertId?: string, performanceId?: string) {
  const query = new URLSearchParams()
  if (concertId) query.set('concert', concertId)
  if (performanceId) query.set('performance', performanceId)
  const suffix = query.size ? `?${query}` : ''
  return `https://ll-fans.jp/data/event/${eventId}${suffix}`
}

function normalizeSetlist(items: SetlistItem[] = []): StoredSetlistItem[] {
  return items.map((item) => ({
    index: `${item.indexPrefix || ''}${item.indexNumber == null ? '' : String(item.indexNumber).padStart(2, '0')}` || '—',
    name: item.content?.name || item.contentTypeOther || item.content?.__typename || '未命名项目',
    note: item.note || '',
    premiere: !!item.premiere,
  }))
}

function isWithinLookahead(tour: TourSummary, now: Date, days: number) {
  const end = dateAtEnd(tour.endsOn || tour.startsOn)
  const start = tour.startsOn ? new Date(`${tour.startsOn}T00:00:00+09:00`) : undefined
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  return end.getTime() >= now.getTime() - DAY && start.getTime() <= now.getTime() + days * DAY
}

export class LlEventService {
  private syncing = false
  private lastListSyncAt = 0

  constructor(
    private ctx: Context,
    private logger: Logger,
    private client: LlFansClient,
    private config: Config,
  ) {}

  async syncIfDue(force = false) {
    if (!force && Date.now() - this.lastListSyncAt < this.config.listIntervalMinutes * 60_000) return false
    await this.sync(force)
    return true
  }

  async sync(force = false) {
    if (this.syncing) return
    this.syncing = true
    try {
      const now = new Date()
      const tours = await this.client.listTours()
      const existing = await this.ctx.database.get('rina_llevent_event', {})
      const existingById = new Map(existing.map(event => [event.id, event]))
      const seen = new Set(tours.map(tour => tour.id))
      let details = 0

      for (const tour of tours) {
        const previous = existingById.get(tour.id)
        const changed = await this.upsertEvent(tour, previous, now)
        if (!isWithinLookahead(tour, now, this.config.lookaheadDays)) continue
        if (force || changed || this.shouldRefreshEvent(previous, now)) {
          try {
            await this.syncTour(tour.id, now, force)
            details++
          } catch (error) {
            this.logger.warn(`活动 ${tour.id} 详情同步失败：${String(error)}`)
          }
        }
      }

      for (const event of existing) {
        if (!event.active || seen.has(event.id)) continue
        const end = dateAtEnd(event.endsOn || event.startsOn)
        if (!end || end.getTime() < now.getTime() - DAY) continue
        await this.ctx.database.set('rina_llevent_event', event.id, { active: false, syncedAt: now })
        this.logger.warn(`活动 ${event.id} 已从 LL-Fans 列表移除，标记为待确认`)
      }
      this.lastListSyncAt = Date.now()
      this.logger.debug(`活动列表同步完成：${tours.length} 条，刷新 ${details} 个详情`)
    } finally {
      this.syncing = false
    }
  }

  /** Loads one event regardless of date range. Used when a historical event is queried on demand. */
  async syncEventDetails(eventId: string) {
    await this.syncTour(eventId, new Date(), true)
  }

  private async upsertEvent(tour: TourSummary, previous: LlEvent | undefined, now: Date) {
    const source = {
      name: tour.name || '', startsOn: tour.startsOn || '', endsOn: tour.endsOn || '',
    }
    const sourceHash = hash(source)
    const value: LlEvent = { id: tour.id, ...source, active: true, sourceHash, syncedAt: now }
    if (!previous) {
      await this.ctx.database.create('rina_llevent_event', value)
      return true
    }
    const changed = previous.sourceHash !== sourceHash || !previous.active
    await this.ctx.database.set('rina_llevent_event', tour.id, {
      ...source, active: true, sourceHash, syncedAt: now,
    })
    return changed
  }

  private shouldRefreshEvent(event: LlEvent | undefined, now: Date) {
    if (!event) return true
    const start = event.startsOn ? new Date(`${event.startsOn}T00:00:00+09:00`) : undefined
    if (!start || Number.isNaN(start.getTime())) return false
    const days = (start.getTime() - now.getTime()) / DAY
    const interval = days <= 2 ? 5 : days <= 7 ? 60 : days <= 30 ? 6 * 60 : 24 * 60
    return now.getTime() - event.syncedAt.getTime() >= interval * 60_000
  }

  private async syncTour(id: string, now: Date, force: boolean) {
    const tour = await this.client.getTour(id)
    if (!tour) throw new Error(`LL-Fans 活动 ${id} 不存在`)
    await this.applyTourDetail(tour, now)
    const performances = await this.ctx.database.get('rina_llevent_performance', { eventId: id })
    const known = new Map(performances.map(performance => [performance.id, performance]))
    for (const concert of tour.concerts || []) {
      for (const item of concert.performances || []) {
        const previous = known.get(item.id)
        if (!previous || force || this.shouldRefreshPerformance(previous, now)) {
          await this.refreshPerformance(item.id, id, concert.id, item.name || '', now)
        }
      }
    }
  }

  private async applyTourDetail(tour: TourDetail, now: Date) {
    const event = (await this.ctx.database.get('rina_llevent_event', { id: tour.id }))[0]
    if (event) {
      await this.ctx.database.set('rina_llevent_event', tour.id, {
        name: tour.name || event.name, startsOn: tour.startsOn || '', endsOn: tour.endsOn || '', active: true, syncedAt: now,
      })
    }
    for (const concert of tour.concerts || []) {
      const record: LlConcert = {
        id: concert.id, eventId: tour.id, name: concert.name || '', venue: concert.venue?.name || '',
      }
      const current = (await this.ctx.database.get('rina_llevent_concert', { id: concert.id }))[0]
      if (current) {
        const { id: _id, ...update } = record
        await this.ctx.database.set('rina_llevent_concert', concert.id, update)
      }
      else await this.ctx.database.create('rina_llevent_concert', record)
    }
  }

  private shouldRefreshPerformance(performance: LlPerformance, now: Date) {
    const start = performanceStart(performance)
    if (!start) return now.getTime() - performance.syncedAt.getTime() >= 24 * 60 * 60_000
    const days = (start.getTime() - now.getTime()) / DAY
    if (days < -1) return false
    const interval = days <= 2 ? 5 : days <= 7 ? 60 : days <= 30 ? 6 * 60 : 24 * 60
    return now.getTime() - performance.syncedAt.getTime() >= interval * 60_000
  }

  private async refreshPerformance(id: string, eventId: string, concertId: string, name: string, now: Date) {
    const detail = await this.client.getPerformance(id)
    if (!detail) throw new Error(`LL-Fans 场次 ${id} 不存在`)
    await this.persistPerformance(detail, eventId, concertId, name, now)
  }

  private async persistPerformance(detail: PerformanceDetail, eventId: string, concertId: string, name: string, now: Date) {
    const old = (await this.ctx.database.get('rina_llevent_performance', { id: detail.id }))[0]
    const setlist = normalizeSetlist(detail.setlists)
    const record: LlPerformance = {
      id: detail.id, eventId, concertId, name: name || old?.name || '', date: detail.date || '', openTime: detail.openTime || '',
      startTime: detail.startTime || '', canceled: !!detail.canceled, setlistHash: hash(setlist),
      syncedAt: now, setlistCheckedAt: old?.setlistCheckedAt,
    }
    if (old) {
      const { id: _id, ...update } = record
      await this.ctx.database.set('rina_llevent_performance', detail.id, update)
    }
    else await this.ctx.database.create('rina_llevent_performance', record)
  }

  async refreshSetlist(performance: LlPerformance) {
    const now = new Date()
    const detail = await this.client.getPerformance(performance.id)
    if (!detail) throw new Error(`LL-Fans 场次 ${performance.id} 不存在`)
    const setlist = normalizeSetlist(detail.setlists)
    await this.persistPerformance(detail, performance.eventId, performance.concertId, performance.name, now)
    await this.ctx.database.set('rina_llevent_performance', performance.id, { setlistCheckedAt: now })
    const refreshed = (await this.ctx.database.get('rina_llevent_performance', { id: performance.id }))[0]
    return refreshed && { performance: refreshed, setlist }
  }

  async upcoming(days = 30) {
    const now = new Date()
    const performances = await this.ctx.database.get('rina_llevent_performance', { canceled: false })
    const events = new Map((await this.ctx.database.get('rina_llevent_event', { active: true })).map(event => [event.id, event]))
    const concerts = new Map((await this.ctx.database.get('rina_llevent_concert', {})).map(concert => [concert.id, concert]))
    return performances
      .map(performance => ({ performance, start: performanceStart(performance), event: events.get(performance.eventId), concert: concerts.get(performance.concertId) }))
      .filter((item): item is { performance: LlPerformance, start: Date, event: LlEvent | undefined, concert: LlConcert | undefined } => !!item.start && item.start >= now && item.start.getTime() <= now.getTime() + days * DAY)
      .sort((left, right) => left.start.getTime() - right.start.getTime())
  }
}

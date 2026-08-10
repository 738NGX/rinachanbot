import { Context } from 'koishi'

export interface LlEvent {
  id: string
  name: string
  startsOn: string
  endsOn: string
  active: boolean
  sourceHash: string
  syncedAt: Date
}

export interface LlConcert {
  id: string
  eventId: string
  name: string
  venue: string
}

export interface LlPerformance {
  id: string
  eventId: string
  concertId: string
  name: string
  date: string
  openTime: string
  startTime: string
  canceled: boolean
  setlistHash: string
  syncedAt: Date
  setlistCheckedAt?: Date
}

export interface LlDelivery {
  id: string
  contentHash: string
  sentAt: Date
}

declare module 'koishi' {
  interface Tables {
    rina_llevent_event: LlEvent
    rina_llevent_concert: LlConcert
    rina_llevent_performance: LlPerformance
    rina_llevent_delivery: LlDelivery
  }
}

export function extendModel(ctx: Context) {
  ctx.model.extend('rina_llevent_event', {
    id: 'string', name: 'string', startsOn: 'string', endsOn: 'string', active: 'boolean', sourceHash: 'string', syncedAt: 'timestamp',
  }, { primary: 'id' })
  ctx.model.extend('rina_llevent_concert', {
    id: 'string', eventId: 'string', name: 'string', venue: 'string',
  }, { primary: 'id' })
  ctx.model.extend('rina_llevent_performance', {
    id: 'string', eventId: 'string', concertId: 'string', name: 'string', date: 'string', openTime: 'string',
    startTime: 'string', canceled: 'boolean', setlistHash: 'string', syncedAt: 'timestamp', setlistCheckedAt: 'timestamp',
  }, { primary: 'id' })
  ctx.model.extend('rina_llevent_delivery', {
    id: 'string', contentHash: 'string', sentAt: 'timestamp',
  }, { primary: 'id' })
}

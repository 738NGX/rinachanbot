import { Schema } from 'koishi'

export interface BroadcastTarget {
  enabled: boolean
  platform: string
  selfId: string
  channelId: string
}

export interface Config {
  requestTimeout: number
  listIntervalMinutes: number
  lookaheadDays: number
  reminderMinutes: number
  expectedDurationMinutes: number
  setlistPollIntervalMinutes: number
  setlistPollHours: number
  syncOnStart: boolean
  targets: BroadcastTarget[]
}

const Target = Schema.object({
  enabled: Schema.boolean().default(true).description('启用此群推送目标'),
  platform: Schema.string().required().description('平台名，例如 onebot、qq、telegram'),
  selfId: Schema.string().required().description('发送消息的机器人 ID'),
  channelId: Schema.string().required().description('群组或频道 ID'),
})

export const Config: Schema<Config> = Schema.object({
  requestTimeout: Schema.number().min(1000).max(60000).default(15000).description('LL-Fans 请求超时（毫秒）'),
  listIntervalMinutes: Schema.number().min(5).max(1440).default(30).description('活动列表同步间隔（分钟）'),
  lookaheadDays: Schema.number().min(1).max(730).default(365).description('缓存和变更检查的未来活动范围（天）'),
  reminderMinutes: Schema.number().min(1).max(120).default(10).description('开演前提醒分钟数'),
  expectedDurationMinutes: Schema.number().min(30).max(720).default(210).description('未提供结束时间时用于开始歌单轮询的预计时长'),
  setlistPollIntervalMinutes: Schema.number().min(1).max(60).default(5).description('演出后歌单轮询间隔（分钟）'),
  setlistPollHours: Schema.number().min(1).max(72).default(24).description('演出后歌单轮询最长时长'),
  syncOnStart: Schema.boolean().default(true).description('配置了推送目标时，插件启动后立即同步活动列表'),
  targets: Schema.array(Target).default([]).description('提醒与歌单推送目标'),
})

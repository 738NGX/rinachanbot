import { Schema } from 'koishi'
import { BankId, RateType } from './types'

export interface BroadcastTarget {
  enabled: boolean
  platform: string
  selfId: string
  channelId: string
  hour: number
  minute: number
  includeChart: boolean
  chartDays: number
}

export interface ThresholdAlert {
  enabled: boolean
  bank: BankId
  rateType: RateType
  changePercent: number
  platform: string
  selfId: string
  channelId: string
}

export interface Config {
  defaultBank: BankId
  defaultRateType: RateType
  requestTimeout: number
  requestAttempts: number
  requestRetryDelay: number
  collectIntervalMinutes: number
  collectOnStart: boolean
  chartWidth: number
  chartHeight: number
  broadcasts: BroadcastTarget[]
  thresholdAlerts: ThresholdAlert[]
}

const BankSchema = Schema.union([
  Schema.const('boc').description('中国银行'),
  Schema.const('icbc').description('中国工商银行'),
])

const RateTypeSchema = Schema.union([
  Schema.const('spotSell').description('现汇卖出价（推荐默认）'),
  Schema.const('cashSell').description('现钞卖出价'),
  Schema.const('spotBuy').description('现汇买入价'),
  Schema.const('cashBuy').description('现钞买入价'),
])

const BroadcastSchema: Schema<BroadcastTarget> = Schema.object({
  enabled: Schema.boolean().default(true).description('启用这条播报规则'),
  platform: Schema.string().required().description('平台名称，例如 onebot、qq、telegram'),
  selfId: Schema.string().required().description('用于发送的机器人账号 ID'),
  channelId: Schema.string().required().description('目标频道或群组 ID'),
  hour: Schema.number().min(0).max(23).default(9).description('北京时间小时'),
  minute: Schema.number().min(0).max(59).default(0).description('北京时间分钟'),
  includeChart: Schema.boolean().default(true).description('附上趋势图'),
  chartDays: Schema.number().min(1).max(365).default(7).description('趋势图天数'),
})

const ThresholdSchema: Schema<ThresholdAlert> = Schema.object({
  enabled: Schema.boolean().default(true).description('启用这条提醒规则'),
  bank: BankSchema.default('boc'),
  rateType: RateTypeSchema.default('spotSell'),
  changePercent: Schema.number().min(0.01).max(100).required().description('相邻采样点的绝对涨跌幅达到此百分比时提醒，例如 0.5 表示上涨或下跌 0.5%'),
  platform: Schema.string().required().description('平台名称'),
  selfId: Schema.string().required().description('机器人账号 ID'),
  channelId: Schema.string().required().description('目标频道或群组 ID'),
})

export const Config: Schema<Config> = Schema.object({
  defaultBank: BankSchema.default('boc').description('购汇成本与单银行趋势的默认参考银行'),
  defaultRateType: RateTypeSchema.default('spotSell').description('默认牌价类型'),
  requestTimeout: Schema.number().min(1000).max(60000).default(15000).description('银行接口请求超时（毫秒）'),
  requestAttempts: Schema.number().min(1).max(10).default(3).description('每个银行接口请求的总尝试次数（含首次请求）'),
  requestRetryDelay: Schema.number().min(100).max(30000).default(1500).description('请求失败后的首次重试等待时间（毫秒），后续等待时间线性递增'),
  collectIntervalMinutes: Schema.number().min(10).max(1440).default(60).description('牌价采集间隔（分钟）'),
  collectOnStart: Schema.boolean().default(true).description('插件启动后立即采集一次'),
  chartWidth: Schema.number().min(600).max(2000).default(1200).description('趋势图宽度'),
  chartHeight: Schema.number().min(360).max(1200).default(680).description('趋势图高度'),
  broadcasts: Schema.array(BroadcastSchema).default([]).description('每日定时播报目标'),
  thresholdAlerts: Schema.array(ThresholdSchema).default([]).description('跌破阈值提醒规则'),
})

import { Context } from 'koishi'
import { BankId } from './types'

export interface ExchangeRateHistory {
  id: number
  bank: BankId
  currency: 'JPY'
  unit: number
  spotBuy: number
  cashBuy: number
  spotSell: number
  cashSell: number
  publishedAt: Date
  collectedAt: Date
  sourceUrl: string
}

export interface ExchangeRateAlertState {
  id: number
  key: string
  direction: number
  updatedAt: Date
}

declare module 'koishi' {
  interface Tables {
    rina_currency_rate: ExchangeRateHistory
    rina_currency_alert_state: ExchangeRateAlertState
  }
}

export function extendModel(ctx: Context) {
  ctx.model.extend('rina_currency_rate', {
    id: 'unsigned',
    bank: 'string',
    currency: 'string',
    unit: 'integer',
    spotBuy: 'double',
    cashBuy: 'double',
    spotSell: 'double',
    cashSell: 'double',
    publishedAt: 'timestamp',
    collectedAt: 'timestamp',
    sourceUrl: 'string',
  }, {
    autoInc: true,
  })

  ctx.model.extend('rina_currency_alert_state', {
    id: 'unsigned',
    key: 'string',
    direction: 'integer',
    updatedAt: 'timestamp',
  }, {
    autoInc: true,
  })
}

import { Context } from 'koishi'
import 'koishi-plugin-cron'
import { Config as ConfigSchema, Config as PluginConfig } from './config'
import { registerCommands } from './commands'
import { extendModel } from './model'
import { BocProvider } from './providers/boc'
import { IcbcProvider } from './providers/icbc'
import { Scheduler } from './scheduler'
import { RateService } from './service'

export const name = 'rina-currency'
export const inject = ['database', 'cron']

export type Config = PluginConfig
export const Config = ConfigSchema

export function apply(ctx: Context, config: Config) {
  extendModel(ctx)

  const logger = ctx.logger(name)
  const service = new RateService(ctx, logger, [
    new BocProvider(config.requestTimeout, config.requestAttempts, config.requestRetryDelay),
    new IcbcProvider(config.requestTimeout, config.requestAttempts, config.requestRetryDelay),
  ])

  registerCommands(ctx, service, config)
  new Scheduler(ctx, logger, service, config).start()
}

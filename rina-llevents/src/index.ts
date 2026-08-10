import { Context } from 'koishi'
import 'koishi-plugin-cron'
import { Config as ConfigSchema, Config as PluginConfig } from './config'
import { registerCommands } from './commands'
import { LlFansClient } from './graphql'
import { extendModel } from './model'
import { Scheduler } from './scheduler'
import { LlEventService } from './service'

export const name = 'rina-llevents'

export const inject = { required: ['database', 'cron', 'http'], optional: ['puppeteer'] }

export type Config = PluginConfig
export const Config = ConfigSchema

export function apply(ctx: Context, config: Config) {
  extendModel(ctx)
  const logger = ctx.logger(name)
  const service = new LlEventService(ctx, logger, new LlFansClient(ctx, config.requestTimeout), config)
  registerCommands(ctx, service)
  new Scheduler(ctx, logger, service, config).start()
}

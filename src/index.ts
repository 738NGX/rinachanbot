import { Context, Schema, Logger, Bot, MessageEncoder, Database, h } from 'koishi'
import { searchEvents } from './calendar';
import { getBirthdays, getBirthdaysByDate } from './birthdays';
import { singleTarot, tarot } from './tarot';
import { CountDown, createCountDown, deleteCountDown, listCountDown } from './countDown';
import * as Gallery from './gallery';
import * as Bill from './bill';
import * as Translate from './translate';
import * as DailyReport from './dailyReport';

export const name = 'rinachanbot'

export const logger = new Logger(name)

export const inject = {
  required: ['database', 'cron'],
  optional: [],
}

declare module 'koishi' {
  export interface Tables {
    gallery: Gallery.Gallery
    galleryName: Gallery.GalleryName
    countDown: CountDown
    bill: Bill.Bill
    billDetail: Bill.BillDetail
  }
  export interface Context {
    bots: Bot[]
    http: any
    model: any
    database: any
    cron: any
  }
}

export interface Config {
  dailyReport: boolean
  botPlatform: string
  botId: string
  targetGroups: string[]
  maxCountDown: number
  galleryPath: string
  defaultImageExtension: string
  maxout: number
  replaceRkey: boolean
  oldRkey: string
  newRkey: string
  consoleinfo: boolean
  defaultCurrency: string
  tarotPath: string;
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    dailyReport: Schema.boolean().description('是否启用日报').default(true),
    botPlatform: Schema.string().description('机器人平台'),
    botId: Schema.string().description('机器人ID'),
    targetGroups: Schema.array(Schema.string()).description('目标群组').default([]),
  }).description('📅 日报'),
  Schema.object({
    maxCountDown: Schema.number().description('最大倒数日数量').default(10),
  }).description('🔍 信息查询'),
  Schema.object({
    galleryPath: Schema.string().description('图库根目录').default(null).required(),
    defaultImageExtension: Schema.union(['jpg', 'png', 'gif']).description("默认图片后缀名").default('jpg'),
    maxout: Schema.number().description('一次最大输出图片数量').default(5),
    replaceRkey: Schema.boolean().description('是否使用手动指定的rkey进行替换').default(false),
    oldRkey: Schema.string().description('需要替换的rkey').default(null),
    newRkey: Schema.string().description('替换后的rkey').default(null),
    consoleinfo: Schema.boolean().description('是否在控制台输出图片信息').default(false),
  }).description('🖼️ 图库'),
  Schema.object({
    defaultCurrency: Schema.union(['cny', 'jpy']).description('默认货币币种').default('cny'),
  }).description('💴 账本'),
  Schema.object({
    tarotPath: Schema.string().description('塔罗牌根目录').default(null).required(),
  }).description('🎲 互动'),
])

export function apply(ctx: Context, config: Config) {
  /****************************************
   *
   * 数据库
   *
   ***************************************/
  // 图库目录
  ctx.model.extend('rina.gallery', {
    id: 'unsigned',
    path: 'string',
  }, { primaryKey: 'id', autoInc: true });

  //图库别名
  ctx.model.extend('rina.galleryName', {
    id: 'unsigned',
    name: 'string',
    galleryId: 'unsigned',
  }, { primaryKey: 'id', autoInc: true });

  // 倒数日
  ctx.model.extend('rina.countDown', {
    id: 'unsigned',
    name: 'string',
    date: 'date',
  }, { primaryKey: 'id', autoInc: true });

  // 生日
  ctx.model.extend('rina.birthday', {
    id: 'unsigned',
    month: 'unsigned',
    date: 'unsigned',
    name: 'string',
    userid: 'string',
  }, { primaryKey: 'id', autoInc: true });

  // 账本
  ctx.model.extend('rina.bill', {
    id: 'unsigned',
    name: 'string',         // 账本名
    currency: 'string',     // 默认货币币种
    user: 'string',         // 账本主人
    limit: 'double',        // 限额
  }, { primaryKey: 'id', autoInc: true });

  // 账目
  ctx.model.extend('rina.billDetail', {
    id: 'unsigned',
    billId: 'unsigned',     // 所属账本
    name: 'string',         // 账目名
    amount: 'double',       // 金额
    currency: 'string',     // 货币币种
    date: 'date',           // 日期
    note: 'string',         // 备注
  }, { primaryKey: 'id', autoInc: true });

  /****************************************
   *
   * 定时任务
   *
   ***************************************/
  // 每天 23:00 发送第二天的日报
  ctx.cron('0 23 * * *', async () => {
    await DailyReport.sendDailyReport(ctx, config, null);
  })

  /****************************************
   *
   * 指令
   *
   ***************************************/

  // 测试
  ctx.command('rinachanbot/天使天才', '简单的测试命令')
    .action(({ session }) => {
      session.send('天王寺！[≧▽≦]')
    });

  // 信息查询
  ctx.command('rinachanbot/生日 [month:number]', '查询LL成员生日信息')
    .action(({ session }, month) => {
      return getBirthdays(month);
    });

  ctx.command('rinachanbot/日报', '查询指定日期的日报')
    .option('day', '-d <day:number>').option('month', '-m <month:number>').option('year', '-y <year:number>')
    .action(async ({ session, options }) => {
      await DailyReport.getDailyReport(ctx, session, null);
    });

  ctx.command('rinachanbot/日程', '查询指定日期的日程')
    .option('day', '-d <day:number>').option('month', '-m <month:number>').option('year', '-y <year:number>')
    .action(async ({ session, options }) => {
      return await searchEvents(options.day, options.month, options.year);
    });

  ctx.command('rinachanbot/倒数日', '倒数日相关操作')
    .option('add', '-a <add:string>').option('remove', '-r <remove:string>').option('list', '-l')
    .option('day', '-d <day:number>').option('month', '-m <month:number>').option('year', '-y <year:number>')
    .action(async ({ session, options }) => {
      logger.info(options);
      if (options.add) {
        return await createCountDown(options.add, options.day, options.month, options.year, config, ctx);
      } else if (options.remove) {
        return await deleteCountDown(options.remove, ctx);
      } else if (options.list) {
        return await listCountDown(options.day, options.month, options.year, ctx);
      } else {
        return '请输入正确的参数[X﹏X]';
      }
    });

  // 图库
  ctx.command('rinachanbot/新建图库 <name:string> [...rest]', '新建一个图库')
    .action(async ({ session }, name, ...rest) => {
      return await Gallery.createGallery(name, rest, config, ctx);
    });

  ctx.command('rinachanbot/关联图库 <name:string> <gallery:string>', '关联一个名称到已有图库')
    .option('force', '-f', { fallback: false })
    .action(async ({ session, options }, name, gallery) => {
      return await Gallery.associateGallery(name, gallery, options, ctx);
    });

  ctx.command('rinachanbot/加图 <name:string>', '保存图片到指定图库')
    .option('ext', '-e <ext:string>')
    .option('fileName', '-n <fileName:string>')
    .action(async ({ session, options }, name) => {
      return await Gallery.addImages(session, name, options.fileName, options, config, ctx);
    });

  ctx.command('rinachanbot/偷图 <name:string>', '回复图片以保存到指定路径')
    .option('ext', '-e <ext:string>')
    .option('fileName', '-n <fileName:string>')
    .action(async ({ session, options }, name) => {
      return await Gallery.stealImages(session, name, options.fileName, options, config, ctx);
    });

  ctx.command('rinachanbot/璃奈板 <name:string> [count:number]', '随机从指定图库输出图片')
    .option('allRandom', '-r', { fallback: false })
    .action(async ({ session, options }, name, count) => {
      return await Gallery.loadImages(name, count, options, config, ctx);
    });

  // 账本
  ctx.command('rinachanbot/查账 [name:string]', '查看账本信息')
    .option('rate', '-r <rate:number>')
    .action(async ({ session, options }, name) => {
      if (!name) return Bill.listBill(ctx);
      const info = await Bill.showBillInfo(name, options.rate, ctx);
      const detail = await Bill.listBillDetail(name, session, ctx);
      session.send(info);
      session.send(detail);
    });

  ctx.command('rinachanbot/新建账本 <name:string>', '新建一个账本')
    .option('currency', '-c <currency:string>').option('user', '-u <user:string>').option('limit', '-l <limit:number>')
    .action(async ({ session, options }, name) => {
      return Bill.createBill(name, options.currency, options.user, options.limit, config, ctx);
    });

  ctx.command('rinachanbot/修改账本', '修改现有账本')
    .option('name', '-n <name:string>').option('currency', '-c <currency:string>')
    .option('user', '-u <user:string>').option('limit', '-l <limit:number>')
    .action(async ({ session, options }, name) => {
      return Bill.updateBill(name, options.name, options.currency, options.user, options.limit, ctx);
    });

  ctx.command('rinachanbot/合并账本 <name:string> <target:string>', '将一个账本的数据合并到另一个账本')
    .option('remove', '-r', { fallback: false })
    .action(async ({ session, options }, name, target) => {
      return Bill.mergeBill(name, target, options.remove, ctx);
    });

  ctx.command('rinachanbot/删除账本 <name:string>', '删除一个账本')
    .action(async ({ session }, name) => {
      return Bill.deleteBill(name, ctx);
    });

  ctx.command('rinachanbot/记账 <bill:string> <name:string> <amount:number>', '记账')
    .option('currency', '-c <currency:string>').option('day', '-d <day:number>').option('month', '-m <month:number>')
    .option('year', '-y <year:number>').option('note', '-n <note:string>')
    .action(async ({ session, options }, bill, name, amount) => {
      return Bill.createBillDetail(bill, name, amount, options.currency, options.day, options.month, options.year, options.note, ctx);
    });

  ctx.command('rinachanbot/删账 <id:number>', '删除一条账目')
    .action(async ({ session }, id) => {
      return Bill.deleteBillDetail(id, ctx);
    });

  // 互动
  ctx.command('rinachanbot/塔罗', '抽取一张塔罗牌')
    .action(async ({ session }) => {
      const message = await singleTarot(session, config.tarotPath);
      session.send(message);
    });

  ctx.command('rinachanbot/塔罗牌', '抽取四张塔罗牌')
    .action(async ({ session }) => {
      const message = await tarot(session, config.tarotPath);
      session.send(message);
    });

  ctx.command("翻译 <content:text>")
    .option('language', '-l <language:string>', { fallback: 'zh' })
    .action(async ({ session, options }, content) => {
      return await Translate.google_translate(ctx, content, options.language);
    });

  ctx.command("翻译消息")
    .option('language', '-l <language:string>', { fallback: 'zh' })
    .action(async ({ session, options }) => {
      await Translate.message_translate(session, ctx, options.language)
    });
}

export { Context };


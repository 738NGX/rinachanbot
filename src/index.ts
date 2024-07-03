import { Context, Schema, Logger, Bot, MessageEncoder } from 'koishi'
import { searchEvents } from './calendar';
import { getBirthdays } from './birthdays';
import { singleTarot, tarot } from './tarot';
import * as Gallery from './gallery';
import { copyFileSync } from 'fs';

export const name = 'rinachanbot'

export const logger = new Logger(name)

export const inject = {
    required: ['database', 'cron'],
    optional: [],
}

declare module 'koishi' {
    interface Tables {
        gallery: Gallery.Gallery
        galleryName: Gallery.GalleryName
    }
    interface Context {
        bots: Bot[]
        http: any
        model: any
        database: any
        cron: any
    }
}

export interface Config {
    botPlatform: string
    botId: string
    targetGroups: string[]
    galleryPath: string
    defaultImageExtension: string
    maxout: number
    consoleinfo: boolean
    tarotPath: string;
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        botPlatform: Schema.string().description('机器人平台'),
        botId: Schema.string().description('机器人ID'),
        targetGroups: Schema.array(Schema.string()).description('目标群组').default([]),
    }).description('📅 日报'),
    Schema.object({
        galleryPath: Schema.string().description('图库根目录').default(null).required(),
        defaultImageExtension: Schema.union(['jpg', 'png', 'gif']).description("默认图片后缀名").default('jpg'),
        maxout: Schema.number().description('一次最大输出图片数量').default(5),
    }).description('🖼️ 图库'),
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
    ctx.model.extend('rina.gallery', {
        id: 'unsigned',
        path: 'string',
    }, { primaryKey: 'id', autoInc: true });

    ctx.model.extend('rina.galleryName', {
        id: 'unsigned',
        name: 'string',
        galleryId: 'unsigned',
    }, { primaryKey: 'id', autoInc: true });

    /****************************************
     * 
     * 定时任务
     * 
     ***************************************/
    // 每天 23:00 发送第二天的日报
    ctx.cron('0 23 * * *', async () => {
        const bot = ctx.bots[`${config.botPlatform}:${config.botId}`]
        if(!bot) return;

        const date = new Date();
        date.setDate(date.getDate() + 1);
        
        for(let group of config.targetGroups) {
            bot.sendMessage(group, `现在是东京时间${date.toISOString().split('T')[0]} 00:00,新的一天开始了[≧▽≦]`);
            const events = await searchEvents(date.getDate(), date.getMonth() + 1, date.getFullYear());
            bot.sendMessage(group, `以下是今日的LoveLive!企划相关事件,请查收:\n${events}`);
        }
    })

    /****************************************
     * 
     * 指令
     * 
     ***************************************/

    // 测试
    ctx.command('天使天才', '简单的测试命令')
        .action(({ session }) => {
            session.send('天王寺！[≧▽≦]')
        });

    // 信息查询
    ctx.command('生日 [month:number]', '查询LL成员生日信息')
        .action(({ session }, month) => {
            return getBirthdays(month);
        });

    ctx.command('日程 [day:number] [month:number] [year:number]', '查询指定日期的日程')
        .action(async ({ session }, day, month, year) => {
            return await searchEvents(day, month, year);
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

    ctx.command('rinachanbot/加图 <name:string> [filename:string]', '保存图片到指定图库')
        .option('ext', '-e <ext:string>')
        .action(async ({ session, options }, name, filename) => {
            return await Gallery.addImages(session, name, filename, options, config, ctx);
        });

    ctx.command('rinachanbot/璃奈板 <name:string> [count:number]', '随机输出图片')
        .option('allRandom', '-r', { fallback: false })
        .action(async ({ session, options }, name, count) => {
            return await Gallery.loadImages(name, count, options, config, ctx);
        });

    // 互动
    ctx.command('塔罗', '抽取一张塔罗牌')
        .action(async ({ session }) => {
            const message = await singleTarot(session, config.tarotPath);
            session.send(message);
        });

    ctx.command('塔罗牌', '抽取四张塔罗牌')
        .action(async ({ session }) => {
            const message = await tarot(session, config.tarotPath);
            session.send(message);
        });
}


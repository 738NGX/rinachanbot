import { Context, Schema, Logger, h, Database, Model } from 'koishi'
import { getEvents, calendarUrls } from './calendar';
import { birthdays } from './birthdays_data';
import { singleTarot, tarot } from './tarot';
import fs from 'fs';
import * as Gallery from './gallery';
import { pathToFileURL } from 'url'
import { join } from 'path'

export const name = 'rinachanbot'

export const logger = new Logger('rinachanbot-img-manager');

export const inject = {
    required: ['database'],
    optional: [],
}

export interface Config {
    tarotPath: string;
    defaultImageExtension: string
    galleryPath: string
    maxout: number
    consoleinfo: boolean
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        galleryPath: Schema.string().description('图库根目录').default(null).required(),
        defaultImageExtension: Schema.string().description("默认图片后缀名").default("jpg"),
        maxout: Schema.number().description('一次最大输出图片数量').default(10),
    }).description('🖼️ 图库'),
    Schema.object({
        tarotPath: Schema.string().description('塔罗牌根目录').default(null),
    }).description('🎲 互动'),
])

declare module 'koishi' {
    interface Context {
        model: any
        database: any
    }
}

export function apply(ctx: Context, config: Config) {
    // 图库数据库
    ctx.model.extend('rina.gallery', {
        id: 'unsigned',
        path: 'string',
    }, { primaryKey: 'id', autoInc: true });

    ctx.model.extend('rina.galleryName', {
        id: 'unsigned',
        name: 'string',
        galleryId: 'unsigned',
    }, { primaryKey: 'id', autoInc: true });

    ctx.command('天使天才', '简单的测试命令').action(({ session }) => {
        session.send('天王寺！[≧▽≦]')
    });

    ctx.command('生日 [month:number]', '查询LL成员生日信息').action(({ session }, month) => {
        const now = new Date();
        const ifAvailMonth = month && month >= 1 && month <= 12;
        const currentMonth = ifAvailMonth ? month : now.getMonth() + 1;
        const currentMonthBirthdays = birthdays.filter(b => b.month === currentMonth);

        const formatBirthdays = (birthdays: any[]) => {
            return birthdays.map(b => `${b.month}月${b.date}日 ${b.name} (${b.group}, ${b.role})`).join('\n');
        }

        const message = `${currentMonth}月的生日信息:\n${formatBirthdays(currentMonthBirthdays)}}`;
        return message;
    });

    ctx.command('日程 [day:number] [month:number] [year:number]', '查询指定日期的日程').action(async ({ session }, day, month, year) => {
        const now = new Date();
        const d = day ? day : now.getDate();
        const m = month ? month - 1 : now.getMonth();
        const y = year ? year : now.getFullYear();
        const date = new Date(y, m, d + 1);
        const formattedDate = date.toISOString().split('T')[0];

        try {
            const events = await getEvents(formattedDate, calendarUrls);
            if (events.length === 0) {
                session.send(`在 ${formattedDate} 没有找到任何日程。`);
            } else {
                const message = events.map(event => `${event.start.toISOString()} - ${event.summary}`).join('\n');
                session.send(message);
            }
        } catch (error) {
            session.send(`获取日程信息时发生错误: ${error.message}`);
        }
    });

    ctx.command('塔罗', '抽取一张塔罗牌').action(async ({ session }) => {
        if (!config.tarotPath) {
            session.send('未配置塔罗牌根目录。');
            return;
        }
        const message = await singleTarot(session, config.tarotPath);
        session.send(message);
    });

    ctx.command('塔罗牌', '抽取四张塔罗牌').action(async ({ session }) => {
        if (!config.tarotPath) {
            session.send('未配置塔罗牌根目录。');
            return;
        }
        const message = await tarot(session, config.tarotPath);
        session.send(message);
    });

    // 新建图库
    ctx.command('rinachanbot/新建图库 <name:string> [...rest]', '新建一个图库')
        .action(async ({ session }, name, ...rest) => {
            if (!name) return '请输入图库名[X﹏X]';

            // 检查是否存在同名图库
            let duplicate = await ctx.database.get('rina.galleryName', { name: [name], })
            if (duplicate.length != 0) { return '图库已存在[X﹏X]'; }

            let newGallery = await ctx.database.create('rina.gallery', { path: name })
            let newGalleryName = await ctx.database.create('rina.galleryName', { name: name, galleryId: newGallery.id })
            await fs.promises.mkdir(config.galleryPath + "/" + name, { recursive: true });

            // 多个图库的创建
            if (rest.length > 0) {
                for (const rest_name of rest) {
                    duplicate = await ctx.database.get('rina.galleryName', { name: [rest_name], })
                    if (duplicate.length != 0) { return `图库${rest_name}已存在[X﹏X]`; }
                    newGallery = await ctx.database.create('rina.gallery', { path: rest_name })
                    newGalleryName = await ctx.database.create('rina.galleryName', { name: rest_name, galleryId: newGallery.id })
                    await fs.promises.mkdir(config.galleryPath + "/" + rest_name, { recursive: true });
                }
            }

            let prefix = rest.length > 0 ? `${rest.length + 1}个` : ''
            return `${prefix}图库创建成功! [=^▽^=]`;
        });

    // 关联图库
    ctx.command('rinachanbot/关联图库 <name:string> <gallery:string>', '关联一个名称到已有图库')
        .option('force', '-f', { fallback: false })
        .action(async ({ session, options }, name, gallery) => {
            if (!name) return '请输入图库名[X﹏X]';

            // 检查是否存在同名图库
            const duplicate = await ctx.database.get('rina.galleryName', { name: [name], })

            if (!options.force) {
                if (duplicate.length != 0) { return '名称已存在[X﹏X]'; }

                // 检查图库是否存在
                const galleryId = await ctx.database.get('rina.galleryName', { name: [gallery], })
                if (galleryId.length == 0) { return '图库不存在[X﹏X]'; }

                await ctx.database.create('rina.galleryName', { name: name, galleryId: galleryId[0].galleryId })
                return '关联成功! [=^▽^=]';
            } else {
                if (duplicate.length == 0) { return '名称不存在,-f选项不可用[X﹏X]'; }

                // 检查图库是否存在
                const galleryId = await ctx.database.get('rina.gallery', { path: [gallery], })
                if (galleryId.length == 0) { return '图库不存在,注意-f选项启用后不能关联到图库别名[X﹏X]'; }

                await ctx.database.update('rina.galleryName', { name: name }, { galleryId: galleryId[0].id })
                return '关联成功! [=^▽^=]';
            }
        });

    // 加图
    ctx.command('rinachanbot/加图 <name:string> [filename:string]', '保存图片到指定图库')
        .option('ext', '-e <ext:string>')
        .action(async ({ session, options }, name, filename) => {
            if (!name) return '请输入图库名[X﹏X]';

            // 选择图库
            const selected = await ctx.database.get('rina.galleryName', { name: [name], });
            if (selected.length == 0) return '不存在的图库,请重新输入或新建/关联图库[X﹏X]';
            const selectedSubPath = await ctx.database.get('rina.gallery', { id: [selected[0].galleryId], });
            const selectedPath = join(config.galleryPath, selectedSubPath[0].path);

            // 文件名处理
            let safeFilename: string;
            if (!filename) {
                // 如果未指定文件名，则生成默认文件名，是【年-月-日-小时-分】
                const date = new Date();
                safeFilename = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
            } else {
                // 使用用户指定的文件名
                safeFilename = filename;
            }

            // 处理中文文件名
            if(!['jpg','png','gif'].includes(options.ext)) {
                options.ext = config.defaultImageExtension;
            }
            const imageExtension = options.ext || config.defaultImageExtension;
            safeFilename = safeFilename.replace(/[\u0000-\u001f\u007f-\u009f\/\\:*?"<>|]/g, '_'); // 移除不安全字符

            // 获取图片
            await session.send('请发送图片[≧▽≦]');
            const image = await session.prompt(30000);

            // 提取图片URL
            if (config.consoleinfo) {
                logger.info('用户输入： ' + image);
            }
            const urlhselect = h.select(image, 'img').map(item => item.attrs.src);
            if (!urlhselect) return '无法提取图片URL[X﹏X]';

            // 调用 saveImages 函数保存图片
            try {
                await Gallery.saveImages(urlhselect, selectedPath, safeFilename, imageExtension, config, session, ctx);
            } catch (error) {
                return `保存图片时出错[X﹏X]：${error.message}`;
            }
        });

    // 璃奈板
    ctx.command('rinachanbot/璃奈板 <name:string> [count:number]', '随机输出图片')
        .option('allRandom', '-r', { fallback: false })
        .action(async ({ session, options }, name, count) => {
            if (!name) return '请输入图库名[X﹏X]';

            // 处理数量
            if (!count) count = 1
            if (count > config.maxout) count = config.maxout

            // 匹配图库
            const selected = await ctx.database.get('rina.galleryName', { name: [name], });
            if (selected.length == 0) return '不存在的图库[X﹏X]';
            const index = selected.length == 1 ? 0 : Math.floor(Math.random() * selected.length);
            const selectedSubPath = await ctx.database.get('rina.gallery', { id: [selected[index].galleryId], });
            const gallery = selectedSubPath[0].path;

            // 选择图片
            let pickeed = Gallery.ImagerPicker(config.galleryPath, gallery, count, options.allRandom);
            let res = []
            for (const fname of pickeed) {
                const p = join(config.galleryPath, gallery, fname)
                res.push(h.image(pathToFileURL(p).href))
            }

            return res
        });
}


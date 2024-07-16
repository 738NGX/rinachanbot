import { Session, Context, h, Logger } from 'koishi'
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url'
import { Config } from './index';

export const img_logger = new Logger('rinachanbot-img-manager');

export interface Gallery {
    id: number
    path: string
}

export interface GalleryName {
    id: number
    name: string
    galleryId: number
}

export async function createGallery(name: string, rest: string[], config: Config, ctx: Context) {
    if (!name) return '请输入图库名[X﹏X]';

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
}

export async function associateGallery(name: string, gallery: string, options: any, ctx: Context) {
    if (!name) return '请输入图库名[X﹏X]';

    const duplicate = await ctx.database.get('rina.galleryName', { name: [name], })

    if (!options.force) {
        if (duplicate.length != 0) { return '名称已存在[X﹏X]'; }

        const galleryId = await ctx.database.get('rina.galleryName', { name: [gallery], })
        if (galleryId.length == 0) { return '图库不存在[X﹏X]'; }

        await ctx.database.create('rina.galleryName', { name: name, galleryId: galleryId[0].galleryId })
        return '关联成功! [=^▽^=]';
    } else {
        if (duplicate.length == 0) { return '名称不存在,-f选项不可用[X﹏X]'; }

        const galleryId = await ctx.database.get('rina.gallery', { path: [gallery], })
        if (galleryId.length == 0) { return '图库不存在,注意-f选项启用后不能关联到图库别名[X﹏X]'; }

        await ctx.database.create('rina.galleryName', { name: name, galleryId: galleryId[0].id })
        return '关联成功! [=^▽^=]';
    }
}

export async function addImages(session: any, name: string, filename: string, options: any, config: Config, ctx: Context) {
    if (!name) return '请输入图库名[X﹏X]';

    const selected = await ctx.database.get('rina.galleryName', { name: [name], });
    if (selected.length == 0) return '不存在的图库,请重新输入或新建/关联图库[X﹏X]';
    const selectedSubPath = await ctx.database.get('rina.gallery', { id: [selected[0].galleryId], });
    const selectedPath = path.join(config.galleryPath, selectedSubPath[0].path);

    let safeFilename: string;
    if (!filename) {
        // 默认文件名格式【年-月-日-小时-分】
        const date = new Date();
        safeFilename = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
    } else {
        safeFilename = filename;
    }

    if (!['jpg', 'png', 'gif'].includes(options.ext)) {
        options.ext = config.defaultImageExtension;
    }
    const imageExtension = options.ext || config.defaultImageExtension;
    safeFilename = safeFilename.replace(/[\u0000-\u001f\u007f-\u009f\/\\:*?"<>|]/g, '_');

    await session.send('请发送图片[≧▽≦]');
    const image = await session.prompt(30000);

    if (config.consoleinfo) {
        img_logger.info('用户输入： ' + image);
    }
    const urlhselect = h.select(image, 'img').map(item => item.attrs.src);

    if (!urlhselect) return '无法提取图片URL[X﹏X]';
    
    const updatedUrls = config.replaceRkey ? replaceRKey(urlhselect, config.oldRkey, config.newRkey) : urlhselect;

    try {
        const result = await saveImages(updatedUrls, selectedPath, safeFilename, imageExtension, config, session, ctx);
        await session.send(`${result.success}张图片已成功保存到${name},失败${result.failed}张[=^▽^=]`);
    } catch (error) {
        return `保存图片时出错[X﹏X]：${error.message}`;
    }
}

export async function stealImages(session: any, name: string, filename: string, options: any, config: Config, ctx: Context) {
    if (!name) return '请输入图库名[X﹏X]';

    const selected = await ctx.database.get('rina.galleryName', { name: [name], });
    if (selected.length == 0) return '不存在的图库,请重新输入或新建/关联图库[X﹏X]';
    const selectedSubPath = await ctx.database.get('rina.gallery', { id: [selected[0].galleryId], });
    const selectedPath = path.join(config.galleryPath, selectedSubPath[0].path);

    let safeFilename: string;
    if (!filename) {
        // 默认文件名格式【年-月-日-小时-分】
        const date = new Date();
        safeFilename = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
    } else {
        safeFilename = filename;
    }

    if (!['jpg', 'png', 'gif'].includes(options.ext)) {
        options.ext = config.defaultImageExtension;
    }
    const imageExtension = options.ext || config.defaultImageExtension;
    safeFilename = safeFilename.replace(/[\u0000-\u001f\u007f-\u009f\/\\:*?"<>|]/g, '_');

    const quotemessage = session.quote.content;
    const urlhselect = h.select(quotemessage, 'img').map(item => item.attrs.src);
    if (!quotemessage) {
        return '请回复带有图片的消息[X﹏X]';
    }
    if (config.consoleinfo) {
        img_logger.info('触发回复的目标消息内容： ' + session.quote.content);
    }
    if (!urlhselect) return '无法提取图片URL[X﹏X]';

    const updatedUrls = config.replaceRkey ? replaceRKey(urlhselect, config.oldRkey, config.newRkey) : urlhselect;

    try {
        const result = await saveImages(updatedUrls, selectedPath, safeFilename, imageExtension, config, session, ctx);
        await session.send(`${result.success}张图片已成功保存到${name},失败${result.failed}张[=^▽^=]`);
    } catch (error) {
        return `保存图片时出错[X﹏X]：${error.message}`;
    }
}

export async function loadImages(name: string, count: number, options: any, config: Config, ctx: Context) {
    if (!name) return '请输入图库名[X﹏X]';

    if (!count) count = 1
    if (count > config.maxout) count = config.maxout

    const selected = await ctx.database.get('rina.galleryName', { name: [name], });
    if (selected.length == 0) return '不存在的图库[X﹏X]';
    const index = selected.length == 1 ? 0 : Math.floor(Math.random() * selected.length);
    const selectedSubPath = await ctx.database.get('rina.gallery', { id: [selected[index].galleryId], });
    const gallery = selectedSubPath[0].path;

    let pickeed = imagePicker(config.galleryPath, gallery, count, options.allRandom);
    let res = []
    for (const fname of pickeed) {
        const p = path.join(config.galleryPath, gallery, fname)
        res.push(h.image(pathToFileURL(p).href))
    }

    return res
}

function replaceRKey(urls: string[], oldRKey: string, newRKey: string): string[] {
    return urls.map(url => {
        const regex = new RegExp(`rkey=${oldRKey}`);
        return url.replace(regex, `rkey=${newRKey}`);
    });
}

async function saveImages(urls: string[], selectedPath: string, safeFilename: string, imageExtension: string, config: Config, session: Session, ctx: Context) {
    let failed_count = 0;
    for (let i = 0; i < urls.length; i++) {
        let url = urls[i];
        let fileRoot = path.join(selectedPath, safeFilename);
        let fileExt = `.${imageExtension}`;
        let targetPath = `${fileRoot}${fileExt}`;
        let index = 0; // 重名文件序号

        if (config.consoleinfo) {
            img_logger.info('提取到的图片链接：' + url);
        }

        while (fs.existsSync(targetPath)) {
            index++;
            targetPath = `${fileRoot}(${index})${fileExt}`;
        }

        try {
            const buffer = await ctx.http.get(url);
            if (config.consoleinfo) {
                img_logger.info('Downloaded ArrayBuffer size:', buffer.byteLength);
            }
            if (buffer.byteLength === 0) throw new Error('下载的数据为空');
            await fs.promises.writeFile(targetPath, Buffer.from(buffer));
        } catch (error) {
            img_logger.info('保存图片时出错[X﹏X]： ' + error.message);
            failed_count++;
            //await session.send(`保存图片时出错[X﹏X]：${error.message}`);
        }
    }
    return { success: urls.length - failed_count, failed: failed_count };
}

function imagePicker(basePath: string, gallery: string, count: number, allRandom: boolean) {
    const files = fs.readdirSync(path.join(basePath, gallery));

    if (count > files.length) { count = files.length; }
    if (count < 1) { count = 1; }

    // 连续选择
    if (!allRandom) {
        const k = Math.round(Math.random() * (count - files.length) + files.length - count);
        return files.slice(k, k + count)
    }

    // 随机选择
    const selectedFiles = [];
    const usedIndices = new Set();

    while (selectedFiles.length < count) {
        const randomIndex = Math.floor(Math.random() * files.length);
        if (!usedIndices.has(randomIndex)) {
            usedIndices.add(randomIndex);
            selectedFiles.push(files[randomIndex]);
        }
    }

    return selectedFiles;
}
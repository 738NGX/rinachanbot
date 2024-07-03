import { Tables, Session, Context } from 'koishi'
import fs from 'fs';
import path from 'path';
import { Config, logger } from './index';

declare module 'koishi' {
    interface Tables {
        gallery: Gallery
        galleryName: GalleryName
    }
    interface Context {
        http: any
    }
}

export interface Gallery {
    id: number
    path: string
}

export interface GalleryName {
    id: number
    name: string
    galleryId: number
}

export async function saveImages(
    urls: string[],
    selectedPath: string,
    safeFilename: string,
    imageExtension: string,
    config: Config,
    session: Session,
    ctx: Context) {
    for (let i = 0; i < urls.length; i++) {
        let url = urls[i];
        let fileRoot = path.join(selectedPath, safeFilename);
        let fileExt = `.${imageExtension}`;
        let targetPath = `${fileRoot}${fileExt}`;
        let index = 0; // 用于记录尝试的文件序号

        if (config.consoleinfo) {
            logger.info('提取到的图片链接：' + url);
        }

        // 重名文件检查
        while (fs.existsSync(targetPath)) {
            index++;
            targetPath = `${fileRoot}(${index})${fileExt}`; // 更新目标文件路径
        }

        // 下载并保存图片
        try {
            const buffer = await ctx.http.get(url);
            if (config.consoleinfo) {
                logger.info('Downloaded ArrayBuffer size:', buffer.byteLength);
            }
            if (buffer.byteLength === 0) throw new Error('下载的数据为空');
            await fs.promises.writeFile(targetPath, Buffer.from(buffer));

            // 根据是否存在重名文件发送不同消息
            if (i == 0) {
                if (index > 0) {
                    await session.send(`出现同名文件,已保存为 ${safeFilename}(${index})${fileExt} [=^▽^=]`);
                } else {
                    await session.send(`图片已成功保存[=^▽^=]`);
                }
            }
        } catch (error) {
            logger.info('保存图片时出错[X﹏X]： ' + error.message);
            await session.send(`保存图片时出错[X﹏X]：${error.message}`);
        }
    }
    await session.send('图片批量保存完毕[=^▽^=]');
}

export function ImagerPicker(basePath: string, gallery: string, count: number, allRandom: boolean) {
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
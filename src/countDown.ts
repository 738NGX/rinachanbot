import { Session, Context } from 'koishi'
import * as utils from './utils'
import { Config } from './index';

export interface CountDown {
    id: number
    name: string
    date: Date
}

export async function createCountDown(name: string, day: any, month: any, year: any, config: Config, ctx: Context) {
    const count = await ctx.database.get('rina.countDown', {});
    if (count.length >= config.maxCountDown) return `倒数日数量已达上限[X﹏X]`;
    if (!name) return '请输入倒数日名[X﹏X]';
    let duplicate = await ctx.database.get('rina.countDown', { name: [name] })
    if (duplicate.length != 0) { return '倒数日已存在[X﹏X]'; }

    const date = utils.numberTODate(day, month, year);
    await ctx.database.create('rina.countDown', { name: name, date: date })
    return '倒数日创建成功! [=^▽^=]';
}

export async function deleteCountDown(name: string, ctx: Context) {
    if (!name) return '请输入倒数日名[X﹏X]';
    const countDown = await ctx.database.get('rina.countDown', { name: [name] })
    if (countDown.length == 0) return '倒数日不存在[X﹏X]';
    await ctx.database.remove('rina.countDown', { name: [name] })
    return '倒数日删除成功! [=^▽^=]';
}

export async function listCountDown(day: any, month: any, year: any, ctx: Context) {
    const countDown = await ctx.database.get('rina.countDown', {})
    if (countDown.length == 0) return '没有任何倒数日[◔‿◔]';

    const date = utils.numberTODate(day, month, year);
    function compare(now: Date, target: Date) {
        return now.getTime() <= target.getTime();
    }

    const message = countDown.map((cd: any) => `距离${cd.name}${compare(date, cd.date) ? '还剩' : '已过'}${Math.abs(cd.date.getTime() - date.getTime()) / (24 * 3600 * 1000)}天`).join('\n');
    return message;
}
import { Config } from './index';
import { searchEvents } from './calendar';
import { CountDown, createCountDown, deleteCountDown, listCountDown } from './countDown';
import { getBirthdays, getBirthdaysByDate, getBirthdaysByDateFromDb } from './birthdays';

export async function sendDailyReport(ctx: any, config: Config, date: Date) {
  const bot = ctx.bots[`${config.botPlatform}:${config.botId}`]
  if (!bot || !config.dailyReport) return;

  if (!date) {
    date = new Date();
    date.setDate(date.getDate() + 1);
  }

  const events = await searchEvents(date.getDate(), date.getMonth() + 1, date.getFullYear());
  const count_down = await listCountDown(date.getDate(), date.getMonth() + 1, date.getFullYear(), ctx);
  const birthdays = await getBirthdaysByDateFromDb(date.getMonth() + 1, date.getDate(), ctx);

  for (let group of config.targetGroups) {
    bot.sendMessage(group, `现在是东京时间${date.toISOString().split('T')[0]} 00:00,新的一天开始了[≧▽≦]`);
    await ctx.sleep(500);
    bot.sendMessage(group, `以下是今日的LoveLive!企划相关事件,请查收[╹▽╹]:\n${events}`);
    await ctx.sleep(500);
    bot.sendMessage(group, `还记得这些日子吗[╹▽╹]:\n${count_down}`);
    await ctx.sleep(500);
    bot.sendMessage(group, getBirthdaysByDate(date.getMonth() + 1, date.getDate()));
    await ctx.sleep(500);
    bot.sendMessage(group, birthdays);
  }
}

export async function getDailyReport(ctx: any, session: any, date: Date) {
  if (!date) {
    date = new Date();
    date.setDate(date.getDate() + 1);
  }

  const events = await searchEvents(date.getDate(), date.getMonth() + 1, date.getFullYear());
  const count_down = await listCountDown(date.getDate(), date.getMonth() + 1, date.getFullYear(), ctx);
  const birthdays = await getBirthdaysByDateFromDb(date.getMonth() + 1, date.getDate(), ctx);

  session.send(`现在是东京时间${date.toISOString().split('T')[0]} 00:00,新的一天开始了[≧▽≦]`);
  await ctx.sleep(500);
  session.send(`以下是今日的LoveLive!企划相关事件,请查收[╹▽╹]:\n${events}`);
  await ctx.sleep(500);
  session.send(`还记得这些日子吗[╹▽╹]:\n${count_down}`);
  await ctx.sleep(500);
  session.send(getBirthdaysByDate(date.getMonth() + 1, date.getDate()));
  await ctx.sleep(500);
  session.send(birthdays);
}

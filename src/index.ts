import { Context, Schema } from 'koishi'
import { getEvents, calendarUrls } from './calendar';
import { birthdays } from './birthdays_data';

export const name = 'rinachanbot'
export interface Config { }
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
    ctx.command('天使天才', '简单的测试命令').action(({ session }) => {
        session.send('天王寺！[≧▽≦]')
    });

    ctx.command('生日 [month:number]', '查询LL成员生日信息').action(({ session }, month) => {
        const now = new Date();
        const currentMonth = month ? month : now.getMonth() + 1;
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
}


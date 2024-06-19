import { Context, Schema } from 'koishi'
const { getEvents } = require('./calendar');
const { birthdays } = require('./birthdays_data');

export const name = 'rinachanbot'
export interface Config { }
export const Config: Schema<Config> = Schema.object({})

const calendarUrls = [
    'https://calendar.google.com/calendar/ical/c_r5tf64n6deed8dkmj6h7r6tr90%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_50b432266bf298e686d867169129d16b9845448a5cb8749909757ea027c55f97%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_fqe30janocv0k76kf63qa2i6hk%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_mg5gu0t8fltuhvfr203tsg5qng%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_b0e2c7d76bf5b353777f7c1a4d5eda9da8ab3b3d36d9cce10fb44c0a269b6f59%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_i1b3gbmjmbhqa0bong3ag68pj0%40group.calendar.google.com/public/basic.ics'
];

export function apply(ctx: Context) {
    ctx.command('天使天才', '简单的测试命令').action(({ session }) => {
        session.send('天王寺！')
    });

    ctx.command('生日', '查询当月和下月的成员生日信息').action(({ session }) => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

        const currentMonthBirthdays = birthdays.filter(b => b.month === currentMonth);
        const nextMonthBirthdays = birthdays.filter(b => b.month === nextMonth);

        const formatBirthdays = (birthdays: any[]) => {
            return birthdays.map(b => `${b.month}月${b.date}日 ${b.name} (${b.group}, ${b.role})`).join('\n');
        }

        const message = `本月的生日信息:\n${formatBirthdays(currentMonthBirthdays)}\n\n下月的生日信息:\n${formatBirthdays(nextMonthBirthdays)}`;
        session.send(message);
    });

    ctx.command('日程 [day] [month] [year]', '查询指定日期的日程').action(async ({ session }, day?: string, month?: string, year?: string) => {
        const now = new Date();
        const d = day ? parseInt(day) : now.getDate();
        const m = month ? parseInt(month) - 1 : now.getMonth();
        const y = year ? parseInt(year) : now.getFullYear();
        const date = new Date(y, m, d);
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


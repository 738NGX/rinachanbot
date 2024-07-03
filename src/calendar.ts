const ical = require('ical');

const calendarUrls = [
    'https://calendar.google.com/calendar/ical/c_r5tf64n6deed8dkmj6h7r6tr90%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_50b432266bf298e686d867169129d16b9845448a5cb8749909757ea027c55f97%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_fqe30janocv0k76kf63qa2i6hk%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_mg5gu0t8fltuhvfr203tsg5qng%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_b0e2c7d76bf5b353777f7c1a4d5eda9da8ab3b3d36d9cce10fb44c0a269b6f59%40group.calendar.google.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/c_i1b3gbmjmbhqa0bong3ag68pj0%40group.calendar.google.com/public/basic.ics'
];

export async function searchEvents(day: any, month: any, year: any) {
    const now = new Date();
    const d = day ? day : now.getDate();
    const m = month ? month - 1 : now.getMonth();
    const y = year ? year : now.getFullYear();
    const date = new Date(y, m, d + 1);
    const formattedDate = date.toISOString().split('T')[0];

    try {
        const events = await getEvents(formattedDate, calendarUrls);
        if (events.length === 0) {
            return `在 ${formattedDate} 没有找到任何日程。`;
        } else {
            const message = events.map(event => `${event.start.toISOString()} - ${event.summary}`).join('\n');
            return message;
        }
    } catch (error) {
        return `获取日程信息时发生错误: ${error.message}`;
    }
}

async function fetchCalendar(url: string | URL | Request) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const data = await response.text();
    return ical.parseICS(data);
}

function convertToUTC8(date: string | number | Date) {
    const dateObj = new Date(date);
    dateObj.setHours(dateObj.getHours() + 8);
    return dateObj;
}

function getDateStringInUTC8(date: string | number | Date) {
    const dateInUTC8 = convertToUTC8(date);
    return dateInUTC8.toISOString().split('T')[0];
}

export async function getEvents(date: string | number | Date, urls: string[]) {
    const targetDateInUTC8 = getDateStringInUTC8(new Date(date));
    const eventList = [];

    for (const url of urls) {
        try {
            const events = await fetchCalendar(url);
            for (const k in events) {
                if (events.hasOwnProperty(k)) {
                    const event = events[k];
                    if (event.type === 'VEVENT') {
                        const eventStartDateInUTC8 = getDateStringInUTC8(event.start);
                        if (eventStartDateInUTC8 === targetDateInUTC8) {
                            eventList.push({
                                summary: event.summary,
                                description: event.description,
                                location: event.location,
                                start: convertToUTC8(event.start),
                                end: convertToUTC8(event.end),
                                url: event.url,
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to fetch calendar from ${url}: ${error.message}`);
        }
    }

    return eventList;
}
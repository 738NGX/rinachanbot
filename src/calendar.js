const ical = require('ical');

async function fetchCalendar(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data = await response.text();
  return ical.parseICS(data);
}

async function getEvents(date, urls) {
  const targetDate = new Date(date).toISOString().split('T')[0];
  const eventList = [];

  for (const url of urls) {
    try {
      const events = await fetchCalendar(url);
      for (const k in events) {
        if (events.hasOwnProperty(k)) {
          const event = events[k];
          if (event.type === 'VEVENT') {
            const eventStartDate = event.start.toISOString().split('T')[0];
            if (eventStartDate === targetDate) {
              eventList.push({
                summary: event.summary,
                description: event.description,
                location: event.location,
                start: event.start,
                end: event.end,
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

module.exports = { getEvents };
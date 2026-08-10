import { LlConcert, LlEvent, LlPerformance } from './model'
import { canonicalUrl } from './service'

function formatTime(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(value).replace(',', '')
}

function title(event?: LlEvent, concert?: LlConcert, performance?: LlPerformance) {
  return [event?.name, concert?.name, performance?.name].filter(Boolean).join(' · ')
}

export function formatReminder(event: LlEvent | undefined, concert: LlConcert | undefined, performance: LlPerformance, start: Date, minutes: number) {
  return [
    `【演出还有 ${minutes} 分钟】`,
    title(event, concert, performance),
    `开演：${formatTime(start)}（日本时间）`,
    performance.openTime ? `开场：${performance.openTime}（日本时间）` : '',
    concert?.venue ? `会场：${concert.venue}` : '',
    canonicalUrl(performance.eventId, performance.concertId, performance.id),
  ].filter(Boolean).join('\n')
}

export function formatSetlistCaption(event: LlEvent | undefined, concert: LlConcert | undefined, performance: LlPerformance, updated: boolean) {
  return [
    updated ? '【歌单更新】' : '【演出歌单】',
    title(event, concert, performance),
    performance.date && performance.startTime ? `开演：${performance.date} ${performance.startTime}（日本时间）` : '',
    canonicalUrl(performance.eventId, performance.concertId, performance.id),
  ].filter(Boolean).join('\n')
}

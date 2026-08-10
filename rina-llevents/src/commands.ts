import { Context, h, Session } from 'koishi'
import { formatSetlistCaption } from './formatter'
import { LlConcert, LlEvent, LlPerformance } from './model'
import { captureEventDetailPage, captureSetlistPage, renderChoiceList } from './renderer'
import { canonicalUrl, LlEventService } from './service'

interface Candidate {
  performance: LlPerformance
  event?: LlEvent
  concert?: LlConcert
}

function normalize(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase()
    .replace(/day\s*[.]?\s*0*(\d+)/g, 'd$1')
    .replace(/第\s*0*(\d+)\s*日目/g, 'd$1')
    .replace(/[ヶケ]/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fffμ]/g, '')
}

function tokens(value: string) {
  return normalize(value).match(/[a-z]+\d*|\d+(?:st|nd|rd|th)?|[\u3040-\u30ff\u3400-\u9fffμ]+/g) || []
}

/** Scores an event using only the parts of the query present in its title. */
function eventScore(query: string, event: LlEvent) {
  const source = normalize(event.name)
  const key = normalize(query)
  if (source.includes(key)) return 100 + key.length
  return tokens(query).filter(token => source.includes(token)).length
}

function matchesCandidate(query: string, candidate: Candidate) {
  const source = normalize(candidateName(candidate))
  const key = normalize(query)
  return source.includes(key) || tokens(query).every(token => source.includes(token))
}

async function cachedCandidates(ctx: Context) {
  const [events, concerts, performances] = await Promise.all([
    ctx.database.get('rina_llevent_event', {}), ctx.database.get('rina_llevent_concert', {}), ctx.database.get('rina_llevent_performance', {}),
  ])
  const eventMap = new Map(events.map(event => [event.id, event]))
  const concertMap = new Map(concerts.map(concert => [concert.id, concert]))
  const candidates = performances.map(performance => ({
    performance, event: eventMap.get(performance.eventId), concert: concertMap.get(performance.concertId),
  }))
  return { events, candidates }
}

function candidateName(candidate: Candidate) {
  return [candidate.event?.name, candidate.concert?.name, candidate.performance.name]
    .filter(Boolean).join(' · ')
}

function candidateLine(candidate: Candidate, index: number) {
  const time = [candidate.performance.date, candidate.performance.startTime].filter(Boolean).join(' ')
  return `${index + 1}. ${candidateName(candidate)}${time ? `（${time}）` : ''}${candidate.performance.canceled ? '（已取消）' : ''}`
}

function eventLine(event: LlEvent, index: number) {
  const date = [event.startsOn, event.endsOn].filter(Boolean).join(' ~ ')
  return `${index + 1}. ${event.name}${date ? `（${date}）` : ''}`
}

async function choose<T>(ctx: Context, session: Session, values: T[], title: string, line: (value: T, index: number) => string) {
  if (values.length === 1) return values[0]
  const lines = values.map(line)
  await session.send(`${title}，请在 60 秒内回复序号。`)
  try {
    await session.send(h.image(await renderChoiceList(ctx, title, lines), 'image/png'))
  } catch {
    await session.send(lines.join('\n'))
  }
  const choice = await session.prompt((input) => {
    const value = Number(input.content?.trim())
    return Number.isInteger(value) && value >= 1 && value <= values.length ? value : undefined
  }, { timeout: 60_000 })
  return choice ? values[choice - 1] : undefined
}

export function registerCommands(ctx: Context, service: LlEventService) {
  ctx.command('ll演出近期 [days:number]', '查询近期已缓存的 LoveLive! 演出')
    .alias('ll近期演出')
    .action(async ({ session }, days) => {
      const items = await service.upcoming(Math.min(Math.max(days || 30, 1), 365))
      if (!items.length) return '暂无近期已缓存的、具有明确开演时间的演出。'
      const lines = items.slice(0, 20).map(({ event, concert, performance, start }) => [
        new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(start),
        [event?.name, concert?.name, performance.name].filter(Boolean).join(' · '),
        performance.canceled ? '（已取消）' : '',
      ].filter(Boolean).join(' ')).join('\n')
      if (!session) return lines
      const shownDays = Math.min(Math.max(days || 30, 1), 365)
      await session.send(`未来 ${shownDays} 天内有 ${items.length} 个已缓存场次（日本时间）。`)
      try {
        await session.send(h.image(await renderChoiceList(ctx, `近期演出 · ${shownDays} 天`, lines.split('\n'), ''), 'image/png'))
      } catch {
        await session.send(lines)
      }
    })

  ctx.command('ll演出下场', '查询下一场已缓存的 LoveLive! 演出')
    .action(async ({ session }) => {
      const next = (await service.upcoming(365))[0]
      if (!next) return '暂无下一场已缓存的、具有明确开演时间的演出。'
      const sourceUrl = canonicalUrl(next.performance.eventId, next.performance.concertId, next.performance.id)
      const title = [next.event?.name, next.concert?.name, next.performance.name].filter(Boolean).join(' · ')
      if (!session) return [title, sourceUrl].join('\n')
      await session.send(`【下一场演出】\n${title}\n${sourceUrl}`)
      try {
        await session.send(h.image(await captureEventDetailPage(ctx, sourceUrl), 'image/png'))
      } catch (error) {
        return `详情页截图失败：${String(error)}\n${sourceUrl}`
      }
    })

  ctx.command('ll歌单 <keyword:text>', '模糊查找活动或场次并截取 LL-Fans 原页面歌单')
    .action(async ({ session }, keyword = '') => {
      const needle = keyword.trim().toLocaleLowerCase()
      if (!needle) return '请输入活动、公演或场次关键词。'
      if (!session) return '请在群聊或私聊中使用 ll歌单，以便选择匹配的场次。'
      let cached = await cachedCandidates(ctx)
      const scoredEvents = cached.events
        .map(event => ({ event, score: eventScore(needle, event) }))
        .filter(item => item.score > 0)
        .sort((left, right) => right.score - left.score || right.event.startsOn.localeCompare(left.event.startsOn))
      // A specific query such as “虹咲8th大阪” scores the 8th event twice
      // (虹咲 + 8th), while other 虹咲 events only score once. Keep only the
      // strongest group before presenting an event choice.
      const bestScore = scoredEvents[0]?.score || 0
      const eventMatches = scoredEvents.filter(item => item.score === bestScore)
      if (eventMatches.length > 20) return `关键词过宽，匹配到 ${eventMatches.length} 个活动；请补充团体、届次或地点，例如“虹咲8th大阪”。`

      let candidates: Candidate[]
      if (eventMatches.length) {
        const event = await choose(ctx, session, eventMatches.map(item => item.event), `找到 ${eventMatches.length} 个活动`, eventLine)
        if (!event) return '未收到有效序号，已取消歌单查询。'
        await service.syncEventDetails(event.id)
        cached = await cachedCandidates(ctx)
        const allPerformances = cached.candidates.filter(candidate => candidate.performance.eventId === event.id)
        candidates = allPerformances.filter(candidate => matchesCandidate(needle, candidate))
        // Queries such as a title-only keyword intentionally show all Day choices.
        if (!candidates.length) candidates = allPerformances
      } else {
        candidates = cached.candidates.filter(candidate => matchesCandidate(needle, candidate))
      }
      if (!candidates.length) return '未找到匹配场次；可先执行 ll演出同步，或使用更具体的活动名称。'
      if (candidates.length > 20) return `找到 ${candidates.length} 个场次，请补充公演地点或 Day，例如“大阪d1”。`
      const selected = await choose(ctx, session, candidates, `找到 ${candidates.length} 个场次`, candidateLine)
      if (!selected) return '未收到有效序号，已取消歌单查询。'

      const result = await service.refreshSetlist(selected.performance)
      const sourceUrl = canonicalUrl(selected.performance.eventId, selected.performance.concertId, selected.performance.id)
      if (!result?.setlist.length) return `LL-Fans 尚未收录该场次歌单：\n${sourceUrl}`
      const caption = formatSetlistCaption(selected.event, selected.concert, result.performance, false)
      await session.send(caption)
      try {
        const image = await captureSetlistPage(ctx, sourceUrl)
        await session.send(h.image(image, 'image/png'))
      } catch (error) {
        return `歌单已确认，但原页面截图失败：${String(error)}\n${sourceUrl}`
      }
    })

  ctx.command('ll演出同步', '立即同步 LL-Fans 活动列表与近期详情')
    .action(async () => {
      await service.sync(true)
      return 'LL-Fans 活动列表与近期详情已同步。'
    })
}

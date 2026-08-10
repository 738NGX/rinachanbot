import { Context, h, Schema } from 'koishi'
import 'koishi-plugin-cron'
import {
  bangdream_character_birthdays,
  bangdream_voice_actor_birthdays,
  lovelive_character_birthdays,
  lovelive_voice_actor_birthdays,
} from './data'
import { extendModel, FriendBirthday } from './model'

export const name = 'rina-birthday'
export const inject = ['cron', 'database']

export interface BroadcastTarget {
  onebotSelfId: string
  groupId: string
  enableLoveLive: boolean
  enableBangDream: boolean
  enableFriendBirthdays: boolean
}

export interface Config {
  targets: BroadcastTarget[]
}

const BroadcastTargetSchema: Schema<BroadcastTarget> = Schema.object({
  onebotSelfId: Schema.string().required().description('用于向此群发送播报的 OneBot 账号。'),
  groupId: Schema.string().required().description('接收播报的 OneBot 群号。'),
  enableLoveLive: Schema.boolean().description('在此群播报 Love Live! 系列生日。').default(true),
  enableBangDream: Schema.boolean().description('在此群播报 BanG Dream! 企划生日。').default(true),
  enableFriendBirthdays: Schema.boolean().description('在此群读取数据库并播报群友生日。').default(false),
})

export const Config: Schema<Config> = Schema.object({
  targets: Schema.array(BroadcastTargetSchema).description('按群独立设置播报内容。').default([]),
})

interface Birthday {
  month: number
  date: number
  name: string
  group: string
}

interface CalendarDate {
  year: number
  month: number
  date: number
}

function getDateInTimeZone(date: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    date: Number(values.day),
  }
}

function formatDate(date: CalendarDate) {
  return `${date.year} 年 ${date.month} 月 ${date.date} 日`
}

function formatBirthdays(title: string, characters: Birthday[], voiceActors: Birthday[], date: CalendarDate) {
  const characterNames = characters
    .filter((entry) => entry.month === date.month && entry.date === date.date)
    .map((entry) => `${entry.name}（${entry.group}）`)
  const voiceActorNames = voiceActors
    .filter((entry) => entry.month === date.month && entry.date === date.date)
    .map((entry) => `${entry.name}（${entry.group}）`)

  if (!characterNames.length && !voiceActorNames.length) return

  const lines = [`${title}：`]
  if (characterNames.length) lines.push(`角色：${characterNames.join('、')}`)
  if (voiceActorNames.length) lines.push(`声优：${voiceActorNames.join('、')}`)
  return lines.join('\n')
}

function countBirthdays(entries: Birthday[], date: CalendarDate) {
  return entries.filter((entry) => entry.month === date.month && entry.date === date.date).length
}

function createBroadcast(target: BroadcastTarget, now: Date, friends: FriendBirthday[]) {
  const beijingDate = getDateInTimeZone(now, 'Asia/Shanghai')
  const tokyoDate = getDateInTimeZone(now, 'Asia/Tokyo')
  const sections: string[] = []
  let projectBirthdayCount = 0

  if (target.enableLoveLive) {
    const section = formatBirthdays('Love Live!', lovelive_character_birthdays, lovelive_voice_actor_birthdays, tokyoDate)
    if (section) sections.push(section)
    projectBirthdayCount += countBirthdays(lovelive_character_birthdays, tokyoDate)
    projectBirthdayCount += countBirthdays(lovelive_voice_actor_birthdays, tokyoDate)
  }
  if (target.enableBangDream) {
    const section = formatBirthdays('BanG Dream!', bangdream_character_birthdays, bangdream_voice_actor_birthdays, tokyoDate)
    if (section) sections.push(section)
    projectBirthdayCount += countBirthdays(bangdream_character_birthdays, tokyoDate)
    projectBirthdayCount += countBirthdays(bangdream_voice_actor_birthdays, tokyoDate)
  }

  if (!sections.length && !friends.length) return

  const projectPronoun = projectBirthdayCount === 1 ? '她' : '她们'
  const content = [
    `现在是东京时间：${formatDate(tokyoDate)} 00:00,新的一天开始了[≧▽≦]`,
    ...(projectBirthdayCount ? [
      `今天是${projectPronoun}的生日，祝${projectPronoun}生日快乐🎂`,
      '',
      ...sections,
    ] : []),
  ].join('\n')

  if (!friends.length) return content

  const friendSubject = friends.length === 1 ? '这位饱饱' : '这些饱饱'
  const friendPronoun = friends.length === 1 ? '饱饱' : '饱饱们'

  return [
    content,
    `\n\n今天是${friendSubject}的生日，祝${friendPronoun}生日快乐🎂`,
    ...friends.flatMap((friend, index) => [
      index ? '、' : '',
      h('at', { id: friend.id }),
    ]),
  ]
}

function formatBirthday(date: CalendarDate) {
  return `${String(date.month).padStart(2, '0')}-${String(date.date).padStart(2, '0')}`
}

function appliesToGroup(groups: string, groupId: string) {
  return groups.split(',').some((id) => id.trim() === groupId)
}

function formatMonthlyBirthdays(title: string, characters: Birthday[], voiceActors: Birthday[], month: number) {
  const entries = [
    ...characters.filter((entry) => entry.month === month).map((entry) => ({ ...entry, label: '角色' })),
    ...voiceActors.filter((entry) => entry.month === month).map((entry) => ({ ...entry, label: '声优' })),
  ].sort((left, right) => left.date - right.date)

  if (!entries.length) return

  const lines = new Map<number, string[]>()
  for (const entry of entries) {
    const names = lines.get(entry.date) ?? []
    names.push(`${entry.label}：${entry.name}（${entry.group}）`)
    lines.set(entry.date, names)
  }

  return [
    `${title}：`,
    ...[...lines].map(([date, names]) => `${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')} ${names.join('、')}`),
  ].join('\n')
}

function createMonthlyQuery(target: BroadcastTarget, month: number, friends: FriendBirthday[]) {
  const sections: string[] = []
  if (target.enableLoveLive) {
    const section = formatMonthlyBirthdays('Love Live!', lovelive_character_birthdays, lovelive_voice_actor_birthdays, month)
    if (section) sections.push(section)
  }
  if (target.enableBangDream) {
    const section = formatMonthlyBirthdays('BanG Dream!', bangdream_character_birthdays, bangdream_voice_actor_birthdays, month)
    if (section) sections.push(section)
  }

  if (!sections.length && !friends.length) return

  const content = [`🎂 ${month} 月生日`, ...sections].join('\n\n')
  if (!friends.length) return content

  return [
    content,
    '\n\n群友：',
    ...friends.flatMap((friend) => [
      `\n${friend.date} `,
      h('at', { id: friend.id }),
    ]),
  ]
}

export function apply(ctx: Context, config: Config) {
  extendModel(ctx)

  const broadcast = async () => {
    const targets = config.targets.filter((target) =>
      target.enableLoveLive || target.enableBangDream || target.enableFriendBirthdays,
    )
    if (!targets.length) return

    const now = new Date()
    const birthday = formatBirthday(getDateInTimeZone(now, 'Asia/Tokyo'))

    await Promise.all(targets.flatMap((target) => ctx.bots
      .filter((bot) => bot.platform === 'onebot' && bot.selfId === target.onebotSelfId)
      .map(async (bot) => {
      try {
        const friends = target.enableFriendBirthdays
          ? (await ctx.database.get('rina_birthday_friend', { date: birthday })).filter((friend) => appliesToGroup(friend.groups, target.groupId))
          : []
        const content = createBroadcast(target, now, friends)
        if (!content) return
        await bot.sendMessage(target.groupId, content)
      } catch (error) {
        bot.logger.warn(error)
      }
      })))
  }

  ctx.command('生日 [month:number]', '查询本群当月生日；不填月份则查询本月。')
    .action(async ({ session }, month) => {
      const groupId = session?.channelId
      if (!groupId) return '请在群聊中使用该指令。'
      if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
        return '月份应为 1 到 12 的整数。'
      }

      const targetMonth = month ?? getDateInTimeZone(new Date(), 'Asia/Tokyo').month
      const target = config.targets.find((target) =>
        target.groupId === groupId && target.onebotSelfId === session.selfId,
      )
      if (!target) return '当前群未配置生日播报。'
      const friends = target.enableFriendBirthdays
        ? (await ctx.database.get('rina_birthday_friend', {})).filter((friend) =>
          friend.date.startsWith(`${String(targetMonth).padStart(2, '0')}-`) && appliesToGroup(friend.groups, groupId),
        )
        : []
      const content = createMonthlyQuery(target, targetMonth, friends)
      return content ?? `本群 ${targetMonth} 月没有可播报的生日信息。`
    })

  ctx.cron('0 23 * * *', () => void broadcast())
}

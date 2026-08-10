import { Context } from 'koishi'

export interface FriendBirthday {
  id: string
  nickname: string
  date: string
  groups: string
}

declare module 'koishi' {
  interface Tables {
    rina_birthday_friend: FriendBirthday
  }
}

export function extendModel(ctx: Context) {
  ctx.model.extend('rina_birthday_friend', {
    id: 'string',
    nickname: 'string',
    date: 'string',
    groups: 'string',
  }, {
    primary: 'id',
  })
}

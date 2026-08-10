# koishi-plugin-rina-llevents

基于 LL-Fans 活动数据库的 LoveLive! 演出提醒与演出后歌单推送插件。

插件直接请求 LL-Fans 网页所使用的公开 GraphQL 端点，并以三层数据建档：

- 活动：`eventId`，例如 `288`。
- 公演：`concertId`，例如大阪公演 `427`。
- 场次：`performanceId`，例如 Day.2 `731`。

因此缓存后的场次可直达：

```text
https://ll-fans.jp/data/event/288?concert=427&performance=731
```

## 行为

- 定时轮询活动列表，发现新增、名称或日期变动，及近期一年内的活动详情变动。
- 仅缓存未来一年内的详情；越接近开演检查越频繁。
- 在 `performance.date + startTime`（日本时区）前 10 分钟发送一次提醒。
- 从预计结束时刻开始轮询该场次歌单；首次出现时推送，随后变化时发送更新。
- 歌单正文不入库；推送和 `ll歌单` 都使用 Puppeteer 截取 LL-Fans 原页面。
- `performance.canceled` 会阻止提醒和歌单轮询；未来活动从列表消失只标为“待确认”，不会误判为取消。

## 配置示例

在 `koishi.yml` 中启用插件并填入实际机器人与群号：

```yaml
rina-llevents:example:
  targets:
    - platform: onebot
      selfId: '123456'
      channelId: '987654'
  reminderMinutes: 10
  expectedDurationMinutes: 180

puppeteer:example: {}
```

没有启用的推送目标时，插件不会自动访问 LL-Fans；可通过 `ll演出同步` 手动建立缓存。

## 指令

- `ll演出近期 [天数]`
- `ll演出下场`
- `ll歌单 <活动、公演或场次关键词>`（历史活动会按需抓取详情；多结果时回复序号选择）
- `ll演出同步`

LL-Fans 的 GraphQL 端点为网页内部接口，未承诺稳定性。插件会保留本地快照，并在请求失败时记录告警而不清空已有数据。

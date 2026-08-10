# koishi-plugin-rina-currency

面向购汇决策的日元（JPY）汇率插件。默认关注中国银行与中国工商银行的**现汇卖出价**，定时积累历史牌价，并提供购汇成本、趋势图、每日播报和跌破阈值提醒。

## 前置条件

插件依赖 Koishi 的 `database` 服务。应用中请启用一个数据库实现；SQLite 示例：

```yaml
plugins:
  database-sqlite:
    path: data/koishi.db
  cron: {}
  rina-currency: {}
```

## 指令

```text
汇率 日元
汇率 中行 日元
汇率 工行 现钞卖出
汇率 日元 详细
购汇成本 50000
购汇成本 50000 工行 现钞卖出
汇率趋势 日元 7天
汇率趋势 中行 现汇卖出 30天
```

`日元`、`换日元` 和 `日元趋势` 可作为对应命令的别名。牌价单位始终为 `100 JPY / CNY`，购汇成本按 `日元金额 × 卖出价 ÷ 100` 计算。

## 采集和来源

插件启动时可立即采集，之后按北京时间以每日 17:00 为基准、按 `collectIntervalMinutes` 分钟间隔采集，不受插件启动时刻影响。趋势图按采样时间绘制并始终延伸至查询当下；周末等未更新时会保持水平线。若每日 17:00 的牌价与上一次相同，仍会保存一条确认采样点，表示此前一天内牌价未变。

- 中国银行：公开外汇牌价页面（HTML 表格）
- 中国工商银行：公开最新牌价接口（JSON）

工行公开端点当前与现代 Node 的 HTTPS TLS 协商不兼容，因此实现使用其原有、无凭据的 HTTP 公开牌价端点；请求不发送任何用户数据。每条历史记录都会保存来源 URL、银行发布时间和抓取时间。

牌价仅供参考，实际成交以银行渠道为准。引用中行牌价时应注明来源。

## 配置

```yaml
plugins:
  cron: {}
  rina-currency:
    defaultBank: boc
    defaultRateType: spotSell
    requestAttempts: 3
    requestRetryDelay: 1500
    collectIntervalMinutes: 60
    broadcasts:
      - platform: onebot
        selfId: '123456'
        channelId: '987654'
        hour: 9
        minute: 0
        includeChart: true
        chartDays: 7
    thresholdAlerts:
      - bank: boc
        rateType: spotSell
        changePercent: 0.5
        platform: onebot
        selfId: '123456'
        channelId: '987654'
```

每个来源请求默认总共尝试 3 次（包含首次请求），失败后分别等待 1.5 秒和 3 秒再试；可通过 `requestAttempts` 和 `requestRetryDelay` 调整。连续失败时，最终日志会包含来源地址、尝试次数和最后一次错误。

定时播报按北京时间执行。阈值提醒按相邻真实采样点的绝对涨跌幅触发：`changePercent: 0.5` 表示上涨或下跌至少 0.5%。比较周期由 `collectIntervalMinutes` 自然决定；同方向只提醒一次，波动回到阈值内或反向越过阈值后才会重新提醒。

## 开发

```bash
npm install
npm run typecheck
```

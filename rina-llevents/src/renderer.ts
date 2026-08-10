import { Context } from 'koishi'
import 'koishi-plugin-puppeteer'

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)
}

/** Captures LL-Fans' own rendered setlist page, rather than reproducing its layout. */
export async function captureSetlistPage(ctx: Context, url: string) {
  if (!ctx.puppeteer) throw new Error('未启用 puppeteer 服务，无法截取 LL-Fans 歌单页面')
  const page = await ctx.puppeteer.page()
  try {
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
    await page.waitForFunction(() => document.body.innerText.includes('セットリスト'), { timeout: 15_000 })
    const main = await page.$('main')
    return await (main || page).screenshot({ type: 'png' }) as Buffer
  } finally {
    await page.close()
  }
}

/** Captures an event detail page even when its setlist has not been published yet. */
export async function captureEventDetailPage(ctx: Context, url: string) {
  if (!ctx.puppeteer) throw new Error('未启用 puppeteer 服务，无法截取 LL-Fans 详情页')
  const page = await ctx.puppeteer.page()
  try {
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
    await page.waitForSelector('main', { timeout: 15_000 })
    const main = await page.$('main')
    return await (main || page).screenshot({ type: 'png' }) as Buffer
  } finally {
    await page.close()
  }
}

/** Renders a selectable result list into one compact image for mobile chats. */
export async function renderChoiceList(ctx: Context, title: string, lines: string[], instruction = '请在 60 秒内回复序号') {
  if (!ctx.puppeteer) throw new Error('未启用 puppeteer 服务，无法渲染候选列表')
  const page = await ctx.puppeteer.page()
  try {
    await page.setViewport({ width: 1180, height: 900, deviceScaleFactor: 1 })
    const rows = lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')
    const hint = instruction ? `<p>${escapeHtml(instruction)}</p>` : ''
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      * { box-sizing: border-box; }
      body { margin: 0; background: transparent; font-family: "Noto Sans CJK JP", "Microsoft YaHei", sans-serif; }
      #card { width: 1180px; padding: 32px 38px 34px; color: #f5f1f7; background: linear-gradient(135deg, #29242d, #19171c); border: 2px solid #f200b5; border-radius: 18px; }
      h1 { margin: 0 0 22px; color: #ff6bd4; font-size: 31px; font-weight: 800; }
      p { margin: 0 0 20px; color: #cbc3cc; font-size: 22px; }
      ol { margin: 0; padding-left: 42px; }
      li { padding: 9px 0 9px 8px; font-size: 22px; line-height: 1.42; border-bottom: 1px solid rgba(255,255,255,.12); word-break: break-word; }
      li:last-child { border-bottom: 0; }
      li::marker { color: #ff55c8; font-weight: 800; }
      footer { margin-top: 23px; color: #ff8cdb; font-size: 20px; }
    </style></head><body><main id="card"><h1>${escapeHtml(title)}</h1>${hint}<ol>${rows}</ol><footer>LL-Fans 演出查询</footer></main></body></html>`)
    const card = await page.$('#card')
    if (!card) throw new Error('候选列表渲染失败')
    return await card.screenshot({ type: 'png' }) as Buffer
  } finally {
    await page.close()
  }
}

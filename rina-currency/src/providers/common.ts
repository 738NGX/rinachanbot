import { request as httpRequest } from 'node:http'
import { ExchangeRateQuote } from '../types'

export const BOC_SOURCE_URL = 'https://www.boc.cn/sourcedb/whpj/index.html'
// ICBC's TLS endpoint currently requires legacy renegotiation that modern Node
// disables. This public, credential-free endpoint is therefore intentionally
// requested over HTTP; no user data is ever sent with the request.
export const ICBC_SOURCE_URL = 'http://papi.icbc.com.cn/exchanges/ns/getLatest'

export interface RateProvider {
  readonly id: ExchangeRateQuote['bank']
  fetch(): Promise<ExchangeRateQuote>
}

export interface RetryOptions {
  attempts: number
  retryDelay: number
}

function describeError(error: unknown) {
  if (!(error instanceof Error)) return String(error)
  const details = [`${error.name}: ${error.message}`]
  const code = (error as NodeJS.ErrnoException).code
  if (code) details.push(`code=${code}`)
  if (error.cause && error.cause !== error) details.push(`cause=${describeError(error.cause)}`)
  return details.join(', ')
}

async function withRetries<T>(url: string, retry: RetryOptions, operation: () => Promise<T>) {
  let lastError: unknown

  for (let attempt = 1; attempt <= retry.attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
    }

    if (attempt < retry.attempts) {
      await new Promise<void>((resolve) => setTimeout(resolve, retry.retryDelay * attempt))
    }
  }

  throw new Error(`请求 ${url} 失败，已尝试 ${retry.attempts} 次：${describeError(lastError)}`)
}

export async function fetchText(
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
  retry: RetryOptions = { attempts: 1, retryDelay: 0 },
) {
  return withRetries(url, retry, async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }
      return await response.text()
    } finally {
      clearTimeout(timer)
    }
  })
}

/**
 * ICBC's legacy public endpoint is plain HTTP. Keep this request on a fresh
 * Node socket instead of the process-wide fetch pool, which can retain a
 * connection that the upstream has already closed.
 */
export function postJsonText(url: string, timeoutMs: number, retry: RetryOptions, body = '{}') {
  return withRetries(url, retry, () => new Promise<string>((resolve, reject) => {
    const endpoint = new URL(url)
    const request = httpRequest({
      protocol: endpoint.protocol,
      hostname: endpoint.hostname,
      port: endpoint.port || undefined,
      method: 'POST',
      path: `${endpoint.pathname}${endpoint.search}`,
      agent: false,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'connection': 'close',
        'user-agent': 'koishi-plugin-rina-currency/0.1',
      },
    }, (response) => {
      let responseBody = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { responseBody += chunk })
      response.on('error', reject)
      response.on('end', () => {
        if (response.statusCode == null || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${response.statusCode || 0} ${response.statusMessage || ''}`.trim()))
          return
        }
        resolve(responseBody)
      })
    })
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`请求超时（${timeoutMs}ms）`)))
    request.on('error', reject)
    request.end(body)
  }))
}

export function asRate(value: unknown, field: string) {
  const parsed = Number.parseFloat(String(value).trim())
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`无效的${field}：${String(value)}`)
  }
  return parsed
}

export function chinaTime(date: string, time?: string) {
  const normalizedDate = date.trim().replace(/\//g, '-').replace(/\s+/, ' ')
  const normalizedTime = (time?.trim() || '00:00:00').replace(/\s+/g, '')
  // BOC's date column already contains a time, while ICBC provides date and
  // time separately. Both variants are normalized to China Standard Time.
  const localDateTime = /\d{1,2}:\d{2}/.test(normalizedDate)
    ? normalizedDate.replace(' ', 'T')
    : `${normalizedDate}T${normalizedTime}`
  const value = new Date(`${localDateTime}+08:00`)
  if (Number.isNaN(value.getTime())) {
    throw new Error(`无效的发布时间：${date} ${time || ''}`.trim())
  }
  return value
}

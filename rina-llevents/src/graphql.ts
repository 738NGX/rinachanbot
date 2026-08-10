import { Context } from 'koishi'

const ENDPOINT = 'https://ll-fans.jp/api/graphql'

export interface TourSummary {
  id: string
  name: string
  startsOn?: string
  endsOn?: string
}

export interface TourDetail extends TourSummary {
  concerts?: Array<{
    id: string
    name?: string
    venue?: { name?: string }
    performances?: Array<{ id: string, name?: string }>
  }>
}

export interface SetlistItem {
  id: string
  indexPrefix?: string
  indexNumber?: number
  content?: { __typename?: string, name?: string }
  contentTypeOther?: string
  note?: string
  premiere?: boolean
}

export interface PerformanceDetail {
  id: string
  canceled?: boolean
  date?: string
  openTime?: string
  startTime?: string
  setlists?: SetlistItem[]
}

const LIST_QUERY = `query TourListPage($first: Int!, $page: Int!) {
  tours(orderBy: [{column: STARTS_ON, order: DESC}, {column: ID, order: DESC}], first: $first, page: $page) {
    paginatorInfo { hasMorePages total }
    data { id name startsOn endsOn }
  }
}`

const DETAIL_QUERY = `query EventDetailPage($id: ID!) {
  tour(id: $id) {
    id name startsOn endsOn
    concerts(orderBy: [{column: STARTS_ON, order: ASC}]) {
      id name venue { name }
      performances(orderBy: [{column: DATE, order: ASC}, {column: START_TIME, order: ASC}]) { id name }
    }
  }
}`

const PERFORMANCE_QUERY = `query EventDetailPage_PerformanceDetail($id: ID!) {
  performance(id: $id) {
    id canceled date openTime startTime
    setlists(orderBy: [{column: ORDER, order: ASC}, {column: ID, order: ASC}]) {
      id indexPrefix indexNumber contentTypeOther note premiere
      content { __typename ... on Song { id name } ... on CollaborationSong { name } }
    }
  }
}`

export class LlFansClient {
  constructor(private ctx: Context, private timeout: number) {}

  private async query<T>(operationName: string, query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await this.ctx.http.post<{ data?: T, errors?: Array<{ message: string }> }>(ENDPOINT, {
      operationName, query, variables,
    }, {
      timeout: this.timeout,
      headers: { 'user-agent': 'koishi-plugin-rina-llevents/0.1', accept: 'application/json' },
    })
    if (response.errors?.length) throw new Error(response.errors.map(error => error.message).join('; '))
    if (!response.data) throw new Error(`LL-Fans ${operationName} returned no data`)
    return response.data
  }

  async listTours() {
    const all: TourSummary[] = []
    for (let page = 1; page <= 10; page++) {
      const data = await this.query<{ tours: { data: TourSummary[], paginatorInfo: { hasMorePages: boolean } } }>('TourListPage', LIST_QUERY, { first: 1000, page })
      all.push(...data.tours.data)
      if (!data.tours.paginatorInfo.hasMorePages) break
    }
    return all
  }

  async getTour(id: string) {
    return (await this.query<{ tour?: TourDetail }>('EventDetailPage', DETAIL_QUERY, { id })).tour
  }

  async getPerformance(id: string) {
    return (await this.query<{ performance?: PerformanceDetail }>('EventDetailPage_PerformanceDetail', PERFORMANCE_QUERY, { id })).performance
  }
}

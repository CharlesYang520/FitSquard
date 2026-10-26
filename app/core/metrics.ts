// 核心指标（PRD §9）：北极星 + 漏斗。纯函数，输入为各集合的精简行。
import { addDays, todayCN } from './time'

export interface MUser {
  id: string
  created_at: number
}
export interface MMember {
  user_id: string
  team_id: string
  joined_date: string
}
export interface MDay {
  user_id: string
  team_id: string
  date: string
  qualified: boolean
  counted_count: number
}
export interface MReport {
  team_id: string
  end_date: string
  members: { user_id: string; rate: number }[]
}
export interface MEvent {
  name: string
  user_id: string
  date: string
}

export const FUNNEL_WINDOW = 30
export const FINISH_RATE = 0.6
export const REMATCH_DAYS = 7

/** 北极星：近 7 天（含今天）≥ 2 名成员各有 ≥ 5 天达标的战队数 */
export function northStar(days: MDay[], today: string): number {
  const from = addDays(today, -6)
  const cnt = new Map<string, Map<string, number>>()
  for (const d of days) {
    if (!d.qualified || d.date < from || d.date > today) continue
    const m = cnt.get(d.team_id) ?? new Map<string, number>()
    m.set(d.user_id, (m.get(d.user_id) ?? 0) + 1)
    cnt.set(d.team_id, m)
  }
  let n = 0
  for (const m of cnt.values()) if ([...m.values()].filter((v) => v >= 5).length >= 2) n++
  return n
}

export interface FunnelStep {
  key: string
  label: string
  count: number
  /** 有资格进入这一步的人数（D3 / D7 需要满 3 / 7 天） */
  base: number
}

export function funnel(input: { users: MUser[]; members: MMember[]; days: MDay[]; reports: MReport[]; events: MEvent[] }, today: string): FunnelStep[] {
  const from = addDays(today, -(FUNNEL_WINDOW - 1))
  const inWin = (d: string) => d >= from && d <= today

  const opened = new Set(input.events.filter((e) => e.name === 'invite_open' && inWin(e.date)).map((e) => e.user_id))
  const newUsers = input.users.filter((u) => inWin(todayCN(new Date(u.created_at)))).map((u) => u.id)
  const newSet = new Set(newUsers)

  const firstJoin = new Map<string, string>()
  for (const m of input.members) {
    if (!newSet.has(m.user_id)) continue
    const cur = firstJoin.get(m.user_id)
    if (!cur || m.joined_date < cur) firstJoin.set(m.user_id, m.joined_date)
  }
  const joined = [...firstJoin.keys()]

  const daysBy = new Map<string, MDay[]>()
  for (const d of input.days) {
    const l = daysBy.get(d.user_id) ?? []
    l.push(d)
    daysBy.set(d.user_id, l)
  }
  const qualified = joined.filter((u) => (daysBy.get(u) ?? []).some((d) => d.qualified))

  const retained = (offset: number) => {
    const eligible = joined.filter((u) => addDays(firstJoin.get(u)!, offset - 1) <= today)
    const kept = eligible.filter((u) => {
      const target = addDays(firstJoin.get(u)!, offset - 1)
      return (daysBy.get(u) ?? []).some((d) => d.counted_count > 0 && d.date >= target)
    })
    return { count: kept.length, base: eligible.length }
  }
  const d3 = retained(3)
  const d7 = retained(7)

  // 一局完成 / 再来一局（只看窗口内新用户，保持漏斗口径一致）
  const finishedEnd = new Map<string, string>() // user → 最早完成的局结束日
  for (const r of input.reports) {
    for (const m of r.members) {
      if (!newSet.has(m.user_id) || m.rate < FINISH_RATE) continue
      const cur = finishedEnd.get(m.user_id)
      if (!cur || r.end_date < cur) finishedEnd.set(m.user_id, r.end_date)
    }
  }
  const endedTeams = new Map(input.reports.map((r) => [r.team_id, r.end_date]))
  const playedEnd = new Map<string, string>() // user → 参加过的已结束局的结束日（最早）
  for (const m of input.members) {
    const e = endedTeams.get(m.team_id)
    if (!e || !newSet.has(m.user_id)) continue
    const cur = playedEnd.get(m.user_id)
    if (!cur || e < cur) playedEnd.set(m.user_id, e)
  }
  const rematchBase = [...playedEnd.keys()]
  const rematched = rematchBase.filter((u) => {
    const end = playedEnd.get(u)!
    return input.members.some((m) => m.user_id === u && m.joined_date > end && m.joined_date <= addDays(end, REMATCH_DAYS))
  })

  return [
    { key: 'invite_open', label: '打开战书', count: opened.size, base: opened.size },
    { key: 'login', label: '新登录', count: newUsers.length, base: newUsers.length },
    { key: 'joined', label: '加入 / 开局', count: joined.length, base: newUsers.length },
    { key: 'qualified', label: '首次达标', count: qualified.length, base: joined.length },
    { key: 'd3', label: 'D3 仍在打卡', count: d3.count, base: d3.base },
    { key: 'd7', label: 'D7 仍在打卡', count: d7.count, base: d7.base },
    { key: 'finished', label: '一局完成（≥60%）', count: finishedEnd.size, base: playedEnd.size },
    { key: 'rematch', label: '7 天内再来一局', count: rematched.length, base: rematchBase.length },
  ]
}

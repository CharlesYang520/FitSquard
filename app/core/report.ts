// 战报与本局称号（纯函数，可复算）
import { addDays } from './time'

export type TitleKey = 'allin' | 'steady' | 'early' | 'buzzer' | 'slacker'

export const TITLES: Record<TitleKey, { emoji: string; name: string; desc: string }> = {
  allin: { emoji: '🏆', name: '全勤王', desc: '一天都没断' },
  steady: { emoji: '🧱', name: '最稳', desc: '最长连续达标' },
  early: { emoji: '🐦', name: '早鸟', desc: '第一个达标次数最多' },
  buzzer: { emoji: '⏱', name: '压哨王', desc: '最后补齐全员次数最多' },
  slacker: { emoji: '🐟', name: '摸鱼选手', desc: '下一局翻身就靠你了' },
}

export interface ReportMemberInput {
  user_id: string
  joined_date: string
  left_date?: string | null
}

export interface ReportDayInput {
  user_id: string
  date: string
  qualified: boolean
  qualified_at?: number | null
}

export interface MemberReport {
  user_id: string
  done_days: number
  expected_days: number
  rate: number
  best_streak: number
  first_count: number
  last_count: number
  rank: number
  title: TitleKey | null
}

export interface TeamReport {
  rate: number
  all_done_days: number
  best_team_streak: number
  member_count: number
  days: number
}

const MIN_STEADY = 3
const MIN_EARLY = 2
const MIN_BUZZER = 2
const MIN_TEAM_FOR_SLACKER = 3

function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** 某成员某天是否应达标 */
const expectedOn = (m: ReportMemberInput, d: string) => m.joined_date <= d && (!m.left_date || m.left_date > d)

function longestRun(flags: boolean[]): number {
  let best = 0
  let cur = 0
  for (const f of flags) {
    cur = f ? cur + 1 : 0
    best = Math.max(best, cur)
  }
  return best
}

/** 唯一最大者；并列或不达门槛返回 null */
function uniqueMax<T>(rows: T[], val: (r: T) => number, min: number): T | null {
  if (!rows.length) return null
  const max = Math.max(...rows.map(val))
  if (max < min) return null
  const top = rows.filter((r) => val(r) === max)
  return top.length === 1 ? top[0] : null
}

export function buildReport(input: {
  startDate: string
  endDate: string
  members: ReportMemberInput[]
  days: ReportDayInput[]
}): { team: TeamReport; members: MemberReport[] } {
  const { startDate, endDate, members, days } = input
  const dates = dateRange(startDate, endDate)
  const key = (u: string, d: string) => `${u}_${d}`
  const dayMap = new Map(days.map((x) => [key(x.user_id, x.date), x]))
  const q = (u: string, d: string) => !!dayMap.get(key(u, d))?.qualified

  // 每天：第一个达标、全员到齐、压哨
  const first = new Map<string, number>()
  const last = new Map<string, number>()
  const allDone: boolean[] = []
  for (const d of dates) {
    const exp = members.filter((m) => expectedOn(m, d))
    const qualified = exp
      .map((m) => dayMap.get(key(m.user_id, d)))
      .filter((x): x is ReportDayInput => !!x && x.qualified)
    const withTime = qualified.filter((x) => typeof x.qualified_at === 'number')
    if (withTime.length) {
      const f = withTime.reduce((a, b) => ((a.qualified_at as number) <= (b.qualified_at as number) ? a : b))
      first.set(f.user_id, (first.get(f.user_id) ?? 0) + 1)
    }
    const all = exp.length > 0 && qualified.length === exp.length
    allDone.push(all)
    if (all && exp.length >= 2 && withTime.length === qualified.length) {
      const l = withTime.reduce((a, b) => ((a.qualified_at as number) >= (b.qualified_at as number) ? a : b))
      last.set(l.user_id, (last.get(l.user_id) ?? 0) + 1)
    }
  }

  // 战报只列局结束时仍在队里的成员
  const stay = members.filter((m) => !m.left_date || m.left_date > endDate)
  const rows: MemberReport[] = stay.map((m) => {
    const mine = dates.filter((d) => expectedOn(m, d))
    const flags = mine.map((d) => q(m.user_id, d))
    const done = flags.filter(Boolean).length
    return {
      user_id: m.user_id,
      done_days: done,
      expected_days: mine.length,
      rate: mine.length ? done / mine.length : 0,
      best_streak: longestRun(flags),
      first_count: first.get(m.user_id) ?? 0,
      last_count: last.get(m.user_id) ?? 0,
      rank: 0,
      title: null,
    }
  })

  // 名次
  const joined = new Map(stay.map((m) => [m.user_id, m.joined_date]))
  rows.sort(
    (a, b) =>
      b.rate - a.rate ||
      b.best_streak - a.best_streak ||
      (joined.get(a.user_id) ?? '').localeCompare(joined.get(b.user_id) ?? '') ||
      a.user_id.localeCompare(b.user_id),
  )
  rows.forEach((r, i) => {
    const p = rows[i - 1]
    r.rank = p && p.rate === r.rate && p.best_streak === r.best_streak ? p.rank : i + 1
  })

  // 称号：按顺序分配，每人最多 1 个
  const free = () => rows.filter((r) => !r.title)
  for (const r of rows) if (r.expected_days > 0 && r.done_days === r.expected_days) r.title = 'allin'
  const steady = uniqueMax(free(), (r) => r.best_streak, MIN_STEADY)
  if (steady) steady.title = 'steady'
  const early = uniqueMax(free(), (r) => r.first_count, MIN_EARLY)
  if (early) early.title = 'early'
  const buzzer = uniqueMax(free(), (r) => r.last_count, MIN_BUZZER)
  if (buzzer) buzzer.title = 'buzzer'
  if (rows.length >= MIN_TEAM_FOR_SLACKER) {
    const minRate = Math.min(...rows.map((r) => r.rate))
    const lows = rows.filter((r) => r.rate === minRate)
    if (minRate < 1 && lows.length === 1 && !lows[0].title) lows[0].title = 'slacker'
  }

  const sumDone = rows.reduce((s, r) => s + r.done_days, 0)
  const sumExp = rows.reduce((s, r) => s + r.expected_days, 0)
  return {
    team: {
      rate: sumExp ? sumDone / sumExp : 0,
      all_done_days: allDone.filter(Boolean).length,
      best_team_streak: longestRun(allDone),
      member_count: rows.length,
      days: dates.length,
    },
    members: rows,
  }
}

// 达标、计入规则、达标率、实时排名、全队达标
import type { Mood } from './types'
import { diffDays } from './time'

export const DAILY_TARGET = 3
export const UNWELL_TARGET = 1
export const COOLDOWN_MS = 5 * 60 * 1000
export const MAX_UNWELL_DAYS = 2

export const targetFor = (mood: Mood) => (mood === 'unwell' ? UNWELL_TARGET : DAILY_TARGET)

export const dayQualified = (countedCount: number, mood: Mood) => countedCount >= targetFor(mood)

export interface CheckinLite {
  action_id: string
  counted: boolean
  created_at: number // ms
}

export type CountResult =
  | { counted: true; extra: false }
  | { counted: false; extra: true }
  | { counted: false; extra: false; cooldown: true; retryAt: number }

/**
 * 新的一次打卡是否计入。
 * - 当天已计入数达到门槛 → 额外完成（不计入）
 * - 距上一次计入不到 5 分钟 → 暂不计入，可在 retryAt 之后对同一项重新提交
 */
export function evaluateCheckin(existing: CheckinLite[], mood: Mood, now: number): CountResult {
  const counted = existing.filter((c) => c.counted)
  if (counted.length >= targetFor(mood)) return { counted: false, extra: true }
  const last = counted.reduce((m, c) => Math.max(m, c.created_at), -Infinity)
  if (now - last < COOLDOWN_MS) return { counted: false, extra: false, cooldown: true, retryAt: last + COOLDOWN_MS }
  return { counted: true, extra: false }
}

/** 切换今天状态是否允许 */
export function canSetMood(params: {
  from: Mood
  to: Mood
  countedCount: number
  unwellDaysUsed: number // 不含今天
}): { ok: true } | { ok: false; reason: 'MOOD_LIMIT' | 'LOCKED' } {
  const { from, to, countedCount, unwellDaysUsed } = params
  if (from === to) return { ok: true }
  if (to === 'unwell' && unwellDaysUsed >= MAX_UNWELL_DAYS) return { ok: false, reason: 'MOOD_LIMIT' }
  // 已在“不太舒服”下计入过打卡，就不能切回正常门槛来回刷
  if (from === 'unwell' && countedCount > 0) return { ok: false, reason: 'LOCKED' }
  return { ok: true }
}

export interface MemberProgress {
  user_id: string
  joined_date: string
  /** 已结算的天数中属于该成员的天数（加入日 → last_settled_date） */
  settled_days: number
  /** 已结算的达标天数 */
  done_days: number
  /** 已结算的当前连续达标 */
  streak_days: number
  /** 本局计入的完成项数（含未结算的） */
  counted_items: number
  /** 未结算的日子（通常是今天，中午前还有昨天）里已达标的天数 */
  pending_qualified: number
  /** 精确的实时连续达标（由 rollStreak 算出）；不传时用简化算法 */
  live_streak?: number
}

/** 成员已结算天数：加入日到最后结算日（含），未结算过为 0 */
export function settledDays(joinedDate: string, lastSettled: string | null | undefined): number {
  if (!lastSettled || lastSettled < joinedDate) return 0
  return diffDays(joinedDate, lastSettled) + 1
}

/** 实时达标率：未结算的日子只有达标后才计入分子分母，避免白天所有人比率被拉低 */
export function memberRate(m: Pick<MemberProgress, 'settled_days' | 'done_days' | 'pending_qualified'>): number {
  const passed = m.settled_days + m.pending_qualified
  if (passed === 0) return 0
  return (m.done_days + m.pending_qualified) / passed
}

/** 实时连续达标（简化版）：达标的未结算日直接累加 */
export const liveStreak = (m: Pick<MemberProgress, 'streak_days' | 'pending_qualified'> & { live_streak?: number }) =>
  m.live_streak ?? m.streak_days + m.pending_qualified

/** 未结算日的状态：yes=已达标 no=已确定未达标 open=还可能达标（今天，或中午前的昨天） */
export type DayMark = 'yes' | 'no' | 'open'

/** 从已结算的连续天数出发，按时间顺序滚动未结算日 */
export function rollStreak(settledStreak: number, marks: DayMark[]): number {
  let s = settledStreak
  for (const m of marks) {
    if (m === 'yes') s += 1
    else if (m === 'no') s = 0
  }
  return s
}

export interface RankRow {
  user_id: string
  rank: number
  rate: number
  streak: number
  counted_items: number
}

/** 排名：达标率 ↓ → 当前连续达标 ↓ → 计入项数 ↓ → 加入日期 ↑。三项都相同的并列同名次。 */
export function rank(members: MemberProgress[]): RankRow[] {
  const rows = members.map((m) => ({
    m,
    rate: memberRate(m),
    streak: liveStreak(m),
  }))
  rows.sort(
    (a, b) =>
      b.rate - a.rate ||
      b.streak - a.streak ||
      b.m.counted_items - a.m.counted_items ||
      a.m.joined_date.localeCompare(b.m.joined_date) ||
      a.m.user_id.localeCompare(b.m.user_id),
  )
  const out: RankRow[] = []
  rows.forEach((r, i) => {
    const prev = rows[i - 1]
    const tie = prev && prev.rate === r.rate && prev.streak === r.streak && prev.m.counted_items === r.m.counted_items
    out.push({
      user_id: r.m.user_id,
      rank: tie ? out[i - 1].rank : i + 1,
      rate: r.rate,
      streak: r.streak,
      counted_items: r.m.counted_items,
    })
  })
  return out
}

/** 某天应达标的成员：当天及之前加入、且未退出 */
export function expectedMembers<T extends { joined_date: string; left_date?: string | null }>(members: T[], date: string): T[] {
  return members.filter((m) => m.joined_date <= date && (!m.left_date || m.left_date > date))
}

/** 全队当天：达标人数 / 应达标人数，是否全员达标 */
export function teamDay(expectedIds: string[], qualifiedIds: Set<string>) {
  const done = expectedIds.filter((id) => qualifiedIds.has(id)).length
  const total = expectedIds.length
  return { done, total, all: total > 0 && done === total }
}

/** 这次达标是不是让全员达标的最后一人 */
export function isLastOne(expectedIds: string[], qualifiedBefore: Set<string>, userId: string): boolean {
  if (qualifiedBefore.has(userId) || !expectedIds.includes(userId)) return false
  return expectedIds.every((id) => id === userId || qualifiedBefore.has(id))
}

/** 格式化达标率为百分比整数 */
export const ratePercent = (rate: number) => Math.round(rate * 100)

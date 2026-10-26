import { describe, expect, it } from 'vitest'
import {
  canSetMood,
  COOLDOWN_MS,
  dayQualified,
  evaluateCheckin,
  expectedMembers,
  isLastOne,
  liveStreak,
  memberRate,
  rank,
  rollStreak,
  settledDays,
  teamDay,
  type MemberProgress,
} from '../scoring'

const T0 = Date.UTC(2026, 9, 22, 4, 0) // 北京 12:00
const min = 60 * 1000

describe('当天达标门槛', () => {
  it('正常 / 很忙 3 项，不太舒服 1 项', () => {
    expect(dayQualified(2, 'normal')).toBe(false)
    expect(dayQualified(3, 'normal')).toBe(true)
    expect(dayQualified(3, 'busy')).toBe(true)
    expect(dayQualified(1, 'unwell')).toBe(true)
    expect(dayQualified(0, 'unwell')).toBe(false)
    // 正常时打了 2 项非恢复类，再切“不太舒服”不算达标
    expect(dayQualified(2, 'unwell', 0)).toBe(false)
    expect(dayQualified(2, 'unwell', 1)).toBe(true)
  })
})

describe('evaluateCheckin', () => {
  it('第一项计入', () => {
    expect(evaluateCheckin([], 'normal', T0)).toEqual({ counted: true, extra: false })
  })

  it('间隔内第二项不计入，给出可重试时间；满间隔计入', () => {
    const ex = [{ action_id: 'a', counted: true, created_at: T0 }]
    expect(evaluateCheckin(ex, 'normal', T0 + COOLDOWN_MS - min)).toEqual({ counted: false, extra: false, cooldown: true, retryAt: T0 + COOLDOWN_MS })
    expect(evaluateCheckin(ex, 'normal', T0 + COOLDOWN_MS)).toEqual({ counted: true, extra: false })
  })

  it('冷却只看已计入的打卡', () => {
    const ex = [
      { action_id: 'a', counted: true, created_at: T0 },
      { action_id: 'b', counted: false, created_at: T0 + 6 * min },
    ]
    expect(evaluateCheckin(ex, 'normal', T0 + 7 * min).counted).toBe(true)
  })

  it('已满 3 项后为额外完成；不太舒服 1 项后即额外完成', () => {
    const three = ['a', 'b', 'c'].map((id, i) => ({ action_id: id, counted: true, created_at: T0 + i * 10 * min }))
    expect(evaluateCheckin(three, 'normal', T0 + 60 * min)).toEqual({ counted: false, extra: true })
    const one = [{ action_id: 'a', counted: true, created_at: T0 }]
    expect(evaluateCheckin(one, 'unwell', T0 + 60 * min)).toEqual({ counted: false, extra: true })
  })
})

describe('canSetMood', () => {
  it('本局不太舒服已用 2 天 → 不可再选', () => {
    expect(canSetMood({ from: 'normal', to: 'unwell', countedWhileUnwell: 0, unwellDaysUsed: 2 })).toEqual({ ok: false, reason: 'MOOD_LIMIT' })
    expect(canSetMood({ from: 'normal', to: 'unwell', countedWhileUnwell: 0, unwellDaysUsed: 1 })).toEqual({ ok: true })
  })

  it('正常时打的项不影响切回；不太舒服下计入过才锁住', () => {
    expect(canSetMood({ from: 'unwell', to: 'normal', countedWhileUnwell: 0, unwellDaysUsed: 0 })).toEqual({ ok: true })
  })

  it('不太舒服下已计入打卡后不能切回', () => {
    expect(canSetMood({ from: 'unwell', to: 'normal', countedWhileUnwell: 1, unwellDaysUsed: 0 })).toEqual({ ok: false, reason: 'LOCKED' })
    expect(canSetMood({ from: 'unwell', to: 'normal', countedWhileUnwell: 0, unwellDaysUsed: 0 })).toEqual({ ok: true })
    expect(canSetMood({ from: 'normal', to: 'busy', countedWhileUnwell: 0, unwellDaysUsed: 0 })).toEqual({ ok: true })
  })
})

// Day 1 = 10-17，今天 10-22（Day 6），已结算到 10-21
const LAST = '2026-10-21'
const mk = (p: Partial<MemberProgress> & { user_id: string }): MemberProgress => {
  const joined_date = p.joined_date ?? '2026-10-17'
  return {
    joined_date,
    settled_days: settledDays(joined_date, LAST),
    done_days: 0,
    streak_days: 0,
    counted_items: 0,
    pending_qualified: 0,
    ...p,
  }
}

describe('达标率', () => {
  it('已结算天数从加入日起算', () => {
    expect(settledDays('2026-10-17', LAST)).toBe(5)
    expect(settledDays('2026-10-19', LAST)).toBe(3)
    expect(settledDays('2026-10-22', LAST)).toBe(0)
    expect(settledDays('2026-10-17', null)).toBe(0)
  })

  it('今天未达标时只算已结算的', () => {
    expect(memberRate(mk({ user_id: 'a', done_days: 4 }))).toBeCloseTo(4 / 5)
  })

  it('今天达标后把今天计入分子分母', () => {
    expect(memberRate(mk({ user_id: 'a', done_days: 4, pending_qualified: 1 }))).toBeCloseTo(5 / 6)
  })

  it('迟到成员从加入日起算；今天刚加入为 0，达标后 100%', () => {
    expect(memberRate(mk({ user_id: 'b', joined_date: '2026-10-19', done_days: 3 }))).toBe(1)
    expect(memberRate(mk({ user_id: 'c', joined_date: '2026-10-22' }))).toBe(0)
    expect(memberRate(mk({ user_id: 'c', joined_date: '2026-10-22', pending_qualified: 1 }))).toBe(1)
  })

  it('实时连续达标', () => {
    expect(liveStreak({ streak_days: 4, pending_qualified: 1 })).toBe(5)
    expect(liveStreak({ streak_days: 4, pending_qualified: 0 })).toBe(4)
  })
})

describe('rank', () => {
  it('按达标率 → 连续 → 计入项数 → 加入日期排序', () => {
    const rows = rank([
      mk({ user_id: 'xw', done_days: 4, streak_days: 2, counted_items: 14 }),
      mk({ user_id: 'aj', done_days: 5, streak_days: 5, counted_items: 15, pending_qualified: 1 }),
      mk({ user_id: 'mia', done_days: 4, streak_days: 4, counted_items: 13 }),
      mk({ user_id: 'dl', joined_date: '2026-10-19', done_days: 3, streak_days: 3, counted_items: 9 }),
      mk({ user_id: 'lily', done_days: 4, streak_days: 4, counted_items: 15 }),
    ])
    expect(rows.map((r) => r.user_id)).toEqual(['aj', 'dl', 'lily', 'mia', 'xw'])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5])
  })

  it('三项全相同并列同名次', () => {
    const rows = rank([
      mk({ user_id: 'a', done_days: 2, streak_days: 2, counted_items: 6 }),
      mk({ user_id: 'b', done_days: 2, streak_days: 2, counted_items: 6 }),
      mk({ user_id: 'c', done_days: 1, streak_days: 1, counted_items: 3 }),
    ])
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3])
  })
})

describe('全队', () => {
  const members = [
    { user_id: 'a', joined_date: '2026-10-17' },
    { user_id: 'b', joined_date: '2026-10-19' },
    { user_id: 'c', joined_date: '2026-10-17', left_date: '2026-10-20' },
    { user_id: 'd', joined_date: '2026-10-23' },
  ]

  it('应达标成员：已加入、未退出', () => {
    expect(expectedMembers(members, '2026-10-18').map((m) => m.user_id)).toEqual(['a', 'c'])
    expect(expectedMembers(members, '2026-10-22').map((m) => m.user_id)).toEqual(['a', 'b'])
  })

  it('全员达标与 N/M', () => {
    expect(teamDay(['a', 'b'], new Set(['a']))).toEqual({ done: 1, total: 2, all: false })
    expect(teamDay(['a', 'b'], new Set(['a', 'b', 'x']))).toEqual({ done: 2, total: 2, all: true })
    expect(teamDay([], new Set())).toEqual({ done: 0, total: 0, all: false })
  })

  it('最后一人', () => {
    expect(isLastOne(['a', 'b', 'c'], new Set(['a', 'c']), 'b')).toBe(true)
    expect(isLastOne(['a', 'b', 'c'], new Set(['a']), 'b')).toBe(false)
    expect(isLastOne(['a', 'b'], new Set(['a', 'b']), 'b')).toBe(false)
    expect(isLastOne(['a', 'b'], new Set(['a']), 'z')).toBe(false)
  })
})

describe('rollStreak', () => {
  it('达标累加、确定未达标清零、待定不变', () => {
    expect(rollStreak(4, [])).toBe(4)
    expect(rollStreak(4, ['yes'])).toBe(5)
    expect(rollStreak(4, ['open'])).toBe(4)
    expect(rollStreak(4, ['open', 'yes'])).toBe(5)
    expect(rollStreak(4, ['no', 'yes'])).toBe(1)
    expect(rollStreak(4, ['yes', 'open'])).toBe(5)
  })
})

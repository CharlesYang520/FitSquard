import { describe, expect, it } from 'vitest'
import { addDays } from '../time'
import { funnel, northStar, type MDay } from '../metrics'

const TODAY = '2026-11-20'
const ms = (date: string) => Date.parse(`${date}T10:00:00+08:00`)
const day = (user_id: string, team_id: string, date: string, qualified: boolean, counted = qualified ? 3 : 0): MDay => ({
  user_id,
  team_id,
  date,
  qualified,
  counted_count: counted,
})

describe('northStar', () => {
  it('近 7 天 ≥ 2 人各 ≥ 5 天达标才算 1 队', () => {
    const days: MDay[] = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(TODAY, -i)
      days.push(day('a', 'T1', d, i < 5), day('b', 'T1', d, i < 6), day('c', 'T2', d, true), day('d', 'T2', d, i < 4))
    }
    // 7 天之前的不算
    for (let i = 7; i < 14; i++) days.push(day('d', 'T2', addDays(TODAY, -i), true))
    expect(northStar(days, TODAY)).toBe(1)
  })
})

describe('funnel', () => {
  it('各段口径', () => {
    const J = addDays(TODAY, -20) // 首次加入日
    const users = [
      { id: 'u1', created_at: ms(J) },
      { id: 'u2', created_at: ms(J) },
      { id: 'u3', created_at: ms(addDays(TODAY, -1)) }, // 昨天才来，还不满 3 天
      { id: 'old', created_at: ms(addDays(TODAY, -60)) }, // 窗口外
    ]
    const members = [
      { user_id: 'u1', team_id: 'T1', joined_date: J },
      { user_id: 'u2', team_id: 'T1', joined_date: J },
      { user_id: 'u3', team_id: 'T2', joined_date: addDays(TODAY, -1) },
      { user_id: 'u1', team_id: 'T3', joined_date: addDays(J, 16) }, // T1 结束后 3 天再来
    ]
    const days: MDay[] = [
      day('u1', 'T1', J, true),
      day('u1', 'T1', addDays(J, 7), false, 1), // D7 后还有打卡
      day('u2', 'T1', J, false, 1),
      day('u2', 'T1', addDays(J, 2), false, 1), // D3 当天有打卡
    ]
    const reports = [
      {
        team_id: 'T1',
        end_date: addDays(J, 13),
        members: [
          { user_id: 'u1', rate: 0.8 },
          { user_id: 'u2', rate: 0.3 },
        ],
      },
    ]
    const events = [
      { name: 'invite_open', user_id: 'u2', date: J },
      { name: 'invite_open', user_id: 'x', date: J },
      { name: 'invite_open', user_id: 'y', date: addDays(TODAY, -40) },
    ]
    const f = Object.fromEntries(funnel({ users, members, days, reports, events }, TODAY).map((s) => [s.key, [s.count, s.base]]))
    expect(f.invite_open).toEqual([2, 2])
    expect(f.login).toEqual([3, 3])
    expect(f.joined).toEqual([3, 3])
    expect(f.qualified).toEqual([1, 3])
    expect(f.d3).toEqual([2, 2]) // u3 不满 3 天不进分母
    expect(f.d7).toEqual([1, 2])
    expect(f.finished).toEqual([1, 2])
    expect(f.rematch).toEqual([1, 2])
  })
})

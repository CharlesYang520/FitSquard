import { describe, expect, it } from 'vitest'
import { addDays } from '../time'
import { buildReport, type ReportDayInput, type ReportMemberInput } from '../report'

const START = '2026-10-17'
const END = addDays(START, 13) // 14 天
const T = (dayIdx: number, minute: number) => Date.UTC(2026, 9, 17 + dayIdx, 0, minute)

/** pattern: 每天一个字符，'1' 达标，'0' 未达标，'-' 未加入；times 可选：每天达标时刻（分钟） */
function mk(user: string, pattern: string, times?: number[]): { m: ReportMemberInput; d: ReportDayInput[] } {
  const firstIdx = pattern.search(/[01]/)
  const m: ReportMemberInput = { user_id: user, joined_date: addDays(START, firstIdx) }
  const d: ReportDayInput[] = []
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '-') continue
    const qualified = pattern[i] === '1'
    d.push({ user_id: user, date: addDays(START, i), qualified, qualified_at: qualified ? T(i, times?.[i] ?? 600) : null })
  }
  return { m, d }
}

function run(list: ReturnType<typeof mk>[]) {
  return buildReport({ startDate: START, endDate: END, members: list.map((x) => x.m), days: list.flatMap((x) => x.d) })
}
const title = (r: ReturnType<typeof run>, u: string) => r.members.find((m) => m.user_id === u)?.title ?? null

describe('buildReport', () => {
  it('Mockup 场景：全勤王 / 最稳 / 早鸟 / 压哨王 / 摸鱼选手', () => {
    const r = run([
      mk('jie', '11111111111111', Array(14).fill(500)),
      mk('wang', '11111110111111', Array(14).fill(700)),
      // Mia 每天最早（但不是全勤）
      mk('mia', '11011101110111', Array(14).fill(400)),
      // Lily 常常最后一个让全员到齐
      mk('lily', '01111011101111', Array(14).fill(900)),
      mk('liu', '--100110011011', Array(14).fill(800)),
    ])
    expect(title(r, 'jie')).toBe('allin')
    expect(title(r, 'wang')).toBe('steady') // 最长连续 7
    expect(title(r, 'mia')).toBe('early')
    expect(title(r, 'lily')).toBe('buzzer')
    expect(title(r, 'liu')).toBe('slacker')
    expect(r.members[0].user_id).toBe('jie')
    expect(r.members[0].rank).toBe(1)
    const liu = r.members.find((m) => m.user_id === 'liu')!
    expect(liu.expected_days).toBe(12) // Day 3 加入
    expect(liu.done_days).toBe(7)
  })

  it('全队统计：全员到齐天数、全队最长连续、完成率', () => {
    const r = run([mk('a', '11111111111111'), mk('b', '11110111111111')])
    expect(r.team.all_done_days).toBe(13)
    expect(r.team.best_team_streak).toBe(9)
    expect(r.team.rate).toBeCloseTo(27 / 28)
    expect(r.team.days).toBe(14)
  })

  it('全勤王可多人；最稳不足 3 天空缺；并列空缺', () => {
    const r = run([mk('a', '11111111111111'), mk('b', '11111111111111'), mk('c', '10101010101010'), mk('d', '01010101010101')])
    expect(title(r, 'a')).toBe('allin')
    expect(title(r, 'b')).toBe('allin')
    // c、d 最长连续都是 1 → 最稳空缺；完成率并列 → 摸鱼空缺
    expect(title(r, 'c')).toBeNull()
    expect(title(r, 'd')).toBeNull()
    expect(r.members.filter((m) => m.rank === 3)).toHaveLength(2)
  })

  it('2 人队没有摸鱼选手；早鸟要 ≥ 2 次', () => {
    const r = run([mk('a', '10000000000000', [100]), mk('b', '00000000000001')])
    expect(r.members.some((m) => m.title === 'slacker')).toBe(false)
    expect(title(r, 'a')).toBeNull()
  })

  it('退出的成员不进战报，但退出前影响全员到齐', () => {
    const a = mk('a', '11111111111111')
    const b = mk('b', '00111111111111')
    b.m.left_date = addDays(START, 2) // 第 3 天起退出
    const r = run([a, b])
    expect(r.members.map((m) => m.user_id)).toEqual(['a'])
    expect(r.team.all_done_days).toBe(12)
  })
})

// 战队实时快照：未结算日（今天，以及中午前的昨天）在读时合成，不提前改 streak
import { addDays, minutesCN, NEXT_MORNING_TO } from '@core/time'
import { expectedMembers, rank, rollStreak, settledDays, teamDay, type DayMark, type MemberProgress } from '@core/scoring'
import { COLL } from './db'
import { today as todayOf, yesterday as yesterdayOf, type Ctx } from './context'
import { dayId, type DayDoc, type MemberDoc, type TeamDoc, type UserDoc } from './models'

/** 还没被日终结算的日期（升序），封顶在局的最后一天和今天 */
export function unsettledDates(team: TeamDoc, today: string): string[] {
  const from = team.last_settled_date ? addDays(team.last_settled_date, 1) : team.start_date
  const to = today < team.end_date ? today : team.end_date
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export interface Snapshot {
  date: string
  members: MemberDoc[]
  users: Map<string, UserDoc>
  /** key = dayId */
  days: Map<string, DayDoc>
  ranking: ReturnType<typeof rank>
  progress: Map<string, MemberProgress>
  today: { done: number; total: number; all: boolean; expected: string[]; qualified: Set<string> }
  teamStreak: number
}

export async function teamSnapshot(ctx: Ctx, team: TeamDoc): Promise<Snapshot> {
  const date = todayOf(ctx)
  const yest = yesterdayOf(ctx)
  const beforeNoon = minutesCN(ctx.now) < NEXT_MORNING_TO
  const members = (await ctx.db.find<MemberDoc>(COLL.members, { team_id: team._id })).filter((m) => !m.left_date)
  const pending = unsettledDates(team, date)
  const [dayRows, userRows] = await Promise.all([
    pending.length ? ctx.db.find<DayDoc>(COLL.days, { team_id: team._id, date: pending }) : Promise.resolve([]),
    members.length ? ctx.db.find<UserDoc>(COLL.users, { _id: members.map((m) => m.user_id) }) : Promise.resolve([]),
  ])
  const days = new Map(dayRows.map((d) => [d._id, d]))
  const users = new Map(userRows.map((u) => [u._id, u]))

  const markOf = (qualified: boolean, d: string): DayMark => {
    if (qualified) return 'yes'
    if (d === date) return 'open'
    if (d === yest && beforeNoon) return 'open'
    return 'no'
  }

  const progress = new Map<string, MemberProgress>()
  for (const m of members) {
    const marks = pending
      .filter((d) => d >= m.joined_date)
      .map((d) => markOf(!!days.get(dayId(team._id, m.user_id, d))?.qualified, d))
    progress.set(m.user_id, {
      user_id: m.user_id,
      joined_date: m.joined_date,
      settled_days: settledDays(m.joined_date, team.last_settled_date),
      done_days: m.done_days,
      streak_days: m.streak_days,
      counted_items: m.counted_items,
      pending_qualified: marks.filter((x) => x === 'yes').length,
      live_streak: rollStreak(m.streak_days, marks),
    })
  }

  const teamMarks = pending.map((d) => {
    const exp = expectedMembers(members, d).map((m) => m.user_id)
    const q = new Set(exp.filter((id) => days.get(dayId(team._id, id, d))?.qualified))
    return markOf(teamDay(exp, q).all, d)
  })

  const expected = date <= team.end_date ? expectedMembers(members, date).map((m) => m.user_id) : []
  const qualified = new Set(expected.filter((id) => days.get(dayId(team._id, id, date))?.qualified))

  return {
    date,
    members,
    users,
    days,
    ranking: rank([...progress.values()]),
    progress,
    today: { ...teamDay(expected, qualified), expected, qualified },
    teamStreak: rollStreak(team.team_streak, teamMarks),
  }
}

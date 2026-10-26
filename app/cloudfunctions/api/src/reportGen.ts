// 生成并保存战报（日终结算和读取时都可调用；已存在则直接返回，幂等）
import { buildReport } from '@core/report'
import { COLL, type Db } from './db'
import type { DayDoc, MemberDoc, ReportDoc, TeamDoc } from './models'

export async function generateReport(db: Db, teamId: string, now: number): Promise<ReportDoc | null> {
  const existing = await db.get<ReportDoc>(COLL.reports, teamId)
  if (existing) return existing
  const team = await db.get<TeamDoc>(COLL.teams, teamId)
  if (!team || team.status !== 'ended') return null
  const [members, days] = await Promise.all([
    db.find<MemberDoc>(COLL.members, { team_id: teamId }),
    db.find<DayDoc>(COLL.days, { team_id: teamId }),
  ])
  const r = buildReport({
    startDate: team.start_date,
    endDate: team.end_date,
    members: members.map((m) => ({ user_id: m.user_id, joined_date: m.joined_date, left_date: m.left_date })),
    days: days.map((d) => ({ user_id: d.user_id, date: d.date, qualified: d.qualified, qualified_at: d.qualified_at ?? null })),
  })
  const doc: ReportDoc = {
    _id: teamId,
    member_ids: r.members.map((m) => m.user_id),
    team: {
      name: team.name,
      theme: team.theme,
      period_days: team.period_days,
      start_date: team.start_date,
      end_date: team.end_date,
      offline_note: team.offline_note ?? '',
      rate: r.team.rate,
      all_done_days: r.team.all_done_days,
      best_team_streak: r.team.best_team_streak,
      member_count: r.team.member_count,
    },
    members: r.members.map((m) => ({
      user_id: m.user_id,
      done_days: m.done_days,
      expected_days: m.expected_days,
      rate: m.rate,
      best_streak: m.best_streak,
      rank: m.rank,
      title: m.title,
    })),
    created_at: now,
  }
  await db.set(COLL.reports, doc)
  await db.update(COLL.teams, teamId, { report_ready: true })
  return doc
}

// 日终结算：把“昨天及以前还没结算的日子”逐天结算。
// 触发时间 12:05（北京时间）：次日早上确认的项要到 12:00 才截止，所以等它截止后再结算昨天。
// 幂等：每个局按 last_settled_date 推进，重复执行不会重复累加。
import { addDays, todayCN } from '@core/time'
import { expectedMembers, teamDay } from '@core/scoring'
import { COLL, type Db } from '../../api/src/db'
import type { DayDoc, MemberDoc, TeamDoc, UserDoc } from '../../api/src/models'
import { notify, type NotifyDeps } from '../../api/src/notify'
import { generateReport } from '../../api/src/reportGen'

export interface SettleReport {
  teams: number
  days: number
  ended: string[]
}

export async function settleAll(db: Db, now: Date, notifyDeps?: Omit<NotifyDeps, 'db'>): Promise<SettleReport> {
  const upTo = addDays(todayCN(now), -1)
  const teams = await db.find<TeamDoc>(COLL.teams, { status: 'active' })
  const report: SettleReport = { teams: 0, days: 0, ended: [] }
  for (const t of teams) {
    const n = await settleTeam(db, t._id, upTo)
    if (n.days) report.teams++
    report.days += n.days
    if (n.ended) report.ended.push(t._id)
  }
  // 局结束：生成战报 + 通知
  for (const id of report.ended) {
    const r = await generateReport(db, id, now.getTime())
    if (!r || !notifyDeps) continue
    for (const m of r.members) {
      await notify(
        { db, ...notifyDeps },
        m.user_id,
        'team',
        { title: `${r.team.name} 战报出来了`, content: `你的完成率 ${Math.round(m.rate * 100)}%，全队 ${Math.round(r.team.rate * 100)}%`, note: '看看你拿了什么称号' },
        `/pages/report/index?team=${id}`,
      )
    }
  }
  return report
}

export async function settleTeam(db: Db, teamId: string, upTo: string): Promise<{ days: number; ended: boolean }> {
  let days = 0
  for (;;) {
    const team = await db.get<TeamDoc>(COLL.teams, teamId)
    if (!team || team.status !== 'active') return { days, ended: false }
    const next = team.last_settled_date ? addDays(team.last_settled_date, 1) : team.start_date
    const last = upTo < team.end_date ? upTo : team.end_date
    if (next > last) break
    await settleDay(db, teamId, next)
    days++
  }
  const team = (await db.get<TeamDoc>(COLL.teams, teamId))!
  if (team.last_settled_date === team.end_date) {
    await endTeam(db, team)
    return { days, ended: true }
  }
  return { days, ended: false }
}

async function settleDay(db: Db, teamId: string, date: string) {
  const members = (await db.find<MemberDoc>(COLL.members, { team_id: teamId })).filter((m) => !m.left_date || m.left_date > date)
  const expected = expectedMembers(members, date)
  const dayRows = expected.length
    ? await db.find<DayDoc>(COLL.days, { team_id: teamId, date })
    : []
  const qualified = new Set(dayRows.filter((d) => d.qualified).map((d) => d.user_id))

  await db.transaction(async (tx) => {
    const team = await tx.get<TeamDoc>(COLL.teams, teamId)
    // 幂等：已结算过这一天就跳过
    if (!team || (team.last_settled_date && team.last_settled_date >= date)) return

    for (const em of expected) {
      const m = await tx.get<MemberDoc>(COLL.members, em._id)
      if (!m) continue
      const ok = qualified.has(m.user_id)
      const streak = ok ? m.streak_days + 1 : 0
      const best = Math.max(m.streak_best, streak)
      await tx.update(COLL.members, m._id, {
        streak_days: streak,
        streak_best: best,
        done_days: m.done_days + (ok ? 1 : 0),
      })
      const u = await tx.get<UserDoc>(COLL.users, m.user_id)
      if (u) await tx.update(COLL.users, u._id, { streak_days: streak, streak_best: Math.max(u.streak_best ?? 0, best) })
    }

    const all = teamDay(
      expected.map((m) => m.user_id),
      qualified,
    ).all
    const ts = all ? team.team_streak + 1 : 0
    await tx.update(COLL.teams, teamId, {
      team_streak: ts,
      team_streak_best: Math.max(team.team_streak_best, ts),
      last_settled_date: date,
    })
  })
}

async function endTeam(db: Db, team: TeamDoc) {
  const members = await db.find<MemberDoc>(COLL.members, { team_id: team._id })
  await db.transaction(async (tx) => {
    const t = await tx.get<TeamDoc>(COLL.teams, team._id)
    if (!t || t.status === 'ended') return
    await tx.update(COLL.teams, team._id, { status: 'ended' })
    for (const m of members) {
      const u = await tx.get<UserDoc>(COLL.users, m.user_id)
      if (u?.active_team_id === team._id) await tx.update(COLL.users, u._id, { active_team_id: null })
    }
  })
}

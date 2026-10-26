// 明早提醒：每天 08:30（北京时间），给有额度、今天在局内的成员发一条；按 users.last_morning_date 幂等
import { todayCN } from '@core/time'
import { SEED_ACTIONS } from '../../api/src/context'
import { COLL, type Db } from '../../api/src/db'
import type { MemberDoc, PlanDoc, TeamDoc, UserDoc } from '../../api/src/models'
import { notify, type NotifyDeps } from '../../api/src/notify'

export async function sendMorning(db: Db, now: Date, deps: Omit<NotifyDeps, 'db'>) {
  const date = todayCN(now)
  const out = { sent: 0, skipped: 0 }
  if (!deps.templates.morning || !deps.notifier) return out
  const rows = await db.find(COLL.actions, {})
  const actions = (rows.length ? rows : SEED_ACTIONS) as typeof SEED_ACTIONS
  const teams = (await db.find<TeamDoc>(COLL.teams, { status: 'active' })).filter((t) => t.start_date <= date && date <= t.end_date)
  for (const t of teams) {
    const [members, plan] = await Promise.all([db.find<MemberDoc>(COLL.members, { team_id: t._id }), db.get<PlanDoc>(COLL.plans, t._id)])
    const pd = plan?.days.find((d) => d.date === date)
    const pick = pd ? actions.find((a) => a._id === pd.pick_id) : undefined
    for (const m of members) {
      if (m.left_date || m.joined_date > date) continue
      const u = await db.get<UserDoc>(COLL.users, m.user_id)
      if (!u || u.deleted_at || u.last_morning_date === date) {
        out.skipped++
        continue
      }
      await db.update(COLL.users, u._id, { last_morning_date: date })
      const r = await notify(
        { db, ...deps },
        u._id,
        'morning',
        {
          title: `${t.name} · Day ${pd?.day_no ?? ''}`,
          content: pick ? `今日推荐：${pick.text}` : '今天的 9 项清单解锁了',
          note: `全队连续 ${t.team_streak} 天，今天接着来`,
        },
        '/pages/checkin/index',
      )
      if (r === 'sent') out.sent++
      else out.skipped++
    }
  }
  return out
}

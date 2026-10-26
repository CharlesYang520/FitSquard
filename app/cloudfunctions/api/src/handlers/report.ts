import { TITLES, type TitleKey } from '@core/report'
import { ratePercent } from '@core/scoring'
import { COLL } from '../db'
import { displayName, getTeam, requireUser, type Ctx } from '../context'
import { fail } from '../errors'
import { memberId, type MemberDoc, type ReportDoc, type UserDoc } from '../models'
import { generateReport } from '../reportGen'

const titleView = (t: string | null) => (t ? { key: t, ...TITLES[t as TitleKey] } : null)

/** 某局战报（成员可读）；只含百分比与天数，不含任何体重数据 */
export async function get(ctx: Ctx, payload: Record<string, unknown>) {
  const team = await getTeam(ctx, payload.team_id)
  const m = await ctx.db.get<MemberDoc>(COLL.members, memberId(team._id, ctx.openid))
  if (!m) fail('NOT_MEMBER', '你不在这支战队里')
  if (team.status !== 'ended') fail('LOCKED', '这局还没结束，战报最后一天结算后出')
  const r = await generateReport(ctx.db, team._id, ctx.now.getTime())
  if (!r) fail('INTERNAL', '战报还没生成')
  const report = r as ReportDoc
  const users = report.member_ids.length ? await ctx.db.find<UserDoc>(COLL.users, { _id: report.member_ids }) : []
  const uMap = new Map(users.map((u) => [u._id, u]))
  const rows = report.members.map((x) => ({
    user_id: x.user_id,
    nickname: displayName(uMap.get(x.user_id)),
    avatar: uMap.get(x.user_id)?.deleted_at ? '' : uMap.get(x.user_id)?.avatar ?? '',
    done_days: x.done_days,
    expected_days: x.expected_days,
    rate_pct: ratePercent(x.rate),
    best_streak: x.best_streak,
    rank: x.rank,
    title: titleView(x.title),
    is_me: x.user_id === ctx.openid,
  }))
  return {
    team_id: team._id,
    team: { ...report.team, rate_pct: ratePercent(report.team.rate) },
    members: rows,
    me: rows.find((x) => x.is_me) ?? null,
    next_team_id: team.next_team_id ?? null,
  }
}

/** 我的历史战报 */
export async function list(ctx: Ctx) {
  await requireUser(ctx)
  const rows = await ctx.db.find<ReportDoc>(COLL.reports, { member_ids: ctx.openid }, { orderBy: ['created_at', 'desc'], limit: 50 })
  return rows.map((r) => {
    const me = r.members.find((x) => x.user_id === ctx.openid)
    return {
      team_id: r._id,
      name: r.team.name,
      start_date: r.team.start_date,
      end_date: r.team.end_date,
      period_days: r.team.period_days,
      rate_pct: me ? ratePercent(me.rate) : 0,
      title: titleView(me?.title ?? null),
    }
  })
}

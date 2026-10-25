import type { ReactionKind } from '@core/types'
import { ratePercent, targetFor } from '@core/scoring'
import { addDays, clockCN } from '@core/time'
import { REACTIONS } from '@core/copy'
import { COLL } from '../db'
import { dayNoOf, getPlan, getTeam, publicAction, requireMember, resolveTeamId, type Ctx } from '../context'
import { fail } from '../errors'
import { dayId, type CheckinDoc, type DayDoc, type ReactionDoc } from '../models'
import { teamSnapshot } from '../snapshot'

const FEED_LIMIT = 30
const KINDS = REACTIONS.map((r) => r.kind) as ReactionKind[]

/** 首页 / 战队页 / 我的 共用数据 */
export async function home(ctx: Ctx, payload: Record<string, unknown>) {
  const teamId = await resolveTeamId(ctx, payload.team_id)
  const [team, me, plan, actions] = await Promise.all([
    getTeam(ctx, teamId),
    requireMember(ctx, teamId),
    getPlan(ctx, teamId),
    ctx.getActions(),
  ])
  const byId = new Map(actions.map((a) => [a._id, a]))
  const snap = await teamSnapshot(ctx, team)
  const date = snap.date
  const nick = (id: string) => snap.users.get(id)?.nickname || '队友'
  const avatar = (id: string) => snap.users.get(id)?.avatar || ''

  // 今日头像排：已达标在前
  const todayMembers = snap.today.expected
    .map((id) => ({
      user_id: id,
      nickname: nick(id),
      avatar: avatar(id),
      qualified: snap.today.qualified.has(id),
      counted_count: snap.days.get(dayId(teamId, id, date))?.counted_count ?? 0,
      is_me: id === ctx.openid,
    }))
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.counted_count - a.counted_count)

  const ranking = snap.ranking.map((r) => {
    const p = snap.progress.get(r.user_id)!
    const m = snap.members.find((x) => x.user_id === r.user_id)!
    return {
      user_id: r.user_id,
      nickname: nick(r.user_id),
      avatar: avatar(r.user_id),
      rank: r.rank,
      rate_pct: ratePercent(r.rate),
      done_days: p.done_days + p.pending_qualified,
      passed_days: p.settled_days + p.pending_qualified,
      streak: r.streak,
      counted_items: r.counted_items,
      joined_day_no: dayNoOf(team, m.joined_date),
      today_counted: snap.days.get(dayId(teamId, r.user_id, date))?.counted_count ?? 0,
      is_captain: r.user_id === team.captain_id,
      is_me: r.user_id === ctx.openid,
    }
  })

  // 动态：系统生成的打卡记录（不含“稍后再打”的未计入记录）
  const recent = await ctx.db.find<CheckinDoc>(COLL.checkins, { team_id: teamId }, { orderBy: ['created_at', 'desc'], limit: FEED_LIMIT * 2 })
  const feedRows = recent.filter((c) => c.counted || c.extra).slice(0, FEED_LIMIT)
  const reactions = feedRows.length
    ? await ctx.db.find<ReactionDoc>(COLL.reactions, { team_id: teamId, checkin_id: feedRows.map((c) => c._id) })
    : []
  const feed = feedRows.map((c) => {
    const a = byId.get(c.action_id)
    const rs = reactions.filter((r) => r.checkin_id === c._id)
    return {
      id: c._id,
      user_id: c.user_id,
      nickname: nick(c.user_id),
      avatar: avatar(c.user_id),
      emoji: a?.emoji ?? '✅',
      text: a?.text ?? '',
      at: c.created_at,
      clock: clockCN(new Date(c.created_at)),
      date: c.date,
      extra: c.extra,
      verified_by: c.verified_by,
      reactions: Object.fromEntries(KINDS.map((k) => [k, rs.filter((r) => r.kind === k).length])),
      mine: rs.filter((r) => r.user_id === ctx.openid).map((r) => r.kind),
    }
  })

  // 我的
  const myDay = snap.days.get(dayId(teamId, ctx.openid, date))
  const myDays = await ctx.db.find<DayDoc>(COLL.days, { team_id: teamId, user_id: ctx.openid })
  const dayMap = new Map(myDays.map((d) => [d.date, d]))
  const grid = Array.from({ length: team.period_days }, (_, i) => {
    const d = addDays(team.start_date, i)
    const dd = dayMap.get(d)
    let state: 'before_join' | 'done' | 'unwell' | 'miss' | 'today' | 'future'
    if (d < me.joined_date) state = 'before_join'
    else if (d > date) state = 'future'
    else if (dd?.qualified) state = dd.mood === 'unwell' ? 'unwell' : 'done'
    else if (d === date) state = 'today'
    else state = 'miss'
    return { day_no: i + 1, date: d, state }
  })
  const myRank = ranking.find((r) => r.is_me)
  const myProgress = snap.progress.get(ctx.openid)

  // 今天的清单摘要
  const pd = plan.days.find((d) => d.date === date)
  const myToday = await ctx.db.find<CheckinDoc>(COLL.checkins, { team_id: teamId, user_id: ctx.openid, date })
  const doneIds = myToday.filter((c) => c.counted || c.extra).map((c) => c.action_id)
  const pick = pd ? byId.get(pd.pick_id) : undefined

  const mood = myDay?.mood ?? 'normal'
  const myCounted = myDay?.counted_count ?? 0
  const target = targetFor(mood)

  return {
    team: {
      id: team._id,
      name: team.name,
      theme: team.theme,
      taunt: team.taunt,
      period_days: team.period_days,
      day_no: dayNoOf(team, date),
      start_date: team.start_date,
      end_date: team.end_date,
      status: team.status,
      member_count: snap.members.length,
      team_streak: snap.teamStreak,
      team_streak_best: Math.max(team.team_streak_best, snap.teamStreak),
      is_captain: team.captain_id === ctx.openid,
    },
    today: {
      date,
      day_type: pd?.day_type ?? null,
      done: snap.today.done,
      total: snap.today.total,
      all: snap.today.all,
      members: todayMembers,
    },
    ranking,
    me: {
      rank: myRank?.rank ?? null,
      rate_pct: myRank?.rate_pct ?? 0,
      streak: myProgress?.live_streak ?? 0,
      streak_best: Math.max(me.streak_best, myProgress?.live_streak ?? 0),
      done_days: me.done_days + (myProgress?.pending_qualified ?? 0),
      counted_items: me.counted_items,
      counted_today: myCounted,
      target,
      qualified_today: snap.today.qualified.has(ctx.openid),
      mood,
      joined_date: me.joined_date,
      grid,
    },
    plan_today: pd
      ? {
          pick: pick ? { ...publicAction(pick), done: doneIds.includes(pick._id) } : null,
          done: doneIds.map((id) => byId.get(id)).filter(Boolean).map((a) => publicAction(a!)),
          left: Math.max(0, target - myCounted),
        }
      : null,
    feed,
    hook: hookText(snap.today, ctx.openid, snap.teamStreak, Math.max(0, target - myCounted)),
  }
}

function hookText(t: { done: number; total: number; all: boolean; qualified: Set<string> }, me: string, teamStreak: number, left: number): string {
  if (t.total === 0) return '这局已经打完了'
  if (t.all) return `全员到齐，全队连续 ${teamStreak} 天`
  const missing = t.total - t.done
  if (!t.qualified.has(me)) {
    if (missing === 1) return `全队就差你了，再做 ${left} 项`
    return `今天还差 ${left} 项，全队还差 ${missing} 人到齐`
  }
  return missing === 1 ? '就差 1 人全员到齐，去催一下' : `还差 ${missing} 人全员到齐`
}

/** 表情：点一下加，再点取消 */
export async function react(ctx: Ctx, payload: Record<string, unknown>) {
  const kind = payload.kind as ReactionKind
  if (!KINDS.includes(kind)) fail('BAD_INPUT', '表情不对')
  if (typeof payload.checkin_id !== 'string') fail('BAD_INPUT', '缺少动态')
  const c = await ctx.db.get<CheckinDoc>(COLL.checkins, payload.checkin_id as string)
  if (!c) fail('BAD_INPUT', '这条动态不存在')
  await requireMember(ctx, c!.team_id)
  const id = `${c!._id}_${ctx.openid}_${kind}`
  const existing = await ctx.db.get<ReactionDoc>(COLL.reactions, id)
  if (existing) {
    await ctx.db.remove(COLL.reactions, id)
    return { on: false }
  }
  await ctx.db.set(COLL.reactions, {
    _id: id,
    checkin_id: c!._id,
    team_id: c!.team_id,
    user_id: ctx.openid,
    kind,
    created_at: ctx.now.getTime(),
  })
  return { on: true }
}

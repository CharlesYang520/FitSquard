import type { Action, Mood, Verify } from '@core/types'
import { addDays, minutesCN, NEXT_MORNING_FROM, NEXT_MORNING_TO, windowState } from '@core/time'
import { canSetMood, dayQualified, evaluateCheckin, isLastOne, MAX_UNWELL_DAYS, targetFor, type CheckinLite } from '@core/scoring'
import { COLL, inc, type TxDb } from '../db'
import {
  dayNoOf,
  getPlan,
  getTeam,
  publicAction,
  requireMember,
  resolveTeamId,
  teamOpenOn,
  today as todayOf,
  yesterday as yesterdayOf,
  type Ctx,
} from '../context'
import { fail } from '../errors'
import { checkinId, dayId, type CheckinDoc, type DayDoc, type MemberDoc, type PlanDoc, type TeamDoc } from '../models'
import { teamSnapshot } from '../snapshot'

const MOODS: Mood[] = ['normal', 'busy', 'unwell']

function emptyDay(team: TeamDoc, openid: string, date: string, plan: PlanDoc): DayDoc {
  const pd = plan.days.find((d) => d.date === date)
  return {
    _id: dayId(team._id, openid, date),
    team_id: team._id,
    user_id: openid,
    date,
    day_type: pd?.day_type ?? 'workday',
    mood: 'normal',
    counted_count: 0,
    qualified: false,
    last_counted_at: null,
  }
}

/** 打卡页数据 */
export async function todayView(ctx: Ctx, payload: Record<string, unknown>) {
  const teamId = await resolveTeamId(ctx, payload.team_id)
  const [team, member, plan, actions] = await Promise.all([
    getTeam(ctx, teamId),
    requireMember(ctx, teamId),
    getPlan(ctx, teamId),
    ctx.getActions(),
  ])
  const byId = new Map(actions.map((a) => [a._id, a]))
  const date = todayOf(ctx)
  const yest = yesterdayOf(ctx)
  const inPeriod = teamOpenOn(team, date)

  const [mine, dayToday, dayYest] = await Promise.all([
    ctx.db.find<CheckinDoc>(COLL.checkins, { team_id: teamId, user_id: ctx.openid, date: [date, yest] }),
    ctx.db.get<DayDoc>(COLL.days, dayId(teamId, ctx.openid, date)),
    ctx.db.get<DayDoc>(COLL.days, dayId(teamId, ctx.openid, yest)),
  ])
  const ck = new Map(mine.map((c) => [`${c.date}_${c.action_id}`, c]))

  const itemView = (a: Action, d: string) => {
    const c = ck.get(`${d}_${a._id}`)
    const base = publicAction(a)
    if (c && (c.counted || c.extra)) return { ...base, state: 'done' as const, counted: c.counted, extra: c.extra, at: c.created_at }
    if (c) return { ...base, state: 'retry' as const, retry_at: (c.created_at as number) + 5 * 60 * 1000 }
    if (a.verify === 'werun') return { ...base, state: 'werun' as const }
    const w = windowState(a.window, d, ctx.now)
    if (w.open) return { ...base, state: 'open' as const }
    if (w.reason === 'not_yet') return { ...base, state: 'locked' as const, unlock_label: w.unlockLabel }
    if (w.reason === 'next_morning') return { ...base, state: 'locked' as const, unlock_label: '明早' }
    return { ...base, state: 'expired' as const }
  }

  const pd = plan.days.find((d) => d.date === date)
  const mood = dayToday?.mood ?? 'normal'
  const counted = dayToday?.counted_count ?? 0

  // 次日早上确认：昨天的 next_morning 项，今天 05:00–12:00 可补确认
  const mins = minutesCN(ctx.now)
  const pdY = plan.days.find((d) => d.date === yest)
  const canConfirmYest = !!pdY && member.joined_date <= yest && mins >= NEXT_MORNING_FROM && mins < NEXT_MORNING_TO
  const yesterdayConfirm = canConfirmYest
    ? pdY!.items
        .map((id) => byId.get(id)!)
        .filter((a) => a.window === 'next_morning')
        .map((a) => itemView(a, yest))
        .filter((v) => v.state === 'open')
    : []

  return {
    team: { id: team._id, name: team.name, period_days: team.period_days, day_no: dayNoOf(team, date), member_count: team.member_count },
    in_period: inPeriod && !!pd,
    date,
    day_type: pd?.day_type ?? null,
    recovery_day: pd?.recovery_day ?? false,
    mood,
    target: targetFor(mood),
    counted_count: counted,
    qualified: dayQualified(counted, mood),
    unwell_left: Math.max(0, MAX_UNWELL_DAYS - member.unwell_days_used + (mood === 'unwell' ? 1 : 0)),
    pick_id: pd?.pick_id ?? null,
    items: pd ? pd.items.map((id) => itemView(byId.get(id)!, date)) : [],
    yesterday: {
      date: yest,
      counted_count: dayYest?.counted_count ?? 0,
      qualified: !!dayYest?.qualified,
      confirm: yesterdayConfirm,
    },
  }
}

/** 设置今天状态 */
export async function setMood(ctx: Ctx, payload: Record<string, unknown>) {
  const to = payload.mood as Mood
  if (!MOODS.includes(to)) fail('BAD_INPUT', '状态不对')
  const teamId = await resolveTeamId(ctx, payload.team_id)
  const [team, , plan] = await Promise.all([getTeam(ctx, teamId), requireMember(ctx, teamId), getPlan(ctx, teamId)])
  const date = todayOf(ctx)
  if (!teamOpenOn(team, date)) fail('TEAM_ENDED', '这局已经结束了')

  return ctx.db.transaction(async (tx) => {
    const m = (await tx.get<MemberDoc>(COLL.members, `${teamId}_${ctx.openid}`))!
    const day = (await tx.get<DayDoc>(COLL.days, dayId(teamId, ctx.openid, date))) ?? emptyDay(team, ctx.openid, date, plan)
    const from = day.mood
    const usedExclToday = m.unwell_days_used - (from === 'unwell' ? 1 : 0)
    const ok = canSetMood({ from, to, countedCount: day.counted_count, unwellDaysUsed: usedExclToday })
    if (!ok.ok) {
      if (ok.reason === 'MOOD_LIMIT') fail('MOOD_LIMIT', `这局“不太舒服”的 ${MAX_UNWELL_DAYS} 天已经用完了`)
      fail('LOCKED', '今天已经按“不太舒服”打过卡了，明天再换')
    }
    const next: DayDoc = { ...day, mood: to, qualified: dayQualified(day.counted_count, to) }
    await tx.set(COLL.days, next)
    const delta = (to === 'unwell' ? 1 : 0) - (from === 'unwell' ? 1 : 0)
    if (delta) await tx.update(COLL.members, m._id, { unwell_days_used: inc(delta) })
    return {
      mood: to,
      target: targetFor(to),
      qualified: next.qualified,
      unwell_left: Math.max(0, MAX_UNWELL_DAYS - usedExclToday),
    }
  })
}

/** 事务内写入一次打卡；返回计入结果 */
async function writeCheckin(
  tx: TxDb,
  ctx: Ctx,
  p: { team: TeamDoc; plan: PlanDoc; date: string; action: Action; verifiedBy: Verify; ignoreCooldown?: boolean },
) {
  const { team, plan, date, action } = p
  const now = ctx.now.getTime()
  const id = checkinId(team._id, ctx.openid, date, action._id)
  const existing = await tx.get<CheckinDoc>(COLL.checkins, id)
  if (existing && (existing.counted || existing.extra)) fail('DUPLICATE', '这一项今天已经打过了')

  const day = (await tx.get<DayDoc>(COLL.days, dayId(team._id, ctx.openid, date))) ?? emptyDay(team, ctx.openid, date, plan)
  if (day.mood === 'unwell' && !action.recovery) fail('BAD_INPUT', '今天不太舒服，做恢复类的就好')

  const lite: CheckinLite[] = Array.from({ length: day.counted_count }, () => ({
    action_id: '',
    counted: true,
    created_at: p.ignoreCooldown ? -Infinity : (day.last_counted_at ?? -Infinity),
  }))
  const r = evaluateCheckin(lite, day.mood, now)
  const wasQualified = day.qualified

  const doc: CheckinDoc = {
    _id: id,
    team_id: team._id,
    user_id: ctx.openid,
    date,
    day_no: dayNoOf(team, date),
    action_id: action._id,
    mood: day.mood,
    verified_by: p.verifiedBy,
    counted: r.counted,
    extra: r.extra,
    created_at: now,
  }
  await tx.set(COLL.checkins, doc)

  let nextDay = day
  if (r.counted) {
    const cc = day.counted_count + 1
    nextDay = { ...day, counted_count: cc, qualified: dayQualified(cc, day.mood), last_counted_at: now }
    await tx.update(COLL.members, `${team._id}_${ctx.openid}`, { counted_items: inc(1) })
  }
  await tx.set(COLL.days, nextDay)

  return {
    counted: r.counted,
    extra: r.extra,
    retry_at: 'retryAt' in r ? r.retryAt : null,
    counted_count: nextDay.counted_count,
    target: targetFor(day.mood),
    qualified: nextDay.qualified,
    became_qualified: !wasQualified && nextDay.qualified,
  }
}

/** 达标反馈：连续达标、全队 N/M、我的排名、是否最后一人 */
async function feedback(ctx: Ctx, team: TeamDoc, date: string, becameQualified: boolean) {
  const snap = await teamSnapshot(ctx, team)
  const me = snap.ranking.find((r) => r.user_id === ctx.openid)
  const before = new Set([...snap.today.qualified].filter((id) => id !== ctx.openid))
  return {
    streak: snap.progress.get(ctx.openid)?.live_streak ?? 0,
    team_today: { done: snap.today.done, total: snap.today.total, all: snap.today.all },
    team_streak: snap.teamStreak,
    rank: me?.rank ?? null,
    rank_total: snap.ranking.length,
    is_last: becameQualified && date === snap.date && isLastOne(snap.today.expected, before, ctx.openid),
  }
}

/** 自报打卡 */
export async function submit(ctx: Ctx, payload: Record<string, unknown>) {
  const teamId = await resolveTeamId(ctx, payload.team_id)
  const actionId = payload.action_id
  if (typeof actionId !== 'string') fail('BAD_INPUT', '缺少行动')
  const [team, member, plan, actions] = await Promise.all([
    getTeam(ctx, teamId),
    requireMember(ctx, teamId),
    getPlan(ctx, teamId),
    ctx.getActions(),
  ])
  const today = todayOf(ctx)
  const date = typeof payload.date === 'string' ? payload.date : today
  if (date !== today && date !== addDays(today, -1)) fail('LOCKED', '只能打今天的卡')
  if (date < member.joined_date || date < team.start_date || date > team.end_date) fail('LOCKED', '这天不在你的挑战期内')
  if (date === today && !teamOpenOn(team, today)) fail('TEAM_ENDED', '这局已经结束了')

  const pd = plan.days.find((d) => d.date === date)
  if (!pd || !pd.items.includes(actionId as string)) fail('NOT_IN_PLAN', '这一项不在今天的清单里')
  const action = actions.find((a) => a._id === actionId)
  if (!action) fail('NOT_IN_PLAN', '这一项不在今天的清单里')
  if (action!.verify === 'werun') fail('BAD_INPUT', '步数项会根据微信运动自动打卡')
  const w = windowState(action!.window, date, ctx.now)
  if (!w.open) {
    const label = w.reason === 'not_yet' ? `${w.unlockLabel} 后再来` : w.reason === 'next_morning' ? '明早再来确认' : '已经过了可打卡时间'
    fail('LOCKED', label)
  }

  const res = await ctx.db.transaction((tx) =>
    writeCheckin(tx, ctx, { team, plan, date, action: action!, verifiedBy: 'self' }),
  )
  return { ...res, date, action_id: actionId, ...(await feedback(ctx, team, date, res.became_qualified)) }
}

/** 微信运动：云调用解密后的步数，达到阈值自动打卡 */
export async function werun(ctx: Ctx, payload: Record<string, unknown>) {
  const teamId = await resolveTeamId(ctx, payload.team_id)
  const [team, member, plan, actions] = await Promise.all([
    getTeam(ctx, teamId),
    requireMember(ctx, teamId),
    getPlan(ctx, teamId),
    ctx.getActions(),
  ])
  const date = todayOf(ctx)
  if (!teamOpenOn(team, date) || date < member.joined_date) fail('TEAM_ENDED', '这局已经结束了')
  const list = ctx.weRunSteps
  if (!Array.isArray(list)) fail('BAD_INPUT', '没有拿到微信运动数据')

  // stepInfoList 的 timestamp 是北京时间当天 0 点（秒）
  const todayStart = Date.parse(`${date}T00:00:00+08:00`) / 1000
  const steps = list!.find((s) => s.timestamp === todayStart)?.step ?? 0

  const pd = plan.days.find((d) => d.date === date)
  const items = (pd?.items ?? []).map((id) => actions.find((a) => a._id === id)!).filter((a) => a?.verify === 'werun')
  const results: Array<{ action_id: string; target: number; done: boolean; counted?: boolean }> = []
  let became = false
  for (const a of items) {
    const target = a.werun_steps ?? 0
    if (steps < target) {
      results.push({ action_id: a._id, target, done: false })
      continue
    }
    const r = await ctx.db
      .transaction((tx) => writeCheckin(tx, ctx, { team, plan, date, action: a, verifiedBy: 'werun', ignoreCooldown: true }))
      .catch((e) => {
        if (e?.code === 'DUPLICATE') return null
        throw e
      })
    if (r?.became_qualified) became = true
    results.push({ action_id: a._id, target, done: true, counted: r?.counted })
  }
  return { steps, items: results, ...(await feedback(ctx, team, date, became)) }
}

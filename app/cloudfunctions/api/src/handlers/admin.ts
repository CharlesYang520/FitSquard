// 运营后台接口：只对 ADMIN_OPENIDS 白名单开放
import type { Action } from '@core/types'
import { checkAction } from '@core/actionCheck'
import { funnel, northStar } from '@core/metrics'
import { generatePlan, pickRecommendation } from '@core/planGenerator'
import { mulberry32, newSeed } from '@core/random'
import { addDays, todayCN } from '@core/time'
import { COLL } from '../db'
import { dayNoOf, displayName, getTeam, isAdmin, publicAction, resetActionCache, SEED_ACTIONS, today, type Ctx } from '../context'
import { fail } from '../errors'
import type { DayDoc, MemberDoc, PlanDoc, ReportDoc, TeamDoc, UserDoc } from '../models'
import { teamSnapshot } from '../snapshot'

const SCAN_LIMIT = 1000

function requireAdmin(ctx: Ctx) {
  if (!isAdmin(ctx)) fail('FORBIDDEN', '没有后台权限')
}

export async function overview(ctx: Ctx) {
  requireAdmin(ctx)
  const date = today(ctx)
  const [users, teams, members, days, reports, events] = await Promise.all([
    ctx.db.find<UserDoc>(COLL.users, {}, { limit: SCAN_LIMIT }),
    ctx.db.find<TeamDoc>(COLL.teams, {}, { limit: SCAN_LIMIT }),
    ctx.db.find<MemberDoc>(COLL.members, {}, { limit: SCAN_LIMIT }),
    ctx.db.find<DayDoc>(COLL.days, {}, { limit: SCAN_LIMIT }),
    ctx.db.find<ReportDoc>(COLL.reports, {}, { limit: SCAN_LIMIT }),
    ctx.db.find<{ _id: string; name: string; user_id: string; date: string }>(COLL.events, {}, { limit: SCAN_LIMIT }),
  ])
  const truncated = [users, teams, members, days, reports, events].some((l) => l.length >= SCAN_LIMIT)
  const todayDays = days.filter((d) => d.date === date)
  return {
    date,
    truncated,
    stats: {
      users: users.filter((u) => !u.deleted_at).length,
      new_today: users.filter((u) => todayCN(new Date(u.created_at)) === date).length,
      active_teams: teams.filter((t) => t.status === 'active' && t.end_date >= date).length,
      checkin_today: todayDays.filter((d) => d.counted_count > 0).length,
      qualified_today: todayDays.filter((d) => d.qualified).length,
      north_star: northStar(days, date),
    },
    funnel: funnel(
      {
        users: users.map((u) => ({ id: u._id, created_at: u.created_at })),
        members: members.map((m) => ({ user_id: m.user_id, team_id: m.team_id, joined_date: m.joined_date })),
        days,
        reports: reports.map((r) => ({ team_id: r._id, end_date: r.team.end_date, members: r.members })),
        events,
      },
      date,
    ),
  }
}

export async function users(ctx: Ctx, payload: Record<string, unknown>) {
  requireAdmin(ctx)
  const q = typeof payload.q === 'string' ? payload.q.trim() : ''
  const all = await ctx.db.find<UserDoc>(COLL.users, {}, { orderBy: ['created_at', 'desc'], limit: SCAN_LIMIT })
  const hit = all.filter((u) => !q || u._id.startsWith(q) || (u.nickname ?? '').includes(q)).slice(0, 50)
  const teamIds = [...new Set(hit.map((u) => u.active_team_id).filter(Boolean))] as string[]
  const teams = teamIds.length ? await ctx.db.find<TeamDoc>(COLL.teams, { _id: teamIds }) : []
  const tMap = new Map(teams.map((t) => [t._id, t.name]))
  return hit.map((u) => ({
    id: u._id,
    nickname: displayName(u),
    created_at: u.created_at,
    team: u.active_team_id ? tMap.get(u.active_team_id) ?? '' : '',
    streak_days: u.streak_days,
    banned: !!u.banned_at,
    deleted: !!u.deleted_at,
  }))
}

export async function ban(ctx: Ctx, payload: Record<string, unknown>) {
  requireAdmin(ctx)
  const id = payload.user_id
  if (typeof id !== 'string' || !id) fail('BAD_INPUT', '缺少用户')
  if (id === ctx.openid) fail('BAD_INPUT', '不能封禁自己')
  const u = await ctx.db.get<UserDoc>(COLL.users, id as string)
  if (!u) fail('BAD_INPUT', '用户不存在')
  await ctx.db.update(COLL.users, id as string, { banned_at: payload.banned ? ctx.now.getTime() : null })
  return { banned: !!payload.banned }
}

export async function teams(ctx: Ctx, payload: Record<string, unknown>) {
  requireAdmin(ctx)
  const status = payload.status === 'ended' ? 'ended' : 'active'
  const list = await ctx.db.find<TeamDoc>(COLL.teams, { status }, { orderBy: ['created_at', 'desc'], limit: 50 })
  const capIds = [...new Set(list.map((t) => t.captain_id))]
  const caps = capIds.length ? await ctx.db.find<UserDoc>(COLL.users, { _id: capIds }) : []
  const cMap = new Map(caps.map((u) => [u._id, u]))
  const date = today(ctx)
  return list.map((t) => ({
    id: t._id,
    name: t.name,
    captain: displayName(cMap.get(t.captain_id)),
    member_count: t.member_count,
    day_no: dayNoOf(t, date),
    period_days: t.period_days,
    team_streak: t.team_streak,
    start_date: t.start_date,
    status: t.status,
  }))
}

export async function team(ctx: Ctx, payload: Record<string, unknown>) {
  requireAdmin(ctx)
  const t = await getTeam(ctx, payload.team_id)
  const [plan, actions] = await Promise.all([ctx.db.get<PlanDoc>(COLL.plans, t._id), ctx.getActions()])
  const byId = new Map(actions.map((a) => [a._id, a]))
  const snap = await teamSnapshot(ctx, t)
  const date = today(ctx)
  const dayView = (d: string) => {
    const pd = plan?.days.find((x) => x.date === d)
    if (!pd) return null
    return {
      date: d,
      day_no: pd.day_no,
      day_type: pd.day_type,
      recovery_day: pd.recovery_day,
      fallback: !!pd.fallback,
      pick_id: pd.pick_id,
      items: pd.items.map((id) => (byId.get(id) ? publicAction(byId.get(id)!) : { id, text: `（已删除模板 ${id}）`, emoji: '❔' })),
    }
  }
  return {
    team: {
      id: t._id,
      name: t.name,
      status: t.status,
      theme: t.theme,
      day_no: dayNoOf(t, date),
      period_days: t.period_days,
      start_date: t.start_date,
      end_date: t.end_date,
      team_streak: snap.teamStreak,
      generated_by: plan?.generated_by ?? 'rules',
      fallback_days: plan?.days.filter((d) => d.fallback).length ?? 0,
      replans: (plan?.replans as unknown[] | undefined)?.length ?? 0,
    },
    today: { done: snap.today.done, total: snap.today.total },
    members: snap.ranking.map((r) => ({
      user_id: r.user_id,
      nickname: displayName(snap.users.get(r.user_id)),
      rank: r.rank,
      rate_pct: Math.round(r.rate * 100),
      streak: r.streak,
      qualified_today: snap.today.qualified.has(r.user_id),
    })),
    plan_today: dayView(date),
    plan_tomorrow: dayView(addDays(date, 1)),
  }
}

/** 计划抽检与回退：明天起的清单重新生成（新种子）或回退到兜底；已过去和今天的不变 */
export async function replan(ctx: Ctx, payload: Record<string, unknown>) {
  requireAdmin(ctx)
  const mode = payload.mode
  if (mode !== 'reroll' && mode !== 'fallback') fail('BAD_INPUT', 'mode 只能是 reroll / fallback')
  const t = await getTeam(ctx, payload.team_id)
  if (t.status !== 'active') fail('TEAM_ENDED', '这局已经结束了')
  const plan = await ctx.db.get<PlanDoc>(COLL.plans, t._id)
  if (!plan) fail('INTERNAL', '清单不存在')
  const from = addDays(today(ctx), 1)
  const actions = await ctx.getActions()
  const byId = new Map(actions.map((a) => [a._id, a]))
  const seed = newSeed()
  const rng = mulberry32(seed)
  let replaced = 0
  let days = plan!.days
  if (mode === 'reroll') {
    const fresh = generatePlan({ theme: t.theme, periodDays: t.period_days, startDate: t.start_date, holidays: ctx.holidays, actions, seed, fallback: ctx.fallback })
    days = plan!.days.map((d) => {
      if (d.date < from) return d
      replaced++
      return fresh.days.find((x) => x.date === d.date) ?? d
    })
  } else {
    const fb = ctx.fallback[t.theme] ?? ctx.fallback.all
    days = plan!.days.map((d) => {
      if (d.date < from) return d
      replaced++
      const items = (d.recovery_day ? fb.recovery : fb[d.day_type]).slice()
      return { ...d, items, pick_id: pickRecommendation(items, byId, d.day_type, rng), fallback: true }
    })
  }
  const log = [...((plan!.replans as unknown[] | undefined) ?? []), { at: ctx.now.getTime(), by: ctx.openid, mode, from }]
  await ctx.db.update(COLL.plans, t._id, {
    days,
    version: (plan!.version ?? 1) + 1,
    generated_by: days.some((d) => d.fallback) ? 'fallback' : 'rules',
    replans: log,
  })
  return { replaced, from }
}

export async function actionsList(ctx: Ctx) {
  requireAdmin(ctx)
  const rows = (await ctx.db.find(COLL.actions, {}, { limit: SCAN_LIMIT })) as unknown as Action[]
  const list = rows.length ? rows : SEED_ACTIONS
  return { from_seed: rows.length === 0, items: [...list].sort((a, b) => a._id.localeCompare(b._id)) }
}

export async function saveAction(ctx: Ctx, payload: Record<string, unknown>) {
  requireAdmin(ctx)
  const a = payload.action as Action
  if (!a || typeof a !== 'object') fail('BAD_INPUT', '缺少模板')
  const existing = (await ctx.db.find(COLL.actions, {}, { limit: 1 })).length
  if (!existing) fail('LOCKED', '先点“导入种子模板”，再编辑')
  const errs = checkAction(a)
  if (errs.length) fail('BAD_INPUT', errs.join('；'))
  const clean: Action = {
    _id: a._id,
    group: a.group,
    day_type: a.day_type,
    recovery: a.recovery,
    minutes: a.minutes,
    scene: a.scene,
    intensity: a.intensity,
    verify: a.verify,
    ...(a.verify === 'werun' ? { werun_steps: Number(a.werun_steps) } : {}),
    window: a.window,
    emoji: a.emoji,
    text: a.text.trim(),
    ...(a.sub ? { sub: a.sub.trim() } : {}),
    reason: a.reason.trim(),
    themes: a.themes,
    status: a.status,
  }
  await ctx.db.set(COLL.actions, clean as unknown as { _id: string })
  resetActionCache()
  return clean
}

export async function importSeed(ctx: Ctx) {
  requireAdmin(ctx)
  const existing = await ctx.db.find(COLL.actions, {}, { limit: 1 })
  if (existing.length) fail('LOCKED', '云库已有模板，不重复导入')
  for (const a of SEED_ACTIONS) await ctx.db.set(COLL.actions, a as unknown as { _id: string })
  resetActionCache()
  return { imported: SEED_ACTIONS.length }
}

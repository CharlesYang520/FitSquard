import type { Theme } from '@core/types'
import { PERIODS, THEMES } from '@core/types'
import { generatePlan } from '@core/planGenerator'
import { newSeed } from '@core/random'
import { addDays } from '@core/time'
import { MAX_MEMBERS, TAUNTS, TEAM_NAME_MAX } from '@core/copy'
import { COLL, inc } from '../db'
import {
  activeTeamOf,
  dayNoOf,
  getTeam,
  publicAction,
  randomId,
  requireUser,
  teamOpenOn,
  today,
  type Ctx,
} from '../context'
import { fail } from '../errors'
import { memberId, type DayDoc, type MemberDoc, type PlanDoc, type TeamDoc, type UserDoc } from '../models'

function parseConfig(payload: Record<string, unknown>) {
  const theme = (payload.theme ?? 'all') as Theme
  const period = Number(payload.period_days ?? 14)
  if (!THEMES.includes(theme)) fail('BAD_INPUT', '主题不对')
  if (!(PERIODS as readonly number[]).includes(period)) fail('BAD_INPUT', '周期只能是 14 或 21 天')
  const seedIn = Number(payload.seed)
  const seed = Number.isInteger(seedIn) && seedIn > 0 ? seedIn : newSeed()
  return { theme, period, seed }
}

/** 开一局页的前 3 天预览（不落库） */
export async function preview(ctx: Ctx, payload: Record<string, unknown>) {
  const { theme, period, seed } = parseConfig(payload)
  const actions = await ctx.getActions()
  const byId = new Map(actions.map((a) => [a._id, a]))
  const plan = generatePlan({
    theme,
    periodDays: period,
    startDate: today(ctx),
    holidays: ctx.holidays,
    actions,
    seed,
    fallback: ctx.fallback,
    limitDays: 3,
  })
  return {
    seed,
    days: plan.days.map((d) => ({
      day_no: d.day_no,
      date: d.date,
      day_type: d.day_type,
      recovery_day: d.recovery_day,
      pick_id: d.pick_id,
      items: d.items.map((id) => publicAction(byId.get(id)!)),
    })),
  }
}

/** 开局：建局、加发起人、固化全周期清单、写 active_team_id（事务） */
export async function create(ctx: Ctx, payload: Record<string, unknown>) {
  const user = await requireUser(ctx)
  return createTeamCore(ctx, user, payload, null)
}

/** 开局核心；prevTeamId 非空 = 再来一局（事务内保证同一原局只开一次） */
async function createTeamCore(ctx: Ctx, user: UserDoc, payload: Record<string, unknown>, prevTeamId: string | null) {
  if (await activeTeamOf(ctx, user)) fail('ALREADY_IN_TEAM', '你已经在一支战队里了，这期结束再来')
  const { theme, period, seed } = parseConfig(payload)
  const rawName = typeof payload.name === 'string' ? payload.name.trim() : ''
  const name = (rawName || `${user.nickname || '我'}的战队`).slice(0, TEAM_NAME_MAX)
  const taunt = TAUNTS.includes(payload.taunt as (typeof TAUNTS)[number]) ? (payload.taunt as string) : TAUNTS[0]

  const start = today(ctx)
  const actions = await ctx.getActions()
  const plan = generatePlan({ theme, periodDays: period, startDate: start, holidays: ctx.holidays, actions, seed, fallback: ctx.fallback })
  const teamId = randomId(ctx)
  const now = ctx.now.getTime()

  const team: TeamDoc = {
    _id: teamId,
    name,
    captain_id: user._id,
    theme,
    period_days: period,
    start_date: start,
    end_date: addDays(start, period - 1),
    status: 'active',
    taunt,
    member_count: 1,
    team_streak: 0,
    team_streak_best: 0,
    last_settled_date: null,
    created_at: now,
    offline_note: typeof payload.offline_note === 'string' ? payload.offline_note.slice(0, NOTE_MAX) : '',
    prev_team_id: prevTeamId,
    next_team_id: null,
    all_done_dates: [],
    report_ready: false,
  }
  const member: MemberDoc = newMember(teamId, user._id, start)
  const planDoc: PlanDoc = { _id: teamId, theme, ...plan }

  await ctx.db.transaction(async (tx) => {
    const fresh = await tx.get<UserDoc>(COLL.users, user._id)
    if (fresh?.active_team_id) {
      const other = await tx.get<TeamDoc>(COLL.teams, fresh.active_team_id)
      if (other && teamOpenOn(other, start)) fail('ALREADY_IN_TEAM', '你已经在一支战队里了，这期结束再来')
    }
    if (prevTeamId) {
      const prev = await tx.get<TeamDoc>(COLL.teams, prevTeamId)
      if (prev?.next_team_id) fail('DUPLICATE', '已经有人开了下一局', { team_id: prev.next_team_id })
      await tx.update(COLL.teams, prevTeamId, { next_team_id: teamId })
    }
    await tx.set(COLL.teams, team)
    await tx.set(COLL.members, member)
    await tx.set(COLL.plans, planDoc)
    await tx.update(COLL.users, user._id, { active_team_id: teamId })
  })

  return { team_id: teamId, name, taunt, period_days: period, start_date: start }
}

export function newMember(teamId: string, userId: string, joinedDate: string): MemberDoc {
  return {
    _id: memberId(teamId, userId),
    team_id: teamId,
    user_id: userId,
    joined_date: joinedDate,
    left_date: null,
    unwell_days_used: 0,
    done_days: 0,
    counted_items: 0,
    streak_days: 0,
    streak_best: 0,
  }
}

/** 战书落地页：只返回公开字段 */
export async function publicInfo(ctx: Ctx, payload: Record<string, unknown>) {
  const team = await getTeam(ctx, payload.team_id)
  const date = today(ctx)
  const [captain, me, myMember, plan, qualifiedDays] = await Promise.all([
    ctx.db.get<UserDoc>(COLL.users, team.captain_id),
    ctx.db.get<UserDoc>(COLL.users, ctx.openid),
    ctx.db.get<MemberDoc>(COLL.members, memberId(team._id, ctx.openid)),
    ctx.db.get<PlanDoc>(COLL.plans, team._id),
    ctx.db.find<DayDoc>(COLL.days, { team_id: team._id, date, qualified: true }),
  ])
  const qualifiedUsers = qualifiedDays.length
    ? await ctx.db.find<UserDoc>(COLL.users, { _id: qualifiedDays.map((d) => d.user_id) })
    : []
  const actions = await ctx.getActions()
  const pd = plan?.days.find((d) => d.date === date)
  const pick = pd ? actions.find((a) => a._id === pd.pick_id) : undefined

  const ended = !teamOpenOn(team, date)
  const isMember = !!myMember && !myMember.left_date
  let inOtherTeam = false
  if (me && !isMember) {
    const other = await activeTeamOf(ctx, me)
    inOtherTeam = !!other && other._id !== team._id
  }

  return {
    team: {
      id: team._id,
      name: team.name,
      taunt: team.taunt,
      theme: team.theme,
      period_days: team.period_days,
      day_no: dayNoOf(team, date),
      member_count: team.member_count,
      team_streak: team.team_streak,
    },
    captain: { nickname: captain?.nickname ?? '', avatar: captain?.avatar ?? '' },
    today_qualified: qualifiedUsers.map((u) => ({ nickname: u.nickname, avatar: u.avatar })),
    pick: pick ? publicAction(pick) : null,
    state: ended ? 'ended' : isMember ? 'member' : team.member_count >= MAX_MEMBERS ? 'full' : inOtherTeam ? 'in_other' : 'open',
    logged_in: !!me,
  }
}

/** 加入：成员日序从今天起算（事务） */
export async function join(ctx: Ctx, payload: Record<string, unknown>) {
  const user = await requireUser(ctx)
  const team = await getTeam(ctx, payload.team_id)
  const date = today(ctx)
  if (!teamOpenOn(team, date)) fail('TEAM_ENDED', '这局已经结束了')

  const existing = await ctx.db.get<MemberDoc>(COLL.members, memberId(team._id, user._id))
  if (existing && !existing.left_date) return { team_id: team._id, joined_date: existing.joined_date, already: true }

  const current = await activeTeamOf(ctx, user)
  if (current && current._id !== team._id) fail('ALREADY_IN_TEAM', '你正在打另一局，打完再来')

  await ctx.db.transaction(async (tx) => {
    const t = await tx.get<TeamDoc>(COLL.teams, team._id)
    if (!t || !teamOpenOn(t, date)) fail('TEAM_ENDED', '这局已经结束了')
    if ((t as TeamDoc).member_count >= MAX_MEMBERS) fail('TEAM_FULL', '这队已经满 10 人了')
    const fresh = await tx.get<UserDoc>(COLL.users, user._id)
    if (fresh?.active_team_id && fresh.active_team_id !== team._id) {
      const other = await tx.get<TeamDoc>(COLL.teams, fresh.active_team_id)
      if (other && teamOpenOn(other, date)) fail('ALREADY_IN_TEAM', '你正在打另一局，打完再来')
    }
    await tx.set(COLL.members, newMember(team._id, user._id, date))
    await tx.update(COLL.teams, team._id, { member_count: inc(1) })
    await tx.update(COLL.users, user._id, { active_team_id: team._id })
  })

  return { team_id: team._id, joined_date: date, already: false }
}

/** 发战书前改狠话（只有发起人） */
export async function setTaunt(ctx: Ctx, payload: Record<string, unknown>) {
  const team = await getTeam(ctx, payload.team_id)
  if (team.captain_id !== ctx.openid) fail('NOT_MEMBER', '只有发起人能改战书')
  if (!TAUNTS.includes(payload.taunt as (typeof TAUNTS)[number])) fail('BAD_INPUT', '狠话不对')
  await ctx.db.update(COLL.teams, team._id, { taunt: payload.taunt })
  return { taunt: payload.taunt }
}

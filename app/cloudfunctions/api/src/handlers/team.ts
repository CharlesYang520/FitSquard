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
  displayName,
  getTeam,
  publicAction,
  randomId,
  requireUser,
  teamOpenOn,
  today,
  type Ctx,
} from '../context'
import { fail } from '../errors'
import { memberId, type DayDoc, type MemberDoc, type NudgeDoc, type PlanDoc, type TeamDoc, type UserDoc } from '../models'
import { notify, quotaOf } from '../notify'
import { teamSnapshot } from '../snapshot'

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

  // 埋点：战书打开（同人同局同日去重；只记已建档或未建档的 openid，不含任何个人资料）
  await ctx.db
    .set(COLL.events, { _id: `invite_open_${team._id}_${ctx.openid}_${date}`, name: 'invite_open', user_id: ctx.openid, team_id: team._id, date, ts: ctx.now.getTime() })
    .catch(() => undefined)

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
    captain: { nickname: captain?.deleted_at ? '已注销用户' : captain?.nickname ?? '', avatar: captain?.deleted_at ? '' : captain?.avatar ?? '' },
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

export const NOTE_MAX = 30
export const NUDGE_PER_DAY = 3

/** 线下约定（只有发起人；只在战报展示，平台不追踪执行） */
export async function setNote(ctx: Ctx, payload: Record<string, unknown>) {
  const team = await getTeam(ctx, payload.team_id)
  if (team.captain_id !== ctx.openid) fail('NOT_MEMBER', '只有发起人能改线下约定')
  const note = typeof payload.note === 'string' ? payload.note.trim() : ''
  if ([...note].length > NOTE_MAX) fail('BAD_INPUT', `最多 ${NOTE_MAX} 个字`)
  await ctx.db.update(COLL.teams, team._id, { offline_note: note })
  return { note }
}

/** 退出进行中的局：今天起不再计入应达标成员 */
export async function leaveTeam(ctx: Ctx, teamId: string) {
  const date = today(ctx)
  await ctx.db.transaction(async (tx) => {
    const m = await tx.get<MemberDoc>(COLL.members, memberId(teamId, ctx.openid))
    if (!m || m.left_date) fail('NOT_MEMBER', '你不在这支战队里')
    const t = await tx.get<TeamDoc>(COLL.teams, teamId)
    // 今天刚加入就退出：视为没加入过
    const leftDate = m!.joined_date >= date ? m!.joined_date : date
    await tx.update(COLL.members, m!._id, { left_date: leftDate })
    if (t) await tx.update(COLL.teams, teamId, { member_count: inc(-1) })
    const u = await tx.get<UserDoc>(COLL.users, ctx.openid)
    if (u?.active_team_id === teamId) await tx.update(COLL.users, ctx.openid, { active_team_id: null })
  })
}

export async function leave(ctx: Ctx, payload: Record<string, unknown>) {
  const team = await getTeam(ctx, payload.team_id)
  if (!teamOpenOn(team, today(ctx))) fail('TEAM_ENDED', '这局已经结束了')
  await leaveTeam(ctx, team._id)
  return { left: true }
}

/** 再来一局：原队名 + 原主题，周期默认 21 天；同一原局只开一次 */
export async function rematch(ctx: Ctx, payload: Record<string, unknown>) {
  const user = await requireUser(ctx)
  const prev = await getTeam(ctx, payload.team_id)
  const mine = await ctx.db.get<MemberDoc>(COLL.members, memberId(prev._id, ctx.openid))
  if (!mine) fail('NOT_MEMBER', '你不在这支战队里')
  if (teamOpenOn(prev, today(ctx))) fail('LOCKED', '这局还没结束')
  if (prev.next_team_id) return { team_id: prev.next_team_id, created: false }

  let created: Awaited<ReturnType<typeof createTeamCore>>
  try {
    created = await createTeamCore(
      ctx,
      user,
      {
        theme: prev.theme,
        period_days: payload.period_days ?? 21,
        name: prev.name,
        taunt: payload.taunt ?? '别说明天开始了，就今天',
        offline_note: prev.offline_note ?? '',
      },
      prev._id,
    )
  } catch (e) {
    const ex = (e as { code?: string; extra?: { team_id?: string } })
    if (ex.code === 'DUPLICATE' && ex.extra?.team_id) return { team_id: ex.extra.team_id, created: false }
    throw e
  }

  // 给原局其他成员发新战书（有额度才发）
  const others = (await ctx.db.find<MemberDoc>(COLL.members, { team_id: prev._id })).filter((m) => m.user_id !== ctx.openid)
  let notified = 0
  for (const m of others) {
    const r = await notify(
      ctx,
      m.user_id,
      'team',
      { title: `${user.nickname || '队友'}又下战书了`, content: `${created.name} 第二局，${created.period_days} 天`, note: '点开接下战书' },
      `/pages/invite/index?team=${created.team_id}`,
    )
    if (r === 'sent') notified++
  }
  return { ...created, created: true, notified }
}

async function nudgeContext(ctx: Ctx, payload: Record<string, unknown>) {
  const team = await getTeam(ctx, payload.team_id)
  const to = payload.to
  if (typeof to !== 'string' || !to) fail('BAD_INPUT', '要催谁？')
  if (to === ctx.openid) fail('BAD_INPUT', '不能催自己')
  const [me, target] = await Promise.all([
    ctx.db.get<MemberDoc>(COLL.members, memberId(team._id, ctx.openid)),
    ctx.db.get<MemberDoc>(COLL.members, memberId(team._id, to as string)),
  ])
  if (!me || me.left_date) fail('NOT_MEMBER', '你不在这支战队里')
  if (!target || target.left_date) fail('NOT_MEMBER', 'TA 不在这支战队里')
  const date = today(ctx)
  if (!teamOpenOn(team, date)) fail('TEAM_ENDED', '这局已经结束了')

  const snap = await teamSnapshot(ctx, team)
  if (snap.today.qualified.has(to as string)) fail('LOCKED', 'TA 今天已经达标了')

  const [mineToday, theirsToday, targetUser, meUser, plan, actions] = await Promise.all([
    ctx.db.find<NudgeDoc>(COLL.nudges, { team_id: team._id, from: ctx.openid, date }),
    ctx.db.find<NudgeDoc>(COLL.nudges, { to: to as string, date, via: 'notify' }),
    ctx.db.get<UserDoc>(COLL.users, to as string),
    ctx.db.get<UserDoc>(COLL.users, ctx.openid),
    ctx.db.get<PlanDoc>(COLL.plans, team._id),
    ctx.getActions(),
  ])
  const pd = plan?.days.find((d) => d.date === date)
  const pick = pd ? actions.find((a) => a._id === pd.pick_id) : undefined
  const canNotify = theirsToday.length === 0 && (await quotaOf(ctx, to as string, 'nudge')) > 0
  return {
    team,
    date,
    to: to as string,
    snap,
    mineToday,
    canNotify,
    targetName: displayName(targetUser),
    myName: displayName(meUser),
    pick,
  }
}

/** 催一下弹层数据：今日战况卡 + 能否直接通知 */
export async function nudgeInfo(ctx: Ctx, payload: Record<string, unknown>) {
  const c = await nudgeContext(ctx, payload)
  return {
    target: { user_id: c.to, nickname: c.targetName },
    can_notify: c.canNotify,
    left_today: Math.max(0, NUDGE_PER_DAY - c.mineToday.length),
    card: {
      team_name: c.team.name,
      day_no: dayNoOf(c.team, c.date),
      done: c.snap.today.done,
      total: c.snap.today.total,
      team_streak: c.snap.teamStreak,
      pick: c.pick ? `${c.pick.text} ${c.pick.emoji}` : '',
      members: c.snap.today.expected.map((id) => ({
        user_id: id,
        nickname: displayName(c.snap.users.get(id)),
        avatar: c.snap.users.get(id)?.avatar ?? '',
        qualified: c.snap.today.qualified.has(id),
      })),
    },
    share: nudgeShare(c),
  }
}

function nudgeShare(c: Awaited<ReturnType<typeof nudgeContext>>) {
  return {
    title: `@${c.targetName} 就差你了！${c.team.name} 今天 ${c.snap.today.done}/${c.snap.today.total}`,
    path: `/pages/invite/index?team=${c.team._id}`,
  }
}

/** 催一下：能通知就发服务通知，否则返回分享卡片 */
export async function nudge(ctx: Ctx, payload: Record<string, unknown>) {
  const c = await nudgeContext(ctx, payload)
  if (c.mineToday.length >= NUDGE_PER_DAY) fail('LOCKED', `今天已经催了 ${NUDGE_PER_DAY} 次，留点面子`)
  let via: 'notify' | 'share' = 'share'
  if (c.canNotify) {
    const r = await notify(
      ctx,
      c.to,
      'nudge',
      {
        title: `${c.myName}催你了`,
        content: `${c.snap.today.done}/${c.snap.today.total} 已经做完${c.pick ? ` · ${c.pick.text}` : ''}`,
        note: `全队连续 ${c.snap.teamStreak} 天，别断在你这`,
      },
      '/pages/checkin/index',
    )
    if (r === 'sent') via = 'notify'
  }
  const doc: NudgeDoc = {
    _id: `${c.team._id}_${c.date}_${ctx.openid}_${c.mineToday.length + 1}`,
    team_id: c.team._id,
    from: ctx.openid,
    to: c.to,
    date: c.date,
    via,
    created_at: ctx.now.getTime(),
  }
  await ctx.db.set(COLL.nudges, doc)
  return { via, left_today: NUDGE_PER_DAY - c.mineToday.length - 1, share: nudgeShare(c) }
}

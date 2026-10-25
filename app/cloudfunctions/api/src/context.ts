import type { Action, HolidayCalendar } from '@core/types'
import type { FallbackPlans } from '@core/planGenerator'
import { mergeCalendars } from '@core/dayType'
import { addDays, diffDays, todayCN } from '@core/time'
import seedActions from '@data/actions.seed.json'
import fallbackJson from '@data/fallbackPlans.json'
import cal2026 from '@data/holidays/2026.json'
import cal2027 from '@data/holidays/2027.json'
import { COLL, type Db } from './db'
import type { Notifier, TemplateConfig } from './notify'
import { fail } from './errors'
import { memberId, type MemberDoc, type PlanDoc, type TeamDoc, type UserDoc } from './models'

export interface WeRunStep {
  timestamp: number // 秒，北京时间当天 0 点
  step: number
}

export interface Ctx {
  db: Db
  openid: string
  now: Date
  holidays: HolidayCalendar
  fallback: FallbackPlans
  getActions(): Promise<Action[]>
  /** 云调用自动解密后的微信运动数据（event.weRunData.data.stepInfoList） */
  weRunSteps?: WeRunStep[]
  /** 生成随机数（测试可注入） */
  random?: () => number
  /** 订阅消息模板 ID（来自环境变量）与发送器；缺省 = 通知能力降级 */
  templates: TemplateConfig
  notifier?: Notifier
}

export const HOLIDAYS = mergeCalendars(cal2026, cal2027)
export const FALLBACK = fallbackJson as FallbackPlans
export const SEED_ACTIONS = seedActions as Action[]

const ACTION_TTL = 60 * 1000
let actionCache: { at: number; list: Action[] } | null = null

/** 读取模板库：云库 actions 集合为空时用内置种子（首次部署可直接跑） */
export async function loadActions(db: Db, now: number): Promise<Action[]> {
  if (actionCache && now - actionCache.at < ACTION_TTL) return actionCache.list
  const rows = (await db.find(COLL.actions, {})) as unknown as Action[]
  const list = rows.length ? rows : SEED_ACTIONS
  actionCache = { at: now, list }
  return list
}

export function resetActionCache() {
  actionCache = null
}

export function makeCtx(
  params: Omit<Ctx, 'holidays' | 'fallback' | 'getActions' | 'templates'> & Partial<Pick<Ctx, 'getActions' | 'templates'>>,
): Ctx {
  const { db, now } = params
  return {
    holidays: HOLIDAYS,
    fallback: FALLBACK,
    getActions: () => loadActions(db, now.getTime()),
    templates: {},
    ...params,
  }
}

/** 展示用昵称：注销用户统一显示“已注销用户” */
export const displayName = (u: UserDoc | null | undefined) => (u?.deleted_at ? '已注销用户' : u?.nickname || '队友')

export const today = (ctx: Ctx) => todayCN(ctx.now)
export const yesterday = (ctx: Ctx) => addDays(todayCN(ctx.now), -1)

export async function getUser(ctx: Ctx): Promise<UserDoc | null> {
  return ctx.db.get<UserDoc>(COLL.users, ctx.openid)
}

export async function requireUser(ctx: Ctx): Promise<UserDoc> {
  const u = await getUser(ctx)
  if (!u) fail('NOT_LOGGED_IN', '先登录')
  return u as UserDoc
}

/** 局在某天是否仍在进行（状态 active 且日期 ≤ 最后一天） */
export const teamOpenOn = (t: TeamDoc, date: string) => t.status === 'active' && date <= t.end_date

/** 用户当前进行中的局；已结束的会被顺手清掉 */
export async function activeTeamOf(ctx: Ctx, user: UserDoc): Promise<TeamDoc | null> {
  if (!user.active_team_id) return null
  const t = await ctx.db.get<TeamDoc>(COLL.teams, user.active_team_id)
  if (t && teamOpenOn(t, today(ctx))) return t
  await ctx.db.update(COLL.users, user._id, { active_team_id: null })
  return null
}

export async function getTeam(ctx: Ctx, teamId: unknown): Promise<TeamDoc> {
  if (typeof teamId !== 'string' || !teamId) fail('BAD_INPUT', '缺少战队')
  const t = await ctx.db.get<TeamDoc>(COLL.teams, teamId as string)
  if (!t) fail('BAD_INPUT', '战队不存在')
  return t as TeamDoc
}

export async function requireMember(ctx: Ctx, teamId: string): Promise<MemberDoc> {
  const m = await ctx.db.get<MemberDoc>(COLL.members, memberId(teamId, ctx.openid))
  if (!m || m.left_date) fail('NOT_MEMBER', '你还不是这支战队的成员')
  return m as MemberDoc
}

/** 解析 team_id：没传就用我当前的局 */
export async function resolveTeamId(ctx: Ctx, teamId: unknown): Promise<string> {
  if (typeof teamId === 'string' && teamId) return teamId
  const u = await requireUser(ctx)
  const t = await activeTeamOf(ctx, u)
  if (!t) fail('NOT_MEMBER', '你还没有进行中的战队')
  return (t as TeamDoc)._id
}

export async function getPlan(ctx: Ctx, teamId: string): Promise<PlanDoc> {
  const p = await ctx.db.get<PlanDoc>(COLL.plans, teamId)
  if (!p) fail('INTERNAL', '清单不存在')
  return p as PlanDoc
}

/** 第几天（从 1 开始），封顶在周期内 */
export function dayNoOf(t: TeamDoc, date: string): number {
  return Math.min(t.period_days, Math.max(1, diffDays(t.start_date, date) + 1))
}

export function randomId(ctx: Ctx, len = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  const r = ctx.random ?? Math.random
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(r() * chars.length)]
  return s
}

/** 只给前端看的模板字段 */
export function publicAction(a: Action) {
  return {
    id: a._id,
    group: a.group,
    emoji: a.emoji,
    text: a.text,
    sub: a.sub ?? '',
    reason: a.reason,
    minutes: a.minutes,
    recovery: a.recovery,
    verify: a.verify,
    werun_steps: a.werun_steps ?? 0,
    window: a.window,
    day_type: a.day_type,
  }
}
export type PublicAction = ReturnType<typeof publicAction>

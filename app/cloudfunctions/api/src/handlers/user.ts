import { COLL } from '../db'
import { activeTeamOf, dayNoOf, getUser, requireUser, today, type Ctx } from '../context'
import { fail } from '../errors'
import type { UserDoc, WeightDoc } from '../models'
import { grant as grantQuota } from '../notify'
import { leaveTeam } from './team'

const NICK_MAX = 20

function cleanProfile(p: Record<string, unknown>) {
  const out: Partial<Pick<UserDoc, 'nickname' | 'avatar'>> = {}
  if (typeof p.nickname === 'string') out.nickname = p.nickname.trim().slice(0, NICK_MAX)
  // 只接受云存储 fileID / https；本地演示模式下允许临时文件路径
  if (typeof p.avatar === 'string' && /^(cloud|https|wxfile|http:\/\/tmp)/.test(p.avatar)) out.avatar = p.avatar
  return out
}

/** 登录 / 建档。首次（或注销后）必须 agreed=true；之后可顺带更新昵称头像。 */
export async function login(ctx: Ctx, payload: Record<string, unknown>) {
  let user = await getUser(ctx)
  const profile = cleanProfile(payload)
  if (!user || user.deleted_at) {
    if (payload.agreed !== true) fail('BAD_INPUT', '先勾协议，再上秤')
    const base = {
      nickname: profile.nickname ?? '',
      avatar: profile.avatar ?? '',
      agreed_at: ctx.now.getTime(),
      active_team_id: null,
      deleted_at: null,
    }
    if (!user) {
      user = { _id: ctx.openid, streak_days: 0, streak_best: 0, created_at: ctx.now.getTime(), ...base }
      await ctx.db.set(COLL.users, user)
    } else {
      await ctx.db.update(COLL.users, user._id, base)
      user = { ...user, ...base }
    }
  } else if (Object.keys(profile).length) {
    await ctx.db.update(COLL.users, user._id, profile)
    user = { ...user, ...profile }
  }

  const team = await activeTeamOf(ctx, user)
  return {
    user: {
      id: user._id,
      nickname: user.nickname,
      avatar: user.avatar,
      streak_days: user.streak_days,
      streak_best: user.streak_best,
      weight_consented: !!user.health_consent_at,
    },
    team: team
      ? { id: team._id, name: team.name, period_days: team.period_days, day_no: dayNoOf(team, today(ctx)) }
      : null,
    /** 已配置的订阅模板（前端据此请求授权） */
    templates: ctx.templates,
  }
}

/** 订阅授权结果上报 */
export async function grant(ctx: Ctx, payload: Record<string, unknown>) {
  await requireUser(ctx)
  return grantQuota(ctx, ctx.openid, payload.accepted)
}

/** 注销：退出进行中的局，删除体重 / 身高 / 订阅额度，昵称头像置空；历史打卡保留为匿名 */
export async function deleteAccount(ctx: Ctx) {
  const user = await requireUser(ctx)
  const team = await activeTeamOf(ctx, user)
  if (team) await leaveTeam(ctx, team._id)
  const weights = await ctx.db.find<WeightDoc>(COLL.weights, { user_id: user._id })
  for (const w of weights) await ctx.db.remove(COLL.weights, w._id)
  await ctx.db.update(COLL.users, user._id, {
    nickname: '',
    avatar: '',
    sub_quota: {},
    height_cm: null,
    health_consent_at: null,
    active_team_id: null,
    deleted_at: ctx.now.getTime(),
  })
  // 成员记录里不存昵称，展示时统一显示“已注销用户”
  return { deleted: true }
}

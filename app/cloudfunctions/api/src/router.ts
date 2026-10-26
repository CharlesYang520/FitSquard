import type { Ctx } from './context'
import { COLL } from './db'
import type { UserDoc } from './models'
import { AppError } from './errors'
import { deleteAccount, grant, login } from './handlers/user'
import { create, join, leave, nudge, nudgeInfo, preview, publicInfo, rematch, setNote, setTaunt } from './handlers/team'
import { setMood, submit, todayView, werun } from './handlers/checkin'
import { home, react } from './handlers/home'
import * as report from './handlers/report'
import * as weight from './handlers/weight'
import { qrcode } from './handlers/poster'
import * as admin from './handlers/admin'

type Handler = (ctx: Ctx, payload: Record<string, unknown>) => Promise<unknown>

export const ROUTES: Record<string, Handler> = {
  'user.login': login,
  'user.delete': deleteAccount,
  'sub.grant': grant,
  'plan.preview': preview,
  'team.create': create,
  'team.publicInfo': publicInfo,
  'team.join': join,
  'team.setTaunt': setTaunt,
  'team.setNote': setNote,
  'team.leave': leave,
  'team.rematch': rematch,
  'team.nudgeInfo': nudgeInfo,
  'team.nudge': nudge,
  'team.home': home,
  'checkin.today': todayView,
  'checkin.setMood': setMood,
  'checkin.submit': submit,
  'checkin.werun': werun,
  'feed.react': react,
  'report.get': report.get,
  'report.list': report.list,
  'weight.consent': weight.consent,
  'weight.add': weight.add,
  'weight.list': weight.list,
  'poster.qrcode': qrcode,
  'admin.overview': admin.overview,
  'admin.users': admin.users,
  'admin.ban': admin.ban,
  'admin.teams': admin.teams,
  'admin.team': admin.team,
  'admin.replan': admin.replan,
  'admin.actions': admin.actionsList,
  'admin.saveAction': admin.saveAction,
  'admin.importSeed': admin.importSeed,
}

export type ApiResult = { ok: true; data: unknown } | { ok: false; code: string; message: string; extra?: unknown }

/** 被封禁用户也能调用的接口 */
const BAN_EXEMPT = new Set(['user.login', 'team.publicInfo'])

export async function dispatch(ctx: Ctx, action: unknown, payload: unknown): Promise<ApiResult> {
  const h = typeof action === 'string' ? ROUTES[action] : undefined
  if (!h) return { ok: false, code: 'BAD_INPUT', message: `未知接口：${String(action)}` }
  try {
    if (!BAN_EXEMPT.has(action as string)) {
      const u = await ctx.db.get<UserDoc>(COLL.users, ctx.openid)
      if (u?.banned_at) return { ok: false, code: 'BANNED', message: '账号已被限制使用，如有疑问请联系客服' }
    }
    const data = await h(ctx, payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {})
    return { ok: true, data }
  } catch (e) {
    if (e instanceof AppError || (e as AppError)?.code) {
      const ae = e as AppError
      return { ok: false, code: ae.code, message: ae.message, ...(ae.extra ? { extra: ae.extra } : {}) }
    }
    console.error('[api]', action, e)
    return { ok: false, code: 'INTERNAL', message: '服务开小差了，再试一次' }
  }
}

import type { Ctx } from './context'
import { AppError } from './errors'
import { login } from './handlers/user'
import { create, join, preview, publicInfo, setTaunt } from './handlers/team'
import { setMood, submit, todayView, werun } from './handlers/checkin'
import { home, react } from './handlers/home'

type Handler = (ctx: Ctx, payload: Record<string, unknown>) => Promise<unknown>

export const ROUTES: Record<string, Handler> = {
  'user.login': login,
  'plan.preview': preview,
  'team.create': create,
  'team.publicInfo': publicInfo,
  'team.join': join,
  'team.setTaunt': setTaunt,
  'team.home': home,
  'checkin.today': todayView,
  'checkin.setMood': setMood,
  'checkin.submit': submit,
  'checkin.werun': werun,
  'feed.react': react,
}

export type ApiResult = { ok: true; data: unknown } | { ok: false; code: string; message: string; extra?: unknown }

export async function dispatch(ctx: Ctx, action: unknown, payload: unknown): Promise<ApiResult> {
  const h = typeof action === 'string' ? ROUTES[action] : undefined
  if (!h) return { ok: false, code: 'BAD_INPUT', message: `未知接口：${String(action)}` }
  try {
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

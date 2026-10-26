// 海报用小程序码：云端调用 wxacode.getUnlimited 并缓存到云存储；本地演示 / 未开通时返回 null，前端画占位
import { getTeam, requireUser, type Ctx } from '../context'

export async function qrcode(ctx: Ctx, payload: Record<string, unknown>) {
  await requireUser(ctx)
  const team = await getTeam(ctx, payload.team_id)
  if (!ctx.qrcode) return { url: null }
  try {
    return { url: await ctx.qrcode(`team=${team._id}`, 'pages/invite/index') }
  } catch (e) {
    console.warn('[poster] qrcode fail', e)
    return { url: null }
  }
}

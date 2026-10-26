// 私密体重：只按 ctx.openid 读写自己的数据；其他任何接口都不读取这里的数据
import { COLL } from '../db'
import { requireUser, today, type Ctx } from '../context'
import { fail } from '../errors'
import type { WeightDoc } from '../models'
import { addDays } from '@core/time'

const KG_MIN = 30
const KG_MAX = 250
const CM_MIN = 100
const CM_MAX = 230
const LIST_LIMIT = 30

const round1 = (n: number) => Math.round(n * 10) / 10

/** 同意（带身高）或撤回（删除全部身高体重） */
export async function consent(ctx: Ctx, payload: Record<string, unknown>) {
  const user = await requireUser(ctx)
  if (payload.agree === true) {
    const h = Number(payload.height_cm)
    if (!Number.isFinite(h) || h < CM_MIN || h > CM_MAX) fail('BAD_INPUT', `身高填 ${CM_MIN}–${CM_MAX} cm`)
    await ctx.db.update(COLL.users, user._id, { height_cm: Math.round(h), health_consent_at: ctx.now.getTime() })
    return { consented: true }
  }
  const rows = await ctx.db.find<WeightDoc>(COLL.weights, { user_id: user._id })
  for (const w of rows) await ctx.db.remove(COLL.weights, w._id)
  await ctx.db.update(COLL.users, user._id, { height_cm: null, health_consent_at: null })
  return { consented: false, deleted: rows.length }
}

/** 记一条；同一天再记覆盖 */
export async function add(ctx: Ctx, payload: Record<string, unknown>) {
  const user = await requireUser(ctx)
  if (!user.health_consent_at) fail('LOCKED', '先勾选同意，才能记体重')
  const kg = Number(payload.weight_kg)
  if (!Number.isFinite(kg) || kg < KG_MIN || kg > KG_MAX) fail('BAD_INPUT', `体重填 ${KG_MIN}–${KG_MAX} kg`)
  const t = today(ctx)
  const date = typeof payload.date === 'string' ? payload.date : t
  if (date > t || date < addDays(t, -30)) fail('BAD_INPUT', '只能记最近 30 天的')
  const doc: WeightDoc = { _id: `${user._id}_${date}`, user_id: user._id, date, weight_kg: round1(kg), created_at: ctx.now.getTime() }
  await ctx.db.set(COLL.weights, doc)
  return { date, weight_kg: doc.weight_kg }
}

export async function list(ctx: Ctx) {
  const user = await requireUser(ctx)
  const rows = await ctx.db.find<WeightDoc>(COLL.weights, { user_id: user._id }, { orderBy: ['date', 'desc'], limit: LIST_LIMIT })
  return {
    consented: !!user.health_consent_at,
    height_cm: user.height_cm ?? null,
    items: rows.reverse().map((w) => ({ date: w.date, weight_kg: w.weight_kg })),
  }
}

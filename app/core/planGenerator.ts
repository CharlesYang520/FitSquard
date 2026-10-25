// 每日 9 项清单生成（规则引擎，D2：不用大模型）
import type { Action, DayType, Group, HolidayCalendar, Plan, PlanDay, Theme } from './types'
import { addDays } from './time'
import { dayType } from './dayType'
import { mulberry32, weightedIndex, type Rng } from './random'

export const PLAN_VERSION = 1
export const ITEMS_PER_DAY = 9
export const GROUPS: Group[] = ['move', 'food', 'rest']

/** 硬约束 */
export const RULES = {
  shortMinutes: 5, // “很忙”只显示 ≤ 5 分钟的项
  minShort: 4,
  minAnyWindow: 2,
  minRecovery: 2, // 保证“不太舒服”时至少有 2 项可选
  minRecoveryOnRecoveryDay: 4,
  maxWerun: 1,
  recoveryEvery: 7, // 第 7、14、21 天是恢复日
}

/** 同一模板一局内的最多出现次数：从严到松逐级放宽（始终不与前一天重复） */
export const USE_LIMIT_TIERS = [2, 3, Infinity]
const TRIES_PER_TIER = 6

export interface FallbackPlans {
  [theme: string]: { workday: string[]; holiday: string[]; recovery: string[] }
}

export interface GenerateInput {
  theme: Theme
  periodDays: number
  startDate: string
  holidays: HolidayCalendar
  actions: Action[]
  seed: number
  fallback: FallbackPlans
  /** 只生成前 N 天（预览用），默认全周期 */
  limitDays?: number
}

export const isRecoveryDay = (dayNo: number) => dayNo % RULES.recoveryEvery === 0

const fitsDayType = (a: Action, dt: DayType) => a.day_type === dt || a.day_type === 'any'

/** 可作为“AI 推荐”的项：自报的动一动项，5–30 分钟 */
export const isPickable = (a: Action) => a.group === 'move' && a.verify === 'self' && a.minutes >= 5 && a.minutes <= 30

/** 检查一天的清单是否满足硬约束；返回违反项（空数组 = 合格） */
export function checkDay(items: string[], byId: Map<string, Action>, dt: DayType, recoveryDay: boolean): string[] {
  const errs: string[] = []
  const acts = items.map((id) => byId.get(id))
  if (items.length !== ITEMS_PER_DAY) errs.push(`数量 ${items.length}`)
  if (new Set(items).size !== items.length) errs.push('有重复项')
  if (acts.some((a) => !a)) return [...errs, '有不存在的模板']
  const list = acts as Action[]
  if (list.some((a) => a.status !== 'on')) errs.push('含下线模板')
  if (list.some((a) => !fitsDayType(a, dt))) errs.push('日期类型不符')
  for (const g of GROUPS) if (!list.some((a) => a.group === g)) errs.push(`缺少分组 ${g}`)
  if (list.filter((a) => a.minutes <= RULES.shortMinutes).length < RULES.minShort) errs.push('短时项不足')
  if (list.filter((a) => a.window === 'any').length < RULES.minAnyWindow) errs.push('随时可做项不足')
  const minRec = recoveryDay ? RULES.minRecoveryOnRecoveryDay : RULES.minRecovery
  if (list.filter((a) => a.recovery).length < minRec) errs.push('恢复类不足')
  if (list.filter((a) => a.verify === 'werun').length > RULES.maxWerun) errs.push('步数项过多')
  if (!list.some(isPickable)) errs.push('没有可推荐的动一动项')
  return errs
}

/** 推荐项：当天类型侧重的、5–30 分钟、自报的动一动项；没有则取第 1 项 */
export function pickRecommendation(items: string[], byId: Map<string, Action>, dt: DayType, rng: Rng): string {
  const cands = items.map((id) => byId.get(id)!).filter(isPickable)
  if (cands.length === 0) return items[0]
  const i = weightedIndex(cands.map((a) => (a.day_type === dt ? 3 : 1)), rng)
  return cands[i]._id
}

function weightOf(a: Action, dt: DayType, theme: Theme): number {
  let w = a.day_type === dt ? 3 : 1
  if (theme !== 'all' && a.themes.includes(theme)) w *= 2
  return w
}

/** 从候选里按权重挑 1 个满足 pred 的，放入 picked；成功返回 true */
function take(cands: Action[], picked: Action[], pred: (a: Action) => boolean, dt: DayType, theme: Theme, rng: Rng): boolean {
  const pickedIds = new Set(picked.map((a) => a._id))
  const werunUsed = picked.some((a) => a.verify === 'werun')
  const pool = cands.filter((a) => !pickedIds.has(a._id) && pred(a) && !(werunUsed && a.verify === 'werun'))
  const i = weightedIndex(pool.map((a) => weightOf(a, dt, theme)), rng)
  if (i < 0) return false
  picked.push(pool[i])
  return true
}

function buildDay(cands: Action[], dt: DayType, recoveryDay: boolean, theme: Theme, rng: Rng): Action[] | null {
  const picked: Action[] = []
  const count = (p: (a: Action) => boolean) => picked.filter(p).length
  const need = (p: (a: Action) => boolean, n: number) => {
    while (count(p) < n) if (!take(cands, picked, p, dt, theme, rng)) return false
    return true
  }
  const minRec = recoveryDay ? RULES.minRecoveryOnRecoveryDay : RULES.minRecovery
  if (!need((a) => a.recovery, minRec)) return null
  if (!need(isPickable, 1)) return null
  for (const g of GROUPS) if (!need((a) => a.group === g, 1)) return null
  if (!need((a) => a.minutes <= RULES.shortMinutes, RULES.minShort)) return null
  if (!need((a) => a.window === 'any', RULES.minAnyWindow)) return null
  while (picked.length < ITEMS_PER_DAY) if (!take(cands, picked, () => true, dt, theme, rng)) return null
  return picked
}

const GROUP_ORDER: Record<Group, number> = { move: 0, food: 1, rest: 2 }

/** 生成全周期清单。同样的输入（含 seed）输出完全一致。 */
export function generatePlan(input: GenerateInput): Plan {
  const { theme, periodDays, startDate, holidays, actions, seed, fallback } = input
  const rng = mulberry32(seed)
  const online = actions.filter((a) => a.status === 'on')
  const byId = new Map(actions.map((a) => [a._id, a]))
  const used = new Map<string, number>()
  let prev = new Set<string>()
  let anyFallback = false
  const days: PlanDay[] = []
  const total = Math.min(periodDays, input.limitDays ?? periodDays)

  for (let dayNo = 1; dayNo <= total; dayNo++) {
    const date = addDays(startDate, dayNo - 1)
    const dt = dayType(date, holidays)
    const recoveryDay = isRecoveryDay(dayNo)
    let chosen: Action[] | null = null

    for (const limit of USE_LIMIT_TIERS) {
      const cands = online.filter((a) => fitsDayType(a, dt) && !prev.has(a._id) && (used.get(a._id) ?? 0) < limit)
      for (let t = 0; t < TRIES_PER_TIER && !chosen; t++) chosen = buildDay(cands, dt, recoveryDay, theme, rng)
      if (chosen) break
    }

    let items: string[]
    let isFallback = false
    if (chosen) {
      items = chosen
        .slice()
        .sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group])
        .map((a) => a._id)
    } else {
      const fb = fallback[theme] ?? fallback.all
      items = (recoveryDay ? fb.recovery : fb[dt]).slice()
      isFallback = true
      anyFallback = true
    }

    for (const id of items) used.set(id, (used.get(id) ?? 0) + 1)
    prev = new Set(items)
    days.push({
      day_no: dayNo,
      date,
      day_type: dt,
      recovery_day: recoveryDay,
      items,
      pick_id: pickRecommendation(items, byId, dt, rng),
      ...(isFallback ? { fallback: true } : {}),
    })
  }

  return { version: PLAN_VERSION, seed, generated_by: anyFallback ? 'fallback' : 'rules', days }
}

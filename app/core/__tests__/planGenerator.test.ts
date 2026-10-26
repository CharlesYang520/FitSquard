import { describe, expect, it } from 'vitest'
import type { Action, Theme } from '../types'
import { THEMES } from '../types'
import { checkDay, generatePlan, GROUPS, isRecoveryDay, type FallbackPlans } from '../planGenerator'
import { mergeCalendars } from '../dayType'
import { diffDays } from '../time'
import seed from '../../data/actions.seed.json'
import fallbackJson from '../../data/fallbackPlans.json'
import cal2026 from '../../data/holidays/2026.json'
import cal2027 from '../../data/holidays/2027.json'

const actions = seed as Action[]
const fallback = fallbackJson as FallbackPlans
const holidays = mergeCalendars(cal2026, cal2027)
const byId = new Map(actions.map((a) => [a._id, a]))

describe('种子模板库', () => {
  it('不少于 60 条，id 唯一，字段合法', () => {
    expect(actions.length).toBeGreaterThanOrEqual(60)
    expect(new Set(actions.map((a) => a._id)).size).toBe(actions.length)
    for (const a of actions) {
      expect(GROUPS).toContain(a.group)
      expect(['workday', 'holiday', 'any', 'festival']).toContain(a.day_type)
      expect(a.text.length).toBeGreaterThan(0)
      expect(a.reason.length).toBeGreaterThan(0)
      if (a.verify === 'werun') expect(a.werun_steps).toBeGreaterThan(0)
      for (const t of a.themes) expect(THEMES).toContain(t)
    }
  })

  it('三组 × 工作日 / 休息日都有专属模板', () => {
    for (const g of GROUPS) {
      expect(actions.some((a) => a.group === g && a.day_type === 'workday')).toBe(true)
      expect(actions.some((a) => a.group === g && a.day_type === 'holiday')).toBe(true)
    }
    expect(actions.some((a) => a.recovery)).toBe(true)
    expect(actions.some((a) => a.verify === 'werun')).toBe(true)
    for (const w of ['any', 'after_lunch', 'after_dinner', 'after_20', 'after_21', 'next_morning']) {
      expect(actions.some((a) => a.window === w)).toBe(true)
    }
  })

  it('兜底清单都满足硬约束', () => {
    for (const theme of THEMES) {
      const fb = fallback[theme]
      expect(checkDay(fb.workday, byId, 'workday', false)).toEqual([])
      expect(checkDay(fb.holiday, byId, 'holiday', false)).toEqual([])
      expect(checkDay(fb.recovery, byId, 'workday', true)).toEqual([])
      expect(checkDay(fb.recovery, byId, 'holiday', true)).toEqual([])
    }
  })
})

describe('generatePlan', () => {
  const base = { holidays, actions, fallback }

  it('200 个随机 seed × 主题 × 周期：每天都满足硬约束、相邻天不重复', () => {
    let fallbackDays = 0
    for (let s = 1; s <= 200; s++) {
      const theme = THEMES[s % 4] as Theme
      const periodDays = s % 2 ? 14 : 21
      const startDate = `2026-${String((s % 12) + 1).padStart(2, '0')}-${String((s % 27) + 1).padStart(2, '0')}`
      const plan = generatePlan({ ...base, theme, periodDays, startDate, seed: s * 7919 })
      expect(plan.days).toHaveLength(periodDays)
      plan.days.forEach((d, i) => {
        expect(d.day_no).toBe(i + 1)
        expect(diffDays(startDate, d.date)).toBe(i)
        expect(checkDay(d.items, byId, d.day_type, d.recovery_day), `seed ${s} day ${d.day_no}`).toEqual([])
        expect(d.items).toContain(d.pick_id)
        if (d.fallback) fallbackDays++
        if (i > 0 && !d.fallback && !plan.days[i - 1].fallback) {
          const prev = new Set(plan.days[i - 1].items)
          expect(d.items.some((id) => prev.has(id)), `seed ${s} day ${d.day_no} 与前一天重复`).toBe(false)
        }
      })
    }
    // 种子库下规则生成应基本不触发兜底
    expect(fallbackDays).toBe(0)
  })

  it('同 seed 结果完全一致，换 seed 结果不同', () => {
    const input = { ...base, theme: 'all' as Theme, periodDays: 14, startDate: '2026-10-19', seed: 42 }
    expect(generatePlan(input)).toEqual(generatePlan(input))
    expect(generatePlan({ ...input, seed: 43 }).days[0].items).not.toEqual(generatePlan(input).days[0].items)
  })

  it('第 7、14、21 天是恢复日', () => {
    const plan = generatePlan({ ...base, theme: 'all', periodDays: 21, startDate: '2026-10-19', seed: 9 })
    expect(plan.days.filter((d) => d.recovery_day).map((d) => d.day_no)).toEqual([7, 14, 21])
    expect(isRecoveryDay(7)).toBe(true)
    for (const d of plan.days.filter((x) => x.recovery_day)) {
      expect(d.items.filter((id) => byId.get(id)!.recovery).length).toBeGreaterThanOrEqual(4)
    }
  })

  it('工作日 / 休息日只用对应类型或通用模板（含调休补班）', () => {
    // 2026-10-10 周六补班
    const plan = generatePlan({ ...base, theme: 'all', periodDays: 14, startDate: '2026-10-05', seed: 5 })
    const d10 = plan.days.find((d) => d.date === '2026-10-10')!
    expect(d10.day_type).toBe('workday')
    expect(d10.items.every((id) => ['workday', 'any'].includes(byId.get(id)!.day_type))).toBe(true)
    const d05 = plan.days.find((d) => d.date === '2026-10-05')!
    expect(d05.day_type).toBe('holiday')
  })

  it('推荐项优先是 5–30 分钟的自报动一动项', () => {
    const plan = generatePlan({ ...base, theme: 'walk', periodDays: 21, startDate: '2026-10-19', seed: 77 })
    for (const d of plan.days) {
      const a = byId.get(d.pick_id)!
      expect(a.group).toBe('move')
      expect(a.minutes).toBeGreaterThanOrEqual(5)
      expect(a.minutes).toBeLessThanOrEqual(30)
      expect(a.verify).toBe('self')
    }
  })

  it('主题会提高对应模板的出现比例', () => {
    const share = (theme: Theme) => {
      let hit = 0
      let all = 0
      for (let s = 1; s <= 40; s++) {
        const plan = generatePlan({ ...base, theme, periodDays: 14, startDate: '2026-11-02', seed: s })
        for (const d of plan.days) for (const id of d.items) {
          all++
          if (byId.get(id)!.themes.includes('eat')) hit++
        }
      }
      return hit / all
    }
    expect(share('eat')).toBeGreaterThan(share('all'))
  })

  it('只用上线模板；模板不够时走兜底并标记', () => {
    const tiny = actions.map((a) => (['m01', 'f02', 'r04'].includes(a._id) ? a : { ...a, status: 'off' as const }))
    const plan = generatePlan({ ...base, actions: tiny, theme: 'eat', periodDays: 14, startDate: '2026-10-19', seed: 1 })
    expect(plan.generated_by).toBe('fallback')
    expect(plan.days.every((d) => d.fallback)).toBe(true)
    expect(plan.days[0].items).toEqual(fallback.eat[plan.days[0].day_type])
    expect(plan.days[6].items).toEqual(fallback.eat.recovery)

    const normal = generatePlan({ ...base, theme: 'all', periodDays: 14, startDate: '2026-10-19', seed: 3 })
    const off = actions.filter((a) => a.status !== 'on').map((a) => a._id)
    expect(normal.generated_by).toBe('rules')
    for (const d of normal.days) expect(d.items.some((id) => off.includes(id))).toBe(false)
  })

  it('limitDays 只生成前 N 天（预览）', () => {
    const plan = generatePlan({ ...base, theme: 'all', periodDays: 21, startDate: '2026-10-24', seed: 8, limitDays: 3 })
    expect(plan.days).toHaveLength(3)
  })
})

describe('模板校验', async () => {
  const { checkAction } = await import('../actionCheck')
  it('种子模板全部通过校验（含敏感词）', () => {
    for (const a of actions) expect(checkAction(a), a._id).toEqual([])
  })
  it('敏感词与字段错误被拦下', () => {
    const base = actions[0]
    expect(checkAction({ ...base, text: '今天少吃 300 大卡' }).join()).toContain('敏感词')
    expect(checkAction({ ...base, reason: '一周瘦 2 斤' }).join()).toContain('敏感词')
    expect(checkAction({ ...base, minutes: 90 }).join()).toContain('时长')
    expect(checkAction({ ...base, group: 'xx' as any }).join()).toContain('group')
    expect(checkAction({ ...base, verify: 'werun', werun_steps: 0 }).join()).toContain('步数')
  })
})

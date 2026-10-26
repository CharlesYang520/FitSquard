// 第 4 步集成测试：管理员权限、封禁、战书打开埋点、概览指标、计划回退、模板库
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays } from '@core/time'
import { MemoryDb } from '../src/db.memory'
import { makeCtx, resetActionCache, SEED_ACTIONS } from '../src/context'
import { dispatch, type ApiResult } from '../src/router'
import type { PlanDoc } from '../src/models'

const D1 = '2026-10-17'
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+08:00`)
let db: MemoryDb
let seq = 0

async function call(openid: string, now: Date, action: string, payload: Record<string, unknown> = {}) {
  const ctx = makeCtx({ db, openid, now, adminIds: ['ADMIN'], random: () => ((seq = (seq * 9301 + 49297) % 233280) / 233280) })
  return dispatch(ctx, action, payload)
}
const ok = <T = any>(r: ApiResult): T => {
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`)
  return r.data as T
}
const err = (r: ApiResult) => (r.ok ? 'OK' : r.code)

beforeEach(() => {
  db = new MemoryDb()
  seq = 5
  resetActionCache()
})

async function setup() {
  const t0 = at(D1, '09:00')
  for (const id of ['ADMIN', 'A', 'B']) ok(await call(id, t0, 'user.login', { agreed: true, nickname: id }))
  const T = ok(await call('A', t0, 'team.create', { seed: 7 })).team_id as string
  return { T, t0 }
}

describe('后台权限与封禁', () => {
  it('只有白名单能调 admin.*；登录返回 is_admin', async () => {
    const { t0 } = await setup()
    expect(ok(await call('ADMIN', t0, 'user.login')).user.is_admin).toBe(true)
    expect(ok(await call('A', t0, 'user.login')).user.is_admin).toBe(false)
    for (const a of ['admin.overview', 'admin.users', 'admin.teams', 'admin.actions', 'admin.importSeed']) {
      expect(err(await call('A', t0, a)), a).toBe('FORBIDDEN')
    }
  })

  it('封禁后除登录 / 战书外都被拒；解封恢复', async () => {
    const { T, t0 } = await setup()
    ok(await call('ADMIN', t0, 'admin.ban', { user_id: 'B', banned: true }))
    expect(err(await call('B', t0, 'team.join', { team_id: T }))).toBe('BANNED')
    expect(ok(await call('B', t0, 'user.login')).user.banned).toBe(true)
    ok(await call('B', t0, 'team.publicInfo', { team_id: T }))
    expect(err(await call('ADMIN', t0, 'admin.ban', { user_id: 'ADMIN', banned: true }))).toBe('BAD_INPUT')
    ok(await call('ADMIN', t0, 'admin.ban', { user_id: 'B', banned: false }))
    ok(await call('B', t0, 'team.join', { team_id: T }))
    const found = ok(await call('ADMIN', t0, 'admin.users', { q: 'B' }))
    expect(found.map((u: any) => u.id)).toEqual(['B'])
    expect(found[0].team).toBe('A的战队')
  })
})

describe('概览与埋点', () => {
  it('战书打开同人同局同日去重；概览统计', async () => {
    const { T, t0 } = await setup()
    ok(await call('B', t0, 'team.publicInfo', { team_id: T }))
    ok(await call('B', t0, 'team.publicInfo', { team_id: T }))
    ok(await call('X', t0, 'team.publicInfo', { team_id: T })) // 未登录也记
    expect((await db.find('events', {})).length).toBe(2)
    ok(await call('B', t0, 'team.join', { team_id: T }))
    const o = ok(await call('ADMIN', at(D1, '10:00'), 'admin.overview'))
    expect(o.stats).toMatchObject({ users: 3, new_today: 3, active_teams: 1, checkin_today: 0, north_star: 0 })
    const f = Object.fromEntries(o.funnel.map((s: any) => [s.key, s.count]))
    expect(f).toMatchObject({ invite_open: 2, login: 3, joined: 2 })
    expect(o.truncated).toBe(false)
  })
})

describe('战队与计划回退', () => {
  it('回退 / 重新生成只改明天起，今天和过去不变', async () => {
    const { T } = await setup()
    const D3 = addDays(D1, 2)
    const before = (await db.get<PlanDoc>('plans', T))!
    const list = ok(await call('ADMIN', at(D3, '10:00'), 'admin.teams', { status: 'active' }))
    expect(list[0]).toMatchObject({ id: T, day_no: 3, captain: 'A' })
    const detail = ok(await call('ADMIN', at(D3, '10:00'), 'admin.team', { team_id: T }))
    expect(detail.plan_today.items).toHaveLength(9)
    expect(detail.plan_tomorrow.date).toBe(addDays(D3, 1))

    const r = ok(await call('ADMIN', at(D3, '10:00'), 'admin.replan', { team_id: T, mode: 'fallback' }))
    expect(r.replaced).toBe(11)
    const after = (await db.get<PlanDoc>('plans', T))!
    for (let i = 0; i < 3; i++) expect(after.days[i]).toEqual(before.days[i])
    expect(after.days.slice(3).every((d) => d.fallback)).toBe(true)
    expect(after.generated_by).toBe('fallback')
    expect(after.version).toBe(2)

    ok(await call('ADMIN', at(D3, '10:00'), 'admin.replan', { team_id: T, mode: 'reroll' }))
    const again = (await db.get<PlanDoc>('plans', T))!
    for (let i = 0; i < 3; i++) expect(again.days[i]).toEqual(before.days[i])
    expect(again.days.slice(3).some((d) => d.fallback)).toBe(false)
    expect((again.replans as unknown[]).length).toBe(2)
    expect(err(await call('ADMIN', at(D3, '10:00'), 'admin.replan', { team_id: T, mode: 'x' }))).toBe('BAD_INPUT')
  })
})

describe('模板库', () => {
  it('未导入时显示种子；导入后可编辑，校验拦截；下线后新开局不再出现', async () => {
    const { t0 } = await setup()
    expect(ok(await call('ADMIN', t0, 'admin.actions')).from_seed).toBe(true)
    expect(err(await call('ADMIN', t0, 'admin.saveAction', { action: SEED_ACTIONS[0] }))).toBe('LOCKED')
    expect(ok(await call('ADMIN', t0, 'admin.importSeed')).imported).toBe(SEED_ACTIONS.length)
    expect(err(await call('ADMIN', t0, 'admin.importSeed'))).toBe('LOCKED')
    expect(ok(await call('ADMIN', t0, 'admin.actions')).from_seed).toBe(false)

    const bad = { ...SEED_ACTIONS[0], reason: '燃脂神器' }
    const r = await call('ADMIN', t0, 'admin.saveAction', { action: bad })
    expect(err(r)).toBe('BAD_INPUT')
    expect(!r.ok && r.message).toContain('敏感词')

    // 下线所有工作日“起身动”类之外的一个模板，并确认新清单里不再出现
    const target = SEED_ACTIONS.find((a) => a._id === 'm06')!
    ok(await call('ADMIN', t0, 'admin.saveAction', { action: { ...target, status: 'off', text: '肩颈拉伸 5 分钟（改）' } }))
    const saved = await db.get<any>('actions', 'm06')
    expect(saved).toMatchObject({ status: 'off', text: '肩颈拉伸 5 分钟（改）' })
    const p = ok(await call('B', t0, 'plan.preview', { theme: 'all', period_days: 14, seed: 99 }))
    for (const d of p.days) expect(d.items.map((i: any) => i.id)).not.toContain('m06')
  })
})

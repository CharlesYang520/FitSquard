// 第 3 步集成测试：订阅额度、催一下、全员到齐、战报、再来一局、退出、体重隔离、注销、明早提醒
import { beforeEach, describe, expect, it } from 'vitest'
import type { Action } from '@core/types'
import { addDays, windowState } from '@core/time'
import { MemoryDb } from '../src/db.memory'
import { makeCtx, resetActionCache, SEED_ACTIONS } from '../src/context'
import { MemoryNotifier, type TemplateConfig } from '../src/notify'
import { dispatch, type ApiResult } from '../src/router'
import { settleAll } from '../../daily/src/settle'
import { sendMorning } from '../../daily/src/morning'
import type { PlanDoc, TeamDoc, UserDoc } from '../src/models'

const D1 = '2026-10-17'
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+08:00`)
const byId = new Map(SEED_ACTIONS.map((a) => [a._id, a]))
const TPL: TemplateConfig = { morning: 'tpl-m', nudge: 'tpl-n', team: 'tpl-t' }

let db: MemoryDb
let notifier: MemoryNotifier
let seq = 0
let templates: TemplateConfig = TPL

async function call(openid: string, now: Date, action: string, payload: Record<string, unknown> = {}) {
  const ctx = makeCtx({ db, openid, now, templates, notifier, random: () => ((seq = (seq * 9301 + 49297) % 233280) / 233280) })
  return dispatch(ctx, action, payload)
}
const ok = <T = any>(r: ApiResult): T => {
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`)
  return r.data as T
}
const err = (r: ApiResult) => (r.ok ? 'OK' : r.code)
const sentTo = (openid: string, tpl: string) => notifier.sent.filter((s) => s.openid === openid && s.templateId === tpl).length

async function selfItems(teamId: string, date: string, pred: (a: Action) => boolean = () => true) {
  const p = (await db.get<PlanDoc>('plans', teamId))!
  const day = p.days.find((d) => d.date === date)!
  return day.items.map((id) => byId.get(id)!).filter((a) => a.verify === 'self' && a.window !== 'next_morning' && pred(a))
}
async function qualify(openid: string, teamId: string, date: string, startHour = 21) {
  const list = await selfItems(teamId, date, (a) => windowState(a.window, date, at(date, `${startHour}:00`)).open)
  const out: any[] = []
  for (let i = 0; i < 3; i++) {
    const hm = `${startHour}:${String(i * 6 + 1).padStart(2, '0')}`
    out.push(ok(await call(openid, at(date, hm), 'checkin.submit', { team_id: teamId, action_id: list[i]._id })))
  }
  return out
}

async function setup(n = 3) {
  const t0 = at(D1, '09:00')
  const ids = ['A', 'B', 'C', 'D', 'E'].slice(0, n)
  for (const id of ids) ok(await call(id, t0, 'user.login', { agreed: true, nickname: id }))
  const T = ok(await call('A', t0, 'team.create', { theme: 'all', period_days: 14, seed: 3 })).team_id as string
  for (const id of ids.slice(1)) ok(await call(id, t0, 'team.join', { team_id: T }))
  return { T, ids }
}

beforeEach(() => {
  db = new MemoryDb()
  notifier = new MemoryNotifier()
  templates = TPL
  seq = 3
  resetActionCache()
})

describe('订阅额度', () => {
  it('登录返回模板；授权加额度且只加已配置的；上限 50', async () => {
    const r = ok(await call('A', at(D1, '09:00'), 'user.login', { agreed: true }))
    expect(r.templates).toEqual(TPL)
    ok(await call('A', at(D1, '09:00'), 'sub.grant', { accepted: ['morning', 'nudge', 'bogus'] }))
    let u = (await db.get<UserDoc>('users', 'A'))!
    expect(u.sub_quota).toEqual({ morning: 1, nudge: 1 })
    for (let i = 0; i < 60; i++) await call('A', at(D1, '09:00'), 'sub.grant', { accepted: ['team'] })
    u = (await db.get<UserDoc>('users', 'A'))!
    expect(u.sub_quota!.team).toBe(50)

    templates = { morning: 'tpl-m' }
    ok(await call('A', at(D1, '09:00'), 'sub.grant', { accepted: ['nudge'] }))
    expect((await db.get<UserDoc>('users', 'A'))!.sub_quota!.nudge).toBe(1)
  })
})

describe('催一下', () => {
  it('有额度直接通知；同一被催人每天只收 1 条，之后降级分享；每人每天最多催 3 次', async () => {
    const { T } = await setup(4)
    const now = at(D1, '15:00')
    ok(await call('B', now, 'sub.grant', { accepted: ['nudge'] }))
    ok(await call('B', now, 'sub.grant', { accepted: ['nudge'] }))

    const info = ok(await call('A', now, 'team.nudgeInfo', { team_id: T, to: 'B' }))
    expect(info.can_notify).toBe(true)
    expect(info.left_today).toBe(3)
    expect(info.card.total).toBe(4)

    expect(ok(await call('A', now, 'team.nudge', { team_id: T, to: 'B' })).via).toBe('notify')
    expect(sentTo('B', 'tpl-n')).toBe(1)
    expect((await db.get<UserDoc>('users', 'B'))!.sub_quota!.nudge).toBe(1)
    // 同一人当天第二次被催：降级（即使还有额度）
    const second = ok(await call('C', now, 'team.nudge', { team_id: T, to: 'B' }))
    expect(second.via).toBe('share')
    expect(second.share.path).toContain(T)
    expect(sentTo('B', 'tpl-n')).toBe(1)
    // 没额度的人：分享
    expect(ok(await call('A', now, 'team.nudge', { team_id: T, to: 'C' })).via).toBe('share')
    ok(await call('A', now, 'team.nudge', { team_id: T, to: 'D' }))
    expect(err(await call('A', now, 'team.nudge', { team_id: T, to: 'D' }))).toBe('LOCKED')
    // 不能催自己、非成员、已达标的人
    expect(err(await call('A', now, 'team.nudge', { team_id: T, to: 'A' }))).toBe('BAD_INPUT')
    expect(err(await call('B', now, 'team.nudge', { team_id: T, to: 'Z' }))).toBe('NOT_MEMBER')
    await qualify('D', T, D1, 21)
    expect(err(await call('C', at(D1, '22:00'), 'team.nudge', { team_id: T, to: 'D' }))).toBe('LOCKED')
  })

  it('没配置模板：全部走分享', async () => {
    templates = {}
    const { T } = await setup(2)
    expect(ok(await call('A', at(D1, '15:00'), 'team.nudgeInfo', { team_id: T, to: 'B' })).can_notify).toBe(false)
    expect(ok(await call('A', at(D1, '15:00'), 'team.nudge', { team_id: T, to: 'B' })).via).toBe('share')
  })

  it('发送失败清零额度', async () => {
    const { T } = await setup(2)
    ok(await call('B', at(D1, '09:00'), 'sub.grant', { accepted: ['nudge'] }))
    notifier.failFor.add('B')
    expect(ok(await call('A', at(D1, '15:00'), 'team.nudge', { team_id: T, to: 'B' })).via).toBe('share')
    expect((await db.get<UserDoc>('users', 'B'))!.sub_quota!.nudge).toBe(0)
  })
})

describe('全员到齐通知', () => {
  it('最后一人达标时通知其他人，同一天只发一次；记录 qualified_at', async () => {
    const { T } = await setup(3)
    for (const id of ['A', 'B']) ok(await call(id, at(D1, '09:00'), 'sub.grant', { accepted: ['team'] }))
    await qualify('A', T, D1, 20)
    await qualify('B', T, D1, 21)
    const last = await qualify('C', T, D1, 22)
    expect(last[2].is_last).toBe(true)
    expect(last[2].all_done_notified).toBe(2)
    expect(sentTo('A', 'tpl-t')).toBe(1)
    expect(sentTo('C', 'tpl-t')).toBe(0)
    expect((await db.get<TeamDoc>('teams', T))!.all_done_dates).toEqual([D1])
    const day = await db.get<any>('days', `${T}_A_${D1}`)
    expect(day.qualified_at).toBe(at(D1, '20:13').getTime())
  })
})

describe('退出', () => {
  it('退出后不计入应达标，可再开新局', async () => {
    const { T } = await setup(3)
    const D2 = addDays(D1, 1)
    ok(await call('C', at(D2, '09:00'), 'team.leave', { team_id: T }))
    expect((await db.get<UserDoc>('users', 'C'))!.active_team_id).toBeNull()
    const h = ok(await call('A', at(D2, '09:00'), 'team.home', { team_id: T }))
    expect(h.today.total).toBe(2)
    expect(h.ranking.map((r: any) => r.user_id)).not.toContain('C')
    expect(err(await call('C', at(D2, '09:00'), 'team.home', { team_id: T }))).toBe('NOT_MEMBER')
    await qualify('A', T, D2)
    const r = await qualify('B', T, D2)
    expect(r[2].team_today.all).toBe(true)
    ok(await call('C', at(D2, '09:30'), 'team.create', {}))
  })
})

describe('战报与再来一局', () => {
  it('局结束生成战报（幂等）+ 通知；成员可读、历史可查；再来一局只开一次', async () => {
    const { T } = await setup(3)
    ok(await call('A', at(D1, '09:00'), 'team.setNote', { team_id: T, note: '最后一名请全队喝无糖茶' }))
    expect(err(await call('B', at(D1, '09:00'), 'team.setNote', { team_id: T, note: 'x' }))).toBe('NOT_MEMBER')
    expect(err(await call('A', at(D1, '09:00'), 'team.setNote', { team_id: T, note: '一'.repeat(31) }))).toBe('BAD_INPUT')

    // 14 天：A 全勤，B 前 10 天，C 只做前 3 天
    for (let i = 0; i < 14; i++) {
      const d = addDays(D1, i)
      await qualify('A', T, d, 20)
      if (i < 10) await qualify('B', T, d, 21)
      if (i < 3) await qualify('C', T, d, 22)
    }
    expect(err(await call('A', at(addDays(D1, 13), '23:00'), 'report.get', { team_id: T }))).toBe('LOCKED')
    for (const id of ['A', 'B', 'C']) ok(await call(id, at(D1, '09:00'), 'sub.grant', { accepted: ['team'] }))
    notifier.sent = []

    const after = addDays(D1, 14)
    const rep = await settleAll(db, at(after, '12:05'), { templates, notifier })
    expect(rep.ended).toEqual([T])
    expect(notifier.sent.filter((s) => s.page.includes('/pages/report/')).length).toBe(3)
    await settleAll(db, at(after, '12:10'), { templates, notifier })
    expect(notifier.sent.filter((s) => s.page.includes('/pages/report/')).length).toBe(3)

    const r = ok(await call('B', at(after, '13:00'), 'report.get', { team_id: T }))
    expect(r.team.offline_note).toBe('最后一名请全队喝无糖茶')
    expect(r.team.all_done_days).toBe(3)
    expect(r.members.map((m: any) => [m.user_id, m.rate_pct, m.title?.key ?? null])).toEqual([
      ['A', 100, 'allin'],
      ['B', 71, 'steady'],
      // C 那 3 天都是最后一个让全员到齐的 → 先拿到压哨王（每人最多 1 个称号）
      ['C', 21, 'buzzer'],
    ])
    expect(r.me.user_id).toBe('B')
    expect(JSON.stringify(r)).not.toMatch(/weight|height/)
    expect(err(await call('Z', at(after, '13:00'), 'report.get', { team_id: T }))).toBe('NOT_MEMBER')

    const hist = ok(await call('C', at(after, '13:00'), 'report.list'))
    expect(hist).toHaveLength(1)
    expect(hist[0]).toMatchObject({ team_id: T, rate_pct: 21, title: { key: 'buzzer' } })

    // 再来一局：B 开，A 再点直接进新局（战报通知已用掉额度，A、C 再授权一次）
    notifier.sent = []
    for (const id of ['A', 'C']) ok(await call(id, at(after, '12:30'), 'sub.grant', { accepted: ['team'] }))
    const re = ok(await call('B', at(after, '13:00'), 'team.rematch', { team_id: T }))
    expect(re.created).toBe(true)
    expect(re.period_days).toBe(21)
    const nt = (await db.get<TeamDoc>('teams', re.team_id))!
    expect(nt.prev_team_id).toBe(T)
    expect(nt.theme).toBe('all')
    expect(nt.offline_note).toBe('最后一名请全队喝无糖茶')
    expect(re.notified).toBe(2)
    const again = ok(await call('A', at(after, '13:05'), 'team.rematch', { team_id: T }))
    expect(again).toEqual({ team_id: re.team_id, created: false })
    expect(ok(await call('B', at(after, '13:06'), 'report.get', { team_id: T })).next_team_id).toBe(re.team_id)
  })
})

describe('私密体重与注销', () => {
  it('需同意才能记；只本人可读；撤回删除；战队接口不含体重', async () => {
    const { T } = await setup(2)
    const now = at(D1, '10:00')
    expect(err(await call('A', now, 'weight.add', { weight_kg: 72 }))).toBe('LOCKED')
    expect(err(await call('A', now, 'weight.consent', { agree: true, height_cm: 50 }))).toBe('BAD_INPUT')
    ok(await call('A', now, 'weight.consent', { agree: true, height_cm: 175 }))
    ok(await call('A', now, 'weight.add', { weight_kg: 72.04 }))
    ok(await call('A', now, 'weight.add', { weight_kg: 71.8 })) // 同日覆盖
    ok(await call('A', at(addDays(D1, 3), '10:00'), 'weight.add', { weight_kg: 71.2 }))
    expect(err(await call('A', now, 'weight.add', { weight_kg: 500 }))).toBe('BAD_INPUT')
    const mine = ok(await call('A', at(addDays(D1, 3), '10:00'), 'weight.list'))
    expect(mine.items).toEqual([
      { date: D1, weight_kg: 71.8 },
      { date: addDays(D1, 3), weight_kg: 71.2 },
    ])
    expect(mine.height_cm).toBe(175)
    // B 看不到 A 的
    expect(ok(await call('B', now, 'weight.list')).items).toEqual([])
    for (const action of ['team.home', 'team.publicInfo', 'checkin.today']) {
      const r = ok(await call('B', now, action, { team_id: T }))
      expect(JSON.stringify(r)).not.toMatch(/weight|height|71\.8/)
    }
    const rv = ok(await call('A', now, 'weight.consent', { agree: false }))
    expect(rv.deleted).toBe(2)
    expect(ok(await call('A', now, 'weight.list'))).toEqual({ consented: false, height_cm: null, items: [] })
  })

  it('注销：退出局、删体重、匿名显示，再登录需重新同意', async () => {
    const { T } = await setup(2)
    const now = at(D1, '10:00')
    ok(await call('B', now, 'weight.consent', { agree: true, height_cm: 168 }))
    ok(await call('B', now, 'weight.add', { weight_kg: 60 }))
    await qualify('B', T, D1, 11)
    ok(await call('B', at(D1, '12:00'), 'user.delete'))
    const u = (await db.get<UserDoc>('users', 'B'))!
    expect(u.deleted_at).toBeTruthy()
    expect(u.nickname).toBe('')
    expect(u.height_cm).toBeNull()
    expect(await db.find('weights', { user_id: 'B' })).toEqual([])
    const h = ok(await call('A', at(D1, '12:30'), 'team.home', { team_id: T }))
    expect(h.today.total).toBe(1)
    expect(h.feed.some((f: any) => f.nickname === '已注销用户')).toBe(true)
    expect(err(await call('B', at(D1, '13:00'), 'user.login', {}))).toBe('BAD_INPUT')
    expect(ok(await call('B', at(D1, '13:00'), 'user.login', { agreed: true })).team).toBeNull()
  })
})

describe('明早提醒', () => {
  it('有额度、今天在局内的发一条；同一天幂等；没配置模板不发', async () => {
    const { T } = await setup(3)
    for (const id of ['A', 'B']) ok(await call(id, at(D1, '09:00'), 'sub.grant', { accepted: ['morning'] }))
    const D2 = addDays(D1, 1)
    const r1 = await sendMorning(db, at(D2, '08:30'), { templates, notifier })
    expect(r1.sent).toBe(2)
    expect(notifier.sent[0].page).toBe('/pages/checkin/index')
    expect(notifier.sent[0].data.thing2.value).toContain('今日推荐')
    const r2 = await sendMorning(db, at(D2, '08:35'), { templates, notifier })
    expect(r2.sent).toBe(0)
    expect(sentTo('A', 'tpl-m')).toBe(1)
    expect((await db.get<UserDoc>('users', 'A'))!.sub_quota!.morning).toBe(0)
    expect((await sendMorning(db, at(addDays(D1, 2), '08:30'), { templates: {}, notifier })).sent).toBe(0)
    void T
  })
})

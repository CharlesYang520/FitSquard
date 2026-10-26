// 集成测试：内存假库跑通 开局 → 加入（含迟到）→ 打卡（5 分钟、额外完成、不太舒服、锁定）→ 排名 → 日终 → 结束
import { beforeEach, describe, expect, it } from 'vitest'
import type { Action } from '@core/types'
import { addDays } from '@core/time'
import { MemoryDb } from '../src/db.memory'
import { makeCtx, resetActionCache, SEED_ACTIONS } from '../src/context'
import { dispatch, type ApiResult } from '../src/router'
import { settleAll } from '../../daily/src/settle'
import type { PlanDoc, TeamDoc, UserDoc } from '../src/models'

const D1 = '2026-10-17' // 周六
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+08:00`)
const byId = new Map(SEED_ACTIONS.map((a) => [a._id, a]))

let db: MemoryDb
let seq = 0

async function call(openid: string, now: Date, action: string, payload: Record<string, unknown> = {}, extra: Partial<Parameters<typeof makeCtx>[0]> = {}) {
  const ctx = makeCtx({ db, openid, now, random: () => ((seq = (seq * 9301 + 49297) % 233280) / 233280), ...extra })
  return dispatch(ctx, action, payload)
}
const ok = <T = any>(r: ApiResult): T => {
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`)
  return r.data as T
}
const err = (r: ApiResult) => (r.ok ? 'OK' : r.code)

async function plan(teamId: string) {
  return (await db.get<PlanDoc>('plans', teamId))!
}
/** 某天可在晚上（21:30 后）自报打卡的项 */
async function selfItems(teamId: string, date: string, pred: (a: Action) => boolean = () => true) {
  const p = await plan(teamId)
  const day = p.days.find((d) => d.date === date)!
  return day.items.map((id) => byId.get(id)!).filter((a) => a.verify === 'self' && a.window !== 'next_morning' && pred(a))
}
/** 晚上每隔 6 分钟打一项，打满 n 项 */
async function doItems(openid: string, teamId: string, date: string, n: number, pred?: (a: Action) => boolean) {
  const list = await selfItems(teamId, date, pred)
  expect(list.length).toBeGreaterThanOrEqual(n)
  const out: any[] = []
  for (let i = 0; i < n; i++) {
    const r = await call(openid, at(date, `21:${String(30 + i * 6).padStart(2, '0')}`), 'checkin.submit', { team_id: teamId, action_id: list[i]._id })
    out.push(ok(r))
  }
  return out
}

beforeEach(() => {
  db = new MemoryDb()
  seq = 7
  resetActionCache()
})

describe('主链路', () => {
  it('登录：未勾协议拒绝；首次建档；再次登录直接返回', async () => {
    expect(err(await call('A', at(D1, '09:00'), 'user.login', {}))).toBe('BAD_INPUT')
    const r = ok(await call('A', at(D1, '09:00'), 'user.login', { agreed: true, nickname: '阿杰' }))
    expect(r.user.nickname).toBe('阿杰')
    expect(r.team).toBeNull()
    const again = ok(await call('A', at(D1, '09:01'), 'user.login', {}))
    expect(again.user.id).toBe('A')
    expect(err(await call('X', at(D1, '09:00'), 'team.create', {}))).toBe('NOT_LOGGED_IN')
  })

  it('完整一局', async () => {
    const t0 = at(D1, '09:00')
    for (const [id, nick] of [['A', '阿杰'], ['B', 'Mia'], ['C', '大刘']]) ok(await call(id, t0, 'user.login', { agreed: true, nickname: nick }))

    // 预览：3 天、换 seed 结果不同
    const p1 = ok(await call('A', t0, 'plan.preview', { theme: 'walk', period_days: 14, seed: 11 }))
    const p2 = ok(await call('A', t0, 'plan.preview', { theme: 'walk', period_days: 14, seed: 12 }))
    expect(p1.days).toHaveLength(3)
    expect(p1.days[0].items).toHaveLength(9)
    expect(p1.days[0].items.map((a: any) => a.id)).not.toEqual(p2.days[0].items.map((a: any) => a.id))
    expect(err(await call('A', t0, 'plan.preview', { period_days: 30 }))).toBe('BAD_INPUT')

    // 开局：Day 1 = 今天；同 seed 与预览一致
    const created = ok(await call('A', t0, 'team.create', { theme: 'walk', period_days: 14, seed: 11, taunt: '14 天后见分晓' }))
    const T = created.team_id
    expect(created.name).toBe('阿杰的战队')
    const team0 = (await db.get<TeamDoc>('teams', T))!
    expect(team0.start_date).toBe(D1)
    expect(team0.end_date).toBe(addDays(D1, 13))
    expect((await plan(T)).days).toHaveLength(14)
    expect((await plan(T)).days[0].items).toEqual(p1.days[0].items.map((a: any) => a.id))
    expect(err(await call('A', t0, 'team.create', {}))).toBe('ALREADY_IN_TEAM')

    // 战书落地页
    const pub = ok(await call('B', t0, 'team.publicInfo', { team_id: T }))
    expect(pub.state).toBe('open')
    expect(pub.captain.nickname).toBe('阿杰')
    expect(pub.team.taunt).toBe('14 天后见分晓')
    expect(pub.pick).not.toBeNull()

    // B 第 1 天加入；重复加入幂等；非成员不能看战队数据
    ok(await call('B', t0, 'team.join', { team_id: T }))
    expect(ok(await call('B', t0, 'team.join', { team_id: T })).already).toBe(true)
    expect(err(await call('C', t0, 'team.home', { team_id: T }))).toBe('NOT_MEMBER')

    // —— Day 1 打卡 ——
    const items = await selfItems(T, D1)
    const first = items[0]
    // 5 分钟规则
    const r1 = ok(await call('A', at(D1, '21:30'), 'checkin.submit', { team_id: T, action_id: items[0]._id }))
    expect(r1.counted).toBe(true)
    const r2 = await call('A', at(D1, '21:31'), 'checkin.submit', { team_id: T, action_id: items[1]._id })
    expect(err(r2)).toBe('LOCKED')
    expect(!r2.ok && (r2.extra as any).retry_at).toBe(at(D1, '21:32').getTime())
    expect(await db.get('checkins', `${T}_A_${D1}_${items[1]._id}`)).toBeNull()
    const tvCool = ok(await call('A', at(D1, '21:31'), 'checkin.today', { team_id: T }))
    expect(tvCool.cooldown_until).toBe(at(D1, '21:32').getTime())
    const r2b = ok(await call('A', at(D1, '21:36'), 'checkin.submit', { team_id: T, action_id: items[1]._id }))
    expect(r2b.counted).toBe(true)
    // 重复打同一项
    expect(err(await call('A', at(D1, '21:40'), 'checkin.submit', { team_id: T, action_id: first._id }))).toBe('DUPLICATE')
    // 第 3 项达标
    const r3 = ok(await call('A', at(D1, '21:42'), 'checkin.submit', { team_id: T, action_id: items[2]._id }))
    expect(r3.qualified).toBe(true)
    expect(r3.became_qualified).toBe(true)
    expect(r3.team_today).toEqual({ done: 1, total: 2, all: false })
    expect(r3.rank).toBe(1)
    expect(r3.streak).toBe(1)
    // 第 4 项：额外完成
    if (items[3]) {
      const r4 = ok(await call('A', at(D1, '21:50'), 'checkin.submit', { team_id: T, action_id: items[3]._id }))
      expect(r4.extra).toBe(true)
      expect(r4.counted).toBe(false)
    }
    // 不在清单
    const p = await plan(T)
    const outside = SEED_ACTIONS.find((a) => !p.days[0].items.includes(a._id))!
    expect(err(await call('A', at(D1, '21:55'), 'checkin.submit', { team_id: T, action_id: outside._id }))).toBe('NOT_IN_PLAN')
    // 锁定：明早确认类当天不可打；时间窗未到不可打
    const nm = p.days[0].items.map((id) => byId.get(id)!).find((a) => a.window === 'next_morning')
    if (nm) expect(err(await call('A', at(D1, '21:56'), 'checkin.submit', { team_id: T, action_id: nm._id }))).toBe('LOCKED')
    const late = p.days[0].items.map((id) => byId.get(id)!).find((a) => a.verify === 'self' && ['after_20', 'after_21', 'after_dinner'].includes(a.window))
    if (late) expect(err(await call('B', at(D1, '08:00'), 'checkin.submit', { team_id: T, action_id: late._id }))).toBe('LOCKED')
    // 步数项不能手动打
    const wr = p.days[0].items.map((id) => byId.get(id)!).find((a) => a.verify === 'werun')
    if (wr) expect(err(await call('A', at(D1, '21:57'), 'checkin.submit', { team_id: T, action_id: wr._id }))).toBe('BAD_INPUT')
    // 不能打明天的
    expect(err(await call('A', at(D1, '21:58'), 'checkin.submit', { team_id: T, action_id: p.days[1].items[0], date: addDays(D1, 1) }))).toBe('LOCKED')

    // B 只打 2 项
    await doItems('B', T, D1, 2)

    // 实时排名：A 100%，B 0%
    const h1 = ok(await call('B', at(D1, '22:30'), 'team.home', { team_id: T }))
    expect(h1.ranking.map((r: any) => [r.nickname, r.rate_pct])).toEqual([['阿杰', 100], ['Mia', 0]])
    expect(h1.today).toMatchObject({ done: 1, total: 2, all: false })
    expect(h1.hook).toContain('就差你了')
    expect(h1.feed.length).toBeGreaterThanOrEqual(5)
    expect(h1.me.grid[0].state).toBe('today')

    // 打卡页
    const tv = ok(await call('A', at(D1, '22:31'), 'checkin.today', { team_id: T }))
    expect(tv.items).toHaveLength(9)
    expect(tv.counted_count).toBe(3)
    expect(tv.qualified).toBe(true)
    expect(tv.items.filter((i: any) => i.state === 'done').length).toBeGreaterThanOrEqual(3)

    // 表情：点一下加、再点取消；非成员不能点
    const fid = h1.feed[0].id
    expect(ok(await call('B', at(D1, '22:32'), 'feed.react', { checkin_id: fid, kind: 'cheer' })).on).toBe(true)
    expect(ok(await call('A', at(D1, '22:32'), 'team.home', { team_id: T })).feed[0].reactions.cheer).toBe(1)
    expect(ok(await call('B', at(D1, '22:33'), 'feed.react', { checkin_id: fid, kind: 'cheer' })).on).toBe(false)
    expect(err(await call('C', at(D1, '22:33'), 'feed.react', { checkin_id: fid, kind: 'cheer' }))).toBe('NOT_MEMBER')
    expect(err(await call('B', at(D1, '22:33'), 'feed.react', { checkin_id: fid, kind: 'like' }))).toBe('BAD_INPUT')

    // —— Day 2 中午结算 Day 1 ——
    const D2 = addDays(D1, 1)
    // 结算前（上午），昨天对 B 仍是“待定”，不会断
    expect((await settleAll(db, at(D2, '12:05'))).days).toBe(1)
    let team = (await db.get<TeamDoc>('teams', T))!
    expect(team.last_settled_date).toBe(D1)
    expect(team.team_streak).toBe(0)
    expect((await db.get<any>('members', `${T}_A`)).streak_days).toBe(1)
    expect((await db.get<any>('members', `${T}_B`)).streak_days).toBe(0)
    expect((await db.get<UserDoc>('users', 'A'))!.streak_days).toBe(1)
    // 幂等：再跑一次不变
    expect((await settleAll(db, at(D2, '12:10'))).days).toBe(0)
    expect((await db.get<any>('members', `${T}_A`)).done_days).toBe(1)

    // Day 2：两人都达标
    await doItems('A', T, D2, 3)
    const lastB = await doItems('B', T, D2, 3)
    expect(lastB[2].is_last).toBe(true)
    expect(lastB[2].team_today.all).toBe(true)
    expect(lastB[2].team_streak).toBe(1)

    // —— Day 3：C 迟到加入，不太舒服 1 项达标 ——
    const D3 = addDays(D1, 2)
    await settleAll(db, at(D3, '12:05'))
    team = (await db.get<TeamDoc>('teams', T))!
    expect(team.team_streak).toBe(1)
    ok(await call('C', at(D3, '12:30'), 'team.join', { team_id: T }))
    expect((await db.get<TeamDoc>('teams', T))!.member_count).toBe(3)
    ok(await call('C', at(D3, '12:31'), 'checkin.setMood', { team_id: T, mood: 'unwell' }))
    // 不太舒服时只能打恢复类
    const nonRec = (await selfItems(T, D3, (a) => !a.recovery))[0]
    if (nonRec) expect(err(await call('C', at(D3, '21:00'), 'checkin.submit', { team_id: T, action_id: nonRec._id }))).toBe('BAD_INPUT')
    const cr = await doItems('C', T, D3, 1, (a) => a.recovery)
    expect(cr[0].qualified).toBe(true)
    // 已按不太舒服计入后不能切回
    expect(err(await call('C', at(D3, '22:10'), 'checkin.setMood', { team_id: T, mood: 'normal' }))).toBe('LOCKED')
    await doItems('A', T, D3, 3)
    await doItems('B', T, D3, 3)

    const h3 = ok(await call('C', at(D3, '23:00'), 'team.home', { team_id: T }))
    expect(h3.today).toMatchObject({ done: 3, total: 3, all: true })
    expect(h3.team.team_streak).toBe(2)
    const rC = h3.ranking.find((r: any) => r.nickname === '大刘')
    expect(rC.rate_pct).toBe(100)
    // A：3/3 天，B：2/3 天
    expect(h3.ranking.find((r: any) => r.nickname === '阿杰').rate_pct).toBe(100)
    expect(h3.ranking.find((r: any) => r.nickname === 'Mia').rate_pct).toBe(67)
    expect(h3.me.grid.slice(0, 3).map((g: any) => g.state)).toEqual(['before_join', 'before_join', 'unwell'])

    // —— Day 4：没人打卡 → 结算后全队连续清零 ——
    const D5 = addDays(D1, 4)
    await settleAll(db, at(addDays(D1, 3), '12:05'))
    expect((await db.get<TeamDoc>('teams', T))!.team_streak).toBe(2)
    await settleAll(db, at(D5, '12:05'))
    team = (await db.get<TeamDoc>('teams', T))!
    expect(team.team_streak).toBe(0)
    expect(team.team_streak_best).toBe(2)
    expect((await db.get<any>('members', `${T}_C`)).streak_days).toBe(0)
    expect((await db.get<any>('members', `${T}_C`)).done_days).toBe(1)

    // 不太舒服：每局最多 2 天
    const D6 = addDays(D1, 5)
    ok(await call('C', at(D6, '09:00'), 'checkin.setMood', { team_id: T, mood: 'unwell' }))
    const D7 = addDays(D1, 6)
    expect(err(await call('C', at(D7, '09:00'), 'checkin.setMood', { team_id: T, mood: 'unwell' }))).toBe('MOOD_LIMIT')

    // —— 局结束：最后一天之后的中午结算，状态置为已结束、清空 active_team_id ——
    const after = addDays(team.end_date, 1)
    const rep = await settleAll(db, at(after, '12:05'))
    expect(rep.ended).toContain(T)
    expect((await db.get<TeamDoc>('teams', T))!.status).toBe('ended')
    expect((await db.get<UserDoc>('users', 'A'))!.active_team_id).toBeNull()
    expect(ok(await call('A', at(after, '13:00'), 'team.publicInfo', { team_id: T })).state).toBe('ended')
    expect(err(await call('X', at(after, '13:00'), 'team.join', { team_id: T }))).toBe('NOT_LOGGED_IN')
    ok(await call('X', at(after, '13:00'), 'user.login', { agreed: true }))
    expect(err(await call('X', at(after, '13:00'), 'team.join', { team_id: T }))).toBe('TEAM_ENDED')
    // 结束后可以再开一局
    ok(await call('A', at(after, '13:00'), 'team.create', {}))
  })

  it('次日早上确认：记入前一天，12:00 后不能补', async () => {
    const t0 = at(D1, '09:00')
    ok(await call('A', t0, 'user.login', { agreed: true }))
    // 找一个第 1 天含“明早确认”项的 seed
    let T = ''
    let nmId = ''
    for (let s = 1; s < 50 && !nmId; s++) {
      db = new MemoryDb()
      ok(await call('A', t0, 'user.login', { agreed: true }))
      T = ok(await call('A', t0, 'team.create', { seed: s })).team_id
      nmId = (await plan(T)).days[0].items.find((id) => byId.get(id)!.window === 'next_morning') ?? ''
    }
    expect(nmId).not.toBe('')
    const D2 = addDays(D1, 1)
    const tv = ok(await call('A', at(D2, '07:00'), 'checkin.today', { team_id: T }))
    expect(tv.yesterday.confirm.map((i: any) => i.id)).toContain(nmId)
    const r = ok(await call('A', at(D2, '07:00'), 'checkin.submit', { team_id: T, action_id: nmId, date: D1 }))
    expect(r.counted).toBe(true)
    expect(r.date).toBe(D1)
    expect((await db.get<any>('days', `${T}_A_${D1}`)).counted_count).toBe(1)
    // 已确认后不再出现
    const after = ok(await call('A', at(D2, '07:10'), 'checkin.today', { team_id: T })).yesterday.confirm.map((i: any) => i.id)
    expect(after).not.toContain(nmId)
    // 12:00 后不能补
    const other = (await plan(T)).days[0].items.find((id) => id !== nmId && byId.get(id)!.window === 'next_morning')
    if (other) expect(err(await call('A', at(D2, '12:00'), 'checkin.submit', { team_id: T, action_id: other, date: D1 }))).toBe('LOCKED')
    expect(err(await call('A', at(D2, '07:00'), 'checkin.submit', { team_id: T, action_id: nmId, date: addDays(D1, -1) }))).toBe('LOCKED')
  })

  it('微信运动：达到阈值自动打卡，未达到不打', async () => {
    const t0 = at(D1, '09:00')
    let T = ''
    let wr: Action | undefined
    for (let s = 1; s < 80 && !wr; s++) {
      db = new MemoryDb()
      ok(await call('A', t0, 'user.login', { agreed: true }))
      T = ok(await call('A', t0, 'team.create', { theme: 'walk', seed: s })).team_id
      wr = (await plan(T)).days[0].items.map((id) => byId.get(id)!).find((a) => a.verify === 'werun')
    }
    expect(wr).toBeDefined()
    const ts = Date.parse(`${D1}T00:00:00+08:00`) / 1000
    const low = ok(await call('A', at(D1, '15:00'), 'checkin.werun', { team_id: T }, { weRunSteps: [{ timestamp: ts, step: 100 }] }))
    expect(low.items[0]).toMatchObject({ done: false })
    const high = ok(await call('A', at(D1, '15:01'), 'checkin.werun', { team_id: T }, { weRunSteps: [{ timestamp: ts - 86400, step: 99999 }, { timestamp: ts, step: 12000 }] }))
    expect(high.steps).toBe(12000)
    expect(high.items[0]).toMatchObject({ done: true, counted: true })
    const ck = await db.get<any>('checkins', `${T}_A_${D1}_${wr!._id}`)
    expect(ck.verified_by).toBe('werun')
    // 重复上报不重复写
    const again = ok(await call('A', at(D1, '15:02'), 'checkin.werun', { team_id: T }, { weRunSteps: [{ timestamp: ts, step: 13000 }] }))
    expect(again.items[0].done).toBe(true)
    expect((await db.get<any>('days', `${T}_A_${D1}`)).counted_count).toBe(1)
    expect(err(await call('A', at(D1, '15:03'), 'checkin.werun', { team_id: T }))).toBe('BAD_INPUT')
  })

  it('满 10 人不能再加；在别的局里不能加入', async () => {
    const t0 = at(D1, '09:00')
    ok(await call('A', t0, 'user.login', { agreed: true }))
    const T = ok(await call('A', t0, 'team.create', {})).team_id
    for (let i = 1; i <= 9; i++) {
      ok(await call(`U${i}`, t0, 'user.login', { agreed: true }))
      ok(await call(`U${i}`, t0, 'team.join', { team_id: T }))
    }
    ok(await call('Z', t0, 'user.login', { agreed: true }))
    expect(ok(await call('Z', t0, 'team.publicInfo', { team_id: T })).state).toBe('full')
    expect(err(await call('Z', t0, 'team.join', { team_id: T }))).toBe('TEAM_FULL')

    const T2 = ok(await call('Z', t0, 'team.create', {})).team_id
    expect(ok(await call('U1', t0, 'team.publicInfo', { team_id: T2 })).state).toBe('in_other')
    expect(err(await call('U1', t0, 'team.join', { team_id: T2 }))).toBe('ALREADY_IN_TEAM')
    expect(err(await call('U1', t0, 'nope', {}))).toBe('BAD_INPUT')
  })
})

describe('不太舒服的门槛', () => {
  it('先正常打 1 项非恢复类再切“不太舒服”，不算达标；补 1 项恢复类才达标；正常时打过的项不锁切换', async () => {
    const t0 = at(D1, '09:00')
    ok(await call('A', t0, 'user.login', { agreed: true }))
    const T = ok(await call('A', t0, 'team.create', { seed: 21 })).team_id
    const nonRec = (await selfItems(T, D1, (a) => !a.recovery))[0]
    const rec = (await selfItems(T, D1, (a) => a.recovery))[0]
    expect(nonRec && rec).toBeTruthy()
    ok(await call('A', at(D1, '21:30'), 'checkin.submit', { team_id: T, action_id: nonRec._id }))
    const m = ok(await call('A', at(D1, '21:31'), 'checkin.setMood', { team_id: T, mood: 'unwell' }))
    expect(m.qualified).toBe(false)
    // 还没在不太舒服下计入，可以切回
    ok(await call('A', at(D1, '21:32'), 'checkin.setMood', { team_id: T, mood: 'normal' }))
    ok(await call('A', at(D1, '21:33'), 'checkin.setMood', { team_id: T, mood: 'unwell' }))
    const r = ok(await call('A', at(D1, '21:40'), 'checkin.submit', { team_id: T, action_id: rec._id }))
    expect(r.counted).toBe(true)
    expect(r.qualified).toBe(true)
    expect(err(await call('A', at(D1, '21:41'), 'checkin.setMood', { team_id: T, mood: 'normal' }))).toBe('LOCKED')
  })
})

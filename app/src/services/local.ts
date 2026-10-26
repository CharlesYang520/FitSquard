// 本地演示模式：没填云环境 ID 时，直接在小程序里跑云函数的同一套代码（内存库 + 本地缓存持久化），
// 方便在开发者工具里先把页面和流程看起来。会自动拉两个机器人队友，让排名和动态不至于空着。
import Taro from '@tarojs/taro'
import { MemoryDb } from '../../cloudfunctions/api/src/db.memory'
import { makeCtx, SEED_ACTIONS } from '../../cloudfunctions/api/src/context'
import { dispatch, type ApiResult } from '../../cloudfunctions/api/src/router'
import type { PlanDoc } from '../../cloudfunctions/api/src/models'
import { windowState } from '@core/time'

const KEY = 'fs_local_db_v1'
export const LOCAL_OPENID = 'local-me'
const BOTS = [
  { id: 'bot-mia', nickname: 'Mia' },
  { id: 'bot-jie', nickname: '阿杰' },
]

let db: MemoryDb | null = null

function load(): MemoryDb {
  if (db) return db
  db = new MemoryDb()
  try {
    const raw = Taro.getStorageSync(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as [string, [string, any][]][]
      db.data = new Map(parsed.map(([k, entries]) => [k, new Map(entries)]))
    }
  } catch {
    // 缓存坏了就从空库开始
  }
  return db
}

function save() {
  if (!db) return
  const plain = [...db.data.entries()].map(([k, m]) => [k, [...m.entries()]])
  Taro.setStorageSync(KEY, JSON.stringify(plain))
}

export function resetLocal() {
  db = new MemoryDb()
  Taro.removeStorageSync(KEY)
}

async function run(openid: string, action: string, payload: Record<string, unknown> = {}) {
  // 本地演示：本机用户就是管理员，方便看后台
  const ctx = makeCtx({ db: load(), openid, now: new Date(), adminIds: [LOCAL_OPENID] })
  return dispatch(ctx, action, payload)
}

/** 机器人队友加入并随手打几项 */
async function addBots(teamId: string) {
  const d = load()
  const plan = await d.get<PlanDoc>('plans', teamId)
  for (const [i, b] of BOTS.entries()) {
    await run(b.id, 'user.login', { agreed: true, nickname: b.nickname })
    await run(b.id, 'team.join', { team_id: teamId })
    const today = plan?.days[0]
    if (!today) continue
    const open = today.items
      .map((id) => SEED_ACTIONS.find((a) => a._id === id)!)
      .filter((a) => a.verify === 'self' && windowState(a.window, today.date).open)
    // Mia 做满 3 项（如果做得到），阿杰做 1 项；时间错开绕过 5 分钟规则
    const n = i === 0 ? 3 : 1
    for (let k = 0; k < Math.min(n, open.length); k++) {
      const ctx = makeCtx({ db: d, openid: b.id, now: new Date(Date.now() - (60 - k * 10) * 60 * 1000) })
      await dispatch(ctx, 'checkin.submit', { team_id: teamId, action_id: open[k]._id })
    }
  }
}

export async function callLocal(action: string, payload: Record<string, unknown>): Promise<ApiResult> {
  const r = await run(LOCAL_OPENID, action, payload)
  if (r.ok && action === 'team.create') await addBots((r.data as { team_id: string }).team_id)
  save()
  return r
}

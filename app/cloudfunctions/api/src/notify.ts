// 订阅消息：模板配置、额度、发送。没有模板 ID 时一律返回 disabled，调用方走分享卡片兜底（D5）。
import { COLL, inc, type Db } from './db'
import type { UserDoc } from './models'

export type SubKind = 'morning' | 'nudge' | 'team'
export const SUB_KINDS: SubKind[] = ['morning', 'nudge', 'team']
export const MAX_QUOTA = 50

export type TemplateConfig = Partial<Record<SubKind, string>>

/** 模板 ID 从云函数环境变量读取（云开发控制台 → 云函数 → 版本与配置 → 环境变量） */
export function templatesFromEnv(env: Record<string, string | undefined> = process.env): TemplateConfig {
  const out: TemplateConfig = {}
  if (env.TPL_MORNING) out.morning = env.TPL_MORNING
  if (env.TPL_NUDGE) out.nudge = env.TPL_NUDGE
  if (env.TPL_TEAM) out.team = env.TPL_TEAM
  return out
}

export interface NotifyData {
  /** 标题类：队名 / 谁催你 / 事件名 */
  title: string
  /** 内容：今天的推荐项 / 战况 */
  content: string
  /** 备注 */
  note?: string
  /** 时间文案（北京时间） */
  time?: string
}

const thing = (s: string) => ({ value: [...s].slice(0, 20).join('') })

/**
 * 模板字段映射。拿到真实模板后，按模板详情里的字段名（thing1 / time2 / phrase3 …）改这里一处即可。
 * thing 类字段限 20 字以内，超出会被截断。
 */
export const TEMPLATE_FIELDS: Record<SubKind, (d: NotifyData) => Record<string, { value: string }>> = {
  morning: (d) => ({ thing1: thing(d.title), thing2: thing(d.content), thing3: thing(d.note ?? '9 选 3，做完就达标') }),
  nudge: (d) => ({ thing1: thing(d.title), thing2: thing(d.content), thing3: thing(d.note ?? '点开就能打卡') }),
  team: (d) => ({ thing1: thing(d.title), thing2: thing(d.content), thing3: thing(d.note ?? '点开看看') }),
}

export type SendResult = 'sent' | 'failed'
export interface Notifier {
  send(p: { openid: string; templateId: string; page: string; data: Record<string, { value: string }> }): Promise<SendResult>
}

/** 测试 / 本地演示用：只记录 */
export class MemoryNotifier implements Notifier {
  sent: Array<{ openid: string; templateId: string; page: string; data: Record<string, { value: string }> }> = []
  failFor = new Set<string>()
  async send(p: { openid: string; templateId: string; page: string; data: Record<string, { value: string }> }) {
    if (this.failFor.has(p.openid)) return 'failed' as const
    this.sent.push(p)
    return 'sent' as const
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cloudNotifier(cloud: any): Notifier {
  return {
    async send({ openid, templateId, page, data }) {
      try {
        await cloud.openapi.subscribeMessage.send({ touser: openid, templateId, page, data, miniprogramState: 'formal' })
        return 'sent'
      } catch (e) {
        console.warn('[notify] send fail', openid, templateId, (e as { errCode?: number })?.errCode)
        return 'failed'
      }
    },
  }
}

export interface NotifyDeps {
  db: Db
  templates: TemplateConfig
  notifier?: Notifier
}

export type NotifyResult = 'sent' | 'no_quota' | 'disabled' | 'failed'

export async function quotaOf(deps: NotifyDeps, openid: string, kind: SubKind): Promise<number> {
  if (!deps.templates[kind] || !deps.notifier) return 0
  const u = await deps.db.get<UserDoc>(COLL.users, openid)
  if (!u || u.deleted_at) return 0
  return Number((u.sub_quota as Record<string, number> | undefined)?.[kind] ?? 0)
}

/** 有额度才发；成功扣 1，失败清零（多半是用户关了通知） */
export async function notify(deps: NotifyDeps, openid: string, kind: SubKind, data: NotifyData, page: string): Promise<NotifyResult> {
  const templateId = deps.templates[kind]
  if (!templateId || !deps.notifier) return 'disabled'
  if ((await quotaOf(deps, openid, kind)) <= 0) return 'no_quota'
  const r = await deps.notifier.send({ openid, templateId, page, data: TEMPLATE_FIELDS[kind](data) })
  await deps.db.update(COLL.users, openid, { [`sub_quota.${kind}`]: r === 'sent' ? inc(-1) : 0 })
  return r
}

/** 授权结果上报：同意的模板各 +1（上限 MAX_QUOTA） */
export async function grant(deps: NotifyDeps, openid: string, accepted: unknown): Promise<Record<SubKind, boolean>> {
  const list = Array.isArray(accepted) ? accepted : []
  const u = await deps.db.get<UserDoc>(COLL.users, openid)
  const out = { morning: false, nudge: false, team: false }
  if (!u) return out
  const q = (u.sub_quota as Record<string, number> | undefined) ?? {}
  const patch: Record<string, number> = {}
  for (const k of SUB_KINDS) {
    if (!list.includes(k) || !deps.templates[k]) continue
    patch[`sub_quota.${k}`] = Math.min(MAX_QUOTA, Number(q[k] ?? 0) + 1)
    out[k] = true
  }
  if (Object.keys(patch).length) await deps.db.update(COLL.users, openid, patch)
  return out
}

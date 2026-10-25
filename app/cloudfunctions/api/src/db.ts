// 数据库访问层：handler 只依赖这个接口，云端用 wx-server-sdk 实现，测试用内存实现。

export type Doc = { _id: string; [k: string]: unknown }

/** 自增标记：update 时 { count: inc(1) } */
export interface IncOp {
  __op: 'inc'
  n: number
}
export const inc = (n: number): IncOp => ({ __op: 'inc', n })
export const isInc = (v: unknown): v is IncOp => !!v && typeof v === 'object' && (v as IncOp).__op === 'inc'

export type Patch = Record<string, unknown>

export interface FindOptions {
  orderBy?: [string, 'asc' | 'desc']
  limit?: number
}

/** 事务内可用的操作（只按 _id 读写） */
export interface TxDb {
  get<T extends Doc>(coll: string, id: string): Promise<T | null>
  set(coll: string, doc: Doc): Promise<void>
  update(coll: string, id: string, patch: Patch): Promise<void>
  remove(coll: string, id: string): Promise<void>
}

export interface Db extends TxDb {
  /** 等值条件查询；值为数组时表示 “in” */
  find<T extends Doc>(coll: string, where: Record<string, unknown>, opts?: FindOptions): Promise<T[]>
  transaction<R>(fn: (tx: TxDb) => Promise<R>): Promise<R>
}

export const COLL = {
  users: 'users',
  actions: 'actions',
  teams: 'teams',
  members: 'members',
  plans: 'plans',
  checkins: 'checkins',
  days: 'days',
  reactions: 'reactions',
  nudges: 'nudges',
  reports: 'reports',
  weights: 'weights',
} as const

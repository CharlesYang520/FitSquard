// 内存假库：用于单测 / 集成测试。事务串行执行，失败时回滚。
import { isInc, type Db, type Doc, type FindOptions, type Patch, type TxDb } from './db'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

/** 支持 "a.b" 点路径，与云数据库 update 语义一致 */
function applyPatch(doc: Doc, patch: Patch): Doc {
  const next = clone(doc) as Doc
  for (const [k, v] of Object.entries(patch)) {
    const path = k.split('.')
    let obj: Record<string, unknown> = next
    for (const p of path.slice(0, -1)) {
      if (!obj[p] || typeof obj[p] !== 'object') obj[p] = {}
      obj = obj[p] as Record<string, unknown>
    }
    const leaf = path[path.length - 1]
    if (isInc(v)) obj[leaf] = ((obj[leaf] as number) ?? 0) + v.n
    else if (v === undefined) delete obj[leaf]
    else obj[leaf] = clone(v)
  }
  return next
}

/** 等值匹配；条件值为数组 = in；文档字段为数组 = 包含 */
function match(d: Doc, k: string, v: unknown): boolean {
  const field = d[k]
  if (Array.isArray(v)) return v.includes(field)
  if (Array.isArray(field)) return field.includes(v)
  return field === v
}

export class MemoryDb implements Db {
  data = new Map<string, Map<string, Doc>>()
  private queue: Promise<unknown> = Promise.resolve()

  private coll(name: string) {
    if (!this.data.has(name)) this.data.set(name, new Map())
    return this.data.get(name)!
  }

  async get<T extends Doc>(coll: string, id: string): Promise<T | null> {
    const d = this.coll(coll).get(id)
    return d ? (clone(d) as T) : null
  }

  async set(coll: string, doc: Doc): Promise<void> {
    this.coll(coll).set(doc._id, clone(doc))
  }

  async update(coll: string, id: string, patch: Patch): Promise<void> {
    const d = this.coll(coll).get(id)
    if (!d) throw new Error(`update 不存在的文档 ${coll}/${id}`)
    this.coll(coll).set(id, applyPatch(d, patch))
  }

  async remove(coll: string, id: string): Promise<void> {
    this.coll(coll).delete(id)
  }

  async find<T extends Doc>(coll: string, where: Record<string, unknown>, opts: FindOptions = {}): Promise<T[]> {
    let rows = [...this.coll(coll).values()].filter((d) => Object.entries(where).every(([k, v]) => match(d, k, v)))
    if (opts.orderBy) {
      const [f, dir] = opts.orderBy
      rows.sort((a, b) => {
        const x = a[f] as number | string
        const y = b[f] as number | string
        return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'asc' ? 1 : -1)
      })
    }
    if (opts.limit) rows = rows.slice(0, opts.limit)
    return rows.map((d) => clone(d) as T)
  }

  transaction<R>(fn: (tx: TxDb) => Promise<R>): Promise<R> {
    const run = async () => {
      const snapshot = clone([...this.data.entries()].map(([k, m]) => [k, [...m.entries()]] as const))
      try {
        return await fn(this)
      } catch (e) {
        this.data = new Map(snapshot.map(([k, entries]) => [k, new Map(entries)]))
        throw e
      }
    }
    const p = this.queue.then(run, run)
    this.queue = p.catch(() => undefined)
    return p
  }
}

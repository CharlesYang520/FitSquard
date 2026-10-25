// 云开发实现（wx-server-sdk）
import { isInc, type Db, type Doc, type FindOptions, type Patch, type TxDb } from './db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const isNotFound = (e: Any) => /not exist|cannot find document|document\.get:fail/i.test(String(e?.errMsg ?? e?.message ?? e))

function toCloudPatch(_: Any, patch: Patch) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) out[k] = isInc(v) ? _.inc(v.n) : v === undefined ? _.remove() : v
  return out
}

function withoutId(doc: Doc) {
  const { _id, ...rest } = doc
  void _id
  return rest
}

function txAdapter(t: Any, _: Any): TxDb {
  return {
    async get(coll, id) {
      try {
        const r = await t.collection(coll).doc(id).get()
        return (r.data ?? null) as Any
      } catch (e) {
        if (isNotFound(e)) return null
        throw e
      }
    },
    async set(coll, doc) {
      await t.collection(coll).doc(doc._id).set({ data: withoutId(doc) })
    },
    async update(coll, id, patch) {
      await t.collection(coll).doc(id).update({ data: toCloudPatch(_, patch) })
    },
    async remove(coll, id) {
      await t.collection(coll).doc(id).remove()
    },
  }
}

export function createCloudDb(cloud: Any): Db {
  const db = cloud.database()
  const _ = db.command
  const base = txAdapter(db, _)
  return {
    ...base,
    async find<T extends Doc>(coll: string, where: Record<string, unknown>, opts: FindOptions = {}) {
      const cond: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(where)) cond[k] = Array.isArray(v) ? _.in(v) : v
      let q = db.collection(coll).where(cond)
      if (opts.orderBy) q = q.orderBy(opts.orderBy[0], opts.orderBy[1])
      q = q.limit(Math.min(opts.limit ?? 1000, 1000))
      const r = await q.get()
      return r.data as T[]
    },
    transaction(fn) {
      return db.runTransaction((t: Any) => fn(txAdapter(t, _)))
    },
  }
}

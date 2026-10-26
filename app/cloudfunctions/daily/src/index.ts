// 定时任务入口（见 config.json）：
// - settle：每天 12:05 结算昨天；局结束时生成战报并通知
// - morning：每天 08:30 发明早提醒
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cloud = require('wx-server-sdk')
import { createCloudDb } from '../../api/src/db.cloud'
import { COLL } from '../../api/src/db'
import { cloudNotifier, templatesFromEnv } from '../../api/src/notify'
import { sendMorning } from './morning'
import { settleAll } from './settle'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = createCloudDb(cloud)
const notifier = cloudNotifier(cloud)

/** 一次性初始化：建齐所有集合（已存在的跳过）。在开发者工具里对 daily「云端测试」传 {"task":"init"} */
async function initCollections() {
  const raw = cloud.database()
  const out: Record<string, string> = {}
  for (const name of Object.values(COLL)) {
    try {
      await raw.createCollection(name)
      out[name] = 'created'
    } catch (e) {
      out[name] = /exist/i.test(String((e as { errMsg?: string })?.errMsg ?? e)) ? 'exists' : `error: ${String((e as Error)?.message ?? e)}`
    }
  }
  return out
}

export async function main(event: { TriggerName?: string; task?: string }) {
  const task = event?.task ?? (event?.TriggerName === 'morning' ? 'morning' : 'settle')
  const deps = { templates: templatesFromEnv(), notifier }
  if (task === 'init') return { ok: true, data: await initCollections() }
  try {
    const data = task === 'morning' ? await sendMorning(db, new Date(), deps) : await settleAll(db, new Date(), deps)
    console.log('[daily]', task, JSON.stringify(data))
    return { ok: true, data }
  } catch (e) {
    console.error('[daily]', task, e)
    return { ok: false, code: 'INTERNAL', message: String(e) }
  }
}

// 日终结算入口：定时触发器每天 12:05（北京时间）调用，见 config.json
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cloud = require('wx-server-sdk')
import { createCloudDb } from '../../api/src/db.cloud'
import { settleAll } from './settle'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = createCloudDb(cloud)

export async function main() {
  try {
    const report = await settleAll(db, new Date())
    console.log('[daily]', JSON.stringify(report))
    return { ok: true, data: report }
  } catch (e) {
    console.error('[daily]', e)
    return { ok: false, code: 'INTERNAL', message: String(e) }
  }
}

// 业务接口入口：{ action, payload } → { ok, data } | { ok:false, code, message }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cloud = require('wx-server-sdk')
import { createCloudDb } from './db.cloud'
import { adminIdsFromEnv, makeCtx, type WeRunStep } from './context'
import { cloudNotifier, templatesFromEnv } from './notify'
import { dispatch } from './router'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = createCloudDb(cloud)
const notifier = cloudNotifier(cloud)

/** 小程序码：同一个 scene 只生成一次，存在云存储 qrcode/ 下 */
async function qrcode(scene: string, page: string): Promise<string | null> {
  const cloudPath = `qrcode/${scene.replace(/[^a-zA-Z0-9]/g, '_')}.png`
  const envId = cloud.getWXContext().ENV
  const fileID = `cloud://${envId}/${cloudPath}`
  const urlOf = async (id: string) => (await cloud.getTempFileURL({ fileList: [id] })).fileList?.[0]?.tempFileURL || null
  const existing = await urlOf(fileID).catch(() => null)
  if (existing) return existing
  const r = await cloud.openapi.wxacode.getUnlimited({ scene, page, checkPath: false, width: 280 })
  const up = await cloud.uploadFile({ cloudPath, fileContent: r.buffer })
  return urlOf(up.fileID)
}

interface ApiEvent {
  action?: string
  payload?: unknown
  /** 前端传 wx.cloud.CloudID(cloudID)，云调用会自动解密成 { data: { stepInfoList } } */
  weRunData?: { data?: { stepInfoList?: WeRunStep[] } }
}

export async function main(event: ApiEvent) {
  // 身份只取云函数上下文，不信任前端传入
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NOT_LOGGED_IN', message: '缺少用户身份' }
  const ctx = makeCtx({
    db,
    openid: OPENID,
    now: new Date(),
    weRunSteps: event?.weRunData?.data?.stepInfoList,
    templates: templatesFromEnv(),
    notifier,
    qrcode,
    adminIds: adminIdsFromEnv(),
  })
  return dispatch(ctx, event?.action, event?.payload)
}

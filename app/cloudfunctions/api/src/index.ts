// 业务接口入口：{ action, payload } → { ok, data } | { ok:false, code, message }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cloud = require('wx-server-sdk')
import { createCloudDb } from './db.cloud'
import { makeCtx, type WeRunStep } from './context'
import { dispatch } from './router'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = createCloudDb(cloud)

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
  })
  return dispatch(ctx, event?.action, event?.payload)
}

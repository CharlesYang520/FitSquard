import Taro from '@tarojs/taro'
import { CLOUD_ENV, NETWORK_ERROR_TEXT } from '../config'
import { callLocal } from './local'
import type { home } from '../../cloudfunctions/api/src/handlers/home'
import type { todayView, setMood, submit, werun } from '../../cloudfunctions/api/src/handlers/checkin'
import type { create, join, preview, publicInfo } from '../../cloudfunctions/api/src/handlers/team'
import type { login } from '../../cloudfunctions/api/src/handlers/user'
import type { get as reportGet, list as reportList } from '../../cloudfunctions/api/src/handlers/report'
import type { list as weightList } from '../../cloudfunctions/api/src/handlers/weight'

type R<F extends (...a: any[]) => any> = Awaited<ReturnType<F>>
export type LoginData = R<typeof login>
export type HomeData = R<typeof home>
export type TodayData = R<typeof todayView>
export type TodayItem = TodayData['items'][number]
export type SubmitData = R<typeof submit>
export type MoodData = R<typeof setMood>
export type WerunData = R<typeof werun>
export type PreviewData = R<typeof preview>
export type CreateData = R<typeof create>
export type JoinData = R<typeof join>
export type PublicInfoData = R<typeof publicInfo>
export type ReportData = R<typeof reportGet>
export type ReportListData = R<typeof reportList>
export type WeightListData = R<typeof weightList>

export const isLocalMode = !CLOUD_ENV

/** 兜底文案：云函数一般已经给了中文 message */
const CODE_TEXT: Record<string, string> = {
  NOT_LOGGED_IN: '先登录一下',
  NOT_MEMBER: '你还不是这支战队的成员',
  ALREADY_IN_TEAM: '你已经在一支战队里了，这期结束再来',
  TEAM_FULL: '这队已经满 10 人了',
  TEAM_ENDED: '这局已经结束了',
  NOT_IN_PLAN: '这一项不在今天的清单里',
  LOCKED: '还没到可以打卡的时间',
  DUPLICATE: '这一项今天已经打过了',
  MOOD_LIMIT: '这局“不太舒服”的次数用完了',
  BAD_INPUT: '参数不对，刷新一下再试',
  INTERNAL: '服务开小差了，再试一次',
  FORBIDDEN: '没有权限',
  BANNED: '账号已被限制使用，如有疑问请联系客服',
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

interface CallOptions {
  /** 出错时不弹 toast */
  silent?: boolean
  /** 微信运动 cloudID（只在 checkin.werun 用） */
  weRunCloudID?: string
}

export async function api<T = unknown>(action: string, payload: Record<string, unknown> = {}, opts: CallOptions = {}): Promise<T> {
  let res: { ok: boolean; data?: unknown; code?: string; message?: string }
  try {
    if (isLocalMode) {
      res = await callLocal(action, payload)
    } else {
      const data: Record<string, unknown> = { action, payload }
      if (opts.weRunCloudID) data.weRunData = Taro.cloud.CloudID(opts.weRunCloudID)
      const r = (await Taro.cloud.callFunction({ name: 'api', data } as any)) as unknown as { result: typeof res }
      res = r.result
    }
  } catch (e) {
    console.error('[api]', action, e)
    if (!opts.silent) Taro.showToast({ title: NETWORK_ERROR_TEXT, icon: 'none' })
    throw new ApiError('NETWORK', NETWORK_ERROR_TEXT)
  }
  if (!res?.ok) {
    const code = res?.code ?? 'INTERNAL'
    const msg = res?.message || CODE_TEXT[code] || CODE_TEXT.INTERNAL
    if (!opts.silent) Taro.showToast({ title: msg, icon: 'none', duration: 2200 })
    throw new ApiError(code, msg)
  }
  return res.data as T
}

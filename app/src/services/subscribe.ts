// 订阅消息授权：必须在用户点击的回调里同步调用（微信要求 tap 触发）。
// 同意的模板交给云函数加额度；用户今天拒绝过就不再弹，避免打扰。
import Taro from '@tarojs/taro'
import { api } from './api'
import { session } from '../store/session'

type Kind = 'morning' | 'nudge' | 'team'
const REJECT_KEY = 'fs_sub_reject_date'

const todayKey = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)

/** 在点击回调里调用；返回本次同意了哪些 */
export function askSubscribe(kinds: Kind[] = ['morning', 'nudge', 'team']): Promise<Kind[]> {
  const tpl = session.templates ?? {}
  const pairs = kinds.map((k) => [k, tpl[k]] as const).filter((p): p is readonly [Kind, string] => !!p[1])
  if (!pairs.length || Taro.getStorageSync(REJECT_KEY) === todayKey()) return Promise.resolve([])
  return new Promise((resolve) => {
    Taro.requestSubscribeMessage({
      tmplIds: pairs.map((p) => p[1]),
      success: (res: Record<string, string>) => {
        const accepted = pairs.filter(([, id]) => res[id] === 'accept').map(([k]) => k)
        if (accepted.length < pairs.length) Taro.setStorageSync(REJECT_KEY, todayKey())
        if (accepted.length) api('sub.grant', { accepted }, { silent: true }).catch(() => undefined)
        resolve(accepted)
      },
      fail: () => resolve([]),
    } as any)
  })
}

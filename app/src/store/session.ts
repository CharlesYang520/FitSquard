// 轻量会话：当前用户、当前局、待处理的战书。页面之间共享模块状态即可，不引入状态库。
import Taro from '@tarojs/taro'
import { api, type LoginData } from '../services/api'

const AGREED_KEY = 'fs_agreed'

interface Session {
  user: LoginData['user'] | null
  team: LoginData['team']
  templates: LoginData['templates'] | null
  /** 经战书打开但还没登录时，先记下来，登录后跳回去 */
  pendingInvite: string | null
}

export const session: Session = { user: null, team: null, templates: null, pendingInvite: null }

export const hasAgreed = () => !!Taro.getStorageSync(AGREED_KEY)

/** 已建档用户打开小程序：静默拿状态；没建档返回 null */
export async function refreshSession(): Promise<LoginData | null> {
  if (!hasAgreed()) return null
  try {
    const d = await api<LoginData>('user.login', {}, { silent: true })
    session.user = d.user
    session.team = d.team
    session.templates = d.templates
    return d
  } catch {
    return null
  }
}

export async function loginWith(profile: { nickname?: string; avatar?: string }) {
  const d = await api<LoginData>('user.login', { agreed: true, ...profile })
  Taro.setStorageSync(AGREED_KEY, 1)
  session.user = d.user
  session.team = d.team
  session.templates = d.templates
  return d
}

/** 每个需要登录的页面在 onShow 调用：没登录就去登录页 */
export async function ensureLogin(): Promise<boolean> {
  if (session.user) return true
  const d = await refreshSession()
  if (d) return true
  Taro.redirectTo({ url: '/pages/login/index' })
  return false
}

/** 登录后去哪：有战书去战书，否则回首页 */
export function goAfterLogin() {
  if (session.pendingInvite) {
    const id = session.pendingInvite
    session.pendingInvite = null
    Taro.redirectTo({ url: `/pages/invite/index?team=${id}` })
  } else {
    Taro.switchTab({ url: '/pages/home/index' })
  }
}

/** 注销 / 清空后重置 */
export function clearSession() {
  session.user = null
  session.team = null
  session.templates = null
  session.pendingInvite = null
  Taro.removeStorageSync(AGREED_KEY)
}

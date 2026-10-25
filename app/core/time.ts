// 北京时间（UTC+8）日期工具：所有“日期”都是 YYYY-MM-DD 字符串，不依赖运行环境时区。
import type { ActionWindow } from './types'

const CN_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

/** 北京时间的今天 */
export function todayCN(now: Date = new Date()): string {
  const d = new Date(now.getTime() + CN_OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** 北京时间当天已过的分钟数（0–1439） */
export function minutesCN(now: Date = new Date()): number {
  const d = new Date(now.getTime() + CN_OFFSET_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** 北京时间 HH:mm */
export function clockCN(now: Date = new Date()): string {
  const m = minutesCN(now)
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

function toUTCms(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`非法日期：${date}`)
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(date: string, n: number): string {
  const d = new Date(toUTCms(date) + n * DAY_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** b - a 的天数 */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTCms(b) - toUTCms(a)) / DAY_MS)
}

/** 0=周日 … 6=周六 */
export function weekdayOf(date: string): number {
  return new Date(toUTCms(date)).getUTCDay()
}

const WEEK_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function weekdayLabel(date: string): string {
  return WEEK_LABEL[weekdayOf(date)]
}

/** 时间窗开放时刻（分钟） */
export const WINDOW_OPEN_AT: Record<Exclude<ActionWindow, 'next_morning'>, number> = {
  any: 0,
  after_lunch: 12 * 60,
  after_dinner: 18 * 60,
  after_20: 20 * 60,
  after_21: 21 * 60,
}
export const NEXT_MORNING_FROM = 5 * 60
export const NEXT_MORNING_TO = 12 * 60

export type WindowState =
  | { open: true }
  | { open: false; reason: 'not_yet'; unlockLabel: string }
  | { open: false; reason: 'next_morning' }
  | { open: false; reason: 'expired' }

/**
 * 某天清单里的一项，此刻能不能打卡。
 * - 只能打“今天”的项；next_morning 类只能在次日 05:00–12:00 确认前一天。
 */
export function windowState(window: ActionWindow, planDate: string, now: Date = new Date()): WindowState {
  const today = todayCN(now)
  const mins = minutesCN(now)
  if (window === 'next_morning') {
    if (planDate === today) return { open: false, reason: 'next_morning' }
    if (addDays(planDate, 1) === today && mins >= NEXT_MORNING_FROM && mins < NEXT_MORNING_TO) return { open: true }
    return { open: false, reason: 'expired' }
  }
  if (planDate !== today) return { open: false, reason: 'expired' }
  const openAt = WINDOW_OPEN_AT[window]
  if (mins >= openAt) return { open: true }
  return { open: false, reason: 'not_yet', unlockLabel: `${pad(Math.floor(openAt / 60))}:${pad(openAt % 60)}` }
}

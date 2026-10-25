// 前后端共用类型

export type Group = 'move' | 'food' | 'rest'
export type DayType = 'workday' | 'holiday'
export type ActionDayType = DayType | 'any' | 'festival'
export type Scene = 'office' | 'home' | 'outdoor' | 'any'
export type Intensity = 'light' | 'medium'
export type Verify = 'self' | 'werun'
/** 可打卡时间窗；next_morning = 次日 05:00–12:00 确认前一天 */
export type ActionWindow = 'any' | 'after_lunch' | 'after_dinner' | 'after_20' | 'after_21' | 'next_morning'
/** all=综合 walk=多走动 eat=吃好点 sleep=早点睡 */
export type Theme = 'all' | 'walk' | 'eat' | 'sleep'
export type Mood = 'normal' | 'busy' | 'unwell'
export type ReactionKind = 'cheer' | 'jiuzhe' | 'limao'

export const THEMES: Theme[] = ['all', 'walk', 'eat', 'sleep']
export const PERIODS = [14, 21] as const
export type PeriodDays = (typeof PERIODS)[number]

export interface Action {
  _id: string
  group: Group
  day_type: ActionDayType
  recovery: boolean
  minutes: number
  scene: Scene
  intensity: Intensity
  verify: Verify
  werun_steps?: number
  window: ActionWindow
  emoji: string
  text: string
  sub?: string
  reason: string
  /** 空数组 = 适合所有主题 */
  themes: Theme[]
  status: 'on' | 'off'
}

export interface HolidayCalendar {
  holidays: string[]
  workdays: string[]
}

export interface PlanDay {
  day_no: number
  date: string
  day_type: DayType
  recovery_day: boolean
  items: string[]
  pick_id: string
  /** 该天用了兜底清单 */
  fallback?: boolean
}

export interface Plan {
  version: number
  seed: number
  generated_by: 'rules' | 'fallback'
  days: PlanDay[]
}

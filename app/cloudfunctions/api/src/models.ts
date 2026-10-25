import type { DayType, Mood, PlanDay, ReactionKind, Theme, Verify } from '@core/types'

export interface UserDoc {
  _id: string // openid
  nickname: string
  avatar: string
  agreed_at: number
  streak_days: number
  streak_best: number
  active_team_id: string | null
  created_at: number
  sub_quota?: Partial<Record<'morning' | 'nudge' | 'team', number>>
  last_morning_date?: string | null
  /** 私密：只在 weight.* 接口读写 */
  height_cm?: number | null
  health_consent_at?: number | null
  deleted_at?: number | null
  [k: string]: unknown
}

export interface TeamDoc {
  _id: string
  name: string
  captain_id: string
  theme: Theme
  period_days: number
  start_date: string
  end_date: string
  status: 'active' | 'ended'
  taunt: string
  member_count: number
  team_streak: number
  team_streak_best: number
  last_settled_date: string | null
  created_at: number
  offline_note?: string
  prev_team_id?: string | null
  next_team_id?: string | null
  /** 已发过“全员到齐”通知的日期 */
  all_done_dates?: string[]
  report_ready?: boolean
  [k: string]: unknown
}

export interface MemberDoc {
  _id: string // `${teamId}_${openid}`
  team_id: string
  user_id: string
  joined_date: string
  left_date: string | null
  unwell_days_used: number
  done_days: number
  counted_items: number
  streak_days: number
  streak_best: number
  [k: string]: unknown
}

export interface PlanDoc {
  _id: string // teamId
  version: number
  seed: number
  generated_by: 'rules' | 'fallback'
  theme: Theme
  days: PlanDay[]
  [k: string]: unknown
}

export interface CheckinDoc {
  _id: string // `${teamId}_${openid}_${date}_${actionId}`
  team_id: string
  user_id: string
  date: string
  day_no: number
  action_id: string
  mood: Mood
  verified_by: Verify
  counted: boolean
  extra: boolean
  created_at: number
  [k: string]: unknown
}

export interface DayDoc {
  _id: string // `${teamId}_${openid}_${date}`
  team_id: string
  user_id: string
  date: string
  day_type: DayType
  mood: Mood
  counted_count: number
  qualified: boolean
  last_counted_at: number | null
  /** 当天第一次达标的时间 */
  qualified_at?: number | null
  [k: string]: unknown
}

export interface NudgeDoc {
  _id: string
  team_id: string
  from: string
  to: string
  date: string
  via: 'notify' | 'share'
  created_at: number
  [k: string]: unknown
}

export interface ReportDoc {
  _id: string // teamId
  member_ids: string[]
  team: {
    name: string
    theme: string
    period_days: number
    start_date: string
    end_date: string
    offline_note: string
    rate: number
    all_done_days: number
    best_team_streak: number
    member_count: number
  }
  members: Array<{
    user_id: string
    done_days: number
    expected_days: number
    rate: number
    best_streak: number
    rank: number
    title: string | null
  }>
  created_at: number
  [k: string]: unknown
}

export interface WeightDoc {
  _id: string // `${openid}_${date}`
  user_id: string
  date: string
  weight_kg: number
  created_at: number
  [k: string]: unknown
}

export interface ReactionDoc {
  _id: string // `${checkinId}_${openid}_${kind}`
  checkin_id: string
  team_id: string
  user_id: string
  kind: ReactionKind
  created_at: number
  [k: string]: unknown
}

export const memberId = (teamId: string, openid: string) => `${teamId}_${openid}`
export const dayId = (teamId: string, openid: string, date: string) => `${teamId}_${openid}_${date}`
export const checkinId = (teamId: string, openid: string, date: string, actionId: string) =>
  `${teamId}_${openid}_${date}_${actionId}`

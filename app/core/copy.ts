// 前后端共用的固定文案

/** 战书狠话 3 选 1 */
export const TAUNTS = ['谁先摸鱼谁请客，不服来战', '14 天后见分晓', '别说明天开始了，就今天'] as const

export const THEME_LABEL = { all: '综合', walk: '多走动', eat: '吃好点', sleep: '早点睡' } as const

export const MOOD_LABEL = { normal: '正常', busy: '很忙', unwell: '不太舒服' } as const

export const GROUP_LABEL = { move: '🏃 动一动', food: '🥗 吃喝', rest: '🌙 作息' } as const

export const REACTIONS = [
  { kind: 'cheer', label: '💪' },
  { kind: 'jiuzhe', label: '就这？' },
  { kind: 'limao', label: '你礼貌吗' },
] as const

export const MAX_MEMBERS = 10
export const TEAM_NAME_MAX = 16

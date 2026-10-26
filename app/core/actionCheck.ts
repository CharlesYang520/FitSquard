// 行动模板校验：字段合法 + 安全边界（PRD P-05：不出现热量、克数、断食、节食、药物、补剂、疾病判断、减重承诺）
import type { Action } from './types'
import { THEMES } from './types'

export const TEXT_MAX = 24
export const REASON_MAX = 30
export const SUB_MAX = 16

export const SENSITIVE = [
  '热量', '卡路里', '大卡', '千卡', '克', '断食', '辟谷', '节食', '不吃饭', '催吐', '泻',
  '药', '补剂', '代餐', '减肥茶', '燃脂', '暴瘦', '瘦身霜', '治疗', '疾病', '降血压', '降血糖',
  '斤', '公斤', 'kg', 'KG',
]

const ENUMS = {
  group: ['move', 'food', 'rest'],
  day_type: ['workday', 'holiday', 'any', 'festival'],
  scene: ['office', 'home', 'outdoor', 'any'],
  intensity: ['light', 'medium'],
  verify: ['self', 'werun'],
  window: ['any', 'after_lunch', 'after_dinner', 'after_20', 'after_21', 'next_morning'],
  status: ['on', 'off'],
} as const

export function sensitiveHits(text: string): string[] {
  return SENSITIVE.filter((w) => text.includes(w))
}

/** 返回错误列表（空 = 通过） */
export function checkAction(a: Partial<Action>): string[] {
  const errs: string[] = []
  if (!a._id || !/^[a-z][a-z0-9_]{1,15}$/.test(a._id)) errs.push('ID 只能是小写字母开头的字母数字，2–16 位')
  for (const [k, vals] of Object.entries(ENUMS)) {
    if (!(vals as readonly string[]).includes(String((a as Record<string, unknown>)[k]))) errs.push(`${k} 取值不对`)
  }
  // 自报项 ≤ 60 分钟；步数项按“一天累计”估算，放宽到 120
  const maxMin = a.verify === 'werun' ? 120 : 60
  if (typeof a.minutes !== 'number' || a.minutes < 0 || a.minutes > maxMin || !Number.isInteger(a.minutes)) errs.push(`时长填 0–${maxMin} 的整数分钟`)
  if (typeof a.recovery !== 'boolean') errs.push('recovery 必须是是 / 否')
  if (a.verify === 'werun' && !(Number(a.werun_steps) >= 1000 && Number(a.werun_steps) <= 30000)) errs.push('步数目标填 1000–30000')
  if (!a.text || [...a.text].length > TEXT_MAX) errs.push(`文案必填，≤ ${TEXT_MAX} 字`)
  if (!a.reason || [...a.reason].length > REASON_MAX) errs.push(`推荐理由必填，≤ ${REASON_MAX} 字`)
  if (a.sub && [...a.sub].length > SUB_MAX) errs.push(`副标题 ≤ ${SUB_MAX} 字`)
  // 组合 emoji（如 👨‍👩‍👧）由多个码位组成，放宽到 8
  if (!a.emoji || [...a.emoji].length > 8) errs.push('emoji 必填（1 个）')
  if (!Array.isArray(a.themes) || a.themes.some((t) => !THEMES.includes(t))) errs.push('主题标签不对')
  const hits = sensitiveHits(`${a.text ?? ''}${a.sub ?? ''}${a.reason ?? ''}`)
  if (hits.length) errs.push(`含敏感词：${hits.join('、')}`)
  return errs
}

// 工作日 / 休息日判断：调休上班日 → 工作日；法定假日 → 休息日；周六日 → 休息日；其他 → 工作日
import type { DayType, HolidayCalendar } from './types'
import { weekdayOf } from './time'

export function mergeCalendars(...cals: HolidayCalendar[]): HolidayCalendar {
  return {
    holidays: cals.flatMap((c) => c.holidays),
    workdays: cals.flatMap((c) => c.workdays),
  }
}

export function dayType(date: string, cal: HolidayCalendar): DayType {
  if (cal.workdays.includes(date)) return 'workday'
  if (cal.holidays.includes(date)) return 'holiday'
  const w = weekdayOf(date)
  return w === 0 || w === 6 ? 'holiday' : 'workday'
}

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  workday: '工作日',
  holiday: '休息日',
}

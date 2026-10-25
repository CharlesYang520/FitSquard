import { describe, expect, it } from 'vitest'
import { addDays, clockCN, diffDays, todayCN, weekdayOf, windowState } from '../time'
import { dayType, mergeCalendars } from '../dayType'
import cal2026 from '../../data/holidays/2026.json'
import cal2027 from '../../data/holidays/2027.json'

const cal = mergeCalendars(cal2026, cal2027)
/** 北京时间构造 Date */
const cn = (s: string) => new Date(`${s}+08:00`)

describe('time', () => {
  it('按北京时间取日期，不受 UTC 跨日影响', () => {
    expect(todayCN(new Date('2026-10-24T16:30:00Z'))).toBe('2026-10-25') // 北京 00:30
    expect(todayCN(new Date('2026-10-24T15:59:00Z'))).toBe('2026-10-24') // 北京 23:59
    expect(clockCN(new Date('2026-10-24T04:40:00Z'))).toBe('12:40')
  })

  it('加减天数与跨月、跨年', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-10-19', '2026-10-24')).toBe(5)
    expect(weekdayOf('2026-10-24')).toBe(6)
  })

  it('非法日期抛错', () => {
    expect(() => addDays('2026/10/24', 1)).toThrow()
  })
})

describe('dayType', () => {
  it('普通工作日与周末', () => {
    expect(dayType('2026-10-22', cal)).toBe('workday') // 周四
    expect(dayType('2026-10-24', cal)).toBe('holiday') // 周六
    expect(dayType('2026-10-25', cal)).toBe('holiday') // 周日
  })

  it('法定假日落在工作日 → 休息日', () => {
    expect(dayType('2026-10-05', cal)).toBe('holiday') // 周一，国庆
    expect(dayType('2026-02-23', cal)).toBe('holiday') // 周一，春节
  })

  it('调休上班日落在周末 → 工作日', () => {
    expect(dayType('2026-10-10', cal)).toBe('workday') // 周六补班
    expect(dayType('2026-09-20', cal)).toBe('workday') // 周日补班
    expect(dayType('2026-01-04', cal)).toBe('workday')
  })

  it('2027 未发布前按周末判断', () => {
    expect(dayType('2027-01-01', cal)).toBe('workday') // 周五，待补齐
    expect(dayType('2027-01-02', cal)).toBe('holiday')
  })
})

describe('windowState', () => {
  it('随时项：只能打今天', () => {
    expect(windowState('any', '2026-10-22', cn('2026-10-22T08:00:00'))).toEqual({ open: true })
    expect(windowState('any', '2026-10-21', cn('2026-10-22T08:00:00')).open).toBe(false)
    expect(windowState('any', '2026-10-23', cn('2026-10-22T23:59:00')).open).toBe(false)
  })

  it('时间窗未到显示解锁时间', () => {
    expect(windowState('after_20', '2026-10-22', cn('2026-10-22T12:40:00'))).toEqual({
      open: false,
      reason: 'not_yet',
      unlockLabel: '20:00',
    })
    expect(windowState('after_20', '2026-10-22', cn('2026-10-22T20:00:00'))).toEqual({ open: true })
    expect(windowState('after_lunch', '2026-10-22', cn('2026-10-22T11:59:00')).open).toBe(false)
  })

  it('次日早上确认：当天锁定，次日 05:00–12:00 开放', () => {
    expect(windowState('next_morning', '2026-10-22', cn('2026-10-22T23:00:00'))).toEqual({ open: false, reason: 'next_morning' })
    expect(windowState('next_morning', '2026-10-22', cn('2026-10-23T04:59:00')).open).toBe(false)
    expect(windowState('next_morning', '2026-10-22', cn('2026-10-23T05:00:00'))).toEqual({ open: true })
    expect(windowState('next_morning', '2026-10-22', cn('2026-10-23T11:59:00'))).toEqual({ open: true })
    expect(windowState('next_morning', '2026-10-22', cn('2026-10-23T12:00:00'))).toEqual({ open: false, reason: 'expired' })
  })
})

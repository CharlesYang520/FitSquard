// 打卡组件：行动行、3 个贴纸槽、AI 推荐卡、按住 1 秒确认
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { clockCN } from '@core/time'
import type { TodayItem } from '../services/api'
import './checkin.scss'

const WINDOW_LABEL: Record<string, string> = {
  any: '随时',
  after_lunch: '午饭后',
  after_dinner: '晚饭后',
  after_20: '晚上确认',
  after_21: '睡前',
  next_morning: '明早确认',
}

export function itemMeta(a: Pick<TodayItem, 'minutes' | 'window' | 'verify' | 'sub'>): string[] {
  const out: string[] = []
  if (a.verify === 'werun') out.push('微信运动自动打卡')
  else if (a.minutes > 0) out.push(`⏱ ${a.minutes} 分钟`)
  if (a.sub && a.verify !== 'werun') out.push(a.sub)
  else if (a.verify !== 'werun') out.push(WINDOW_LABEL[a.window] ?? '随时')
  return out
}

export function CheckButton(props: { dark?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <View
      className={`fs-chk ${props.dark ? 'fs-chk--dark' : ''} ${props.disabled ? 'is-disabled' : ''}`}
      hoverClass='is-pressed'
      onClick={props.onClick}
      ariaRole='button'
      ariaLabel='打卡'
    >
      ✓
    </View>
  )
}

export function StepRing(props: { steps: number; target: number }) {
  const p = Math.max(0, Math.min(100, Math.round((props.steps / Math.max(1, props.target)) * 100)))
  return (
    <View className='fs-ring' style={{ background: `conic-gradient(#FF5A1F ${p}%, #F4F3EF 0)` }}>
      <View className='fs-ring__hole'>{p}%</View>
    </View>
  )
}

export function TaskRow(props: {
  item: TodayItem
  steps?: number | null
  werunAuthorized?: boolean
  onCheck: (item: TodayItem) => void
  onAuthWerun?: () => void
  /** 两项间隔内：打勾按钮置灰 */
  cooling?: boolean
}) {
  const { item, steps } = props
  const locked = item.state === 'locked' || item.state === 'expired'
  let right: JSX.Element
  if (item.state === 'werun') {
    right =
      steps == null ? (
        <View className='fs-lockt' onClick={props.onAuthWerun}>
          <Text className='b'>去授权</Text>自动打卡
        </View>
      ) : (
        <StepRing steps={steps} target={item.werun_steps} />
      )
  } else if (item.state === 'locked') {
    right = (
      <View className='fs-lockt'>
        <Text className='b'>{item.unlock_label}</Text>
        {item.unlock_label === '明早' ? '确认' : '后可打'}
      </View>
    )
  } else if (item.state === 'expired') {
    right = <View className='fs-lockt'>已过时间</View>
  } else {
    right = <CheckButton disabled={props.cooling} onClick={() => props.onCheck(item)} />
  }
  return (
    <View className={`fs-row ${locked ? 'is-locked' : ''}`}>
      <View className='fs-row__ic'>{item.emoji}</View>
      <View className='fs-row__body'>
        <View className='fs-row__nm'>{item.text}</View>
        <View className='fs-row__mt'>
          {itemMeta(item).map((m) => (
            <Text key={m} className='fs-row__tag'>
              {m}
            </Text>
          ))}
          {steps != null && item.state === 'werun' && <Text className='fs-row__tag'>{`${steps.toLocaleString()} / ${item.werun_steps}`}</Text>}
        </View>
      </View>
      {right}
    </View>
  )
}

export function Slots(props: { done: { id: string; emoji: string; text: string; at?: number }[]; target: number }) {
  const full = props.done.length >= props.target
  const cells = Array.from({ length: props.target }, (_, i) => props.done[i])
  const left = props.target - props.done.length
  return (
    <View className={`fs-slots ${props.target === 1 ? 'fs-slots--1' : ''} ${full ? 'is-full' : ''}`}>
      {cells.map((c, i) =>
        c ? (
          <View key={c.id} className='fs-slot is-on'>
            <Text className='em'>{c.emoji}</Text>
            <Text className='nm'>{c.text}</Text>
            {c.at && <Text className='tm'>{clockCN(new Date(c.at))}</Text>}
          </View>
        ) : (
          <View key={`e${i}`} className='fs-slot'>
            <Text className='plus'>+</Text>
            {i === props.done.length && <Text className='hint'>{props.target === 1 ? '今天只需要 1 项' : `还差 ${left} 项`}</Text>}
          </View>
        ),
      )}
    </View>
  )
}

export function PickCard(props: { item: TodayItem; label: string; cooling?: boolean; onCheck?: (item: TodayItem) => void }) {
  const { item } = props
  const canCheck = item.state === 'open'
  return (
    <View className='fs-pick'>
      <Text className='fs-pick__lb'>{props.label}</Text>
      <View className='fs-pick__why'>{item.reason}</View>
      <View className='fs-pick__what'>
        {item.emoji} {item.text}
      </View>
      <View className='fs-pick__meta'>
        {itemMeta(item).map((m) => (
          <Text key={m}>{m}</Text>
        ))}
      </View>
      {canCheck && props.onCheck && (
        <View className='fs-pick__chk'>
          <CheckButton dark disabled={props.cooling} onClick={() => props.onCheck!(item)} />
        </View>
      )}
      {item.state === 'locked' && <Text className='fs-pick__lock'>{item.unlock_label} 后可打</Text>}
    </View>
  )
}

/** 底部确认层：主按钮按住 1 秒才提交，松手取消 */
export function HoldConfirm(props: {
  item: TodayItem | null
  teammates: number
  nickname: string
  onConfirm: (item: TodayItem) => void
  onClose: () => void
}) {
  const { item } = props
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }
  useEffect(() => clear, [])
  useEffect(() => {
    if (!item) clear()
  }, [item])

  if (!item) return null
  const start = () => {
    setHolding(true)
    timer.current = setTimeout(() => {
      timer.current = null
      setHolding(false)
      Taro.vibrateShort({ type: 'medium' }).catch(() => undefined)
      props.onConfirm(item)
    }, 1000)
  }

  return (
    <View className='fs-sheet-wrap'>
      <View className='fs-mask' onClick={props.onClose} />
      <View className='fs-sheet'>
        <View className='fs-sheet__head'>
          <View className='fs-sheet__ic'>{item.emoji}</View>
          <View className='fs-sheet__ttl'>
            <View className='t'>真的做完了？</View>
            <View className='s'>{item.text}</View>
          </View>
        </View>
        <View className='fs-pledge'>
          {`会以“${props.nickname || '你'} ${clockCN(new Date())} 完成了 ${item.text}”的形式出现在队内动态${
            props.teammates > 0 ? `，${props.teammates} 个队友都看得到` : ''
          }。没做完就先别按。排名只奖励真做了的人。`}
        </View>
        <View
          className={`fs-hold ${holding ? 'is-holding' : ''}`}
          onTouchStart={start}
          onTouchEnd={() => timer.current && clear()}
          onTouchCancel={() => timer.current && clear()}
        >
          <View className='fs-hold__fill' />
          <Text className='fs-hold__txt'>{holding ? '再按一下下…' : '按住 1 秒 · 真的做完了'}</Text>
        </View>
        <View className='fs-sheet__cancel' onClick={props.onClose}>
          还没，等下再来
        </View>
      </View>
    </View>
  )
}

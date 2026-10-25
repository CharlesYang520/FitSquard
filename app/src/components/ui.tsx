// 基础组件：按钮、卡片、标签、分段控件、头像、今日头像排、免责
import { Button as TButton, Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'
import './ui.scss'

type BtnKind = 'primary' | 'secondary' | 'accent' | 'text'

export function Button(props: {
  kind?: BtnKind
  block?: boolean
  small?: boolean
  disabled?: boolean
  loading?: boolean
  openType?: 'share' | 'chooseAvatar'
  onClick?: () => void
  onChooseAvatar?: (e: any) => void
  className?: string
  children: ReactNode
}) {
  const { kind = 'primary', block, small, disabled, loading, openType, onClick, onChooseAvatar, className = '', children } = props
  const cls = `fs-btn fs-btn--${kind} ${block ? 'fs-btn--block' : ''} ${small ? 'fs-btn--sm' : ''} ${disabled ? 'is-disabled' : ''} ${className}`
  return (
    <TButton
      className={cls}
      openType={openType}
      disabled={disabled || loading}
      loading={loading}
      hoverClass='is-pressed'
      onClick={disabled ? undefined : onClick}
      onChooseAvatar={onChooseAvatar}
    >
      {children}
    </TButton>
  )
}

export function Card(props: { className?: string; dark?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <View className={`fs-card ${props.dark ? 'fs-card--dark' : ''} ${props.className ?? ''}`} onClick={props.onClick}>
      {props.children}
    </View>
  )
}

export function Tag(props: { kind?: 'solid' | 'line' | 'accent' | 'soft'; children: ReactNode; className?: string }) {
  return <Text className={`fs-tag fs-tag--${props.kind ?? 'soft'} ${props.className ?? ''}`}>{props.children}</Text>
}

export interface SegOption<K extends string> {
  key: K
  label: string
  disabled?: boolean
}

export function Segmented<K extends string>(props: {
  options: SegOption<K>[]
  value: K
  onChange: (k: K) => void
  onDisabledClick?: (k: K) => void
  className?: string
}) {
  return (
    <View className={`fs-seg ${props.className ?? ''}`}>
      {props.options.map((o) => (
        <View
          key={o.key}
          className={`fs-seg__item ${o.key === props.value ? 'is-on' : ''} ${o.disabled ? 'is-disabled' : ''}`}
          onClick={() => (o.disabled ? props.onDisabledClick?.(o.key) : o.key !== props.value && props.onChange(o.key))}
        >
          {o.label}
        </View>
      ))}
    </View>
  )
}

/** 选项片（可多个并排，单选） */
export function Chips<K extends string>(props: { options: SegOption<K>[]; value: K; onChange: (k: K) => void; column?: boolean }) {
  return (
    <View className={`fs-chips ${props.column ? 'fs-chips--col' : ''}`}>
      {props.options.map((o) => (
        <View key={o.key} className={`fs-chip ${o.key === props.value ? 'is-on' : ''}`} onClick={() => props.onChange(o.key)}>
          {o.label}
        </View>
      ))}
    </View>
  )
}

const AVATAR_COLORS = ['#C9B8A6', '#9FB1A3', '#A8A9C2', '#C7A9A4', '#B9B39A', '#A3B6C4']
function colorOf(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function Avatar(props: { id: string; name: string; src?: string; size?: 'sm' | 'md' | 'lg'; state?: 'done' | 'todo'; className?: string }) {
  const { id, name, src, size = 'md', state } = props
  const letter = (name || '队').trim().slice(0, 1).toUpperCase()
  return (
    <View
      className={`fs-avatar fs-avatar--${size} ${state ? `is-${state}` : ''} ${props.className ?? ''}`}
      style={src ? undefined : { background: colorOf(id) }}
    >
      {src ? <Image className='fs-avatar__img' src={src} mode='aspectFill' /> : <Text>{letter}</Text>}
      {state === 'done' && <View className='fs-avatar__tick'>✓</View>}
    </View>
  )
}

export function TodayRow(props: { members: { user_id: string; nickname: string; avatar: string; qualified: boolean }[]; size?: 'sm' | 'md' }) {
  return (
    <View className='fs-today-row'>
      {props.members.map((m) => (
        <Avatar key={m.user_id} id={m.user_id} name={m.nickname} src={m.avatar} size={props.size ?? 'md'} state={m.qualified ? 'done' : 'todo'} />
      ))}
    </View>
  )
}

export function Disclaimer() {
  return <Text className='fs-disclaimer'>不适即停，有基础疾病请先咨询医生</Text>
}

/** 衬线大数字 */
export function Num(props: { children: ReactNode; accent?: boolean; size?: number; className?: string }) {
  return (
    <Text className={`fs-num ${props.accent ? 'fs-num--accent' : ''} ${props.className ?? ''}`} style={props.size ? { fontSize: Taro.pxTransform(props.size) } : undefined}>
      {props.children}
    </Text>
  )
}

export function Empty(props: { children: ReactNode }) {
  return <View className='fs-empty'>{props.children}</View>
}

import { Input, Text, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { TAUNTS, THEME_LABEL } from '@core/copy'
import { DAY_TYPE_LABEL } from '@core/dayType'
import { weekdayLabel } from '@core/time'
import type { Theme } from '@core/types'
import { Button, Card, Chips, Disclaimer, Segmented } from '../../components/ui'
import { api, type CreateData, type PreviewData } from '../../services/api'
import { askSubscribe } from '../../services/subscribe'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

type Period = '14' | '21'

export default function CreatePage() {
  const [period, setPeriod] = useState<Period>('14')
  const [theme, setTheme] = useState<Theme>('all')
  const [name, setName] = useState('')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<CreateData | null>(null)
  const [taunt, setTaunt] = useState<string>(TAUNTS[0])
  const seedRef = useRef<number | undefined>(undefined)

  const loadPreview = async (p: Period, t: Theme, newSeed: boolean) => {
    try {
      const d = await api<PreviewData>('plan.preview', { theme: t, period_days: Number(p), seed: newSeed ? undefined : seedRef.current })
      seedRef.current = d.seed
      setPreview(d)
    } catch {
      // 已提示
    }
  }

  useLoad(async () => {
    if (!(await ensureLogin())) return
    loadPreview(period, theme, true)
  })

  useShareAppMessage(() => {
    const who = session.user?.nickname || '队友'
    return {
      title: `${who}向你下了战书：${taunt}`,
      path: `/pages/invite/index?team=${created?.team_id ?? ''}`,
    }
  })

  const onCreate = async () => {
    askSubscribe()
    setBusy(true)
    try {
      const d = await api<CreateData>('team.create', { theme, period_days: Number(period), name: name.trim(), seed: seedRef.current, taunt })
      session.team = { id: d.team_id, name: d.name, period_days: d.period_days, day_no: 1 }
      setCreated(d)
    } catch {
      // 已提示
    } finally {
      setBusy(false)
    }
  }

  const pickTaunt = async (t: string) => {
    setTaunt(t)
    if (created) api('team.setTaunt', { team_id: created.team_id, taunt: t }, { silent: true }).catch(() => undefined)
  }

  if (created) {
    return (
      <View className='page create'>
        <View className='create__done'>
          <View className='t-h1'>开局了 🔥 现在拉人</View>
          <View className='t-cap c-muted mt-4'>一个人也能先打，队友随时加入，从加入那天开始算</View>
        </View>
        <View className='field-label'>战书上写一句狠话</View>
        <Chips column options={TAUNTS.map((t) => ({ key: t, label: t }))} value={taunt as (typeof TAUNTS)[number]} onChange={pickTaunt} />
        <Button block className='mt-24' openType='share'>
          发到微信
        </Button>
        <Button block kind='text' className='mt-8' onClick={() => Taro.redirectTo({ url: '/pages/checkin/index' })}>
          先去打今天的卡 ›
        </Button>
        <Button block kind='text' onClick={() => Taro.navigateTo({ url: `/pages/poster/index?type=invite&team=${created.team_id}` })}>
          生成战书海报（发朋友圈）
        </Button>
      </View>
    )
  }

  const nick = session.user?.nickname || '我'
  return (
    <View className='page page--bottom create'>
      <View className='t-h1'>开一局</View>
      <View className='t-cap c-muted mt-4'>今天就是 Day 1，全队用同一份清单</View>

      <View className='field-label'>周期</View>
      <Segmented<Period>
        options={[
          { key: '14', label: '14 天' },
          { key: '21', label: '21 天' },
        ]}
        value={period}
        onChange={(p) => {
          setPeriod(p)
          loadPreview(p, theme, false)
        }}
      />

      <View className='field-label'>主题</View>
      <Chips<Theme>
        options={(Object.keys(THEME_LABEL) as Theme[]).map((k) => ({ key: k, label: THEME_LABEL[k] }))}
        value={theme}
        onChange={(t) => {
          setTheme(t)
          loadPreview(period, t, false)
        }}
      />

      <View className='field-label'>队名</View>
      <Input className='create__input' placeholder={`${nick}的战队`} maxlength={16} value={name} onInput={(e) => setName(e.detail.value)} />

      <View className='section-head'>
        <Text className='h'>前 3 天的清单</Text>
        <Text className='create__swap' onClick={() => loadPreview(period, theme, true)}>
          ↻ 换一套
        </Text>
      </View>
      {preview?.days.map((d) => {
        const pick = d.items.find((a) => a.id === d.pick_id)
        return (
          <Card key={d.date} className='create__day'>
            <View className='between'>
              <Text className='bold'>{`Day ${d.day_no} · ${weekdayLabel(d.date)}`}</Text>
              <Text className={`create__dt ${d.day_type === 'holiday' ? 'is-rest' : ''}`}>
                {d.recovery_day ? '恢复日' : DAY_TYPE_LABEL[d.day_type]}
              </Text>
            </View>
            {pick && <View className='create__pick'>{`推荐：${pick.emoji} ${pick.text}`}</View>}
            <View className='create__items'>
              {d.items
                .filter((a) => a.id !== d.pick_id)
                .map((a) => (
                  <Text key={a.id} className='create__item'>{`${a.emoji} ${a.text}`}</Text>
                ))}
            </View>
          </Card>
        )
      })}
      <Disclaimer />

      <View className='bottom-bar'>
        <Button block loading={busy} onClick={onCreate}>
          开局，今天就开始
        </Button>
      </View>
    </View>
  )
}

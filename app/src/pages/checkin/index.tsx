import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { GROUP_LABEL } from '@core/copy'
import { weekdayLabel } from '@core/time'
import type { Group, Mood } from '@core/types'
import { HoldConfirm, PickCard, Slots, TaskRow } from '../../components/checkin'
import { Button, Disclaimer, Num, Segmented } from '../../components/ui'
import { api, isLocalMode, type MoodData, type SubmitData, type TodayData, type TodayItem, type WerunData } from '../../services/api'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

const FOCUS: Record<'workday' | 'holiday', Record<Group, string>> = {
  workday: { move: '工作日侧重：防久坐、饭后走', food: '工作日侧重：多喝水、少奶茶', rest: '工作日侧重：午休 + 早睡' },
  holiday: { move: '休息日侧重：出门 + 一起动', food: '休息日侧重：少外卖、少续摊', rest: '休息日侧重：别熬夜补觉' },
}
const GROUPS: Group[] = ['move', 'food', 'rest']

export default function CheckinPage() {
  const [data, setData] = useState<TodayData | null>(null)
  const [confirm, setConfirm] = useState<{ item: TodayItem; date: string } | null>(null)
  const [result, setResult] = useState<SubmitData | null>(null)
  const [steps, setSteps] = useState<number | null>(null)

  const load = async () => {
    if (!(await ensureLogin())) return
    try {
      const d = await api<TodayData>('checkin.today')
      setData(d)
      if (d.items.some((i) => i.state === 'werun')) syncWerun(false)
    } catch (e) {
      if ((e as { code?: string }).code === 'NOT_MEMBER') Taro.switchTab({ url: '/pages/home/index' })
    }
  }

  useDidShow(() => {
    load()
  })

  /** 微信运动：拿加密数据交给云函数解密，达到阈值自动打卡 */
  const syncWerun = async (fromTap: boolean) => {
    if (isLocalMode) {
      if (fromTap) Taro.showToast({ title: '本地演示模式不支持微信运动', icon: 'none' })
      return
    }
    try {
      const r = await Taro.getWeRunData()
      const w = await api<WerunData>('checkin.werun', {}, { weRunCloudID: (r as any).cloudID, silent: !fromTap })
      setSteps(w.steps)
      if (w.items.some((i) => i.done && i.counted)) {
        const d = await api<TodayData>('checkin.today', {}, { silent: true })
        setData(d)
      }
    } catch {
      if (fromTap) {
        Taro.showModal({
          title: '需要微信运动授权',
          content: '授权后，步数达到目标会自动打卡，不用手动点',
          confirmText: '去设置',
          success: (m) => m.confirm && Taro.openSetting(),
        })
      }
    }
  }

  const onMood = async (m: Mood) => {
    try {
      const r = await api<MoodData>('checkin.setMood', { mood: m })
      setData((d) => (d ? { ...d, mood: r.mood, target: r.target, qualified: r.qualified, unwell_left: r.unwell_left } : d))
    } catch {
      // 已提示
    }
  }

  const onConfirm = async (item: TodayItem, date: string) => {
    setConfirm(null)
    try {
      const r = await api<SubmitData>('checkin.submit', { action_id: item.id, date })
      if (r.counted) {
        Taro.showToast({ title: r.became_qualified ? '今天达标了 ✓' : `已完成 ${r.counted_count}/${r.target}`, icon: 'none' })
        if (r.became_qualified) setResult(r)
      } else if (r.extra) {
        Taro.showToast({ title: '已记为额外完成，不计入排名', icon: 'none' })
      } else if (r.retry_at) {
        Taro.showToast({ title: '打得太快了，5 分钟后再点这一项就算数', icon: 'none', duration: 2500 })
      }
      const d = await api<TodayData>('checkin.today', {}, { silent: true })
      setData(d)
    } catch {
      load()
    }
  }

  if (!data) return <View className='loading-page'>加载中…</View>
  if (!data.in_period) {
    return (
      <View className='page'>
        <View className='t-h1 mt-24'>这局已经打完了</View>
        <Button block className='mt-24' onClick={() => Taro.redirectTo({ url: '/pages/create/index' })}>
          再开一局
        </Button>
      </View>
    )
  }

  const { mood, target } = data
  const holiday = data.day_type === 'holiday'
  const visible = (i: TodayItem) => (mood === 'busy' ? i.minutes <= 5 && i.verify === 'self' : mood === 'unwell' ? i.recovery : true)
  const done = data.items.filter((i) => i.state === 'done' && 'counted' in i && i.counted).sort((a, b) => ((a as any).at ?? 0) - ((b as any).at ?? 0))
  const extra = data.items.filter((i) => i.state === 'done' && 'extra' in i && i.extra)
  const pick = data.items.find((i) => i.id === data.pick_id && i.state !== 'done' && visible(i))
  const rest = data.items.filter((i) => i.state !== 'done' && i.id !== pick?.id && visible(i))
  const left = Math.max(0, target - data.counted_count)
  const teammates = Math.max(0, data.team.member_count - 1)

  return (
    <View className='page page--bottom ck'>
      <View className='between'>
        <Text className={`ck__daytype ${holiday ? 'is-rest' : ''}`}>
          {`${holiday ? '☀️' : '💼'} ${weekdayLabel(data.date)} · ${holiday ? '休息日' : '工作日'}${data.recovery_day ? ' · 恢复日' : ''}`}
        </Text>
        <Text className='ck__dayno'>{`DAY ${data.team.day_no} / ${data.team.period_days}`}</Text>
      </View>

      {data.qualified ? (
        <View className='ck__title'>今天达标了 ✓</View>
      ) : mood === 'unwell' ? (
        <View className='ck__title'>
          身体优先，{'\n'}做 <Num accent size={38}>{left}</Num> 项就行
        </View>
      ) : (
        <View className='ck__title'>
          再做 <Num accent size={38}>{left}</Num> 项，{'\n'}今天就达标
        </View>
      )}

      <Segmented<Mood>
        className='mt-12'
        options={[
          { key: 'normal', label: '🙂 正常' },
          { key: 'busy', label: '⏱ 很忙' },
          { key: 'unwell', label: '🤒 不太舒服', disabled: data.unwell_left <= 0 && mood !== 'unwell' },
        ]}
        value={mood}
        onChange={onMood}
        onDisabledClick={() => Taro.showToast({ title: '这局“不太舒服”的 2 天已经用完了', icon: 'none' })}
      />

      {/* 昨天的“明早确认” */}
      {data.yesterday.confirm.length > 0 && (
        <View className='ck__yest'>
          <View className='ck__yest-t'>{`先确认一下昨天的（12:00 前）· 昨天 ${data.yesterday.counted_count}/3`}</View>
          <View className='fs-rows mt-8'>
            {data.yesterday.confirm.map((i) => (
              <TaskRow key={i.id} item={i} onCheck={(it) => setConfirm({ item: it, date: data.yesterday.date })} />
            ))}
          </View>
        </View>
      )}

      <Slots target={target} done={done.map((i) => ({ id: i.id, emoji: i.emoji, text: i.text, at: (i as any).at }))} />
      <View className='ck__prog'>
        <Text>
          <Text className='c-accent bold'>{`${Math.min(data.counted_count, target)} / ${target}`}</Text>
          {data.qualified ? ' 达标' : ' 已完成'}
        </Text>
        {extra.length > 0 && <Text className='t-cap c-muted'>{`额外完成 ${extra.length} 项`}</Text>}
      </View>

      {result && (
        <View className='ck__win'>
          <Num size={52} className='ck__win-big'>
            {result.streak}
          </Num>
          <View className='flex-1'>
            <View className='ck__win-t'>{`连续达标 ${result.streak} 天${result.rank ? ` · 实时第 ${result.rank}` : ''}`}</View>
            <View className='ck__win-s'>
              {result.is_last
                ? `你是最后一个，全队到齐了，全队连续 ${result.team_streak} 天`
                : `全队 ${result.team_today.done}/${result.team_today.total} 已达标`}
            </View>
          </View>
        </View>
      )}

      {mood === 'unwell' && (
        <View className='tip tip--warm'>
          {`🤒 不舒服就别硬撑，今天做 1 项恢复类的就算达标。每局最多用 2 天（还剩 ${data.unwell_left} 天），持续不适请就医。`}
        </View>
      )}
      {mood === 'busy' && <View className='tip'>⏱ 很忙模式：只显示 5 分钟内能做完的</View>}

      {pick && (
        <PickCard
          item={pick}
          label={holiday ? 'AI 推荐 · 休息日加量' : 'AI 推荐 · 现在正合适'}
          onCheck={(it) => setConfirm({ item: it, date: data.date })}
        />
      )}

      {data.qualified && rest.length > 0 && <View className='ck__more'>还想多做？剩下的随便做，只算额外完成</View>}

      {GROUPS.map((g) => {
        const list = rest.filter((i) => i.group === g)
        if (!list.length) return null
        return (
          <View key={g}>
            <View className='ck__grp'>
              <Text className='b'>{GROUP_LABEL[g]}</Text>
              <Text className='s'>{FOCUS[holiday ? 'holiday' : 'workday'][g]}</Text>
            </View>
            <View className='fs-rows'>
              {list.map((i) => (
                <TaskRow
                  key={i.id}
                  item={i}
                  steps={i.state === 'werun' ? steps : null}
                  onAuthWerun={() => syncWerun(true)}
                  onCheck={(it) => setConfirm({ item: it, date: data.date })}
                />
              ))}
            </View>
          </View>
        )
      })}

      <Disclaimer />

      <View className='bottom-bar'>
        <Button block kind={data.qualified ? 'primary' : 'secondary'} onClick={() => Taro.switchTab({ url: '/pages/team/index' })}>
          {data.qualified ? '好了，看看队友' : '看看队友做到哪了'}
        </Button>
      </View>

      <HoldConfirm
        item={confirm?.item ?? null}
        teammates={teammates}
        nickname={session.user?.nickname ?? ''}
        onClose={() => setConfirm(null)}
        onConfirm={(it) => confirm && onConfirm(it, confirm.date)}
      />
    </View>
  )
}

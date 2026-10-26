// 运营后台 · 战队详情 + 计划抽检与回退
import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { Button, Card } from '../components/ui'
import { api } from '../services/api'
import type { team as teamFn } from '../../cloudfunctions/api/src/handlers/admin'
import './admin.scss'

type Data = Awaited<ReturnType<typeof teamFn>>
type DayView = NonNullable<Data['plan_today']>

function PlanDay({ title, d }: { title: string; d: DayView | null }) {
  if (!d) return null
  return (
    <Card className='adm__day'>
      <View className='between'>
        <Text className='bold'>{`${title} · Day ${d.day_no} · ${d.day_type === 'holiday' ? '休息日' : '工作日'}${d.recovery_day ? ' · 恢复日' : ''}`}</Text>
        <Text className='t-label c-muted'>{d.fallback ? '兜底清单' : '规则生成'}</Text>
      </View>
      <View className='mt-8'>
        {d.items.map((a) => (
          <View key={a.id} className={`adm__item ${a.id === d.pick_id ? 'is-pick' : ''}`}>
            {`${a.emoji} ${a.text}${a.id === d.pick_id ? '（推荐）' : ''}`}
          </View>
        ))}
      </View>
    </Card>
  )
}

export default function AdminTeam() {
  const [id, setId] = useState('')
  const [d, setD] = useState<Data | null>(null)
  const load = (tid: string) => api<Data>('admin.team', { team_id: tid }).then(setD).catch(() => undefined)
  useLoad((q) => {
    setId(q.id as string)
    load(q.id as string)
  })

  const replan = (mode: 'reroll' | 'fallback') => {
    Taro.showModal({
      title: mode === 'reroll' ? '明天起重新生成？' : '明天起回退到兜底清单？',
      content: '今天和之前的清单不变，全队明天起看到新清单。',
      success: async (r) => {
        if (!r.confirm) return
        const res = await api<{ replaced: number }>('admin.replan', { team_id: id, mode })
        Taro.showToast({ title: `已替换 ${res.replaced} 天`, icon: 'none' })
        load(id)
      },
    })
  }

  if (!d) return <View className='loading-page'>加载中…</View>
  const t = d.team
  return (
    <View className='page adm'>
      <View className='t-h2'>{t.name}</View>
      <View className='t-cap c-muted mt-4'>{`${t.status === 'active' ? '进行中' : '已结束'} · Day ${t.day_no}/${t.period_days} · ${t.start_date} → ${t.end_date} · 全队连续 ${t.team_streak} 天 · 今天 ${d.today.done}/${d.today.total}`}</View>
      <View className='t-cap c-muted mt-4'>{`清单：${t.generated_by === 'fallback' ? `含兜底 ${t.fallback_days} 天` : '规则生成'} · 调整过 ${t.replans} 次`}</View>

      <View className='section-head'>
        <Text className='h'>成员</Text>
      </View>
      <View className='adm__list'>
        {d.members.map((m) => (
          <View key={m.user_id} className='adm__row'>
            <Text className='bold'>{m.rank}</Text>
            <View className='flex-1'>
              <View className='adm__nm'>{m.nickname}</View>
              <View className='adm__meta'>{`达标率 ${m.rate_pct}% · 连续 ${m.streak} 天 · 今天${m.qualified_today ? '已达标' : '未达标'}`}</View>
            </View>
          </View>
        ))}
      </View>

      <View className='section-head'>
        <Text className='h'>计划抽检</Text>
      </View>
      <PlanDay title='今天' d={d.plan_today} />
      <PlanDay title='明天' d={d.plan_tomorrow} />
      {t.status === 'active' && (
        <View className='row gap-8 mt-16'>
          <Button kind='secondary' className='flex-1' onClick={() => replan('reroll')}>
            明天起重新生成
          </Button>
          <Button className='flex-1' onClick={() => replan('fallback')}>
            明天起回退兜底
          </Button>
        </View>
      )}
    </View>
  )
}

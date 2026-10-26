// 运营后台 · 战队列表
import { View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Segmented } from '../components/ui'
import { api } from '../services/api'
import type { teams as teamsFn } from '../../cloudfunctions/api/src/handlers/admin'
import './admin.scss'

type Row = Awaited<ReturnType<typeof teamsFn>>[number]

export default function AdminTeams() {
  const [status, setStatus] = useState<'active' | 'ended'>('active')
  const [rows, setRows] = useState<Row[]>([])
  const load = (s = status) => api<Row[]>('admin.teams', { status: s }).then(setRows).catch(() => undefined)
  useDidShow(() => {
    load()
  })
  return (
    <View className='page adm'>
      <Segmented<'active' | 'ended'>
        options={[
          { key: 'active', label: '进行中' },
          { key: 'ended', label: '已结束' },
        ]}
        value={status}
        onChange={(s) => {
          setStatus(s)
          load(s)
        }}
      />
      <View className='adm__list'>
        {rows.map((t) => (
          <View key={t.id} className='adm__row' onClick={() => Taro.navigateTo({ url: `/admin/team?id=${t.id}` })}>
            <View className='flex-1'>
              <View className='adm__nm'>{t.name}</View>
              <View className='adm__meta'>{`队长 ${t.captain} · ${t.member_count} 人 · Day ${t.day_no}/${t.period_days} · 全队连续 ${t.team_streak} 天 · ${t.start_date} 开局`}</View>
            </View>
            <View className='c-muted'>›</View>
          </View>
        ))}
        {rows.length === 0 && <View className='fs-empty'>还没有</View>}
      </View>
    </View>
  )
}

// 运营后台 · 概览
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Card, Num } from '../components/ui'
import { api } from '../services/api'
import type { overview } from '../../cloudfunctions/api/src/handlers/admin'
import './admin.scss'

type Data = Awaited<ReturnType<typeof overview>>

export default function AdminHome() {
  const [d, setD] = useState<Data | null>(null)
  useDidShow(() => {
    api<Data>('admin.overview').then(setD).catch(() => undefined)
  })
  if (!d) return <View className='loading-page'>加载中…</View>
  const s = d.stats
  const max = Math.max(1, ...d.funnel.map((f) => f.count))
  return (
    <View className='page adm'>
      <View className='t-cap c-muted'>{`数据日期 ${d.date}（北京时间）`}</View>
      {d.truncated && <View className='tip tip--warm'>数据量已超出后台统计范围（单集合 1000 条），请导出到表格分析</View>}

      <Card className='mt-12 adm__star'>
        <View className='t-cap'>北极星 · 周活跃战队</View>
        <Num accent size={56}>
          {s.north_star}
        </Num>
        <View className='t-label adm__star-sub'>近 7 天 ≥ 2 名成员各有 ≥ 5 天达标的战队数</View>
      </Card>

      <View className='adm__grid'>
        {[
          ['总用户', s.users],
          ['今日新增', s.new_today],
          ['进行中战队', s.active_teams],
          ['今日打卡人数', s.checkin_today],
          ['今日达标人数', s.qualified_today],
        ].map(([k, v]) => (
          <View key={k as string} className='adm__cell'>
            <Num size={24}>{v as number}</Num>
            <View className='t-label c-muted mt-4'>{k}</View>
          </View>
        ))}
      </View>

      <View className='section-head'>
        <Text className='h'>漏斗（近 30 天新用户）</Text>
      </View>
      <Card>
        {d.funnel.map((f) => (
          <View key={f.key} className='adm__fn'>
            <View className='between'>
              <Text className='t-cap'>{f.label}</Text>
              <Text className='t-cap bold'>{`${f.count}${f.base && f.base !== f.count ? ` / ${f.base}` : ''}`}</Text>
            </View>
            <View className='adm__bar'>
              <View className='adm__bar-in' style={{ width: `${(f.count / max) * 100}%` }} />
            </View>
          </View>
        ))}
      </Card>

      <View className='adm__nav'>
        <View onClick={() => Taro.navigateTo({ url: '/admin/teams' })}>🏁 战队与计划抽检 ›</View>
        <View onClick={() => Taro.navigateTo({ url: '/admin/users' })}>👤 用户查询与封禁 ›</View>
        <View onClick={() => Taro.navigateTo({ url: '/admin/actions' })}>📚 行动模板库 ›</View>
      </View>
    </View>
  )
}

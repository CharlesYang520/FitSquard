// 运营后台 · 行动模板库
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { Action, Group } from '@core/types'
import { Button, Chips } from '../components/ui'
import { api } from '../services/api'
import './admin.scss'

type Filter = 'all' | Group | 'off'
const DT = { workday: '工作日', holiday: '休息日', any: '通用', festival: '节日' } as const

export default function AdminActions() {
  const [data, setData] = useState<{ from_seed: boolean; items: Action[] } | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const load = () => api<{ from_seed: boolean; items: Action[] }>('admin.actions').then(setData).catch(() => undefined)
  useDidShow(() => {
    load()
  })

  const importSeed = async () => {
    const r = await api<{ imported: number }>('admin.importSeed')
    Taro.showToast({ title: `已导入 ${r.imported} 条`, icon: 'none' })
    load()
  }

  if (!data) return <View className='loading-page'>加载中…</View>
  const list = data.items.filter((a) => (filter === 'all' ? true : filter === 'off' ? a.status === 'off' : a.group === filter))
  const on = data.items.filter((a) => a.status === 'on').length

  return (
    <View className='page adm'>
      <View className='t-cap c-muted'>{`共 ${data.items.length} 条，上线 ${on} 条。修改只影响之后新开的局。`}</View>
      {data.from_seed ? (
        <View className='tip tip--warm'>
          云库还没有模板，现在用的是内置种子。导入后才能编辑。
          <Button block small className='mt-8' onClick={importSeed}>
            导入种子模板
          </Button>
        </View>
      ) : (
        <Button block small className='mt-12' onClick={() => Taro.navigateTo({ url: '/admin/action' })}>
          + 新增模板
        </Button>
      )}
      <View className='mt-12'>
        <Chips<Filter>
          options={[
            { key: 'all', label: '全部' },
            { key: 'move', label: '动一动' },
            { key: 'food', label: '吃喝' },
            { key: 'rest', label: '作息' },
            { key: 'off', label: '已下线' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>
      <View className='adm__list'>
        {list.map((a) => (
          <View
            key={a._id}
            className='adm__row'
            onClick={() => (data.from_seed ? Taro.showToast({ title: '先导入种子模板', icon: 'none' }) : Taro.navigateTo({ url: `/admin/action?id=${a._id}` }))}
          >
            <Text>{a.emoji}</Text>
            <View className='flex-1'>
              <View className='adm__nm'>
                {a.text}
                {a.status === 'off' && <Text className='adm__tag-ban'> · 下线</Text>}
              </View>
              <View className='adm__meta'>{`${a._id} · ${DT[a.day_type]} · ${a.minutes} 分钟${a.recovery ? ' · 恢复类' : ''}${a.verify === 'werun' ? ` · 步数 ${a.werun_steps}` : ''} · ${a.window}`}</View>
            </View>
            <Text className='c-muted'>›</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

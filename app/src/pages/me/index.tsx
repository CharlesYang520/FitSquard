import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Avatar, Button, Card, Disclaimer, Num } from '../../components/ui'
import { api, ApiError, isLocalMode, type HomeData } from '../../services/api'
import { resetLocal as resetLocalDb } from '../../services/local'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

const GRID_LABEL = { done: '达标', unwell: '不太舒服日', miss: '未达标', today: '今天', future: '未来', before_join: '未加入' } as const

export default function MePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [loaded, setLoaded] = useState(false)

  useDidShow(async () => {
    if (!(await ensureLogin())) return
    try {
      setData(await api<HomeData>('team.home', {}, { silent: true }))
    } catch (e) {
      if ((e as ApiError).code !== 'NOT_MEMBER') Taro.showToast({ title: (e as Error).message, icon: 'none' })
      setData(null)
    } finally {
      setLoaded(true)
    }
  })

  const user = session.user
  const me = data?.me
  const soon = (what: string) => Taro.showToast({ title: `${what}下个版本上线`, icon: 'none' })

  const resetLocal = () => {
    Taro.showModal({
      title: '清空本地演示数据？',
      content: '只影响本机的演示模式数据',
      success: (r) => {
        if (!r.confirm) return
        resetLocalDb()
        Taro.clearStorageSync()
        session.user = null
        session.team = null
        Taro.reLaunch({ url: '/pages/login/index' })
      },
    })
  }

  return (
    <View className='page me'>
      <View className='row gap-12 mt-8'>
        <Avatar id={user?.id ?? 'me'} name={user?.nickname || '我'} src={user?.avatar} size='lg' />
        <View>
          <View className='t-h2'>{user?.nickname || '还没起昵称'}</View>
          <View className='t-cap c-muted'>{data ? data.team.name : '还没有进行中的战队'}</View>
        </View>
      </View>

      <View className='me__stats'>
        <View>
          <Num accent size={40}>
            {me?.streak ?? user?.streak_days ?? 0}
          </Num>
          <View className='k'>连续达标</View>
        </View>
        <View>
          <Num size={40}>{Math.max(me?.streak_best ?? 0, user?.streak_best ?? 0)}</Num>
          <View className='k'>最佳</View>
        </View>
        <View>
          <Num size={40}>{me?.counted_items ?? 0}</Num>
          <View className='k'>本局完成项</View>
        </View>
      </View>

      {me && data && (
        <Card className='mt-16'>
          <View className='between'>
            <Text className='t-h3 bold'>本局达标</Text>
            <Text className='t-cap c-muted'>{`${me.done_days} 天 · 达标率 ${me.rate_pct}%`}</Text>
          </View>
          <View className='me__grid'>
            {me.grid.map((g) => (
              <View key={g.date} className={`me__cell is-${g.state}`}>
                <Text>{g.day_no}</Text>
              </View>
            ))}
          </View>
          <View className='me__legend'>
            {(['done', 'unwell', 'miss', 'future'] as const).map((k) => (
              <View key={k} className='row gap-8'>
                <View className={`me__dot is-${k}`} />
                <Text>{GRID_LABEL[k]}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {loaded && !data && (
        <Button block className='mt-16' onClick={() => Taro.navigateTo({ url: '/pages/create/index' })}>
          开一局
        </Button>
      )}

      <View className='me__menu'>
        <View className='me__item' onClick={() => soon('私密体重')}>
          <Text>🔒 记一下体重（只有自己看得到）</Text>
          <Text className='me__soon'>即将上线 ›</Text>
        </View>
        <View className='me__item' onClick={() => soon('历史战报')}>
          <Text>📜 历史战报</Text>
          <Text className='me__soon'>即将上线 ›</Text>
        </View>
        <View className='me__item' onClick={() => soon('通知设置')}>
          <Text>🔔 通知设置</Text>
          <Text className='me__soon'>即将上线 ›</Text>
        </View>
        {isLocalMode && (
          <View className='me__item' onClick={resetLocal}>
            <Text>🧪 清空本地演示数据</Text>
            <Text className='me__soon'>›</Text>
          </View>
        )}
      </View>
      <Disclaimer />
    </View>
  )
}

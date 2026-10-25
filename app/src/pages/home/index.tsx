import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState } from 'react'
import { Button, Card, Disclaimer, Num, Tag, TodayRow } from '../../components/ui'
import { api, ApiError, type HomeData } from '../../services/api'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [noTeam, setNoTeam] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    if (!(await ensureLogin())) return
    try {
      const d = await api<HomeData>('team.home', {}, { silent: true })
      setData(d)
      setNoTeam(false)
    } catch (e) {
      if ((e as ApiError).code === 'NOT_MEMBER') {
        setNoTeam(true)
        setData(null)
      } else Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoaded(true)
    }
  }

  useDidShow(() => {
    load()
  })
  usePullDownRefresh(async () => {
    await load()
    Taro.stopPullDownRefresh()
  })

  if (!loaded) return <View className='loading-page'>加载中…</View>

  if (noTeam || !data) {
    return (
      <View className='page home'>
        <View className='home__hi'>{session.user?.nickname ? `${session.user.nickname}，` : ''}今天开一局？</View>
        <View className='home__empty'>
          <View className='t-h1'>拉上熟人，</View>
          <View className='t-h1'>14 天一起连续达标</View>
          <View className='home__rules'>
            <View>· 每天 9 个小行动，任选 3 个做完就达标</View>
            <View>· 一个人也能先开，队友随时加入</View>
            <View>· 没有押注、没有积分，只比谁更稳</View>
          </View>
          <Button block className='mt-24' onClick={() => Taro.navigateTo({ url: '/pages/create/index' })}>
            开一局
          </Button>
          <View className='home__invite'>有战书？直接点群里的战书卡片就能上车</View>
        </View>
        <Disclaimer />
      </View>
    )
  }

  const { team, today, me, plan_today: pt } = data
  const myRank = me.rank
  return (
    <View className='page page--bottom home'>
      <View className='between'>
        <Text className='home__team'>{team.name}</Text>
        <Tag kind='line'>{`Day ${team.day_no}/${team.period_days}`}</Tag>
      </View>

      <View className='home__hero'>
        <Num accent size={88}>
          {team.team_streak}
        </Num>
        <View className='home__hero-t'>
          <View className='t-h3 bold'>天 全队连续达标</View>
          <View className='t-cap c-muted'>{`最佳 ${team.team_streak_best} 天`}</View>
        </View>
      </View>

      <Card className='mt-16'>
        <View className='between'>
          <Text className='t-h3 bold'>{`今天 ${today.done}/${today.total} 达标`}</Text>
          <Text className='t-cap c-muted'>9 项任选 3 项</Text>
        </View>
        <View className='mt-12'>
          <TodayRow members={today.members} />
        </View>
        <View className='home__rank' onClick={() => Taro.switchTab({ url: '/pages/team/index' })}>
          <Text>实时排名：</Text>
          <Text className='bold'>{myRank ? `你第 ${myRank}` : '还没有排名'}</Text>
          <Text className='c-muted'>{` · 达标 ${me.done_days} 天 · 连续 ${me.streak} 天`}</Text>
          <Text className='home__chev'>›</Text>
        </View>
      </Card>

      {pt && (
        <Card className='mt-12'>
          <View className='between'>
            <Text className='t-h3 bold'>
              {me.qualified_today ? '今天达标了 ✓' : `今天还差 ${pt.left} 项`}
            </Text>
            <Text className='t-cap c-muted'>{`${me.counted_today}/${me.target}`}</Text>
          </View>
          {pt.pick && !pt.pick.done && (
            <View className='home__pick'>
              <Text className='home__pick-lb'>AI 推荐</Text>
              <View className='home__pick-what'>{`${pt.pick.emoji} ${pt.pick.text}`}</View>
              <View className='t-cap c-muted mt-4'>{pt.pick.reason}</View>
            </View>
          )}
          {pt.done.length > 0 && (
            <View className='home__done'>
              {pt.done.map((a) => (
                <Text key={a.id} className='home__done-i'>{`${a.emoji} ${a.text}`}</Text>
              ))}
            </View>
          )}
        </Card>
      )}

      <View className='home__hook'>{data.hook}</View>
      <Disclaimer />

      <View className='bottom-bar'>
        <Button block onClick={() => Taro.navigateTo({ url: '/pages/checkin/index' })}>
          {me.qualified_today ? '再看看今天的清单' : '去打卡'}
        </Button>
      </View>
    </View>
  )
}

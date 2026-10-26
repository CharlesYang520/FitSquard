import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState } from 'react'
import { Button, Card, Disclaimer, Num, Tag, TodayRow } from '../../components/ui'
import { api, ApiError, type HomeData, type ReportListData } from '../../services/api'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [noTeam, setNoTeam] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [lastReport, setLastReport] = useState<ReportListData[number] | null>(null)

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
        api<ReportListData>('report.list', {}, { silent: true })
          .then((l) => setLastReport(l[0] ?? null))
          .catch(() => undefined)
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
        {lastReport && (
          <View className='home__report' onClick={() => Taro.navigateTo({ url: `/pages/report/index?team=${lastReport.team_id}` })}>
            <View className='flex-1'>
              <View className='t-cap home__report-sub'>{`上一局 · ${lastReport.name}`}</View>
              <View className='t-h3 bold mt-4'>{`战报出来了：完成率 ${lastReport.rate_pct}%${lastReport.title ? ` · ${lastReport.title.emoji} ${lastReport.title.name}` : ''}`}</View>
            </View>
            <Text className='home__report-go'>看战报 · 再来一局 ›</Text>
          </View>
        )}
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
  const needProfile = !session.user?.avatar || !session.user?.nickname
  const myRank = me.rank
  return (
    <View className='page page--bottom home'>
      <View className='between'>
        <Text className='home__team'>{team.name}</Text>
        <Tag kind='line'>{`Day ${team.day_no}/${team.period_days}`}</Tag>
      </View>

      {needProfile && (
        <View className='home__profile' onClick={() => Taro.switchTab({ url: '/pages/me/index' })}>
          👤 补个微信头像和昵称，队友才认得出你 ›
        </View>
      )}

      <View className='home__hero'>
        <Num accent size={88}>
          {team.team_streak}
        </Num>
        <View className='home__hero-t'>
          <View className='t-h3 bold'>天 全队连续达标</View>
          <View className='t-cap c-muted'>{`最佳 ${team.team_streak_best} 天`}</View>
        </View>
      </View>

      {pt && (
        <Card className='mt-16'>
          <View className='between'>
            <Text className='t-h3 bold'>
              我今天完成 <Text className='c-accent'>{`${Math.min(me.counted_today, me.target)}/${me.target}`}</Text> 项
            </Text>
            <Text className='t-cap c-muted'>{me.qualified_today ? '已达标 ✓' : `还差 ${pt.left} 项达标`}</Text>
          </View>
          <View className='home__dots'>
            {Array.from({ length: me.target }, (_, i) => (
              <View key={i} className={`home__dot ${i < me.counted_today ? 'is-on' : ''}`} />
            ))}
          </View>
          {pt.done.length > 0 && (
            <View className='home__done'>
              {pt.done.map((a) => (
                <Text key={a.id} className='home__done-i'>{`✓ ${a.text}`}</Text>
              ))}
            </View>
          )}
          {pt.pick && !pt.pick.done && !me.qualified_today && (
            <View className='home__pick'>
              <Text className='home__pick-lb'>下一项推荐</Text>
              <View className='home__pick-what'>{`${pt.pick.emoji} ${pt.pick.text}`}</View>
              <View className='t-cap c-muted mt-4'>{pt.pick.reason}</View>
            </View>
          )}
        </Card>
      )}

      <Card className='mt-12'>
        <View className='between'>
          <Text className='t-h3 bold'>{`全队今天 ${today.done}/${today.total} 人达标`}</Text>
          <Text className='t-cap c-muted'>每人 9 选 3</Text>
        </View>
        <View className='mt-12'>
          <TodayRow members={today.members} />
        </View>
        {today.total >= 2 ? (
          <View className='home__rank' onClick={() => Taro.switchTab({ url: '/pages/team/index' })}>
            <Text>实时排名：</Text>
            <Text className='bold'>{myRank ? `你第 ${myRank}` : '还没有排名'}</Text>
            <Text className='c-muted'>{` · 已达标 ${me.done_days} 天 · 连续 ${me.streak} 天`}</Text>
            <Text className='home__chev'>›</Text>
          </View>
        ) : (
          <View className='home__rank' onClick={() => Taro.switchTab({ url: '/pages/team/index' })}>
            <Text className='c-muted'>一个人也能先打，拉队友进来才有排名</Text>
            <Text className='home__chev'>›</Text>
          </View>
        )}
      </Card>

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

import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { REACTIONS, THEME_LABEL } from '@core/copy'
import { Avatar, Button, Card, Empty, Num, Tag, TodayRow } from '../../components/ui'
import { api, ApiError, type HomeData } from '../../services/api'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

export default function TeamPage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [noTeam, setNoTeam] = useState(false)

  const load = async () => {
    if (!(await ensureLogin())) return
    try {
      setData(await api<HomeData>('team.home', {}, { silent: true }))
      setNoTeam(false)
    } catch (e) {
      if ((e as ApiError).code === 'NOT_MEMBER') setNoTeam(true)
      else Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  useDidShow(() => {
    load()
  })
  usePullDownRefresh(async () => {
    await load()
    Taro.stopPullDownRefresh()
  })
  useShareAppMessage(() => ({
    title: `${session.user?.nickname || '队友'}向你下了战书：${data?.team.taunt ?? ''}`,
    path: `/pages/invite/index?team=${data?.team.id ?? ''}`,
  }))

  const react = async (checkinId: string, kind: string) => {
    if (!data) return
    // 乐观更新
    setData({
      ...data,
      feed: data.feed.map((f) => {
        if (f.id !== checkinId) return f
        const on = f.mine.includes(kind as any)
        return {
          ...f,
          mine: on ? f.mine.filter((k) => k !== kind) : [...f.mine, kind as any],
          reactions: { ...f.reactions, [kind]: (f.reactions[kind] ?? 0) + (on ? -1 : 1) },
        }
      }),
    })
    try {
      await api('feed.react', { checkin_id: checkinId, kind })
    } catch {
      load()
    }
  }

  if (noTeam) {
    return (
      <View className='page'>
        <Empty>还没有战队</Empty>
        <Button block onClick={() => Taro.navigateTo({ url: '/pages/create/index' })}>
          开一局
        </Button>
      </View>
    )
  }
  if (!data) return <View className='loading-page'>加载中…</View>

  const { team, today, ranking, feed } = data
  const todo = today.members.filter((m) => !m.qualified && !m.is_me)

  return (
    <View className='page tm'>
      <View className='tm__head'>
        <View className='between gap-12'>
          <View className='flex-1'>
            <View className='t-h2'>{team.name}</View>
            <View className='t-cap tm__sub'>{`${THEME_LABEL[team.theme]} · Day ${team.day_no}/${team.period_days} · ${team.member_count} 人`}</View>
          </View>
          <Button small kind='secondary' openType='share'>
            + 拉人
          </Button>
        </View>
        <View className='tm__hero'>
          <Num accent size={64}>
            {team.team_streak}
          </Num>
          <Text className='tm__hero-t'>天 全队连续达标</Text>
        </View>
        <View className='t-cap tm__hook'>{data.hook}</View>
      </View>

      <Card className='mt-16'>
        <View className='between'>
          <Text className='t-h3 bold'>{`今天 ${today.done}/${today.total} 达标`}</Text>
          <Text className='t-cap c-muted'>9 项任选 3 项</Text>
        </View>
        <View className='mt-12'>
          <TodayRow members={today.members} />
        </View>
        {todo.length > 0 && <View className='t-cap c-muted mt-12'>{`还没达标：${todo.map((m) => m.nickname).join('、')}`}</View>}
      </Card>

      <View className='section-head'>
        <View className='h'>
          实时排名 <Tag kind='solid'>LIVE</Tag>
        </View>
        <Text className='more'>按达标天数 · 下拉刷新</Text>
      </View>
      <View className='tm__list'>
        {ranking.map((r) => (
          <View key={r.user_id} className={`tm__mem ${r.is_me ? 'is-me' : ''}`}>
            <Text className='tm__rk'>{r.rank}</Text>
            <Avatar id={r.user_id} name={r.nickname} src={r.avatar} size='sm' />
            <View className='flex-1'>
              <View className='tm__nm'>
                {r.nickname}
                {r.is_captain && <Tag kind='solid' className='tm__tag'>队长</Tag>}
                {r.is_me && <Tag kind='line' className='tm__tag'>我</Tag>}
              </View>
              <View className='tm__meta'>
                {r.joined_day_no > 1 && r.passed_days === 0
                  ? `Day ${r.joined_day_no} 加入 · 今天 ${r.today_counted}/3`
                  : `连续 ${r.streak} 天 · 本局共 ${r.counted_items} 项${r.joined_day_no > 1 ? ` · Day ${r.joined_day_no} 加入` : ''}`}
              </View>
            </View>
            <Text className='tm__rate'>{`${r.done_days}/${r.passed_days}`}</Text>
          </View>
        ))}
      </View>

      <View className='section-head'>
        <View className='h'>动态</View>
      </View>
      {feed.length === 0 && <Empty>今天还没人打卡，你来当第一个</Empty>}
      {feed.map((f) => (
        <Card key={f.id} className='tm__feed'>
          <View className='row gap-8'>
            <Avatar id={f.user_id} name={f.nickname} src={f.avatar} size='sm' />
            <View className='flex-1'>
              <View className='tm__feed-t'>
                <Text className='bold'>{f.nickname}</Text>
                {` ${f.clock} 完成了 ${f.emoji} ${f.text}`}
              </View>
              <View className='t-label c-muted'>
                {f.verified_by === 'werun' ? '微信运动自动核验' : f.extra ? '额外完成' : f.date === today.date ? '今天' : f.date.slice(5)}
              </View>
            </View>
          </View>
          <View className='tm__react'>
            {REACTIONS.map((r) => {
              const n = f.reactions[r.kind] ?? 0
              const on = f.mine.includes(r.kind)
              return (
                <View key={r.kind} className={`tm__chip ${on ? 'is-on' : ''}`} onClick={() => react(f.id, r.kind)}>
                  {n > 0 ? `${r.label} ${n}` : r.label}
                </View>
              )
            })}
          </View>
        </Card>
      ))}
    </View>
  )
}

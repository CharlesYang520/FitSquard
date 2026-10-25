import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { THEME_LABEL } from '@core/copy'
import { Avatar, Button, Card, Disclaimer, TodayRow } from '../../components/ui'
import { api, type JoinData, type PublicInfoData } from '../../services/api'
import { hasAgreed, refreshSession, session } from '../../store/session'
import './index.scss'

export default function InvitePage() {
  const [teamId, setTeamId] = useState('')
  const [info, setInfo] = useState<PublicInfoData | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (id: string) => {
    if (!id) return
    try {
      setInfo(await api<PublicInfoData>('team.publicInfo', { team_id: id }))
    } catch {
      // 已提示
    }
  }

  useLoad((q) => {
    const id = (q?.team as string) || ''
    setTeamId(id)
    if (hasAgreed() && !session.user) refreshSession()
    load(id)
  })
  useDidShow(() => {
    if (teamId) load(teamId)
  })

  const onJoin = async () => {
    if (!session.user && !(await refreshSession())) {
      session.pendingInvite = teamId
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    setBusy(true)
    try {
      await api<JoinData>('team.join', { team_id: teamId })
      Taro.redirectTo({ url: '/pages/checkin/index' })
    } catch {
      load(teamId)
    } finally {
      setBusy(false)
    }
  }

  if (!info) return <View className='loading-page'>{teamId ? '战书加载中…' : '战书链接不完整'}</View>
  const { team, captain, state } = info

  return (
    <View className='page page--bottom invite'>
      <View className='invite__letter'>
        <View className='invite__lb'>— 战 书 —</View>
        <View className='invite__who'>
          <Avatar id={team.id} name={captain.nickname} src={captain.avatar} size='md' />
          <Text className='t-h2'>{`${captain.nickname || '队友'}向你下了战书`}</Text>
        </View>
        <View className='invite__taunt'>{`“${team.taunt}”`}</View>
        <View className='invite__facts'>
          <View>
            <View className='v'>{`${team.period_days} 天`}</View>
            <View className='k'>{`今天 Day ${team.day_no}`}</View>
          </View>
          <View>
            <View className='v'>{`${team.member_count} 人`}</View>
            <View className='k'>已加入</View>
          </View>
          <View>
            <View className='v'>{THEME_LABEL[team.theme]}</View>
            <View className='k'>主题</View>
          </View>
        </View>
      </View>

      <Card className='mt-16'>
        <View className='t-h3 bold'>{team.name}</View>
        <View className='t-cap c-muted mt-4'>{`今天 ${info.today_qualified.length} 人已达标 · 全队连续 ${team.team_streak} 天`}</View>
        {info.today_qualified.length > 0 && (
          <View className='mt-12'>
            <TodayRow size='sm' members={info.today_qualified.map((u, i) => ({ user_id: `${i}`, nickname: u.nickname, avatar: u.avatar, qualified: true }))} />
          </View>
        )}
      </Card>

      {info.pick && (
        <Card className='mt-12'>
          <Text className='invite__pick-lb'>今天的推荐</Text>
          <View className='invite__pick'>{`${info.pick.emoji} ${info.pick.text}`}</View>
          <View className='t-cap c-muted mt-4'>{info.pick.reason}</View>
        </Card>
      )}

      <View className='tip'>玩法：每天 9 个小行动，任选 3 个做完就达标。从你加入那天开始算，迟到不吃亏。</View>
      <Disclaimer />

      <View className='bottom-bar'>
        {state === 'open' && (
          <Button block loading={busy} onClick={onJoin}>
            接下战书，今天就开始
          </Button>
        )}
        {state === 'member' && (
          <Button block onClick={() => Taro.redirectTo({ url: '/pages/checkin/index' })}>
            你已在队里，去打卡
          </Button>
        )}
        {state === 'full' && (
          <Button block disabled>
            这队已经满 10 人了
          </Button>
        )}
        {state === 'in_other' && (
          <Button block disabled>
            你正在打另一局，打完再来
          </Button>
        )}
        {state === 'ended' && (
          <Button block onClick={() => Taro.redirectTo({ url: '/pages/create/index' })}>
            这局已结束，自己开一局
          </Button>
        )}
      </View>
    </View>
  )
}

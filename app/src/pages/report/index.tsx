import { Text, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { Avatar, Button, Card, Num, Segmented } from '../../components/ui'
import { api, type ReportData } from '../../services/api'
import { askSubscribe } from '../../services/subscribe'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

export default function ReportPage() {
  const [teamId, setTeamId] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [period, setPeriod] = useState<'14' | '21'>('21')
  const [busy, setBusy] = useState(false)
  const [newTeam, setNewTeam] = useState<string | null>(null)

  useLoad(async (q) => {
    const id = (q?.team as string) || ''
    setTeamId(id)
    if (!(await ensureLogin()) || !id) return
    try {
      const d = await api<ReportData>('report.get', { team_id: id })
      setData(d)
      if (d.next_team_id) setNewTeam(d.next_team_id)
    } catch {
      // 已提示
    }
  })

  useShareAppMessage(() =>
    newTeam
      ? { title: `${session.user?.nickname || '队友'}又下战书了：第二局，谁先摸鱼谁请客`, path: `/pages/invite/index?team=${newTeam}` }
      : { title: `${data?.team.name ?? ''} 战报：全队完成率 ${data?.team.rate_pct ?? 0}%`, path: `/pages/report/index?team=${teamId}` },
  )

  const rematch = async () => {
    if (newTeam) {
      Taro.redirectTo({ url: `/pages/invite/index?team=${newTeam}` })
      return
    }
    askSubscribe()
    setBusy(true)
    try {
      const r = await api<{ team_id: string; created: boolean }>('team.rematch', { team_id: teamId, period_days: Number(period) })
      setNewTeam(r.team_id)
      if (!r.created) Taro.redirectTo({ url: `/pages/invite/index?team=${r.team_id}` })
      else Taro.showToast({ title: '开局了，发到群里叫上原班人马', icon: 'none' })
    } catch {
      // 已提示
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <View className='loading-page'>{teamId ? '战报加载中…' : '缺少战队'}</View>
  const { team, members, me } = data

  return (
    <View className='page page--bottom rp'>
      <View className='rp__head'>
        <View className='rp__lb'>— 战 报 —</View>
        <View className='t-h2 mt-8'>{team.name}</View>
        <View className='t-cap rp__sub'>{`${team.start_date.slice(5)} – ${team.end_date.slice(5)} · ${team.period_days} 天 · ${team.member_count} 人`}</View>
        <View className='rp__facts'>
          <View>
            <Num accent size={40}>{`${team.rate_pct}%`}</Num>
            <View className='k'>全队完成率</View>
          </View>
          <View>
            <Num size={40}>{team.all_done_days}</Num>
            <View className='k'>全员到齐天数</View>
          </View>
          <View>
            <Num size={40}>{team.best_team_streak}</Num>
            <View className='k'>全队最长连续</View>
          </View>
        </View>
      </View>

      {me && (
        <Card className='mt-16'>
          <View className='between'>
            <Text className='t-h3 bold'>{`我：第 ${me.rank} 名`}</Text>
            {me.title && <Text className='rp__title'>{`${me.title.emoji} ${me.title.name}`}</Text>}
          </View>
          <View className='t-cap c-muted mt-4'>{`达标 ${me.done_days}/${me.expected_days} 天 · 完成率 ${me.rate_pct}% · 最长连续 ${me.best_streak} 天`}</View>
        </Card>
      )}

      <View className='section-head'>
        <Text className='h'>本局排名</Text>
        <Text className='more'>按完成率</Text>
      </View>
      <View className='rp__list'>
        {members.map((m) => (
          <View key={m.user_id} className={`rp__row ${m.is_me ? 'is-me' : ''}`}>
            <Text className='rp__rk'>{m.rank}</Text>
            <Avatar id={m.user_id} name={m.nickname} src={m.avatar} size='sm' />
            <View className='flex-1'>
              <View className='rp__nm'>{m.nickname}</View>
              <View className='rp__meta'>{m.title ? `${m.title.emoji} ${m.title.name} · ${m.title.desc}` : `最长连续 ${m.best_streak} 天`}</View>
            </View>
            <View className='rp__rate'>
              <Num size={18}>{`${m.rate_pct}%`}</Num>
              <View className='t-label c-muted'>{`${m.done_days}/${m.expected_days}`}</View>
            </View>
          </View>
        ))}
      </View>

      {team.offline_note && <View className='tip tip--warm'>{`🤝 线下约定：${team.offline_note}（平台不参与，你们自己兑现）`}</View>}

      <View className='rp__links'>
        <Text onClick={() => Taro.navigateTo({ url: `/pages/poster/index?type=report&team=${teamId}` })}>生成战报海报 ›</Text>
      </View>

      <View className='bottom-bar'>
        {newTeam ? (
          <View className='row gap-8'>
            <Button kind='secondary' className='flex-1' onClick={() => Taro.redirectTo({ url: `/pages/invite/index?team=${newTeam}` })}>
              看新战书
            </Button>
            <Button className='flex-1' openType='share'>
              发到微信
            </Button>
          </View>
        ) : (
          <View>
            <View className='rp__period'>
              <Text className='t-cap c-muted'>下一局</Text>
              <Segmented
                options={[
                  { key: '14', label: '14 天' },
                  { key: '21', label: '21 天' },
                ]}
                value={period}
                onChange={(k) => setPeriod(k as '14' | '21')}
              />
            </View>
            <Button block loading={busy} onClick={rematch}>
              再来一局
            </Button>
          </View>
        )}
      </View>
    </View>
  )
}

import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { REACTIONS, THEME_LABEL } from '@core/copy'
import { Avatar, Button, Card, Empty, Num, Tag, TodayRow } from '../../components/ui'
import { api, ApiError, type HomeData } from '../../services/api'
import type { nudgeInfo as NudgeInfoFn } from '../../../cloudfunctions/api/src/handlers/team'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

type NudgeInfo = Awaited<ReturnType<typeof NudgeInfoFn>>

export default function TeamPage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [noTeam, setNoTeam] = useState(false)
  const [nudge, setNudge] = useState<NudgeInfo | null>(null)
  const [nudging, setNudging] = useState(false)
  /** 分享内容：催一下弹层打开时分享战况卡，否则分享战书 */
  const shareRef = useRef<{ title: string; path: string } | null>(null)

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
  useShareAppMessage(() => {
    if (shareRef.current) {
      const s = shareRef.current
      shareRef.current = null
      return s
    }
    return {
      title: `${session.user?.nickname || '队友'}向你下了战书：${data?.team.taunt ?? ''}`,
      path: `/pages/invite/index?team=${data?.team.id ?? ''}`,
    }
  })

  const openNudge = async (to: string) => {
    if (!data) return
    try {
      const info = await api<NudgeInfo>('team.nudgeInfo', { team_id: data.team.id, to })
      shareRef.current = null
      setNudge(info)
    } catch {
      // 已提示
    }
  }

  /** 直接提醒：系统发服务通知；没额度时服务端会返回 share，前端提示改为分享 */
  const doNudge = async (viaShare: boolean) => {
    if (!data || !nudge) return
    if (viaShare) shareRef.current = nudge.share
    setNudging(true)
    try {
      const r = await api<{ via: 'notify' | 'share'; left_today: number; share: { title: string; path: string } }>('team.nudge', {
        team_id: data.team.id,
        to: nudge.target.user_id,
      })
      if (!viaShare) {
        if (r.via === 'notify') {
          Taro.showToast({ title: `已通过微信通知提醒${nudge.target.nickname}`, icon: 'none' })
          setNudge(null)
        } else {
          Taro.showToast({ title: 'TA 没开通知，发到微信群催吧', icon: 'none' })
          setNudge({ ...nudge, can_notify: false, left_today: r.left_today })
        }
      } else setNudge(null)
    } catch {
      // 已提示（例如今天催满 3 次）
    } finally {
      setNudging(false)
    }
  }

  const editNote = () => {
    if (!data) return
    Taro.showModal({
      title: '线下约定',
      editable: true,
      placeholderText: '如：最后一名请全队喝无糖茶（30 字内）',
      content: data.team.offline_note,
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await api<{ note: string }>('team.setNote', { team_id: data.team.id, note: (r as any).content ?? '' })
          setData({ ...data, team: { ...data.team, offline_note: res.note } })
        } catch {
          // 已提示
        }
      },
    } as any)
  }

  const leave = () => {
    if (!data) return
    Taro.showModal({
      title: '退出这局？',
      content: '退出后不再计入全队，已有记录保留。退出后可以开新局或加入别的战队。',
      confirmText: '退出',
      confirmColor: '#D9381E',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await api('team.leave', { team_id: data.team.id })
          session.team = null
          Taro.switchTab({ url: '/pages/home/index' })
        } catch {
          // 已提示
        }
      },
    })
  }

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
          <Text className='t-h3 bold'>{`全队今天 ${today.done}/${today.total} 人达标`}</Text>
          <Text className='t-cap c-muted'>每人 9 选 3</Text>
        </View>
        <View className='mt-12'>
          <TodayRow members={today.members} />
        </View>
        {todo.length > 0 && (
          <View className='tm__todo'>
            <Text className='t-cap c-muted'>还没达标：</Text>
            {todo.map((m) => (
              <View key={m.user_id} className='tm__nudge' onClick={() => openNudge(m.user_id)}>
                {`催${m.nickname}`}
              </View>
            ))}
          </View>
        )}
      </Card>

      {(team.is_captain || team.offline_note) && (
        <View className='tm__note' onClick={team.is_captain ? editNote : undefined}>
          <Text className='t-cap c-muted'>线下约定</Text>
          <Text className='tm__note-t'>{team.offline_note || '还没写，点这里写一句（只在战报展示）'}</Text>
          {team.is_captain && <Text className='tm__note-e'>✎</Text>}
        </View>
      )}

      <View className='section-head'>
        <View className='h'>
          实时排名 <Tag kind='solid'>LIVE</Tag>
        </View>
        <Text className='more'>按达标天数排 · 下拉刷新</Text>
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
            <View className='tm__rate'>
              {r.passed_days > 0 ? (
                <>
                  <Text className='tm__rate-n'>{`${r.done_days}/${r.passed_days}`}</Text>
                  <Text className='tm__rate-k'>达标天</Text>
                </>
              ) : (
                <>
                  <Text className='tm__rate-n'>{`${r.today_counted}/3`}</Text>
                  <Text className='tm__rate-k'>今天项数</Text>
                </>
              )}
            </View>
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

      <View className='tm__leave' onClick={leave}>
        退出这局
      </View>

      {nudge && (
        <View className='fs-sheet-wrap'>
          <View className='fs-mask' onClick={() => setNudge(null)} />
          <View className='fs-sheet'>
            <View className='between'>
              <Text className='t-h3 bold'>{`催${nudge.target.nickname} 📣`}</Text>
              <Text className='t-cap c-muted' onClick={() => setNudge(null)}>
                取消
              </Text>
            </View>
            <View className='tm__card'>
              <View className='between'>
                <Text className='t-cap tm__card-sub'>{`${nudge.card.team_name} · Day ${nudge.card.day_no}`}</Text>
                <Tag kind='accent'>{`🔥 连续 ${nudge.card.team_streak} 天`}</Tag>
              </View>
              <View className='row gap-8 mt-12'>
                <TodayRow size='sm' members={nudge.card.members} />
                <Text className='flex-1 tm__card-n'>{`${nudge.card.done}/${nudge.card.total} 做完了`}</Text>
              </View>
              <View className='tm__card-t'>{`@${nudge.target.nickname} 就差你了${nudge.card.pick ? `，${nudge.card.pick}` : ''}`}</View>
            </View>
            {nudge.left_today <= 0 ? (
              <Button block disabled className='mt-16'>
                今天已经催了 3 次
              </Button>
            ) : nudge.can_notify ? (
              <Button block className='mt-16' loading={nudging} onClick={() => doNudge(false)}>
                直接提醒他
              </Button>
            ) : (
              <Button block className='mt-16' openType='share' onClick={() => doNudge(true)}>
                发到微信
              </Button>
            )}
            <View className='t-label c-muted center mt-8'>
              {nudge.can_notify
                ? `${nudge.target.nickname}会在微信「服务通知」里收到提醒 · 今天还能催 ${nudge.left_today} 次`
                : `TA 还没开通知，发到群里 @ 一下 · 今天还能催 ${nudge.left_today} 次`}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

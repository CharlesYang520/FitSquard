import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Button, Card, Disclaimer, Num } from '../../components/ui'
import { ProfileFields } from '../../components/ProfileFields'
import { uploadAvatar } from '../../services/profile'
import { api, ApiError, isLocalMode, type HomeData, type ReportListData } from '../../services/api'
import { resetLocal as resetLocalDb } from '../../services/local'
import { clearSession, ensureLogin, loginWith, session } from '../../store/session'
import './index.scss'

const GRID_LABEL = { done: '达标', unwell: '不太舒服日', miss: '未达标', today: '今天', future: '未来', before_join: '未加入' } as const

export default function MePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reports, setReports] = useState<ReportListData>([])
  const [nick, setNick] = useState(session.user?.nickname ?? '')
  const [avatarDraft, setAvatarDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useDidShow(async () => {
    if (!(await ensureLogin())) return
    setNick(session.user?.nickname ?? '')
    api<ReportListData>('report.list', {}, { silent: true }).then(setReports).catch(() => undefined)
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
  const dirty = !!avatarDraft || nick.trim() !== (user?.nickname ?? '')

  const saveProfile = async () => {
    setSaving(true)
    try {
      const profile: { nickname?: string; avatar?: string } = {}
      if (nick.trim() && nick.trim() !== user?.nickname) profile.nickname = nick.trim()
      if (avatarDraft) profile.avatar = await uploadAvatar(avatarDraft, user?.id)
      await loginWith(profile)
      setAvatarDraft('')
      Taro.showToast({ title: '资料已更新', icon: 'none' })
    } catch {
      Taro.showToast({ title: '没保存成功，再试一次', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }
  const me = data?.me
  const soon = (what: string) => Taro.showToast({ title: `${what}下个版本上线`, icon: 'none' })

  const deleteAccount = () => {
    Taro.showModal({
      title: '注销账号？',
      content: '会退出进行中的战队，删除体重身高和通知授权，昵称头像清空，历史打卡匿名保留。不能恢复。',
      confirmText: '注销',
      confirmColor: '#D9381E',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await api('user.delete')
          clearSession()
          Taro.reLaunch({ url: '/pages/login/index' })
        } catch {
          // 已提示
        }
      },
    })
  }

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
      <Card className='mt-8'>
        <ProfileFields avatar={avatarDraft || user?.avatar || ''} nickname={nick} onAvatar={setAvatarDraft} onNickname={setNick} />
        <View className='between mt-12'>
          <Text className='t-cap c-muted'>{data ? `当前战队：${data.team.name}` : '还没有进行中的战队'}</Text>
          {dirty && (
            <Button small loading={saving} onClick={saveProfile}>
              保存
            </Button>
          )}
        </View>
      </Card>

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

      <View className='section-head'>
        <Text className='h'>历史战报</Text>
        <Text className='more'>{reports.length ? `${reports.length} 局` : ''}</Text>
      </View>
      {reports.length === 0 ? (
        <View className='me__empty'>打完第一局，这里会有战报</View>
      ) : (
        <View className='me__menu me__reports'>
          {reports.map((r) => (
            <View key={r.team_id} className='me__item' onClick={() => Taro.navigateTo({ url: `/pages/report/index?team=${r.team_id}` })}>
              <View>
                <View>{r.name}</View>
                <View className='t-label c-muted'>{`${r.start_date.slice(5)} – ${r.end_date.slice(5)} · ${r.period_days} 天`}</View>
              </View>
              <Text className='me__rep'>{`${r.title ? `${r.title.emoji} ` : ''}${r.rate_pct}% ›`}</Text>
            </View>
          ))}
        </View>
      )}

      <View className='me__menu'>
        <View className='me__item' onClick={() => Taro.navigateTo({ url: '/pages/weight/index' })}>
          <Text>🔒 记一下体重（只有自己看得到）</Text>
          <Text className='me__soon'>›</Text>
        </View>
        <View className='me__item' onClick={() => soon('通知设置')}>
          <Text>🔔 微信提醒（打卡时顺手开启）</Text>
          <Text className='me__soon'>›</Text>
        </View>
        <View className='me__item' onClick={deleteAccount}>
          <Text className='c-muted'>注销账号</Text>
          <Text className='me__soon'>›</Text>
        </View>
        {user?.is_admin && (
          <View className='me__item' onClick={() => Taro.navigateTo({ url: '/admin/index' })}>
            <Text>🛠 运营后台</Text>
            <Text className='me__soon'>›</Text>
          </View>
        )}
        <View className='me__item' onClick={() => Taro.navigateTo({ url: '/pages/legal/index?doc=privacy' })}>
          <Text>📄 隐私政策 · 用户协议</Text>
          <Text className='me__soon'>›</Text>
        </View>
        {isLocalMode && (
          <View className='me__item' onClick={resetLocal}>
            <Text>🧪 清空本地演示数据</Text>
            <Text className='me__soon'>›</Text>
          </View>
        )}
      </View>
      <View className='me__uid' onClick={() => user && Taro.setClipboardData({ data: user.id })}>
        {`用户 ID：${user?.id ?? ''}（点击复制）`}
      </View>
      <Disclaimer />
    </View>
  )
}

// 运营后台 · 新增 / 编辑行动模板
import { Input, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import type { Action, Theme } from '@core/types'
import { THEMES } from '@core/types'
import { checkAction } from '@core/actionCheck'
import { THEME_LABEL } from '@core/copy'
import { Button, Chips } from '../components/ui'
import { api } from '../services/api'
import './admin.scss'

const EMPTY: Action = {
  _id: '',
  group: 'move',
  day_type: 'any',
  recovery: false,
  minutes: 5,
  scene: 'any',
  intensity: 'light',
  verify: 'self',
  window: 'any',
  emoji: '✅',
  text: '',
  reason: '',
  themes: [],
  status: 'on',
}

const opts = <K extends string>(m: Record<K, string>) => (Object.keys(m) as K[]).map((k) => ({ key: k, label: m[k] }))

export default function AdminAction() {
  const [a, setA] = useState<Action>(EMPTY)
  const [isNew, setIsNew] = useState(true)
  const [busy, setBusy] = useState(false)

  useLoad(async (q) => {
    if (!q?.id) return
    setIsNew(false)
    const d = await api<{ items: Action[] }>('admin.actions')
    const found = d.items.find((x) => x._id === q.id)
    if (found) setA({ ...EMPTY, ...found })
  })

  const set = <K extends keyof Action>(k: K, v: Action[K]) => setA((x) => ({ ...x, [k]: v }))
  const errs = checkAction(a)

  const save = async () => {
    setBusy(true)
    try {
      await api('admin.saveAction', { action: a })
      Taro.showToast({ title: '已保存', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 500)
    } catch {
      // 已提示
    } finally {
      setBusy(false)
    }
  }

  const field = (label: string, node: JSX.Element) => (
    <View className='adm__field'>
      <View className='lb'>{label}</View>
      {node}
    </View>
  )
  const input = (k: 'text' | 'sub' | 'reason' | 'emoji' | '_id', ph: string, disabled = false) => (
    <Input className='adm__input' placeholder={ph} disabled={disabled} value={String(a[k] ?? '')} onInput={(e) => set(k, e.detail.value as never)} />
  )

  return (
    <View className='page page--bottom adm'>
      {field('ID（新建后不可改）', input('_id', '如 m25', !isNew))}
      {field('文案（≤ 24 字）', input('text', '如 午饭后绕楼走 15 分钟'))}
      {field('副标题（可选，≤ 16 字）', input('sub', '如 明早确认'))}
      {field('推荐理由（≤ 30 字）', input('reason', '如 饭后走一走，下午不容易犯困'))}
      {field('Emoji', input('emoji', '🚶'))}
      {field('分组', <Chips options={opts({ move: '动一动', food: '吃喝', rest: '作息' })} value={a.group} onChange={(v) => set('group', v)} />)}
      {field('日期类型', <Chips options={opts({ workday: '工作日', holiday: '休息日', any: '通用', festival: '节日' })} value={a.day_type} onChange={(v) => set('day_type', v)} />)}
      {field(
        '时长（分钟）',
        <Input className='adm__input' type='number' value={String(a.minutes)} onInput={(e) => set('minutes', Number(e.detail.value))} />,
      )}
      {field('核验方式', <Chips options={opts({ self: '自报', werun: '微信运动' })} value={a.verify} onChange={(v) => set('verify', v)} />)}
      {a.verify === 'werun' &&
        field(
          '步数目标',
          <Input className='adm__input' type='number' value={String(a.werun_steps ?? '')} onInput={(e) => set('werun_steps', Number(e.detail.value))} />,
        )}
      {field(
        '可打卡时间',
        <Chips
          options={opts({ any: '随时', after_lunch: '12:00 后', after_dinner: '18:00 后', after_20: '20:00 后', after_21: '21:00 后', next_morning: '次日早上确认' })}
          value={a.window}
          onChange={(v) => set('window', v)}
        />,
      )}
      {field('场景', <Chips options={opts({ office: '办公室', home: '家', outdoor: '户外', any: '随时' })} value={a.scene} onChange={(v) => set('scene', v)} />)}
      {field('强度', <Chips options={opts({ light: '轻', medium: '中' })} value={a.intensity} onChange={(v) => set('intensity', v)} />)}
      {field(
        '恢复类（不太舒服时可做）',
        <Chips options={opts({ yes: '是', no: '否' })} value={a.recovery ? 'yes' : 'no'} onChange={(v) => set('recovery', v === 'yes')} />,
      )}
      {field(
        '主题加权（可多选，不选 = 通用）',
        <View className='fs-chips'>
          {THEMES.filter((t) => t !== 'all').map((t) => {
            const on = a.themes.includes(t)
            return (
              <View key={t} className={`fs-chip ${on ? 'is-on' : ''}`} onClick={() => set('themes', on ? a.themes.filter((x) => x !== t) : [...a.themes, t as Theme])}>
                {THEME_LABEL[t]}
              </View>
            )
          })}
        </View>,
      )}
      {field('状态', <Chips options={opts({ on: '上线', off: '下线' })} value={a.status} onChange={(v) => set('status', v)} />)}

      {errs.length > 0 && (
        <View className='adm__errs'>
          {errs.map((e) => (
            <Text key={e} style={{ display: 'block' }}>{`· ${e}`}</Text>
          ))}
        </View>
      )}

      <View className='bottom-bar'>
        <Button block loading={busy} disabled={errs.length > 0} onClick={save}>
          保存
        </Button>
      </View>
    </View>
  )
}

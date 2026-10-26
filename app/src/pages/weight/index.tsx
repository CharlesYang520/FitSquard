// 私密体重：只有自己看得到，不进排名、战报、海报
import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Button, Card, Num } from '../../components/ui'
import { api, type WeightListData } from '../../services/api'
import { ensureLogin } from '../../store/session'
import './index.scss'

const CHART_H = 140

export default function WeightPage() {
  const [data, setData] = useState<WeightListData | null>(null)
  const [agree, setAgree] = useState(false)
  const [height, setHeight] = useState('')
  const [kg, setKg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!(await ensureLogin())) return
    try {
      setData(await api<WeightListData>('weight.list'))
    } catch {
      // 已提示
    }
  }
  useDidShow(() => {
    load()
  })

  const onConsent = async () => {
    if (!agree) {
      Taro.showToast({ title: '需要先勾选同意', icon: 'none' })
      return
    }
    setBusy(true)
    try {
      await api('weight.consent', { agree: true, height_cm: Number(height) })
      await load()
    } catch {
      // 已提示
    } finally {
      setBusy(false)
    }
  }

  const onAdd = async () => {
    setBusy(true)
    try {
      await api('weight.add', { weight_kg: Number(kg) })
      setKg('')
      Taro.showToast({ title: '记好了，只有你看得到', icon: 'none' })
      await load()
    } catch {
      // 已提示
    } finally {
      setBusy(false)
    }
  }

  const onRevoke = () => {
    Taro.showModal({
      title: '撤回同意？',
      content: '会删除你记过的全部身高和体重，不能恢复。',
      confirmText: '撤回并删除',
      confirmColor: '#D9381E',
      success: async (r) => {
        if (!r.confirm) return
        await api('weight.consent', { agree: false })
        setAgree(false)
        await load()
      },
    })
  }

  if (!data) return <View className='loading-page'>加载中…</View>

  if (!data.consented) {
    return (
      <View className='page wt'>
        <View className='t-h1'>记一下体重</View>
        <View className='t-cap c-muted mt-4'>可选功能。每周记 1–2 次就够，只有你自己看得到。</View>
        <Card className='mt-16'>
          <View className='wt__rule'>🔒 不进排名、战报、海报、战书，队友看不到</View>
          <View className='wt__rule'>🗑 随时可以撤回，撤回即删除全部数据</View>
          <View className='wt__rule'>🩺 不做诊断、不给减重目标，有基础疾病请咨询医生</View>
        </Card>
        <View className='field-label'>身高（cm）</View>
        <Input className='wt__input' type='digit' placeholder='如 175' value={height} onInput={(e) => setHeight(e.detail.value)} />
        <View className='wt__agree' onClick={() => setAgree(!agree)}>
          <View className={`wt__box ${agree ? 'is-on' : ''}`}>{agree ? '✓' : ''}</View>
          <Text>我同意瘦身战队处理我的身高、体重，仅用于给我自己看趋势（详见《隐私政策》）</Text>
        </View>
        <Button block className='mt-24' loading={busy} disabled={!agree || !height} onClick={onConsent}>
          同意并开始记录
        </Button>
      </View>
    )
  }

  const items = data.items
  const vals = items.map((i) => i.weight_kg)
  const min = vals.length ? Math.min(...vals) : 0
  const max = vals.length ? Math.max(...vals) : 0
  const span = Math.max(1, max - min)
  const last = items[items.length - 1]
  const first = items[0]

  return (
    <View className='page wt'>
      <View className='between'>
        <View className='t-h1'>我的体重</View>
        <Text className='t-label c-muted'>🔒 只有你看得到</Text>
      </View>

      <Card className='mt-16'>
        <View className='row gap-12' style={{ alignItems: 'flex-end' }}>
          <Num size={40}>{last ? last.weight_kg.toFixed(1) : '--'}</Num>
          <Text className='t-cap c-muted wt__unit'>kg · 最近一次</Text>
        </View>
        <View className='t-cap c-muted mt-4'>{`已记录 ${items.length} 次 · 看趋势就好，不用盯每天的数字`}</View>
        {items.length > 1 && (
          <View className='wt__chart' style={{ height: Taro.pxTransform(CHART_H) }}>
            {items.map((i, idx) => (
              <View
                key={i.date}
                className='wt__dot'
                style={{
                  left: `${(idx / (items.length - 1)) * 100}%`,
                  bottom: `${((i.weight_kg - min) / span) * 80 + 10}%`,
                }}
              />
            ))}
          </View>
        )}
        {items.length > 1 && (
          <View className='between t-label c-muted'>
            <Text>{first.date.slice(5)}</Text>
            <Text>{last.date.slice(5)}</Text>
          </View>
        )}
      </Card>

      <View className='field-label'>今天的体重（kg）</View>
      <View className='row gap-8'>
        <Input className='wt__input flex-1' type='digit' placeholder='如 71.5' value={kg} onInput={(e) => setKg(e.detail.value)} />
        <Button loading={busy} disabled={!kg} onClick={onAdd}>
          记一下
        </Button>
      </View>
      <View className='t-label c-muted mt-8'>同一天再记会覆盖。体重有起伏很正常，看趋势就好。</View>

      <View className='wt__revoke' onClick={onRevoke}>
        撤回同意并删除全部数据
      </View>
    </View>
  )
}

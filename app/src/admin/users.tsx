// 运营后台 · 用户查询与封禁
import { Input, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '../components/ui'
import { api } from '../services/api'
import type { users as usersFn } from '../../cloudfunctions/api/src/handlers/admin'
import './admin.scss'

type Row = Awaited<ReturnType<typeof usersFn>>[number]

export default function AdminUsers() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  const search = async (kw = q) => {
    try {
      setRows(await api<Row[]>('admin.users', { q: kw }))
    } catch {
      // 已提示
    }
  }
  useLoad(() => {
    search('')
  })

  const toggleBan = (u: Row) => {
    Taro.showModal({
      title: u.banned ? `解封 ${u.nickname}？` : `封禁 ${u.nickname}？`,
      content: u.banned ? '解封后可正常使用。' : '封禁后 TA 无法打卡、加入或开局，已有数据保留。',
      confirmColor: u.banned ? '#141414' : '#D9381E',
      success: async (r) => {
        if (!r.confirm) return
        await api('admin.ban', { user_id: u.id, banned: !u.banned })
        search()
      },
    })
  }

  return (
    <View className='page adm'>
      <View className='row gap-8'>
        <Input className='adm__search flex-1' placeholder='昵称或用户 ID' value={q} onInput={(e) => setQ(e.detail.value)} onConfirm={() => search()} />
        <Button small onClick={() => search()}>
          搜索
        </Button>
      </View>
      <View className='adm__list'>
        {rows.map((u) => (
          <View key={u.id} className='adm__row'>
            <View className='flex-1'>
              <View className='adm__nm'>
                {u.nickname}
                {u.banned && <Text className='adm__tag-ban'> · 已封禁</Text>}
              </View>
              <View className='adm__meta'>{`${new Date(u.created_at).toLocaleDateString('zh-CN')} 注册 · ${u.team || '无进行中战队'} · 连续 ${u.streak_days} 天`}</View>
              <View className='adm__meta' onClick={() => Taro.setClipboardData({ data: u.id })}>{`ID ${u.id}（点击复制）`}</View>
            </View>
            {!u.deleted && (
              <Button small kind={u.banned ? 'secondary' : 'primary'} onClick={() => toggleBan(u)}>
                {u.banned ? '解封' : '封禁'}
              </Button>
            )}
          </View>
        ))}
        {rows.length === 0 && <View className='fs-empty'>没有找到</View>}
      </View>
    </View>
  )
}

import { Input, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { Button, Disclaimer } from '../../components/ui'
import { isLocalMode } from '../../services/api'
import { goAfterLogin, loginWith, refreshSession, session } from '../../store/session'
import './index.scss'

export default function LoginPage() {
  const [agreed, setAgreed] = useState(false)
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)

  useLoad(async (q) => {
    if (q?.team) session.pendingInvite = q.team
    // 已建档用户不再显示登录页
    if (await refreshSession()) goAfterLogin()
  })

  const onLogin = async () => {
    if (!agreed) {
      Taro.showToast({ title: '先勾协议，再上秤', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      await loginWith({ nickname: nickname.trim() || undefined })
      goAfterLogin()
    } catch {
      // api 已提示
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='page login'>
      <View className='login__brand'>
        <View className='login__logo'>瘦</View>
        <View className='login__name'>瘦身战队</View>
        <View className='login__slogan'>拉上熟人，每天 9 选 3，一起连续达标</View>
      </View>

      <View className='login__points'>
        <View>👥 和同事朋友组队，14 天一局</View>
        <View>✅ 每天 9 个小行动，任选 3 个做完就达标</View>
        <View>🔥 全队连续达标，谁也不想当断的那个</View>
      </View>

      <View className='login__form'>
        <Input
          className='login__input'
          type='nickname'
          placeholder='你的昵称（队友看得到，可跳过）'
          maxlength={20}
          value={nickname}
          onInput={(e) => setNickname(e.detail.value)}
          onBlur={(e) => setNickname(e.detail.value)}
        />
        <Button block loading={loading} onClick={onLogin}>
          微信一键登录
        </Button>
        <View className='login__agree' onClick={() => setAgreed(!agreed)}>
          <View className={`login__box ${agreed ? 'is-on' : ''}`}>{agreed ? '✓' : ''}</View>
          <Text>
            我已阅读并同意<Text className='login__link'>《用户协议》</Text>和<Text className='login__link'>《隐私政策》</Text>
          </Text>
        </View>
        {isLocalMode && <View className='login__local'>本地演示模式：未配置云环境，数据只存在本机</View>}
      </View>
      <Disclaimer />
    </View>
  )
}

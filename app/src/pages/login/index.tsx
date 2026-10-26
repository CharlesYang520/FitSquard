import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { Button, Disclaimer } from '../../components/ui'
import { ProfileFields } from '../../components/ProfileFields'
import { uploadAvatar } from '../../services/profile'
import { isLocalMode } from '../../services/api'
import { goAfterLogin, loginWith, refreshSession, session } from '../../store/session'
import './index.scss'

export default function LoginPage() {
  const [agreed, setAgreed] = useState(false)
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('')
  const [loading, setLoading] = useState(false)

  useLoad(async (q) => {
    if (q?.team) session.pendingInvite = q.team
    // 已建档用户不再显示登录页
    if (await refreshSession()) goAfterLogin()
  })

  const openDoc = (doc: string) => Taro.navigateTo({ url: `/pages/legal/index?doc=${doc}` })

  const onLogin = async () => {
    if (!agreed) {
      Taro.showToast({ title: '先勾协议，再上秤', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      // 先建档（拿到身份），再上传头像并回写，避免头像上传失败卡住登录
      await loginWith({ nickname: nickname.trim() || undefined })
      if (avatar) {
        try {
          const fileID = await uploadAvatar(avatar)
          await loginWith({ avatar: fileID })
        } catch {
          Taro.showToast({ title: '头像没传上，可以在“我的”里再换', icon: 'none' })
        }
      }
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
        <View className='login__profile'>
          <ProfileFields avatar={avatar} nickname={nickname} onAvatar={setAvatar} onNickname={setNickname} />
        </View>
        <Button block loading={loading} onClick={onLogin}>
          微信一键登录
        </Button>
        <View className='login__agree'>
          <View className={`login__box ${agreed ? 'is-on' : ''}`} onClick={() => setAgreed(!agreed)}>
            {agreed ? '✓' : ''}
          </View>
          <Text onClick={() => setAgreed(!agreed)}>我已阅读并同意</Text>
          <Text className='login__link' onClick={() => openDoc('terms')}>《用户协议》</Text>
          <Text className='login__link' onClick={() => openDoc('privacy')}>《隐私政策》</Text>
          <Text className='login__link' onClick={() => openDoc('health')}>《健康免责声明》</Text>
        </View>
        {isLocalMode && <View className='login__local'>本地演示模式：未配置云环境，数据只存在本机</View>}
      </View>
      <Disclaimer />
    </View>
  )
}

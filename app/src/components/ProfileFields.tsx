// 头像 + 昵称：点头像弹出“使用微信头像”，点昵称键盘上方出现微信昵称，一点即用
import { Button as TButton, Image, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './ProfileFields.scss'

export function ProfileFields(props: {
  avatar: string
  nickname: string
  onAvatar: (tempPath: string) => void
  onNickname: (v: string) => void
}) {
  return (
    <View className='pf'>
      <TButton
        className='pf__avatar'
        openType='chooseAvatar'
        onChooseAvatar={(e: any) => e?.detail?.avatarUrl && props.onAvatar(e.detail.avatarUrl)}
        onClick={() => {
          // H5 预览没有 chooseAvatar
          if (process.env.TARO_ENV === 'h5') Taro.showToast({ title: '真机上可一键使用微信头像', icon: 'none' })
        }}
      >
        {props.avatar ? <Image className='pf__img' src={props.avatar} mode='aspectFill' /> : <Text className='pf__plus'>头像</Text>}
        <View className='pf__badge'>换</View>
      </TButton>
      <View className='pf__right'>
        <Input
          className='pf__input'
          type='nickname'
          placeholder='点这里，一键用微信昵称'
          maxlength={20}
          value={props.nickname}
          onInput={(e) => props.onNickname(e.detail.value)}
          onBlur={(e) => props.onNickname(e.detail.value)}
        />
        <Text className='pf__tip'>点头像、点昵称框，都可直接用微信的</Text>
      </View>
    </View>
  )
}

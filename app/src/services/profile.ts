// 头像昵称：用微信“头像昵称填写能力”（chooseAvatar + type=nickname），头像上传到云存储换成 fileID
import Taro from '@tarojs/taro'
import { isLocalMode } from './api'

/** chooseAvatar 拿到的是临时路径，上传到云存储后返回 cloud:// fileID；本地演示模式直接用临时路径 */
export async function uploadAvatar(tempPath: string, openidHint = 'u'): Promise<string> {
  if (isLocalMode) return tempPath
  const ext = (tempPath.match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'jpg').toLowerCase()
  const cloudPath = `avatars/${openidHint}_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`
  const r = await Taro.cloud.uploadFile({ cloudPath, filePath: tempPath })
  return r.fileID
}

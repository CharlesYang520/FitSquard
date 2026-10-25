import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { CLOUD_ENV, SERIF_FONT_URL } from './config'
import './app.scss'

/** 衬线大数字字体：加载失败静默回退到系统字体（D4） */
function loadSerif() {
  if (!SERIF_FONT_URL || !Taro.loadFontFace) return
  Taro.loadFontFace({
    global: true,
    family: 'FSSerif',
    source: `url("${SERIF_FONT_URL}")`,
    scopes: ['webview', 'native'],
    fail: () => undefined,
  } as any)
}

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    if (CLOUD_ENV && Taro.cloud) {
      Taro.cloud.init({ env: CLOUD_ENV, traceUser: true })
    }
    loadSerif()
  })

  return children
}

export default App

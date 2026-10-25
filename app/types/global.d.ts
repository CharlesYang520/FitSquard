/// <reference types="@tarojs/taro" />

declare module '*.png'
declare module '*.svg'
declare module '*.scss'

declare namespace NodeJS {
  interface ProcessEnv {
    TARO_ENV: 'weapp' | 'h5'
    NODE_ENV: 'development' | 'production'
  }
}

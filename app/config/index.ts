import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import path from 'path'
import devConfig from './dev'
import prodConfig from './prod'

const EXTRA_SRC = [path.resolve(__dirname, '..', 'core'), path.resolve(__dirname, '..', 'cloudfunctions', 'api', 'src')]

export default defineConfig<'webpack5'>(async (merge) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'fitsquad',
    date: '2026-10-24',
    designWidth: 375,
    deviceRatio: {
      375: 2,
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    // H5 只用于在浏览器里快速看页面（本地演示模式），输出到单独目录，不影响小程序 dist/
    outputRoot: process.env.TARO_ENV === 'h5' ? 'dist-h5' : 'dist',
    alias: {
      '@core': path.resolve(__dirname, '..', 'core'),
      '@data': path.resolve(__dirname, '..', 'data'),
      '@': path.resolve(__dirname, '..', 'src'),
    },
    plugins: [],
    defineConstants: {},
    copy: { patterns: [], options: {} },
    framework: 'react',
    compiler: 'webpack5',
    cache: { enable: true },
    h5: {
      publicPath: './',
      staticDirectory: 'static',
      router: { mode: 'hash' },
      compile: { include: EXTRA_SRC },
    },
    mini: {
      // core/ 与云函数源码（本地演示模式用）在 src 之外，需要显式交给 babel 编译
      compile: { include: EXTRA_SRC },
      postcss: {
        pxtransform: { enable: true, config: {} },
        cssModules: { enable: false, config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' } },
      },
    },
  }
  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})

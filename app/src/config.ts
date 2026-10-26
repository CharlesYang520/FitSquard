/**
 * 本地配置。
 * - 拿到云开发环境 ID 后填到 CLOUD_ENV（同时把 project.config.json 里的 appid 换成正式 AppID）。
 * - CLOUD_ENV 留空 = 本地演示模式：云函数代码直接在小程序里跑，数据只存在本机，方便先看页面和流程。
 */
// H5 只用于浏览器里快速预览，固定走本地演示模式
export const CLOUD_ENV = process.env.TARO_ENV === 'h5' ? '' : 'fitsquad-d9gcavmbl205a65d9'

/**
 * 衬线数字字体（思源宋体 / Noto Serif SC 数字子集）的 https 地址，上传到云存储后填这里。
 * 留空 = 用系统衬线字体（New York / 宋体），不影响页面。
 * 注意：域名需加入小程序后台 downloadFile 合法域名。
 */
export const SERIF_FONT_URL = ''

/** 网络失败时的统一提示 */
export const NETWORK_ERROR_TEXT = '网络比你还会摸鱼，再试一次'

// 分享海报（发朋友圈用）：战书 / 战报。Canvas 2D 绘制，保存到相册。不含任何体重数据。
import { Canvas, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { THEME_LABEL } from '@core/copy'
import { Button } from '../../components/ui'
import { api, type PublicInfoData, type ReportData } from '../../services/api'
import { ensureLogin, session } from '../../store/session'
import './index.scss'

const W = 300
const H = 480
const INK = '#141414'
const ORANGE = '#FF5A1F'
const SERIF = '"FSSerif", "New York", "Songti SC", Georgia, serif'
const SANS = '-apple-system, "PingFang SC", sans-serif'

type Kind = 'invite' | 'report'

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrap(ctx: any, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 3) {
  let line = ''
  let lines = 0
  for (const ch of [...text]) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lh)
      line = ch
      lines++
      if (lines >= maxLines) return
    } else line += ch
  }
  if (line) ctx.fillText(line, x, y + lines * lh)
}

async function loadImage(canvas: any, url: string | null): Promise<any | null> {
  if (!url) return null
  try {
    const { tempFilePath: path } = await Taro.downloadFile({ url })
    return await new Promise((resolve) => {
      const img = canvas.createImage()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = path
    })
  } catch {
    return null
  }
}

export default function PosterPage() {
  const [ready, setReady] = useState(false)
  const [canvasNode, setCanvasNode] = useState<any>(null)

  useLoad(async (q) => {
    if (!(await ensureLogin())) return
    const kind = (q?.type as Kind) || 'invite'
    const teamId = (q?.team as string) || ''
    if (!teamId) return
    Taro.setNavigationBarTitle({ title: kind === 'report' ? '战报海报' : '战书海报' })
    try {
      const [info, report, qr] = await Promise.all([
        kind === 'invite' ? api<PublicInfoData>('team.publicInfo', { team_id: teamId }) : Promise.resolve(null),
        kind === 'report' ? api<ReportData>('report.get', { team_id: teamId }) : Promise.resolve(null),
        api<{ url: string | null }>('poster.qrcode', { team_id: teamId }, { silent: true }).catch(() => ({ url: null })),
      ])
      setTimeout(() => draw(kind, info, report, qr.url), 50)
    } catch {
      // 已提示
    }
  })

  const draw = (kind: Kind, info: PublicInfoData | null, report: ReportData | null, qrUrl: string | null) => {
    Taro.createSelectorQuery()
      .select('#poster')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        const canvas = res?.[0]?.node
        if (!canvas) {
          Taro.showToast({ title: '当前环境不支持海报', icon: 'none' })
          return
        }
        const dpr = Taro.getSystemInfoSync().pixelRatio || 2
        canvas.width = W * dpr
        canvas.height = H * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)

        // 底
        ctx.fillStyle = '#FAFAF8'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = INK
        roundRect(ctx, 16, 16, W - 32, 300, 20)
        ctx.fill()

        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = `11px ${SANS}`
        ctx.fillText(kind === 'report' ? '—  战  报  —' : '—  战  书  —', W / 2, 46)

        if (kind === 'invite' && info) {
          ctx.fillStyle = '#fff'
          ctx.font = `bold 17px ${SANS}`
          ctx.fillText(`${info.captain.nickname || session.user?.nickname || '队友'} 向你下了战书`, W / 2, 84)
          ctx.fillStyle = ORANGE
          ctx.font = `600 22px ${SERIF}`
          wrap(ctx, `“${info.team.taunt}”`, W / 2, 130, W - 70, 30, 2)
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          ctx.font = `13px ${SANS}`
          ctx.fillText(`${info.team.name}`, W / 2, 210)
          ctx.fillText(`${info.team.period_days} 天 · ${THEME_LABEL[info.team.theme]} · 已有 ${info.team.member_count} 人`, W / 2, 234)
          ctx.fillText('每天 9 个小行动，任选 3 个做完就达标', W / 2, 282)
        }

        if (kind === 'report' && report) {
          ctx.fillStyle = '#fff'
          ctx.font = `bold 17px ${SANS}`
          ctx.fillText(report.team.name, W / 2, 80)
          ctx.fillStyle = ORANGE
          ctx.font = `600 64px ${SERIF}`
          ctx.fillText(`${report.team.rate_pct}%`, W / 2, 160)
          ctx.fillStyle = 'rgba(255,255,255,0.7)'
          ctx.font = `13px ${SANS}`
          ctx.fillText('全队完成率', W / 2, 184)
          ctx.fillText(`${report.team.period_days} 天 · 全员到齐 ${report.team.all_done_days} 天 · 最长连续 ${report.team.best_team_streak} 天`, W / 2, 222)
          if (report.me) {
            ctx.fillStyle = '#fff'
            ctx.font = `bold 15px ${SANS}`
            const t = report.me.title ? ` · ${report.me.title.emoji} ${report.me.title.name}` : ''
            ctx.fillText(`我：完成率 ${report.me.rate_pct}%${t}`, W / 2, 270)
          }
        }

        // 小程序码
        const qr = await loadImage(canvas, qrUrl)
        const qx = W / 2 - 50
        const qy = 340
        if (qr) ctx.drawImage(qr, qx, qy, 100, 100)
        else {
          ctx.strokeStyle = '#D6D3CC'
          ctx.setLineDash?.([4, 4])
          roundRect(ctx, qx, qy, 100, 100, 50)
          ctx.stroke()
          ctx.setLineDash?.([])
          ctx.fillStyle = '#BDBAB3'
          ctx.font = `11px ${SANS}`
          ctx.fillText('小程序码', W / 2, qy + 54)
        }
        ctx.fillStyle = '#8C8983'
        ctx.font = `11px ${SANS}`
        ctx.fillText(kind === 'report' ? '长按识别，下一局一起来' : '长按识别，接下战书', W / 2, 462)

        setCanvasNode(canvas)
        setReady(true)
      })
  }

  const save = async () => {
    if (!canvasNode) return
    try {
      const { tempFilePath } = await Taro.canvasToTempFilePath({ canvas: canvasNode } as any)
      await Taro.saveImageToPhotosAlbum({ filePath: tempFilePath })
      Taro.showToast({ title: '已保存到相册，去发朋友圈吧', icon: 'none' })
    } catch {
      Taro.showModal({
        title: '保存失败',
        content: '需要允许“保存到相册”，可以在设置里打开',
        confirmText: '去设置',
        success: (r) => r.confirm && Taro.openSetting(),
      })
    }
  }

  return (
    <View className='page pt'>
      <View className='pt__frame'>
        <Canvas type='2d' id='poster' className='pt__canvas' />
      </View>
      <Button block className='mt-16' disabled={!ready} onClick={save}>
        {ready ? '保存到相册' : '生成中…'}
      </Button>
      <View className='t-label c-muted center mt-8'>海报只有百分比和天数，不会出现体重</View>
    </View>
  )
}

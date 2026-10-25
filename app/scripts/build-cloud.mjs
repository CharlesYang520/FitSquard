// 用 esbuild 把每个云函数的 src/index.ts（连同 core/、data/）打成单文件 index.js。
// wx-server-sdk 保持外部依赖，由云端安装。
import { build } from 'esbuild'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fns = ['api', 'daily']

for (const fn of fns) {
  const entry = path.join(root, 'cloudfunctions', fn, 'src', 'index.ts')
  if (!existsSync(entry)) {
    console.warn(`[build:cloud] 跳过 ${fn}：找不到 ${entry}`)
    continue
  }
  await build({
    entryPoints: [entry],
    outfile: path.join(root, 'cloudfunctions', fn, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node16',
    format: 'cjs',
    external: ['wx-server-sdk'],
    alias: {
      '@core': path.join(root, 'core'),
      '@data': path.join(root, 'data'),
    },
    logLevel: 'info',
  })
}

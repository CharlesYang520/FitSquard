import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

// 只跑纯逻辑：core/ 与云函数 handler（内存假库）
export default defineConfig({
  resolve: {
    alias: {
      '@core': path.join(root, 'core'),
      '@data': path.join(root, 'data'),
    },
  },
  test: {
    include: ['core/**/*.test.ts', 'cloudfunctions/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})

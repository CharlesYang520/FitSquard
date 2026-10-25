// 可复现随机数：同一个 seed 永远得到同一串数（用于清单生成可追溯、可测试）

export type Rng = () => number

/** mulberry32：输出 [0, 1) */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 新种子（“换一套”时用） */
export function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) + 1
}

/** 按权重随机取 1 个，返回下标；全部权重为 0 时返回 -1 */
export function weightedIndex(weights: number[], rng: Rng): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (total <= 0) return -1
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i])
    if (r < 0) return i
  }
  return weights.length - 1
}

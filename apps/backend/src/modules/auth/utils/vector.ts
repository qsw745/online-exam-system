// 人脸特征向量比对工具。InsightFace 的 normed_embedding 已 L2 归一化，
// 余弦相似度即点积；为稳健起见仍按通用公式计算。

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// 在多个样本中取与目标向量的最高相似度
export function maxCosineSimilarity(target: number[], samples: number[][]): number {
  let best = -1
  for (const s of samples) {
    const sim = cosineSimilarity(target, s)
    if (sim > best) best = sim
  }
  return best
}

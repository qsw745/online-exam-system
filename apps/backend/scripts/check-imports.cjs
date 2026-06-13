#!/usr/bin/env node
// 简单检查：1) 使用别名但缺少 .js 后缀；2) 相对导入缺少 .js；3) 指向不存在的文件
import fs from 'fs'
import path from 'path'
import glob from 'glob'

const SRC = path.resolve(process.cwd(), 'src')
const files = glob.sync('src/**/*.{ts,tsx}', { nodir: true })

const bad = []

for (const f of files) {
  const code = fs.readFileSync(f, 'utf8')
  const rx = /from\s+['"]([^'"]+)['"];?|import\(['"]([^'"]+)['"]\)/g
  let m
  while ((m = rx.exec(code))) {
    const spec = m[1] || m[2]
    if (!spec) continue

    const isUrl = /^(node:|https?:|@?[^/]+$)/.test(spec)
    if (isUrl) continue // 内置/包名/URL 忽略

    // 要求：别名或相对路径，统一带 .js 后缀
    const needJs = spec.startsWith('@') || spec.startsWith('./') || spec.startsWith('../')

    if (needJs && !spec.endsWith('.js')) {
      bad.push({ f, spec, reason: '缺少 .js 扩展名（NodeNext/ESM 推荐）' })
      continue
    }

    // 粗略尝试解析到 .ts 源码路径
    if (spec.endsWith('.js')) {
      let p = spec
      if (p.startsWith('@')) {
        // 简单映射 paths：@modules/* -> src/modules/*
        p = p
          .replace(/^@common\//, 'common/')
          .replace(/^@config\//, 'config/')
          .replace(/^@bootstrap\//, 'bootstrap/')
          .replace(/^@infrastructure\//, 'infrastructure/')
          .replace(/^@modules\//, 'modules/')
          .replace(/^@types\//, 'types/')
          .replace(/^@routes$/, 'routes/index.js')
          .replace(/^@routes\//, 'routes/')
        p = path.join(SRC, p)
      } else {
        p = path.resolve(path.dirname(path.join(process.cwd(), f)), spec)
      }
      const tsPath = p.replace(/\.js$/, '.ts')
      const tsxPath = p.replace(/\.js$/, '.tsx')
      const dtsPath = p.replace(/\.js$/, '.d.ts')

      if (!fs.existsSync(tsPath) && !fs.existsSync(tsxPath) && !fs.existsSync(dtsPath)) {
        bad.push({ f, spec, reason: '可能找不到对应源码（检查 paths/文件名）' })
      }
    }
  }
}

if (bad.length) {
  console.log('发现可疑导入：')
  for (const b of bad) {
    console.log(`- ${b.f} -> ${b.spec} : ${b.reason}`)
  }
  process.exitCode = 1
} else {
  console.log('导入检查通过 ✅')
}

#!/usr/bin/env node
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)
const ts = require('../node_modules/typescript')

const webRoot = path.resolve(new URL('..', import.meta.url).pathname)
const srcRoot = path.join(webRoot, 'src')
const args = new Set(process.argv.slice(2))
const failOnIssues = args.has('--fail')
const jsonOutput = args.has('--json')

const HAN_RE = /\p{Script=Han}/u
const TEXT_ATTRS = new Set([
  'title',
  'placeholder',
  'okText',
  'cancelText',
  'emptyText',
  'description',
  'label',
  'aria-label',
  'alt',
  'notFoundContent',
  'help',
  'tooltip',
  'content',
  'extra',
])
const DISPLAY_PROPS = new Set([
  'title',
  'label',
  'description',
  'content',
  'emptyText',
  'placeholder',
  'okText',
  'cancelText',
  'text',
  'children',
  'message',
  'name',
])
const DISPLAY_CALLERS = new Set([
  'message.success',
  'message.error',
  'message.info',
  'message.warning',
  'message.loading',
  'notification.success',
  'notification.error',
  'notification.info',
  'notification.warning',
  'Modal.confirm',
  'Modal.info',
  'Modal.success',
  'Modal.warning',
  'Modal.error',
  'confirm',
  'alert',
])
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'public', 'coverage'])
const IGNORE_PARTS = [
  `${path.sep}app${path.sep}i18n${path.sep}`,
]
const ALLOW_FILE_PATTERNS = [
  `${path.sep}shared${path.sep}utils${path.sep}fileParser.ts`,
  `${path.sep}shared${path.sep}utils${path.sep}q-helpers.ts`,
]

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, files)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      if (!IGNORE_PARTS.some(part => full.includes(part))) files.push(full)
    }
  }
  return files
}

function lineAndColumn(sourceFile, pos) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos)
  return { line: line + 1, column: character + 1 }
}

function getAttrName(nameNode) {
  if (!nameNode) return ''
  if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)) return nameNode.text
  return nameNode.getText()
}

function getCallerName(expr) {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) {
    return `${getCallerName(expr.expression)}.${expr.name.text}`
  }
  return expr.getText()
}

function containsHanText(text) {
  return HAN_RE.test(String(text || ''))
}

function textFromStringNode(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isJsxText(node)
  ) {
    return node.text
  }
  return ''
}

function shouldSkipSourceText(sourceFile, pos) {
  const text = sourceFile.getFullText()
  const lineStart = text.lastIndexOf('\n', pos) + 1
  const before = text.slice(lineStart, pos)
  return before.includes('//')
}

function hasTAncestor(node) {
  let cur = node.parent
  while (cur) {
    if (ts.isCallExpression(cur)) {
      const caller = getCallerName(cur.expression)
      if (caller === 't' || caller.endsWith('.t') || caller === 'translate') return true
    }
    if (
      ts.isJsxExpression(cur) ||
      ts.isJsxElement(cur) ||
      ts.isJsxSelfClosingElement(cur) ||
      ts.isSourceFile(cur)
    ) {
      break
    }
    cur = cur.parent
  }
  return false
}

function propertyNameOfObjectLiteral(node) {
  const parent = node.parent
  if (!parent || !ts.isPropertyAssignment(parent)) return ''
  const name = parent.name
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return name.getText()
}

function classify(sourceFile, node, text) {
  if (!containsHanText(text)) return null
  if (hasTAncestor(node)) return null
  if (ALLOW_FILE_PATTERNS.some(part => sourceFile.fileName.includes(part))) return null
  if (shouldSkipSourceText(sourceFile, node.getStart(sourceFile))) return null

  const parent = node.parent
  if (ts.isJsxText(node)) {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (!normalized) return null
    return { kind: 'jsx-text', text: normalized }
  }

  if (parent && ts.isJsxAttribute(parent)) {
    const attr = getAttrName(parent.name)
    if (TEXT_ATTRS.has(attr)) return { kind: `jsx-attr:${attr}`, text }
  }

  if (parent && ts.isPropertyAssignment(parent)) {
    const prop = propertyNameOfObjectLiteral(node)
    if (DISPLAY_PROPS.has(prop)) return { kind: `object-prop:${prop}`, text }
  }

  let call = parent
  while (call && !ts.isCallExpression(call) && !ts.isSourceFile(call)) call = call.parent
  if (call && ts.isCallExpression(call)) {
    const caller = getCallerName(call.expression)
    if (DISPLAY_CALLERS.has(caller)) return { kind: `call:${caller}`, text }
    if (/\.catch$|\.then$/.test(caller)) return null
  }

  if (parent && ts.isNewExpression(parent)) {
    const caller = getCallerName(parent.expression)
    if (caller === 'Error') return { kind: 'new-error', text }
  }

  return null
}

function scanFile(file) {
  const source = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const findings = []

  function visit(node) {
    const text = textFromStringNode(node)
    if (text) {
      const hit = classify(sourceFile, node, text)
      if (hit) {
        const loc = lineAndColumn(sourceFile, node.getStart(sourceFile))
        findings.push({
          file: path.relative(webRoot, file),
          line: loc.line,
          column: loc.column,
          kind: hit.kind,
          text: hit.text.replace(/\s+/g, ' ').trim(),
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

const findings = walk(srcRoot).flatMap(scanFile)
const byFile = new Map()
for (const item of findings) {
  byFile.set(item.file, (byFile.get(item.file) || 0) + 1)
}
const topFiles = [...byFile.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 30)
  .map(([file, count]) => ({ file, count }))

if (jsonOutput) {
  console.log(JSON.stringify({ total: findings.length, files: byFile.size, topFiles, findings }, null, 2))
} else {
  console.log(`i18n literal audit: ${findings.length} issue(s) in ${byFile.size} file(s)`)
  console.log('')
  console.log('Top files:')
  for (const item of topFiles) {
    console.log(`  ${String(item.count).padStart(4)}  ${item.file}`)
  }
  console.log('')
  console.log('Sample findings:')
  for (const item of findings.slice(0, 120)) {
    console.log(`${item.file}:${item.line}:${item.column}  ${item.kind}  ${JSON.stringify(item.text)}`)
  }
}

if (failOnIssues && findings.length > 0) {
  process.exitCode = 1
}

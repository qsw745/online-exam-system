import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createPool } from 'mysql2/promise'

type RawItem = { role?: string; content?: string }
type Message = { role: 'user' | 'assistant' | 'system'; content: string }
type SessionRow = {
  user_id: number
  client_id: string
  title: string | null
  items_json: string | null
  created_at: string
  updated_at: string
}

const args = process.argv.slice(2)
const getArg = (name: string): string | undefined => {
  const named = `--${name}`
  const idx = args.findIndex(arg => arg === named)
  if (idx >= 0 && args[idx + 1]) return args[idx + 1]
  const withEq = args.find(arg => arg.startsWith(`${named}=`))
  if (withEq) return withEq.slice(named.length + 1)
  return undefined
}

const envPath = path.resolve(__dirname, '..', '.env')
dotenv.config({ path: envPath })

const rootDir = path.resolve(__dirname, '..', '..', '..')
const outPath = path.resolve(getArg('out') || path.join(rootDir, 'train.jsonl'))

const toMessages = (itemsJson: string | null): Message[] => {
  if (!itemsJson) return []
  let raw: RawItem[] = []
  try {
    const parsed = JSON.parse(itemsJson)
    raw = Array.isArray(parsed) ? (parsed as RawItem[]) : []
  } catch {
    raw = []
  }
  return raw
    .map(item => {
      const role = item?.role === 'assistant' || item?.role === 'system' ? item.role : 'user'
      const content = String(item?.content || '').trim()
      return { role, content } as Message
    })
    .filter(item => item.content.length > 0)
}

const shouldKeep = (messages: Message[]) =>
  messages.some(m => m.role === 'user') && messages.some(m => m.role === 'assistant')

async function main() {
  const dbHost = process.env.DB_HOST || '127.0.0.1'
  const dbPort = Number(process.env.DB_PORT || 3306)
  const dbUser = process.env.DB_USER || 'root'
  const dbPassword = process.env.DB_PASSWORD || ''
  const dbName = process.env.DB_NAME || ''
  if (!dbName) {
    throw new Error('DB_NAME is not set in apps/backend/.env')
  }

  const pool = createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    connectionLimit: 5,
  })

  try {
    const [rows] = await pool.query<SessionRow[]>(
      `SELECT user_id, client_id, title, items_json, created_at, updated_at
         FROM ai_chat_sessions
        ORDER BY user_id ASC, updated_at ASC`
    )

    const lines: string[] = []
    for (const row of rows || []) {
      const messages = toMessages(row.items_json)
      if (!shouldKeep(messages)) continue
      lines.push(JSON.stringify({ messages }))
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8')
    console.log(`Wrote ${lines.length} samples to ${outPath}`)
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

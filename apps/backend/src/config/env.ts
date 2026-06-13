import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

const backendRoot = path.resolve(__dirname, '../..')

function loadEnvFile(filename: string, override = false) {
  const envPath = path.join(backendRoot, filename)
  if (!fs.existsSync(envPath)) return
  dotenv.config({ path: envPath, override })
}

loadEnvFile('.env')

const nodeEnv = process.env.NODE_ENV || 'development'

loadEnvFile('.env.local', true)
loadEnvFile(`.env.${nodeEnv}.local`, true)

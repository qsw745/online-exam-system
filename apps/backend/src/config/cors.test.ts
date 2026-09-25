import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAllowedCorsOrigins, resolveCorsOrigin } from './cors'

test('allows Capacitor and localhost origins alongside the configured frontend', () => {
  const origins = buildAllowedCorsOrigins('http://localhost:4177')

  assert.deepEqual(origins, [
    'http://localhost:4177',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'https://localhost',
  ])
})

test('echoes an allowed origin and rejects an unknown origin', () => {
  const origins = buildAllowedCorsOrigins('https://app.example.com')

  assert.equal(resolveCorsOrigin('capacitor://localhost', origins), 'capacitor://localhost')
  assert.equal(resolveCorsOrigin('https://app.example.com', origins), 'https://app.example.com')
  assert.equal(resolveCorsOrigin('https://malicious.example', origins), false)
  assert.equal(resolveCorsOrigin(undefined, origins), true)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveServiceDataRegion } from './data-region'

test('accepts explicit regional service configuration', () => {
  assert.equal(resolveServiceDataRegion('cn', 'production'), 'CN')
  assert.equal(resolveServiceDataRegion('GLOBAL', 'production'), 'GLOBAL')
})

test('allows an unscoped local development service only', () => {
  assert.equal(resolveServiceDataRegion(undefined, 'development'), null)
  assert.throws(
    () => resolveServiceDataRegion(undefined, 'production'),
    /SERVICE_DATA_REGION must be CN or GLOBAL/,
  )
})

test('rejects unknown configured regions', () => {
  assert.throws(
    () => resolveServiceDataRegion('AUTO', 'development'),
    /SERVICE_DATA_REGION must be CN or GLOBAL/,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluatePersonalRegistration,
  evaluateRegionAccess,
  normalizeDataRegion,
} from './account-region.policy'

const NOW = new Date('2026-08-30T00:00:00.000Z')

test('normalizes only supported data regions', () => {
  assert.equal(normalizeDataRegion('cn'), 'CN')
  assert.equal(normalizeDataRegion('GLOBAL'), 'GLOBAL')
  assert.equal(normalizeDataRegion('overseas'), null)
})

test('blocks mainland self-registration for a child under 14', () => {
  assert.deepEqual(
    evaluatePersonalRegistration(
      { dataRegion: 'CN', countryCode: 'CN', dateOfBirth: '2013-09-01' },
      NOW,
    ),
    {
      allowed: false,
      code: 'GUARDIAN_CONSENT_REQUIRED',
      age: 12,
      ageBand: 'CHILD',
    },
  )
})

test('allows a mainland user who has reached 14', () => {
  assert.deepEqual(
    evaluatePersonalRegistration(
      { dataRegion: 'CN', countryCode: 'CN', dateOfBirth: '2012-08-30' },
      NOW,
    ),
    {
      allowed: true,
      code: 'OK',
      age: 14,
      ageBand: 'TEEN',
    },
  )
})

test('rejects country and selected data-region mismatch', () => {
  assert.equal(
    evaluatePersonalRegistration(
      { dataRegion: 'GLOBAL', countryCode: 'CN', dateOfBirth: '2000-01-01' },
      NOW,
    ).code,
    'REGION_COUNTRY_MISMATCH',
  )
  assert.equal(
    evaluatePersonalRegistration(
      { dataRegion: 'CN', countryCode: 'US', dateOfBirth: '2000-01-01' },
      NOW,
    ).code,
    'REGION_COUNTRY_MISMATCH',
  )
})

test('rejects a token or client routed to the wrong regional service', () => {
  assert.equal(evaluateRegionAccess('CN', 'GLOBAL', 'GLOBAL').code, 'ACCOUNT_REGION_MISMATCH')
  assert.equal(evaluateRegionAccess('GLOBAL', 'GLOBAL', 'CN').code, 'SERVICE_REGION_MISMATCH')
  assert.equal(evaluateRegionAccess('GLOBAL', 'GLOBAL', 'GLOBAL').allowed, true)
})

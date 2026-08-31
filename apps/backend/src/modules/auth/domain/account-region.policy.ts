export type DataRegion = 'CN' | 'GLOBAL'
export type AgeBand = 'CHILD' | 'TEEN' | 'ADULT'

export type RegistrationPolicyCode =
  | 'OK'
  | 'REGION_INVALID'
  | 'COUNTRY_INVALID'
  | 'REGION_COUNTRY_MISMATCH'
  | 'DOB_INVALID'
  | 'GUARDIAN_CONSENT_REQUIRED'

export function normalizeDataRegion(value: unknown): DataRegion | null {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized === 'CN' || normalized === 'GLOBAL' ? normalized : null
}

export function normalizeCountryCode(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

function parseDateOnly(value: unknown): { year: number; month: number; day: number } | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

export function calculateAge(dateOfBirth: unknown, now = new Date()): number | null {
  const dob = parseDateOnly(dateOfBirth)
  if (!dob || Number.isNaN(now.getTime())) return null
  const current = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  }
  let age = current.year - dob.year
  if (current.month < dob.month || (current.month === dob.month && current.day < dob.day)) age -= 1
  return age >= 0 && age <= 130 ? age : null
}

export function ageBandFor(age: number): AgeBand {
  if (age < 14) return 'CHILD'
  if (age < 18) return 'TEEN'
  return 'ADULT'
}

export function evaluatePersonalRegistration(
  input: { dataRegion: unknown; countryCode: unknown; dateOfBirth: unknown },
  now = new Date(),
): { allowed: boolean; code: RegistrationPolicyCode; age: number | null; ageBand: AgeBand | null } {
  const dataRegion = normalizeDataRegion(input.dataRegion)
  if (!dataRegion) return { allowed: false, code: 'REGION_INVALID', age: null, ageBand: null }

  const countryCode = normalizeCountryCode(input.countryCode)
  if (!countryCode) return { allowed: false, code: 'COUNTRY_INVALID', age: null, ageBand: null }

  if ((dataRegion === 'CN') !== (countryCode === 'CN')) {
    return { allowed: false, code: 'REGION_COUNTRY_MISMATCH', age: null, ageBand: null }
  }

  const age = calculateAge(input.dateOfBirth, now)
  if (age === null) return { allowed: false, code: 'DOB_INVALID', age: null, ageBand: null }
  const ageBand = ageBandFor(age)

  if (dataRegion === 'CN' && age < 14) {
    return { allowed: false, code: 'GUARDIAN_CONSENT_REQUIRED', age, ageBand }
  }
  return { allowed: true, code: 'OK', age, ageBand }
}

export type RegionAccessCode =
  | 'OK'
  | 'REGION_INVALID'
  | 'ACCOUNT_REGION_MISMATCH'
  | 'SERVICE_REGION_MISMATCH'

export function evaluateRegionAccess(
  accountRegionValue: unknown,
  requestedRegionValue?: unknown,
  serviceRegionValue?: unknown,
): { allowed: boolean; code: RegionAccessCode; region: DataRegion | null } {
  const accountRegion = normalizeDataRegion(accountRegionValue)
  if (!accountRegion) return { allowed: false, code: 'REGION_INVALID', region: null }

  if (requestedRegionValue != null && String(requestedRegionValue).trim()) {
    const requested = normalizeDataRegion(requestedRegionValue)
    if (!requested) return { allowed: false, code: 'REGION_INVALID', region: accountRegion }
    if (requested !== accountRegion) {
      return { allowed: false, code: 'ACCOUNT_REGION_MISMATCH', region: accountRegion }
    }
  }

  if (serviceRegionValue != null && String(serviceRegionValue).trim()) {
    const service = normalizeDataRegion(serviceRegionValue)
    if (!service) return { allowed: false, code: 'REGION_INVALID', region: accountRegion }
    if (service !== accountRegion) {
      return { allowed: false, code: 'SERVICE_REGION_MISMATCH', region: accountRegion }
    }
  }

  return { allowed: true, code: 'OK', region: accountRegion }
}

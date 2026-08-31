import { describe, expect, it } from 'vitest'

import {
  PREFERRED_DATA_REGION_KEY,
  readPreferredDataRegion,
  resolveRegionalApiBaseUrl,
  writePreferredDataRegion,
} from './accountRegion'

describe('accountRegion', () => {
  it('未知或缺失值安全回退到中国大陆区', () => {
    const storage = { getItem: () => 'UNKNOWN' }
    expect(readPreferredDataRegion(storage)).toBe('CN')
  })

  it('只写入受支持的地区值', () => {
    const calls: Array<[string, string]> = []
    const storage = { setItem: (key: string, value: string) => calls.push([key, value]) }

    writePreferredDataRegion('GLOBAL', storage)

    expect(calls).toEqual([[PREFERRED_DATA_REGION_KEY, 'GLOBAL']])
  })

  it('按地区选择独立 API，缺失时回退通用 API', () => {
    expect(
      resolveRegionalApiBaseUrl('CN', {
        defaultUrl: 'https://api.example.com',
        cnUrl: 'https://cn-api.example.com/',
        globalUrl: 'https://global-api.example.com/',
      }),
    ).toBe('https://cn-api.example.com')
    expect(
      resolveRegionalApiBaseUrl('GLOBAL', {
        defaultUrl: 'https://api.example.com/',
        cnUrl: '',
        globalUrl: '',
      }),
    ).toBe('https://api.example.com')
  })
})

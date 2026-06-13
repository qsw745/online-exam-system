export const BOM = '\ufeff'
export const normalizeKey = (k: unknown) =>
  String(k ?? '')
    .replace(BOM, '')
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, '')
    .toLowerCase()

export const pickField = (row: Record<string, any>, aliases: string[]) => {
  const map = new Map(Object.keys(row).map(k => [normalizeKey(k), k]))
  for (const a of aliases) {
    const real = map.get(normalizeKey(a))
    if (real != null) return row[real]
  }
  for (const a of aliases) if (a in row) return (row as any)[a]
  return undefined
}

export function ensureArrayFromMaybeCsv(input: any): string[] {
  if (Array.isArray(input)) return input.map(String).filter(Boolean)
  if (typeof input === 'string') {
    const normalized = input
      .trim()
      .replace(/[\r\n]+/g, ',')
      .replace(/[，；;]/g, ',')
    return normalized
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  if (input != null && (typeof input === 'number' || typeof input === 'boolean')) return [String(input)]
  return []
}

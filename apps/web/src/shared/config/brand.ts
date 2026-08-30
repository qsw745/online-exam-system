export const brand = Object.freeze({
  name: '问衡',
  shortName: '问衡',
  subtitle: 'AI 智能测评与学习平台',
  slogan: '以问见知，以衡见长',
  themeColor: '#10233F',
})

export function formatDocumentTitle(pageTitle?: string): string {
  const page = pageTitle?.trim()
  return page ? `${page}｜${brand.name}` : brand.name
}

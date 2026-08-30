import { brand } from '@/shared/config/brand'
import { withAppAssetPath } from '@/shared/router/basePath'

type BrandMarkProps = {
  compact?: boolean
  size?: number
  inverse?: boolean
}

export default function BrandMark({ compact = false, size = 40, inverse = false }: BrandMarkProps) {
  const color = inverse ? '#FFFFFF' : '#10233F'

  return (
    <span className="wenheng-brand" style={{ color }}>
      <img src={withAppAssetPath('/brand-logo.svg')} width={size} height={size} alt={brand.name} />
      <span className="wenheng-brand__copy">
        <strong>{brand.name}</strong>
        {compact ? null : <small>{brand.subtitle}</small>}
      </span>
    </span>
  )
}

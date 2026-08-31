import BrandMark from '@/shared/components/BrandMark'
import type { AppLifecycleState } from '@/platform/runtime/runtime.types'

type BackgroundPrivacyCoverProps = {
  lifecycle: AppLifecycleState
}

export default function BackgroundPrivacyCover({ lifecycle }: BackgroundPrivacyCoverProps) {
  if (lifecycle === 'active') return null

  return (
    <aside
      className="background-privacy-cover"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(155deg, #f7f9fc 0%, #e8f2ef 100%)',
      }}
    >
      <div style={{ display: 'grid', justifyItems: 'center', gap: 20, textAlign: 'center' }}>
        <BrandMark size={72} />
        <p style={{ margin: 0, color: '#526579', fontSize: 16 }}>内容已保护</p>
      </div>
    </aside>
  )
}

import React, { useMemo } from 'react'

type Props = { password: string }

function calcScore(pwd: string) {
  let score = 0
  if (!pwd) return 0
  if (pwd.length >= 6) score += 25
  if (/[a-z]/.test(pwd)) score += 15
  if (/[A-Z]/.test(pwd)) score += 20
  if (/\d/.test(pwd)) score += 20
  if (/[^A-Za-z0-9]/.test(pwd)) score += 20
  return Math.min(score, 100)
}

export const PasswordStrengthBar: React.FC<Props> = ({ password }) => {
  const score = useMemo(() => calcScore(password), [password])

  const color =
    score >= 80 ? '#52c41a' : score >= 60 ? '#1890ff' : score >= 40 ? '#faad14' : score > 0 ? '#ff4d4f' : '#d9d9d9'
  const label = score >= 80 ? '强' : score >= 60 ? '较强' : score >= 40 ? '中等' : score > 0 ? '较弱' : '—'

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          height: 6,
          backgroundColor: '#f0f0f0',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.25s ease',
          }}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#8c8c8c' }}>密码强度：{label}</div>
    </div>
  )
}

import { Button, Card, Space, Typography } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import BrandMark from '@/shared/components/BrandMark'
import { brand } from '@/shared/config/brand'
import legalContent from '../legalContent.json'

const { Title, Paragraph, Text } = Typography

export default function LegalDocumentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const privacy = location.pathname.endsWith('/privacy')
  const sections = privacy ? legalContent.privacy : legalContent.terms
  const title = privacy ? '问衡隐私政策' : '问衡用户协议'

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 'max(24px, env(safe-area-inset-top)) 16px max(32px, env(safe-area-inset-bottom))',
        background: '#f5f7fb',
      }}
    >
      <Card style={{ maxWidth: 760, margin: '0 auto', borderRadius: 20 }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Space>
            <BrandMark size={40} />
            <div>
              <Title level={2} style={{ margin: 0 }}>{title}</Title>
              <Text type="secondary">{brand.name} · 生效日期：{legalContent.effectiveDate}</Text>
            </div>
          </Space>

          <Paragraph>
            本文件说明问衡服务的使用规则及个人信息处理方式。请在注册及使用相关功能前阅读；如有疑问，可通过客服邮箱联系我们。
          </Paragraph>

          {sections.map(([heading, body]) => (
            <section key={heading}>
              <Title level={4}>{heading}</Title>
              <Paragraph style={{ lineHeight: 1.8 }}>{body}</Paragraph>
            </section>
          ))}

          <Button block size="large" onClick={() => navigate(-1)}>返回</Button>
        </Space>
      </Card>
    </main>
  )
}

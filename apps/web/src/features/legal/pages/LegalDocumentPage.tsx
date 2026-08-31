import { Button, Card, Space, Typography } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import BrandMark from '@/shared/components/BrandMark'
import { brand } from '@/shared/config/brand'

const { Title, Paragraph, Text } = Typography

const termsSections = [
  ['服务说明', '问衡提供学习、练习、考试与成绩管理等功能。考试组织者可以依据考试规则开启摄像头、麦克风或人脸核验；启用前会另行说明用途并请求系统权限。'],
  ['账号责任', '请使用本人可长期接收通知的邮箱注册，并妥善保管登录凭据。不得冒用他人身份、干扰考试秩序、攻击服务或传播违法内容。'],
  ['考试与结果', '考试规则、评分方式、申诉渠道和证书效力由考试组织者负责说明。自动评分或风险提示不替代依法应由人工完成的最终决定。'],
  ['费用与订阅', '基础功能当前可免费使用。未来如推出会员或付费服务，会在购买前展示价格、周期、自动续费规则和取消方式；未经确认不会自动收费。'],
  ['账号注销', '你可以在应用内发起账号注销。系统会先展示待删除范围、法定或争议处理所需的保留范围及预计完成时间；提交申请不等于数据已经立即物理清除。'],
]

const privacySections = [
  ['我们处理的信息', '为创建账号和提供服务，我们处理邮箱、账号地区、常住国家或地区代码、出生日期对应的年龄段、学习与考试记录、设备与安全日志。出生日期仅用于适用年龄规则，不作为公开资料展示。'],
  ['摄像头、麦克风与人脸', '这些权限默认不启用。仅当考试明确要求且你在权限提示中同意后，才会为身份核验、监考或答题采集使用。具体保存内容、期限和审核方式应在进入考试前再次告知。'],
  ['区域与跨境', '中国大陆账号与海外账号使用不同的数据区域。账号创建后不会因网络位置变化而自动跨区；如确需迁移，将另行取得必要授权并提供可验证的迁移流程。'],
  ['保存与删除', '账号有效期间按提供服务与安全审计的必要期限保存信息。注销申请生效后会删除或匿名化可删除数据；法律义务、交易凭证、安全与争议处理所需记录可能在限定期限内保留。'],
  ['你的权利', '你可以在“我的”中访问和更正资料、管理授权、导出依法可提供的数据，并发起账号注销。未成年人由监护人依法行使相关权利。'],
]

export default function LegalDocumentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const privacy = location.pathname.endsWith('/privacy')
  const sections = privacy ? privacySections : termsSections
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
              <Text type="secondary">{brand.name} · 生效日期：2026 年 8 月 30 日</Text>
            </div>
          </Space>

          <Paragraph>
            本页面是当前产品内可访问的协议版本。正式发布前还需根据实际运营主体、服务器供应商、第三方服务和联系渠道完成法律审核并更新。
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

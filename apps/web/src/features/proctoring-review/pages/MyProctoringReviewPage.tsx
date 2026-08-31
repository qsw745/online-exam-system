import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { proctoringReviewApi } from '@/shared/api/endpoints/proctoringReview'
import { formatDateTime } from '@/shared/utils/datetime'
import { translate } from '@/shared/utils/i18n'
import MyProctoringReviewCard from '../components/MyProctoringReviewCard'
import { publicReasonKey } from '../domain/reviewPresentation'
import { useMyProctoringReviewCase } from '../hooks/useMyProctoringReview'

const { Title, Text, Paragraph } = Typography

type PendingRequest = { id: string; fingerprint: string }

const requestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, value => {
    const random = Math.floor(Math.random() * 16)
    const hex = value === 'x' ? random : (random & 0x3) | 0x8
    return hex.toString(16)
  })
}

const errorCode = (error: any) => error?.code || error?.response?.data?.code

const APPEAL_REASONS = [
  'DEVICE_INTERRUPTION',
  'ENVIRONMENTAL_CAUSE',
  'IDENTITY_ERROR',
  'EVENT_MISINTERPRETED',
  'OTHER',
] as const

export default function MyProctoringReviewPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const review = useMyProctoringReviewCase(caseId)
  const [responseOpen, setResponseOpen] = useState(false)
  const [appealOpen, setAppealOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [responseForm] = Form.useForm<{ body: string }>()
  const [appealForm] = Form.useForm<{ reasonCode: string; statement: string }>()
  const responseRequest = useRef<PendingRequest | null>(null)
  const appealRequest = useRef<PendingRequest | null>(null)
  const [messageApi, contextHolder] = message.useMessage()

  const latestQuestion = useMemo(() => [...(review.detail?.messages || [])]
    .reverse()
    .find(item => item.messageType === 'information_request'), [review.detail?.messages])

  const timelineItems = useMemo(() => {
    if (!review.detail) return []
    const entries = [
      ...review.detail.decisions.map(item => ({
        at: item.createdAt,
        title: translate(`proctoringReview.action.${item.action}`),
        body: translate(publicReasonKey(item.reasonCode)),
      })),
      ...review.detail.messages.map(item => ({
        at: item.createdAt,
        title: item.messageType === 'information_request'
          ? translate('proctoringReview.candidate.informationRequest')
          : translate('proctoringReview.candidate.responseSubmitted'),
        body: item.body,
      })),
      ...(review.detail.appeal ? [{
        at: review.detail.appeal.submittedAt,
        title: translate('proctoringReview.candidate.appealSubmitted'),
        body: review.detail.appeal.statement,
      }] : []),
    ]
    return entries
      .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())
      .map(item => ({
        children: (
          <div>
            <Text strong>{item.title}</Text>
            <Paragraph style={{ margin: '4px 0' }}>{item.body}</Paragraph>
            <Text type="secondary">{formatDateTime(item.at)}</Text>
          </div>
        ),
      }))
  }, [review.detail])

  const handleConflict = async () => {
    responseRequest.current = null
    appealRequest.current = null
    await review.reload()
    messageApi.warning(translate('proctoringReview.candidate.versionConflict'))
  }

  const submitResponse = async ({ body }: { body: string }) => {
    if (!review.detail || !latestQuestion) return
    const normalizedBody = body.trim()
    const fingerprint = JSON.stringify({
      caseId: review.detail.caseId,
      replyToMessageId: latestQuestion.messageId,
      body: normalizedBody,
      expectedVersion: review.detail.version,
    })
    if (!responseRequest.current || responseRequest.current.fingerprint !== fingerprint) {
      responseRequest.current = { id: requestId(), fingerprint }
    }
    setSubmitting(true)
    try {
      const result = await proctoringReviewApi.respond(review.detail.caseId, {
        messageId: responseRequest.current.id,
        replyToMessageId: latestQuestion.messageId,
        body: normalizedBody,
        expectedVersion: review.detail.version,
      })
      review.setDetail(result.case)
      responseRequest.current = null
      responseForm.resetFields()
      setResponseOpen(false)
      messageApi.success(translate('proctoringReview.candidate.responseSuccess'))
    } catch (error: any) {
      if (errorCode(error) === 'PROCTORING_REVIEW_VERSION_CONFLICT' || error?.status === 409) {
        await handleConflict()
      } else {
        messageApi.error(error?.message || translate('proctoringReview.error.generic'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitAppeal = async ({ reasonCode, statement }: { reasonCode: string; statement: string }) => {
    if (!review.detail) return
    const normalizedStatement = statement.trim()
    const fingerprint = JSON.stringify({
      caseId: review.detail.caseId,
      reasonCode,
      statement: normalizedStatement,
      expectedVersion: review.detail.version,
    })
    if (!appealRequest.current || appealRequest.current.fingerprint !== fingerprint) {
      appealRequest.current = { id: requestId(), fingerprint }
    }
    setSubmitting(true)
    try {
      const result = await proctoringReviewApi.appeal(review.detail.caseId, {
        appealId: appealRequest.current.id,
        reasonCode,
        statement: normalizedStatement,
        expectedVersion: review.detail.version,
      })
      review.setDetail(result.case)
      appealRequest.current = null
      appealForm.resetFields()
      setAppealOpen(false)
      messageApi.success(translate('proctoringReview.candidate.appealSuccess'))
    } catch (error: any) {
      if (errorCode(error) === 'PROCTORING_REVIEW_VERSION_CONFLICT' || error?.status === 409) {
        await handleConflict()
      } else {
        messageApi.error(error?.message || translate('proctoringReview.error.generic'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (review.loading && !review.detail) {
    return <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
  }

  if (!review.detail) {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        {contextHolder}
        {review.error && <Alert type="error" showIcon message={review.error} action={<Button onClick={() => void review.reload()}>{translate('app.retry')}</Button>} />}
        <Empty description={translate('proctoringReview.candidate.notFound')}>
          <Button onClick={() => navigate(-1)}>{translate('papers.back_to_list')}</Button>
        </Empty>
      </Space>
    )
  }

  return (
    <Space
      direction="vertical"
      size={18}
      style={{ width: '100%', maxWidth: 920, margin: '0 auto', paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }}
    >
      {contextHolder}
      <div>
        <Text type="secondary">{review.detail.examTitle}</Text>
        <Title level={2} style={{ margin: '4px 0 0' }}>{translate('proctoringReview.candidate.pageTitle')}</Title>
      </div>
      {review.error && <Alert type="warning" showIcon message={review.error} />}
      <MyProctoringReviewCard
        detail={review.detail}
        onRespond={() => setResponseOpen(true)}
        onAppeal={() => setAppealOpen(true)}
        onOpenDetail={() => document.getElementById('candidate-review-timeline')?.scrollIntoView({ behavior: 'smooth' })}
      />

      <Card id="candidate-review-timeline" title={translate('proctoringReview.candidate.timelineTitle')}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap>
            <Tag>{translate(publicReasonKey(review.detail.triggerReasonCode))}</Tag>
            <Text type="secondary">
              {translate('proctoringReview.field.openedAt')}：{formatDateTime(review.detail.openedAt)}
            </Text>
          </Space>
          {timelineItems.length > 0
            ? <Timeline items={timelineItems} />
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={translate('proctoringReview.empty.timeline')} />}
        </Space>
      </Card>

      <Modal
        title={translate('proctoringReview.candidate.respond')}
        open={responseOpen}
        confirmLoading={submitting}
        onCancel={() => setResponseOpen(false)}
        onOk={() => responseForm.submit()}
        okText={translate('proctoringReview.candidate.submitResponse')}
        cancelText={translate('app.cancel')}
        destroyOnHidden
      >
        {latestQuestion && (
          <Alert
            type="info"
            showIcon
            message={translate('proctoringReview.candidate.latestQuestion')}
            description={latestQuestion.body}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={responseForm} layout="vertical" onFinish={values => void submitResponse(values)}>
          <Form.Item
            name="body"
            label={translate('proctoringReview.candidate.responseLabel')}
            rules={[{ required: true, whitespace: true, message: translate('proctoringReview.candidate.responseRequired') }]}
          >
            <Input.TextArea rows={6} maxLength={2000} showCount autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={translate('proctoringReview.candidate.appeal')}
        open={appealOpen}
        confirmLoading={submitting}
        onCancel={() => setAppealOpen(false)}
        onOk={() => appealForm.submit()}
        okText={translate('proctoringReview.candidate.submitAppeal')}
        cancelText={translate('app.cancel')}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          message={translate('proctoringReview.candidate.appealOnce')}
          style={{ marginBottom: 16 }}
        />
        <Form form={appealForm} layout="vertical" onFinish={values => void submitAppeal(values)}>
          <Form.Item
            name="reasonCode"
            label={translate('proctoringReview.field.reason')}
            rules={[{ required: true, message: translate('proctoringReview.candidate.appealReasonRequired') }]}
          >
            <Select options={APPEAL_REASONS.map(value => ({ value, label: translate(`proctoringReview.reason.${value}`) }))} />
          </Form.Item>
          <Form.Item
            name="statement"
            label={translate('proctoringReview.candidate.appealStatement')}
            rules={[{ required: true, whitespace: true, message: translate('proctoringReview.candidate.appealStatementRequired') }]}
          >
            <Input.TextArea rows={7} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

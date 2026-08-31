import { Button, Tag } from 'antd'
import type { CandidateReviewCaseDetail } from '@/shared/api/endpoints/proctoringReview'
import { formatDateTime } from '@/shared/utils/datetime'
import { translate } from '@/shared/utils/i18n'
import { isKnownReviewStatus, statusPresentation } from '../domain/reviewPresentation'
import './MyProctoringReviewCard.css'

type Props = {
  detail: CandidateReviewCaseDetail | null
  now?: Date
  onRespond: () => void | Promise<void>
  onAppeal: () => void | Promise<void>
  onOpenDetail: (caseId: string) => void
}

function reviewLabel(detail: CandidateReviewCaseDetail) {
  if (detail.outcome === 'cleared') return translate('proctoringReview.outcome.cleared')
  if (detail.status === 'appeal_pending') return translate('proctoringReview.status.appeal_pending')
  if (detail.status === 'appeal_resolved') return translate('proctoringReview.status.appeal_resolved')
  if (detail.outcome === 'violation_confirmed') return translate('proctoringReview.outcome.violation_confirmed')
  return translate(statusPresentation(detail.status).labelKey)
}

export default function MyProctoringReviewCard({
  detail,
  now = new Date(),
  onRespond,
  onAppeal,
  onOpenDetail,
}: Props) {
  if (!detail) return null

  const statusView = statusPresentation(detail.status)
  const latestQuestion = [...detail.messages]
    .reverse()
    .find(message => message.messageType === 'information_request')
  const appealPending = detail.status === 'appeal_pending' || detail.appeal?.status === 'pending'
  const appealDeadline = detail.appealDeadlineAt ? new Date(detail.appealDeadlineAt) : null
  const appealExpired = Boolean(appealDeadline && appealDeadline.getTime() < now.getTime())
  const violationCanAppeal = detail.status === 'decided' &&
    detail.outcome === 'violation_confirmed' &&
    !detail.appeal &&
    Boolean(appealDeadline)

  return (
    <section className="my-review-card" aria-label={translate('proctoringReview.candidate.cardTitle')}>
      <div className="my-review-card__body">
        <div className="my-review-card__header">
          <div>
            <div className="my-review-card__eyebrow">{translate('proctoringReview.candidate.eyebrow')}</div>
            <h3 className="my-review-card__title">{translate('proctoringReview.candidate.cardTitle')}</h3>
          </div>
          <Tag color={statusView.tone}>
            {isKnownReviewStatus(detail.status)
              ? translate(statusView.labelKey)
              : translate('proctoringReview.status.unknown')}
          </Tag>
        </div>

        <div className="my-review-tracks" aria-label={translate('proctoringReview.candidate.tracks')}>
          <div className="my-review-track">
            <span className="my-review-track__dot" aria-hidden="true" />
            <div>
              <span className="my-review-track__label">{translate('proctoringReview.candidate.gradeTrack')}</span>
              <span className="my-review-track__value">{translate('proctoringReview.candidate.gradeReady')}</span>
            </div>
          </div>
          <div className="my-review-track my-review-track--review">
            <span className="my-review-track__dot" aria-hidden="true" />
            <div>
              <span className="my-review-track__label">{translate('proctoringReview.candidate.reviewTrack')}</span>
              <span className="my-review-track__value">{reviewLabel(detail)}</span>
            </div>
          </div>
        </div>

        <div className="my-review-card__notice">
          <strong>{translate('proctoringReview.candidate.gradeIndependent')}</strong>
          <br />
          {translate('proctoringReview.gradeIsolation')}
        </div>

        {detail.status === 'information_requested' && latestQuestion && (
          <div className="my-review-card__question">
            <span className="my-review-card__question-label">{translate('proctoringReview.candidate.latestQuestion')}</span>
            {latestQuestion.body}
          </div>
        )}

        {violationCanAppeal && appealDeadline && (
          <div className="my-review-card__deadline">
            {translate('proctoringReview.candidate.appealDeadline')}{formatDateTime(appealDeadline)}
          </div>
        )}

        <div className="my-review-card__actions">
          {detail.status === 'information_requested' && latestQuestion && (
            <Button type="primary" onClick={() => void onRespond()}>
              {translate('proctoringReview.candidate.respond')}
            </Button>
          )}
          {appealPending && (
            <Button disabled>{translate('proctoringReview.candidate.appealPending')}</Button>
          )}
          {violationCanAppeal && (
            <Button
              type={appealExpired ? 'default' : 'primary'}
              disabled={appealExpired}
              onClick={() => void onAppeal()}
            >
              {appealExpired
                ? translate('proctoringReview.candidate.appealExpired')
                : translate('proctoringReview.candidate.appeal')}
            </Button>
          )}
          <Button onClick={() => onOpenDetail(detail.caseId)}>
            {translate('proctoringReview.candidate.viewDetail')}
          </Button>
        </div>
      </div>
    </section>
  )
}

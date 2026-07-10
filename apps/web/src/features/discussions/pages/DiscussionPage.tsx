import { Card, Typography } from 'antd'
import { MessageSquare } from 'lucide-react'
import { CreateDiscussionModal } from '../components/CreateDiscussionModal'
import { DiscussionDetail } from '../components/DiscussionDetail'
import { DiscussionFilters } from '../components/DiscussionFilters'
import { DiscussionList } from '../components/DiscussionList'
import { ReplyList } from '../components/ReplyList'
import { ReplyModal } from '../components/ReplyModal'
import { useDiscussions } from '../hooks/useDiscussions'
import { translate } from '@/shared/utils/i18n'
import '../discussion.css'

const { Title, Paragraph } = Typography

export default function DiscussionPage() {
  const {
    discussions,
    selectedDiscussion,
    replies,
    categories,
    selectedCategory,
    sortBy,
    loading,
    repliesLoading,
    createOpen,
    replyOpen,
    setSelectedCategory,
    setSortBy,
    setCreateOpen,
    setReplyOpen,
    createForm,
    replyForm,
    selectDiscussion,
    toggleLike,
    toggleReplyLike,
    createDiscussion,
    createReply,
  } = useDiscussions()

  return (
    <div className="disc-page">
      <div className="disc-header">
        <Title level={2} style={{ margin: 0 }}>
          {translate('menus.learning-discussion')}
        </Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
          {translate('discussions.subtitle')}
        </Paragraph>
      </div>

      <DiscussionFilters
        categories={categories}
        selectedCategory={selectedCategory}
        sortBy={sortBy}
        onCategoryChange={setSelectedCategory}
        onSortChange={setSortBy}
        onCreate={() => setCreateOpen(true)}
      />

      <div className="disc-layout">
        {/* 左侧列表 */}
        <div className="disc-left">
          <DiscussionList
            loading={loading}
            data={discussions}
            categories={categories} // 传入类别表，用于兜底显示名称
            selectedId={selectedDiscussion?.id}
            onSelect={selectDiscussion}
          />
        </div>

        {/* 右侧详情 */}
        <div>
          {selectedDiscussion ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <DiscussionDetail
                discussion={selectedDiscussion}
                onLike={() => toggleLike(selectedDiscussion.id)}
                onReply={() => setReplyOpen(true)}
              />
              <Card title={translate('auto.ffc7850925')}>
                <ReplyList loading={repliesLoading} replies={replies} onLike={toggleReplyLike} />
              </Card>
            </div>
          ) : (
            <Card>
              <div className="disc-empty">
                <MessageSquare size={56} />
                <p>{translate('auto.9da61ef7f0')}</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <CreateDiscussionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categories}
        form={createForm}
        onSubmit={createDiscussion}
      />

      <ReplyModal open={replyOpen} onClose={() => setReplyOpen(false)} form={replyForm} onSubmit={createReply} />
    </div>
  )
}

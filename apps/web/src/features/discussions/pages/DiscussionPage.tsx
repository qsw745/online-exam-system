import React from 'react'
import { Card, Divider } from 'antd'
import { MessageSquare } from 'lucide-react'
import { DiscussionFilters } from '../components/DiscussionFilters'
import { DiscussionList } from '../components/DiscussionList'
import { DiscussionDetail } from '../components/DiscussionDetail'
import { ReplyList } from '../components/ReplyList'
import { CreateDiscussionModal } from '../components/CreateDiscussionModal'
import { ReplyModal } from '../components/ReplyModal'
import { useDiscussions } from '../hooks/useDiscussions'

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
    <div className="bg-gray-50 min-h-screen">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-5">
        <DiscussionFilters
          categories={categories}
          selectedCategory={selectedCategory}
          sortBy={sortBy}
          onCategoryChange={setSelectedCategory}
          onSortChange={setSortBy}
          onCreate={() => setCreateOpen(true)}
        />

        <div className="grid grid-cols-12 gap-6 items-start">
          {/* 左侧列表 */}
          <div className="col-span-12 lg:col-span-5 lg:sticky lg:top-6">
            <DiscussionList
              loading={loading}
              data={discussions}
              categories={categories} // 传入类别表，用于兜底显示名称
              selectedId={selectedDiscussion?.id}
              onSelect={selectDiscussion}
            />
          </div>

          {/* 右侧详情 */}
          <div className="col-span-12 lg:col-span-7">
            {selectedDiscussion ? (
              <div className="space-y-4">
                <DiscussionDetail
                  discussion={selectedDiscussion}
                  onLike={() => toggleLike(selectedDiscussion.id)}
                  onReply={() => setReplyOpen(true)}
                />
                <Divider className="my-0" />
                <Card className="border bg-white shadow-sm rounded-xl">
                  <ReplyList loading={repliesLoading} replies={replies} onLike={toggleReplyLike} />
                </Card>
              </div>
            ) : (
              <Card className="h-full border bg-white shadow-sm rounded-xl">
                <div className="text-center py-16">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">请选择左侧的讨论查看详情</p>
                </div>
              </Card>
            )}
          </div>
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

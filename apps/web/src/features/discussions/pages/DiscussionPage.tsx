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
    // state
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

    // setters
    setSelectedCategory,
    setSortBy,
    setCreateOpen,
    setReplyOpen,

    // forms
    createForm,
    replyForm,

    // actions
    selectDiscussion,
    toggleLike,
    toggleReplyLike,
    createDiscussion,
    createReply,
  } = useDiscussions()

  return (
    <div className="p-6">
      <div className="flex items-center space-x-3 mb-2">
        <MessageSquare className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold">讨论区</h1>
      </div>

      <DiscussionFilters
        categories={categories}
        selectedCategory={selectedCategory}
        sortBy={sortBy}
        onCategoryChange={setSelectedCategory}
        onSortChange={setSortBy}
        onCreate={() => setCreateOpen(true)}
      />

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧列表 */}
        <div className="col-span-12 lg:col-span-5">
          <DiscussionList
            loading={loading}
            data={discussions}
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
              <Divider />
              <Card>
                <ReplyList loading={repliesLoading} replies={replies} onLike={toggleReplyLike} />
              </Card>
            </div>
          ) : (
            <Card className="h-full">
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">请选择一个讨论查看详情</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 发起讨论 */}
      <CreateDiscussionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categories}
        form={createForm}
        onSubmit={createDiscussion}
      />

      {/* 回复弹窗 */}
      <ReplyModal open={replyOpen} onClose={() => setReplyOpen(false)} form={replyForm} onSubmit={createReply} />
    </div>
  )
}

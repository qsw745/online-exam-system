import BrandMark from '@/shared/components/BrandMark'

export default function UnsupportedMobileRolePage() {
  return (
    <main className="mobile-role-notice" aria-labelledby="mobile-role-notice-title">
      <BrandMark size={64} />
      <h1 id="mobile-role-notice-title">教师与管理员请使用问衡 Web 后台</h1>
      <p>当前 App 专注于考生的考试、任务与学习体验，后台管理功能请在电脑浏览器中使用。</p>
    </main>
  )
}

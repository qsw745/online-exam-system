# 问衡考生端移动化基础实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Web 系统升级为“问衡”品牌，交付移动优先的考生导航、学习入口、考试草稿恢复与断网保护，并建立可持续运行的前端测试基础。

**Architecture:** 教师和管理员继续使用现有动态菜单与桌面布局；考生在小于 768 像素时使用独立底部导航和移动页面样式。考试草稿由不依赖 React 的版本化存储模块负责，React Hook 只连接页面状态与存储；后端 API 和数据库结构不变。

**Tech Stack:** React 19、TypeScript、Vite 8、Ant Design 5、React Router 7、Vitest、Testing Library、Express 4、tsx/node:test。

**Spec:** `docs/superpowers/specs/2026-08-30-wenheng-mobile-foundation-design.md`

## Global Constraints

- 用户品牌固定为“问衡”，副标题为“AI 智能测评与学习平台”，口号为“以问见知，以衡见长”。
- 考生端优先移动化；教师端与管理员端不得因本阶段改动改变现有桌面工作流。
- 手机端主导航固定为：首页、任务、学习、我的。
- 考试草稿键必须包含用户 ID、任务 ID 和考试 ID；草稿数据版本固定为 `1`。
- 答案变化后最迟 500 毫秒写入本地草稿；成功提交才清除草稿。
- 375、390、430、768 和 1024 像素视口不得产生考生主流程的页面级横向滚动。
- 不创建 Capacitor/Xcode 工程，不改变数据库结构、API 路径和角色模型。
- 不新增远程字体；中文使用系统字体栈。
- 未经用户明确授权不得执行 `git commit`；每个任务以测试结果和 `git diff --check` 作为检查点。

---

## 文件职责映射

### 新建

- `apps/web/src/shared/config/brand.ts`：前端唯一品牌配置和文档标题格式化。
- `apps/web/src/shared/config/brand.test.ts`：品牌输出行为测试。
- `apps/web/src/shared/components/BrandMark.tsx`：可复用问衡字标和衡尺图标。
- `apps/web/src/shared/components/BrandMark.test.tsx`：字标可访问性和显示行为测试。
- `apps/web/src/shared/components/MobileStudentNav.tsx`：考生手机底部导航。
- `apps/web/src/shared/components/MobileStudentNav.test.tsx`：角色、路由和显示规则测试。
- `apps/web/src/features/learning/pages/StudentLearningHubPage.tsx`：学习入口聚合页。
- `apps/web/src/features/learning/pages/StudentLearningHubPage.test.tsx`：学习入口链接与文案测试。
- `apps/web/src/features/exams/draft/examDraft.ts`：版本化考试草稿纯逻辑。
- `apps/web/src/features/exams/draft/examDraft.test.ts`：草稿隔离、恢复、损坏和清理测试。
- `apps/web/src/features/exams/hooks/useExamDraft.ts`：草稿恢复、500 毫秒延迟保存和刷新前写入。
- `apps/web/src/features/exams/hooks/useExamDraft.test.tsx`：Hook 生命周期测试。
- `apps/web/src/shared/hooks/useOnlineStatus.ts`：浏览器在线状态 Hook。
- `apps/web/src/shared/hooks/useOnlineStatus.test.tsx`：online/offline 事件测试。
- `apps/web/src/features/tasks/components/MobileTaskList.tsx`：手机任务卡片列表。
- `apps/web/src/features/tasks/components/MobileTaskList.test.tsx`：移动任务列表行为测试。
- `apps/web/src/shared/styles/mobile-foundation.css`：移动安全区、导航、布局、触控和焦点样式。
- `apps/web/src/test/setup.ts`：Vitest DOM 断言和测试清理。
- `apps/backend/src/infrastructure/email/email.templates.ts`：问衡邮件纯模板构造。
- `apps/backend/src/infrastructure/email/email.templates.test.ts`：邮件品牌与链接行为测试。

### 修改

- `apps/web/package.json`、`apps/web/vite.config.ts`、`apps/web/tsconfig.json`：测试依赖、脚本和环境。
- `apps/web/index.html`、`apps/web/src/main.tsx`、`apps/web/public/brand-logo.svg`：品牌标题、元数据和图标。
- `apps/web/src/app/i18n/zh-CN.ts`、`apps/web/src/app/i18n/en-US.ts`：品牌及移动导航文案。
- `apps/web/src/features/auth/pages/LoginPage.tsx`、`apps/web/src/shared/components/Header.tsx`：统一品牌组件。
- `apps/web/src/app/routing/pageRegistry.ts`、`apps/web/src/app/routing/DynamicRoutes.tsx`：学习聚合页固定路由。
- `apps/web/src/shared/components/Layout.tsx`、`apps/web/src/main.tsx`：考生手机布局和全局移动样式。
- `apps/web/src/features/exams/pages/ExamPage.tsx`：草稿恢复、在线状态和提交失败保留。
- `apps/web/src/features/questions/pages/QuestionPracticePage.tsx`：删除 1200 像素最小宽度。
- `apps/web/src/features/tasks/pages/MyTasksPage.tsx`：手机使用卡片列表，桌面保留表格。
- `apps/web/src/features/dashboard/pages/DashboardPage.tsx`、`apps/web/src/features/exams/components/ResultDetailView.tsx`、`apps/web/src/features/wrong-questions/pages/WrongQuestionsPage.tsx`、`apps/web/src/features/profile/pages/ProfilePage.tsx`：考生主流程响应式类名和结构。
- `apps/backend/package.json`、`apps/backend/src/infrastructure/email/email.service.ts`：邮件测试脚本和模板接入。

---

### Task 1: 建立前端测试运行器与品牌配置

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/tsconfig.json`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/shared/config/brand.test.ts`
- Create: `apps/web/src/shared/config/brand.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/app/i18n/zh-CN.ts`
- Modify: `apps/web/src/app/i18n/en-US.ts`

**Interfaces:**
- Produces: `brand` and `formatDocumentTitle(pageTitle?: string): string`.
- Consumed by: Task 2 brand UI and all later browser-title usage.

- [ ] **Step 1: 安装前端测试依赖并配置运行器**

Run:

```bash
pnpm --filter web add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Add to `apps/web/package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Add to `defineConfig` in `apps/web/vite.config.ts`:

```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  restoreMocks: true,
},
```

Set `apps/web/src/test/setup.ts` to:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
```

Add `vitest/globals` to `compilerOptions.types` in `apps/web/tsconfig.json`.

- [ ] **Step 2: 写品牌行为失败测试**

Create `apps/web/src/shared/config/brand.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { brand, formatDocumentTitle } from './brand'

describe('问衡品牌配置', () => {
  it('没有页面标题时返回品牌名', () => {
    expect(formatDocumentTitle()).toBe('问衡')
  })

  it('页面标题去除空白后与品牌名组合', () => {
    expect(formatDocumentTitle('  我的考试  ')).toBe('我的考试｜问衡')
  })

  it('暴露已确认的副标题和口号', () => {
    expect(brand.subtitle).toBe('AI 智能测评与学习平台')
    expect(brand.slogan).toBe('以问见知，以衡见长')
  })
})
```

- [ ] **Step 3: 运行测试并确认因模块不存在而失败**

Run:

```bash
pnpm -C apps/web test -- src/shared/config/brand.test.ts
```

Expected: FAIL，错误包含 `Failed to resolve import "./brand"`。

- [ ] **Step 4: 实现最小品牌配置并接入入口标题**

Create `apps/web/src/shared/config/brand.ts`:

```ts
export const brand = Object.freeze({
  name: '问衡',
  shortName: '问衡',
  subtitle: 'AI 智能测评与学习平台',
  slogan: '以问见知，以衡见长',
  themeColor: '#10233F',
})

export function formatDocumentTitle(pageTitle?: string): string {
  const page = pageTitle?.trim()
  return page ? `${page}｜${brand.name}` : brand.name
}
```

In `apps/web/src/main.tsx`, import `formatDocumentTitle` and set:

```ts
document.title = formatDocumentTitle()
```

Change `app.title` to `问衡` in Chinese and `Wenheng` in English i18n files. Add these exact keys:

```ts
'brand.subtitle': 'AI 智能测评与学习平台',
'brand.slogan': '以问见知，以衡见长',
'mobileNav.home': '首页',
'mobileNav.tasks': '任务',
'mobileNav.learning': '学习',
'mobileNav.profile': '我的',
```

```ts
// en-US.ts
'brand.subtitle': 'AI Assessment & Learning Platform',
'brand.slogan': 'Discover through questions, grow through balance',
'mobileNav.home': 'Home',
'mobileNav.tasks': 'Tasks',
'mobileNav.learning': 'Learn',
'mobileNav.profile': 'Me',
```

- [ ] **Step 5: 运行品牌测试、类型检查和差异检查**

Run:

```bash
pnpm -C apps/web test -- src/shared/config/brand.test.ts
pnpm -C apps/web typecheck
git diff --check
```

Expected: 全部退出码为 0。

---

### Task 2: 实现问衡字标、登录页和页头品牌

**Files:**
- Create: `apps/web/src/shared/components/BrandMark.test.tsx`
- Create: `apps/web/src/shared/components/BrandMark.tsx`
- Modify: `apps/web/public/brand-logo.svg`
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/features/auth/pages/LoginPage.tsx`
- Modify: `apps/web/src/shared/components/Header.tsx`

**Interfaces:**
- Consumes: `brand` from Task 1.
- Produces: `BrandMark({ compact?, size?, inverse? })`.

- [ ] **Step 1: 写字标显示行为失败测试**

Create `apps/web/src/shared/components/BrandMark.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BrandMark from './BrandMark'

describe('BrandMark', () => {
  it('完整模式显示品牌、副标题和可访问图标', () => {
    render(<BrandMark />)
    expect(screen.getByRole('img', { name: '问衡' })).toBeInTheDocument()
    expect(screen.getByText('问衡')).toBeInTheDocument()
    expect(screen.getByText('AI 智能测评与学习平台')).toBeInTheDocument()
  })

  it('紧凑模式隐藏副标题但保留品牌名', () => {
    render(<BrandMark compact />)
    expect(screen.getByText('问衡')).toBeInTheDocument()
    expect(screen.queryByText('AI 智能测评与学习平台')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试并确认组件不存在**

Run:

```bash
pnpm -C apps/web test -- src/shared/components/BrandMark.test.tsx
```

Expected: FAIL，错误包含 `Failed to resolve import "./BrandMark"`。

- [ ] **Step 3: 实现字标组件和衡尺 SVG**

Implement `BrandMark.tsx` with this public structure:

```tsx
import { brand } from '@/shared/config/brand'
import { withAppAssetPath } from '@/shared/router/basePath'

type Props = { compact?: boolean; size?: number; inverse?: boolean }

export default function BrandMark({ compact = false, size = 40, inverse = false }: Props) {
  const color = inverse ? '#FFFFFF' : '#10233F'
  return (
    <span className="wenheng-brand" style={{ color }}>
      <img src={withAppAssetPath('/brand-logo.svg')} width={size} height={size} alt={brand.name} />
      <span className="wenheng-brand__copy">
        <strong>{brand.name}</strong>
        {compact ? null : <small>{brand.subtitle}</small>}
      </span>
    </span>
  )
}
```

Replace `brand-logo.svg` with this self-contained 128×128, gradient-free “衡尺” mark:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-labelledby="title">
  <title id="title">问衡</title>
  <rect width="128" height="128" rx="30" fill="#10233F"/>
  <path d="M25 67h78" stroke="#18A77B" stroke-width="8" stroke-linecap="round"/>
  <path d="M38 51v32M90 51v32" stroke="#D9A441" stroke-width="7" stroke-linecap="round"/>
  <path d="M47 47c2-11 10-17 20-17 13 0 21 7 21 18 0 9-5 13-13 18-6 4-8 7-8 13" fill="none" stroke="#FFF" stroke-width="9" stroke-linecap="round"/>
  <circle cx="67" cy="95" r="5" fill="#FFF"/>
</svg>
```

- [ ] **Step 4: 接入登录页、页头和 HTML 元数据**

- Replace the login page `BookOpen` block with `<BrandMark size={56} />` and render `brand.slogan` below it.
- Replace the header image and `t('app.title')` pair with `<BrandMark compact size={24} />`.
- Add `<meta name="theme-color" content="#10233F" />` and `<meta name="application-name" content="问衡" />` to `index.html`.
- Set `<html lang="zh-CN">` and keep the existing viewport tag.

- [ ] **Step 5: 运行组件测试和前端构建**

Run:

```bash
pnpm -C apps/web test -- src/shared/components/BrandMark.test.tsx
pnpm -C apps/web typecheck
pnpm -C apps/web build
git diff --check
```

Expected: 测试、类型检查和构建通过；构建可保留现有大包警告，但不得出现新错误。

---

### Task 3: 实现考生手机底部导航和学习聚合页

**Files:**
- Create: `apps/web/src/shared/components/MobileStudentNav.test.tsx`
- Create: `apps/web/src/shared/components/MobileStudentNav.tsx`
- Create: `apps/web/src/features/learning/pages/StudentLearningHubPage.tsx`
- Create: `apps/web/src/features/learning/pages/StudentLearningHubPage.test.tsx`
- Modify: `apps/web/src/app/routing/pageRegistry.ts`
- Modify: `apps/web/src/app/routing/DynamicRoutes.tsx`

**Interfaces:**
- Produces: `shouldShowMobileStudentNav(input): boolean` and `MobileStudentNav`.
- Fixed learning route: `/student/learning`.

- [ ] **Step 1: 写角色与路由显示规则失败测试**

Create `MobileStudentNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import MobileStudentNav, { shouldShowMobileStudentNav } from './MobileStudentNav'

describe('MobileStudentNav', () => {
  it.each([
    [{ role: 'student', pathname: '/dashboard', isMobile: true }, true],
    [{ role: 'teacher', pathname: '/dashboard', isMobile: true }, false],
    [{ role: 'admin', pathname: '/dashboard', isMobile: true }, false],
    [{ role: 'student', pathname: '/exam/12', isMobile: true }, false],
    [{ role: 'student', pathname: '/exam/task/12', isMobile: true }, false],
    [{ role: 'student', pathname: '/dashboard', isMobile: false }, false],
  ])('对 %o 返回 %s', (input, expected) => {
    expect(shouldShowMobileStudentNav(input)).toBe(expected)
  })

  it('呈现四个明确的考生入口', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MobileStudentNav />
      </MemoryRouter>
    )
    expect(screen.getByRole('navigation', { name: '考生主导航' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: '学习' })).toHaveAttribute('href', '/student/learning')
  })
})
```

- [ ] **Step 2: 运行测试并确认失败原因是模块不存在**

Run:

```bash
pnpm -C apps/web test -- src/shared/components/MobileStudentNav.test.tsx
```

Expected: FAIL，缺少 `MobileStudentNav`。

- [ ] **Step 3: 实现显示规则与四入口导航**

Implement:

```tsx
export type MobileNavVisibilityInput = {
  role?: string | null
  pathname: string
  isMobile: boolean
}

export function shouldShowMobileStudentNav({ role, pathname, isMobile }: MobileNavVisibilityInput) {
  const examRoute = /^\/exam\/(?:task\/)?\d+/.test(pathname)
  return isMobile && role === 'student' && !examRoute
}
```

Use `NavLink` with these exact targets and Lucide icons:

```ts
[
  { to: '/dashboard', label: '首页', icon: House },
  { to: '/tasks/my', label: '任务', icon: ClipboardList },
  { to: '/student/learning', label: '学习', icon: BookOpenCheck },
  { to: '/profile', label: '我的', icon: CircleUserRound },
]
```

The `<nav>` must use `aria-label="考生主导航"` and each icon must be `aria-hidden="true"`.

- [ ] **Step 4: 创建学习聚合页并注册固定路由**

First create `StudentLearningHubPage.test.tsx` and assert that all four links below are present with their exact `href` values. Then create `StudentLearningHubPage.tsx` with four `Card` links:

```ts
[
  { to: '/learning/practice', title: '题目练习', description: '按知识点练习，及时巩固。' },
  { to: '/learning/wrong-questions', title: '错题本', description: '集中处理尚未掌握的题目。' },
  { to: '/learning/favorites', title: '我的收藏', description: '回看重要题目和学习资料。' },
  { to: '/learning/progress', title: '学习进度', description: '查看完成情况和薄弱方向。' },
]
```

Register lazy key `'student-learning'` in `pageRegistry.ts`. Add this fixed protected route beside the existing fixed exam and settings routes in `DynamicRoutes.tsx`:

```tsx
{ path: 'student/learning', element: elementFromRegistry('student-learning') }
```

- [ ] **Step 5: 运行导航测试和路由类型检查**

Run:

```bash
pnpm -C apps/web test -- src/shared/components/MobileStudentNav.test.tsx
pnpm -C apps/web test -- src/features/learning/pages/StudentLearningHubPage.test.tsx
pnpm -C apps/web typecheck
git diff --check
```

Expected: 全部通过。

---

### Task 4: 接入移动布局、安全区和视觉基础

**Files:**
- Create: `apps/web/src/shared/styles/mobile-foundation.css`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/shared/components/Layout.tsx`

**Interfaces:**
- Consumes: `shouldShowMobileStudentNav` and `MobileStudentNav` from Task 3.
- Produces CSS classes used by Tasks 7–8.

- [ ] **Step 1: 在 Layout 计算考生手机模式**

Add:

```tsx
const showStudentMobileNav = shouldShowMobileStudentNav({
  role: user?.role,
  pathname: location.pathname,
  isMobile,
})
const visibleTabs = showTabs && !showStudentMobileNav
const headTotal = HEADER_H + (visibleTabs ? TABS_H : 0)
```

Render `<TabsBar />` only when `visibleTabs` is true. Render `<MobileStudentNav />` immediately before `</TabsProvider>` only when `showStudentMobileNav` is true. Add `className={showStudentMobileNav ? 'app-content app-content--student-mobile' : 'app-content'}` to `Content`.

- [ ] **Step 2: 写移动基础 CSS**

Create `mobile-foundation.css` with exact tokens and behavior:

```css
:root {
  --wenheng-ink: #10233f;
  --wenheng-jade: #18a77b;
  --wenheng-gold: #d9a441;
  --wenheng-paper: #f7f9fc;
  --wenheng-cloud: #e7ecf3;
  --wenheng-danger: #d94a4a;
  --student-mobile-nav-height: 64px;
}

.wenheng-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
.wenheng-brand__copy { display: grid; line-height: 1.1; text-align: left; }
.wenheng-brand__copy strong { font-size: 18px; letter-spacing: .18em; }
.wenheng-brand__copy small { margin-top: 5px; color: #667085; font-size: 11px; letter-spacing: .04em; }

.mobile-student-nav { display: none; }
.student-learning-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.touch-target { min-width: 44px; min-height: 44px; }

@media (max-width: 767px) {
  .app-content--student-mobile {
    padding: 12px 12px calc(var(--student-mobile-nav-height) + env(safe-area-inset-bottom) + 16px) !important;
  }
  .mobile-student-nav {
    position: fixed;
    z-index: 1250;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    min-height: calc(var(--student-mobile-nav-height) + env(safe-area-inset-bottom));
    padding: 6px 8px env(safe-area-inset-bottom);
    border-top: 1px solid var(--wenheng-cloud);
    background: color-mix(in srgb, #fff 94%, transparent);
    backdrop-filter: blur(18px);
  }
  .mobile-student-nav__item {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    min-height: 52px;
    color: #667085;
    text-decoration: none;
    font-size: 11px;
  }
  .mobile-student-nav__item[aria-current='page'] { color: var(--wenheng-jade); font-weight: 700; }
  .student-learning-grid { grid-template-columns: 1fr; gap: 12px; }
}

:focus-visible { outline: 3px solid color-mix(in srgb, var(--wenheng-jade) 45%, transparent); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
```

- [ ] **Step 3: 全局导入 CSS 并验证既有布局未被覆盖**

Import after existing style imports in `main.tsx`:

```ts
import '@/shared/styles/mobile-foundation.css'
```

Run:

```bash
pnpm -C apps/web test -- src/shared/components/MobileStudentNav.test.tsx
pnpm -C apps/web typecheck
pnpm -C apps/web build
git diff --check
```

Expected: 全部通过；桌面 `DynamicSidebar` 和 `TabsBar` 代码路径仍存在。

---

### Task 5: 实现版本化考试草稿纯逻辑

**Files:**
- Create: `apps/web/src/features/exams/draft/examDraft.test.ts`
- Create: `apps/web/src/features/exams/draft/examDraft.ts`

**Interfaces:**
- Produces: `ExamDraftIdentity`, `ExamDraftState`, `ExamDraft`, `examDraftKey`, `saveExamDraft`, `readExamDraft`, `clearExamDraft`.
- Consumed by: Task 6 Hook.

- [ ] **Step 1: 写草稿隔离、恢复、损坏和清理失败测试**

Create a minimal `MemoryStorage` inside the test file implementing the DOM `Storage` interface. Add these literal behavior tests:

```ts
const alice = { userId: 7, taskId: 11, examId: 13 }
const bob = { userId: 8, taskId: 11, examId: 13 }
const state = { answers: { '101': 'A', '102': 'B,C' }, flagged: [102] }

it('按用户、任务、考试生成隔离键', () => {
  expect(examDraftKey(alice)).toBe('wenheng:exam-draft:v1:7:11:13')
  expect(examDraftKey(bob)).toBe('wenheng:exam-draft:v1:8:11:13')
})

it('保存并恢复带版本和时间的草稿', () => {
  const storage = new MemoryStorage()
  expect(saveExamDraft(storage, alice, state, () => '2026-08-30T10:00:00.000Z')).toEqual({
    ok: true,
    savedAt: '2026-08-30T10:00:00.000Z',
  })
  expect(readExamDraft(storage, alice)).toEqual({
    status: 'found',
    draft: { version: 1, ...alice, ...state, savedAt: '2026-08-30T10:00:00.000Z' },
  })
})

it('损坏草稿会被移除', () => {
  const storage = new MemoryStorage()
  storage.setItem(examDraftKey(alice), '{bad json')
  expect(readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
  expect(storage.getItem(examDraftKey(alice))).toBeNull()
})

it('旧版本或身份不匹配的草稿会被移除', () => {
  const storage = new MemoryStorage()
  storage.setItem(examDraftKey(alice), JSON.stringify({ version: 0, ...alice, ...state, savedAt: '2026-08-30T10:00:00.000Z' }))
  expect(readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
  storage.setItem(examDraftKey(alice), JSON.stringify({ version: 1, ...bob, ...state, savedAt: '2026-08-30T10:00:00.000Z' }))
  expect(readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
})

it('存储不可访问时返回 unavailable 而不抛错', () => {
  const storage = new MemoryStorage()
  vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
  expect(readExamDraft(storage, alice)).toEqual({ status: 'unavailable' })
})

it('只清除指定考试草稿', () => {
  const storage = new MemoryStorage()
  saveExamDraft(storage, alice, state)
  saveExamDraft(storage, bob, state)
  clearExamDraft(storage, alice)
  expect(readExamDraft(storage, alice)).toEqual({ status: 'missing' })
  expect(readExamDraft(storage, bob).status).toBe('found')
})
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run:

```bash
pnpm -C apps/web test -- src/features/exams/draft/examDraft.test.ts
```

Expected: FAIL，缺少 `examDraft` 模块。

- [ ] **Step 3: 实现最小草稿模块**

Use these exact public types:

```ts
export const EXAM_DRAFT_VERSION = 1 as const
export type ExamDraftIdentity = { userId: string | number; taskId: string | number; examId: string | number }
export type ExamDraftState = { answers: Record<string, string>; flagged: number[] }
export type ExamDraft = ExamDraftIdentity & ExamDraftState & { version: 1; savedAt: string }
export type ExamDraftReadResult =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'unavailable' }
  | { status: 'found'; draft: ExamDraft }
```

Implement the module with the following behavior (the helpers may remain private):

```ts
export function examDraftKey(identity: ExamDraftIdentity) {
  return `wenheng:exam-draft:v1:${identity.userId}:${identity.taskId}:${identity.examId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidDraft(value: unknown, identity: ExamDraftIdentity): value is ExamDraft {
  if (!isRecord(value) || value.version !== EXAM_DRAFT_VERSION) return false
  if (String(value.userId) !== String(identity.userId)) return false
  if (String(value.taskId) !== String(identity.taskId)) return false
  if (String(value.examId) !== String(identity.examId)) return false
  if (!isRecord(value.answers) || !Object.values(value.answers).every(item => typeof item === 'string')) return false
  if (!Array.isArray(value.flagged) || !value.flagged.every(Number.isInteger)) return false
  return typeof value.savedAt === 'string' && !Number.isNaN(Date.parse(value.savedAt))
}

export function saveExamDraft(
  storage: Storage,
  identity: ExamDraftIdentity,
  state: ExamDraftState,
  now: () => string = () => new Date().toISOString(),
) {
  const savedAt = now()
  const draft: ExamDraft = { version: EXAM_DRAFT_VERSION, ...identity, ...state, savedAt }
  try {
    storage.setItem(examDraftKey(identity), JSON.stringify(draft))
    return { ok: true as const, savedAt }
  } catch {
    return { ok: false as const }
  }
}

export function readExamDraft(storage: Storage, identity: ExamDraftIdentity): ExamDraftReadResult {
  let raw: string | null
  try {
    raw = storage.getItem(examDraftKey(identity))
  } catch {
    return { status: 'unavailable' }
  }
  if (raw === null) return { status: 'missing' }
  try {
    const draft: unknown = JSON.parse(raw)
    if (isValidDraft(draft, identity)) return { status: 'found', draft }
  } catch { /* invalid JSON is handled below */ }
  try { storage.removeItem(examDraftKey(identity)) } catch { /* best effort */ }
  return { status: 'invalid' }
}

export function clearExamDraft(storage: Storage, identity: ExamDraftIdentity) {
  try {
    storage.removeItem(examDraftKey(identity))
    return true
  } catch {
    return false
  }
}
```

Validation must reject and remove data when version, identity, `answers`, `flagged`, or `savedAt` is invalid. `saveExamDraft` must catch storage quota/security errors and return `{ ok: false }` without throwing.

- [ ] **Step 4: 运行测试并进行突变检查**

Run:

```bash
pnpm -C apps/web test -- src/features/exams/draft/examDraft.test.ts
```

Mentally verify these mutations are caught: remove user ID from key, accept version `0`, skip corrupted-data removal, clear Bob when clearing Alice.

Expected: PASS；每项突变至少对应一个失败断言。

- [ ] **Step 5: 运行前端全量测试与类型检查**

Run:

```bash
pnpm -C apps/web test
pnpm -C apps/web typecheck
git diff --check
```

Expected: 全部通过。

---

### Task 6: 实现草稿 Hook 和在线状态 Hook

**Files:**
- Create: `apps/web/src/features/exams/hooks/useExamDraft.test.tsx`
- Create: `apps/web/src/features/exams/hooks/useExamDraft.ts`
- Create: `apps/web/src/shared/hooks/useOnlineStatus.test.tsx`
- Create: `apps/web/src/shared/hooks/useOnlineStatus.ts`

**Interfaces:**
- Produces: `useExamDraft(options)` returning `{ status, savedAt, clearDraft, flushDraft }`.
- Produces: `useOnlineStatus(): boolean`.
- Consumed by: Task 7 ExamPage.

- [ ] **Step 1: 写 Hook 延迟保存和恢复失败测试**

Use `renderHook`, `act`, `vi.useFakeTimers()` and the real `MemoryStorage`. Required tests:

```tsx
it('恢复匹配草稿并向页面返回答案和标记题', () => {
  saveExamDraft(storage, identity, { answers: { '5': 'A' }, flagged: [5] }, () => savedAt)
  const onRestore = vi.fn()
  renderHook(() => useExamDraft({ identity, answers: {}, flagged: [], storage, onRestore }))
  expect(onRestore).toHaveBeenCalledWith({ answers: { '5': 'A' }, flagged: [5] })
})

it('答案变化 499 毫秒时不写入，500 毫秒时写入', () => {
  const { rerender } = renderHook(
    ({ answers }) => useExamDraft({ identity, answers, flagged: [], storage }),
    { initialProps: { answers: {} as Record<string, string> } }
  )
  rerender({ answers: { '5': 'B' } })
  act(() => vi.advanceTimersByTime(499))
  expect(readExamDraft(storage, identity).status).toBe('missing')
  act(() => vi.advanceTimersByTime(1))
  expect(readExamDraft(storage, identity)).toMatchObject({ status: 'found', draft: { answers: { '5': 'B' } } })
})

it('clearDraft 删除草稿并取消等待中的写入', () => {
  const { result } = renderHook(() => useExamDraft({ identity, answers: { '5': 'C' }, flagged: [], storage }))
  act(() => result.current.clearDraft())
  act(() => vi.advanceTimersByTime(500))
  expect(readExamDraft(storage, identity)).toEqual({ status: 'missing' })
})

it('pagehide 会立即写入尚未到期的草稿', () => {
  renderHook(() => useExamDraft({ identity, answers: { '5': 'D' }, flagged: [5], storage }))
  act(() => window.dispatchEvent(new Event('pagehide')))
  expect(readExamDraft(storage, identity)).toMatchObject({
    status: 'found',
    draft: { answers: { '5': 'D' }, flagged: [5] },
  })
})

it('存储写入失败时报告 unavailable', () => {
  vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError') })
  const { result } = renderHook(() => useExamDraft({ identity, answers: { '5': 'E' }, flagged: [], storage }))
  act(() => vi.advanceTimersByTime(500))
  expect(result.current.status).toBe('unavailable')
})
```

Use `beforeEach` to create a fresh storage and enable fake timers; use `afterEach` to run pending timers, restore real timers, and restore spies.

- [ ] **Step 2: 运行草稿 Hook 测试并确认失败**

Run:

```bash
pnpm -C apps/web test -- src/features/exams/hooks/useExamDraft.test.tsx
```

Expected: FAIL，缺少 `useExamDraft`。

- [ ] **Step 3: 实现草稿 Hook**

Use this signature:

```ts
type UseExamDraftOptions = {
  identity: ExamDraftIdentity | null
  answers: Readonly<Record<string | number, string>>
  flagged: number[]
  onRestore?: (state: ExamDraftState) => void
  storage?: Storage
  delayMs?: number
}
```

Implement around stable refs so the `pagehide` handler always sees the latest state:

```ts
const latestRef = useRef({ identity, answers, flagged })
latestRef.current = { identity, answers, flagged }
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const clearedRef = useRef(false)

const flushDraft = useCallback(() => {
  if (timerRef.current) clearTimeout(timerRef.current)
  timerRef.current = null
  const latest = latestRef.current
  if (!resolvedStorage || !latest.identity || clearedRef.current) return
  const normalizedAnswers = Object.fromEntries(
    Object.entries(latest.answers).map(([key, value]) => [String(key), value]),
  )
  const result = saveExamDraft(resolvedStorage, latest.identity, {
    answers: normalizedAnswers,
    flagged: [...latest.flagged],
  })
  if (result.ok) {
    setStatus('saved')
    setSavedAt(result.savedAt)
  } else {
    setStatus('unavailable')
  }
}, [resolvedStorage])
```

Complete it with these lifecycle requirements:

- Default `storage` to `window.localStorage` only inside a guarded browser branch.
- Read once per identity key and call `onRestore` only for `found`.
- Reset `clearedRef` when the identity key changes, and report `unavailable` when reading storage is unavailable.
- Convert numeric answer keys to strings before saving.
- Debounce writes with default `delayMs = 500`.
- Add a `pagehide` listener that invokes `flushDraft`.
- `clearDraft` sets a cleared ref so a pending timer cannot recreate the draft.
- Every effect removes its timer/listener on cleanup so Strict Mode does not duplicate writes.
- Return status values `idle | restored | saved | unavailable` and the last `savedAt`.

- [ ] **Step 4: 写并实现在线状态 Hook**

First create a failing test that overrides `navigator.onLine`, renders the Hook, dispatches `offline`, then `online`, and expects `false`, then `true`.

Implement:

```ts
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const markOnline = () => setOnline(true)
    const markOffline = () => setOnline(false)
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => {
      window.removeEventListener('online', markOnline)
      window.removeEventListener('offline', markOffline)
    }
  }, [])
  return online
}
```

- [ ] **Step 5: 运行 Hook 测试和全部前端测试**

Run:

```bash
pnpm -C apps/web test -- src/features/exams/hooks/useExamDraft.test.tsx src/shared/hooks/useOnlineStatus.test.tsx
pnpm -C apps/web test
pnpm -C apps/web typecheck
git diff --check
```

Expected: 全部通过，无未清理的 fake timer 警告。

---

### Task 7: 在实际考试页接入恢复、断网和安全提交

**Files:**
- Modify: `apps/web/src/features/exams/pages/ExamPage.tsx`

**Interfaces:**
- Consumes: `useExamDraft`, `useOnlineStatus`, and current `useAuth` user.
- Preserves: existing `tasksApi.startExam` and `tasksApi.submit` request contracts.

- [ ] **Step 1: 构造稳定草稿身份和恢复回调**

Import `useAuth`, `useExamDraft`, and `useOnlineStatus`. Inside `ExamPage`, add:

```tsx
const { user } = useAuth()
const isOnline = useOnlineStatus()
const draftIdentity = React.useMemo(() => {
  if (!user?.id || !exam?.taskId || !exam?.examId) return null
  return { userId: user.id, taskId: exam.taskId, examId: exam.examId }
}, [user?.id, exam?.taskId, exam?.examId])

const restoreDraft = React.useCallback((state: ExamDraftState) => {
  setAnswers(Object.fromEntries(Object.entries(state.answers).map(([key, value]) => [Number(key), value])))
  setFlagged(new Set(state.flagged))
}, [])

const { status: draftStatus, savedAt, clearDraft, flushDraft } = useExamDraft({
  identity: draftIdentity,
  answers,
  flagged: [...flagged],
  onRestore: restoreDraft,
})
```

- [ ] **Step 2: 只在成功提交后清除草稿**

In `doSubmit`:

- Call `flushDraft()` immediately before `tasksApi.submit`.
- After `isSuccess(res)` and before navigation, call `clearDraft()`.
- In `catch`, never clear the draft.
- Remove the current `if (auto) setTimeout(() => navigate('/dashboard'), 800)` behavior so an automatic submission failure keeps the exam and retry path visible.
- Use the existing submit button as the retry action after connectivity returns.

- [ ] **Step 3: 呈现明确的本机保存状态**

Immediately below the sticky top card, render exactly one status alert:

```tsx
{!isOnline ? (
  <Alert type="warning" showIcon message="当前网络不可用" description="答案已保存在本机，恢复联网后请重新提交。" />
) : draftStatus === 'unavailable' ? (
  <Alert type="error" showIcon message="无法保存本地草稿" description="请保持页面打开，并尽快恢复设备存储权限。" />
) : draftStatus === 'saved' ? (
  <Text type="secondary">答案已保存{savedAt ? ` · ${dayjs(savedAt).format('HH:mm:ss')}` : ''}</Text>
) : null}
```

Disable only final submission while `!isOnline`; answering controls remain enabled.

- [ ] **Step 4: 修正手机顶部栏和监考卡片布局**

- Add class names `exam-page`, `exam-top-card`, `exam-submit-actions`, and `exam-side-panel`.
- Change top `Row gutter={16}` to `gutter={[12, 12]}` and allow the action `Space` to wrap.
- Keep question column `xs={24} lg={17}` and side column `xs={24} lg={7}`.
- Add CSS in `mobile-foundation.css` so `.exam-page` uses 12px padding on phones, `.exam-submit-actions` spans full width below 560px, and `.exam-side-panel` is non-sticky below 992px.

- [ ] **Step 5: 运行考试相关测试、类型检查和构建**

Run:

```bash
pnpm -C apps/web test -- src/features/exams/draft/examDraft.test.ts src/features/exams/hooks/useExamDraft.test.tsx src/shared/hooks/useOnlineStatus.test.tsx
pnpm -C apps/web typecheck
pnpm -C apps/web build
git diff --check
```

Expected: 全部通过；`ExamPage` 不再包含自动提交失败后跳转 `/dashboard` 的代码。

---

### Task 8: 适配考生高频页面并将手机任务表格改为卡片

**Files:**
- Create: `apps/web/src/features/tasks/components/MobileTaskList.test.tsx`
- Create: `apps/web/src/features/tasks/components/MobileTaskList.tsx`
- Modify: `apps/web/src/features/tasks/pages/MyTasksPage.tsx`
- Modify: `apps/web/src/features/tasks/components/TaskCard.tsx`
- Modify: `apps/web/src/features/questions/pages/QuestionPracticePage.tsx`
- Modify: `apps/web/src/features/dashboard/pages/DashboardPage.tsx`
- Modify: `apps/web/src/features/exams/components/ResultDetailView.tsx`
- Modify: `apps/web/src/features/wrong-questions/pages/WrongQuestionsPage.tsx`
- Modify: `apps/web/src/features/profile/pages/ProfilePage.tsx`
- Modify: `apps/web/src/features/auth/pages/LoginPage.tsx`
- Modify: `apps/web/src/shared/styles/mobile-foundation.css`

**Interfaces:**
- Produces: `MobileTaskList({ tasks, loading, onStart })`.
- Preserves: desktop `TasksTable` behavior at 768 pixels and above.

- [ ] **Step 1: 写移动任务卡片列表失败测试**

Create `MobileTaskList.test.tsx` using this complete `Task` fixture, then render the real component:

```tsx
const task: Task = {
  id: 'task-21',
  title: '安全培训考试',
  description: '完成年度安全知识测评',
  type: 'exam',
  status: 'published',
  start_time: null,
  end_time: null,
  exam_id: 21,
}

const onStart = vi.fn()
const user = userEvent.setup()
render(<MobileTaskList tasks={[task]} loading={false} onStart={onStart} />)
expect(screen.getByText('安全培训考试')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: '开始考试' }))
expect(onStart).toHaveBeenCalledWith(task)
```

Add a second test with an empty list expecting `当前没有符合条件的任务`.

- [ ] **Step 2: 运行测试并确认组件不存在**

Run:

```bash
pnpm -C apps/web test -- src/features/tasks/components/MobileTaskList.test.tsx
```

Expected: FAIL，缺少 `MobileTaskList`。

- [ ] **Step 3: 实现手机任务列表并接入 MyTasksPage**

`MobileTaskList` must render real `TaskCard` items and Ant `Empty`; it must not duplicate start eligibility logic. In `MyTasksPage`, import `type Task` from `useTasksQuery`, import `useIsMobile` from `@/shared/hooks/useMobile`, call `useIsMobile()`, and render:

```tsx
{isMobile ? (
  <MobileTaskList tasks={rows} loading={loading} onStart={handleStart} />
) : (
  <TasksTable
    data={rows as Task[]}
    loading={loading}
    showPublishActions={false}
    showStartAction
    onStart={handleStart}
    onViewResult={(task: Task) => {
      if (task.my_result_id) nav(`/results/${task.my_result_id}`)
    }}
  />
)}
```

Make filters full width on phones using class `student-task-filters`; keep existing desktop widths through media queries. Give `TaskCard` root class `student-task-card` and make its action button full width below 560 pixels.

- [ ] **Step 4: 完成其余考生页面的定点响应式修改**

Apply these exact structural changes:

- `QuestionPracticePage.tsx`: replace `<div style={{ minWidth: 1200, margin: '0 auto' }}>` with `<div className="student-practice-page">`.
- `DashboardPage.tsx`: add root class `student-dashboard`; keep existing Ant `xs={24}` columns.
- `ResultDetailView.tsx`: add root class `student-result-detail`; change `Descriptions column={3}` to `column={{ xs: 1, sm: 2, lg: 3 }}`; add class `result-detail-actions` to the top action `Space`.
- `WrongQuestionsPage.tsx`: add root class `student-wrong-questions`; make header and filter rows wrap; change title from level 1 to level 2 on all viewports.
- `ProfilePage.tsx`: replace fixed `padding: 24` with class `student-profile-page` and CSS 12px/24px responsive padding.
- `LoginPage.tsx`: add `login-page` and `login-card` classes; use 16px outer padding and 20px card body padding below 480 pixels.

Add the corresponding media rules to `mobile-foundation.css`; no rule may target generic `.ant-card` or `.ant-space` globally.

- [ ] **Step 5: 运行任务测试、前端全量测试和构建**

Run:

```bash
pnpm -C apps/web test -- src/features/tasks/components/MobileTaskList.test.tsx
pnpm -C apps/web test
pnpm -C apps/web typecheck
pnpm -C apps/web build
git diff --check
```

Expected: 全部通过；`rg -n "minWidth: 1200" apps/web/src/features/questions/pages/QuestionPracticePage.tsx` 无输出。

---

### Task 9: 重构邮件模板并完成后端品牌替换

**Files:**
- Modify: `apps/backend/package.json`
- Create: `apps/backend/src/infrastructure/email/email.templates.test.ts`
- Create: `apps/backend/src/infrastructure/email/email.templates.ts`
- Modify: `apps/backend/src/infrastructure/email/email.service.ts`

**Interfaces:**
- Produces: `buildVerificationEmail(input)` and `buildPasswordResetEmail(input)` returning `{ subject, html, text }`.
- Consumed by: existing email service transport calls.

- [ ] **Step 1: 添加后端测试脚本并写失败测试**

Add to backend scripts:

```json
"test": "tsx --test \"src/**/*.test.ts\""
```

Create tests using `node:test` and `node:assert/strict`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPasswordResetEmail, buildVerificationEmail } from './email.templates.js'

test('verification email uses Wenheng brand and keeps verification URL', () => {
  const email = buildVerificationEmail({ username: '小衡', verifyUrl: 'https://example.test/verify?token=abc' })
  assert.equal(email.subject, '邮箱验证 - 问衡')
  assert.match(email.html, /感谢注册问衡/)
  assert.match(email.html, /https:\/\/example\.test\/verify\?token=abc/)
  assert.doesNotMatch(email.text, /在线考试系统/)
})

test('password reset email uses Wenheng brand and keeps reset URL', () => {
  const email = buildPasswordResetEmail({ username: '小衡', resetUrl: 'https://example.test/reset?token=xyz' })
  assert.equal(email.subject, '密码重置请求 - 问衡')
  assert.match(email.text, /https:\/\/example\.test\/reset\?token=xyz/)
  assert.doesNotMatch(email.html, /在线考试系统/)
})
```

- [ ] **Step 2: 运行测试并确认模板模块不存在**

Run:

```bash
pnpm -C apps/backend test
```

Expected: FAIL，缺少 `email.templates`。

- [ ] **Step 3: 提取纯模板并接入现有发送服务**

Implement both builders without I/O using these exact interfaces:

```ts
import type { EmailTemplate } from '@/types/password-reset.js'

export type VerificationEmailInput = { username: string; verifyUrl: string }
export type PasswordResetEmailInput = { username: string; resetUrl: string }

function emailShell(title: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    .container{max-width:600px;margin:0 auto;font-family:Arial}
    .header{background:#10233f;color:#fff;padding:20px;text-align:center}
    .content{padding:30px;background:#f7f9fc}
    .button{display:inline-block;background:#18a77b;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;margin:20px 0}
    .footer{padding:20px;text-align:center;color:#666;font-size:12px}
    .warning{background:#fff8e7;border:1px solid #d9a441;padding:15px;border-radius:5px;margin:20px 0}
  </style></head><body><div class="container">
    <div class="header"><h1>${title}</h1></div>
    <div class="content">${content}</div>
    <div class="footer"><p>此邮件由系统自动发送，请勿回复。</p><p>© 2026 问衡。</p></div>
  </div></body></html>`
}

export function buildVerificationEmail({ username, verifyUrl }: VerificationEmailInput): EmailTemplate {
  const content = `<p>亲爱的 ${username}，</p>
    <p>感谢注册问衡。请点击下面的按钮完成邮箱验证后再登录：</p>
    <div style="text-align:center;"><a href="${verifyUrl}" class="button">验证邮箱</a></div>
    <div class="warning"><strong>重要提醒：</strong>
      <ul><li>此链接将在 24 小时后过期</li><li>如果这不是你本人注册，请忽略此邮件</li></ul>
    </div>
    <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
    <p style="word-break:break-all;background:#e7ecf3;padding:10px;border-radius:3px;">${verifyUrl}</p>`
  return {
    subject: '邮箱验证 - 问衡',
    html: emailShell('验证你的邮箱', content),
    text: `邮箱验证\n\n亲爱的 ${username}，\n\n感谢注册问衡。请访问以下链接完成邮箱验证后再登录：\n${verifyUrl}\n\n链接 24 小时后过期。若非本人注册请忽略。\n\n此邮件由系统自动发送，请勿回复。© 2026 问衡。`,
  }
}

export function buildPasswordResetEmail({ username, resetUrl }: PasswordResetEmailInput): EmailTemplate {
  const content = `<p>亲爱的 ${username}，</p>
    <p>我们收到了您的密码重置请求。如果这是您本人的操作，请点击下面的按钮重置您的密码：</p>
    <div style="text-align:center;"><a href="${resetUrl}" class="button">重置密码</a></div>
    <div class="warning"><strong>重要提醒：</strong>
      <ul><li>此链接将在 1 小时后过期</li><li>如果您没有请求重置密码，请忽略此邮件</li><li>请不要将此链接分享给他人</li></ul>
    </div>
    <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
    <p style="word-break:break-all;background:#e7ecf3;padding:10px;border-radius:3px;">${resetUrl}</p>`
  return {
    subject: '密码重置请求 - 问衡',
    html: emailShell('密码重置请求', content),
    text: `密码重置请求\n\n亲爱的 ${username}，\n\n我们收到了您的密码重置请求。如为本人操作，请访问：\n${resetUrl}\n\n重要提醒：\n- 链接 1 小时后过期\n- 若非本人操作请忽略\n- 不要将该链接分享给他人\n\n此邮件由系统自动发送，请勿回复。© 2026 问衡。`,
  }
}
```

Keep the container/button/warning layout, 24-hour or 1-hour wording, user name, and URL shown above. Do not add I/O or environment access to the template module.

In `email.service.ts`, replace inline subject/html/text construction with:

```ts
const template = buildVerificationEmail({ username, verifyUrl })
return this.sendEmail(to, template)
```

For password reset, replace `generatePasswordResetTemplate` with:

```ts
const template = buildPasswordResetEmail({ username, resetUrl })
return this.sendEmail(to, template)
```

Delete the now-unused private `generatePasswordResetTemplate`. Do not alter transporter configuration or recipient selection.

- [ ] **Step 4: 运行后端测试、类型检查和构建**

Run:

```bash
pnpm -C apps/backend test
pnpm -C apps/backend typecheck
pnpm -C apps/backend build
git diff --check
```

Expected: 全部通过。

---

### Task 10: 完成全量验证和多视口视觉 QA

**Files:**
- Modify only files with defects proven by this task's tests or visual checks.

**Interfaces:**
- Verifies all acceptance criteria from the approved spec.

- [ ] **Step 1: 运行完整自动化验证矩阵**

Run:

```bash
pnpm -C apps/web test
pnpm -C apps/backend test
pnpm -C apps/web typecheck
pnpm -C apps/backend typecheck
pnpm -C apps/web build
pnpm -C apps/backend build
git diff --check
git status --short
```

Expected: 所有测试、类型检查、构建和 diff 检查退出码为 0；状态中只出现本计划范围内文件。

- [ ] **Step 2: 启动现有开发环境进行考生主流程检查**

Run the project's normal development stack:

```bash
pnpm dev
```

Use the existing student demo account only in the local environment. Verify routes:

```text
/login
/dashboard
/tasks/my
/student/learning
/learning/practice
/learning/wrong-questions
/profile
```

From `/tasks/my`, use an existing published exam's “开始考试” action to reach the real `/exam/:examId` route. From a completed task, use its result action to reach the real `/results/:resultId` route. Do not invent IDs or seed/modify production-like data for this check.

- [ ] **Step 3: 在五个视口进行视觉验证**

Check exact viewport widths `375`, `390`, `430`, `768`, and `1024` with sufficient height to show the page body. At each width verify:

- `document.documentElement.scrollWidth === document.documentElement.clientWidth` on each listed route.
- Student at 375/390/430 sees bottom navigation outside exam pages.
- Teacher/admin never sees bottom navigation.
- Exam pages never show bottom navigation, tabs, or sidebar.
- Every primary button and nav item has at least 44×44 clickable bounds.
- Keyboard Tab reveals a visible focus ring.
- Reduced-motion emulation removes nonessential transitions.

Capture screenshots for login, dashboard, task list, learning hub, exam, and result detail at 390 pixels for final review.

- [ ] **Step 4: 验证草稿和断网行为**

With a local valid exam:

1. Answer one single-choice and one multiple-choice question; mark one question.
2. Wait 500 milliseconds and reload.
3. Confirm both answers and the mark restore for the same account.
4. Switch the browser offline, change an answer, and confirm the local-save warning.
5. Reload only after returning online, confirm the latest answer restores, then submit.
6. Confirm the corresponding `wenheng:exam-draft:v1:*` key is removed only after successful submission.

- [ ] **Step 5: 检查品牌边界并整理交付状态**

Run:

```bash
rg -n "在线考试系统|在线刷题系统|Online Exam System" apps/web/src apps/web/index.html apps/backend/src/infrastructure/email
```

Expected: 用户可见前端和邮件模板无旧品牌；允许内部 README、包名、数据库配置、API 路径和 Java 包继续保留原名。

Summarize changed files, automated results, visual results, known warnings, and the unchanged second-stage iOS scope. Do not commit unless the user separately authorizes it.

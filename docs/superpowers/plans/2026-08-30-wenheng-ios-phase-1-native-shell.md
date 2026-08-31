# 问衡 iOS 阶段一原生容器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建可在 iOS 模拟器和真机运行的问衡原生容器，只暴露考生端路由，使用 Keychain 保存会话，并向 React 提供可靠的网络与应用生命周期状态。

**Architecture:** 继续以 `apps/web` 作为 React 业务源和 Capacitor 宿主，使用 `VITE_APP_TARGET=ios` 选择独立考生路由，不复制现有页面。Capacitor 官方 App/Network 插件提供系统状态，本地 Swift 插件使用 Security.framework 管理会话；浏览器版本继续使用现有 Web 存储行为。

**Tech Stack:** React 19、TypeScript、Vite 8、Vitest、Capacitor 8.5.0、Swift 6、Security.framework、Xcode 26、iOS 16。

**Spec:** `docs/superpowers/specs/2026-08-30-wenheng-mobile-product-design.md`

## Global Constraints

- 品牌固定为“问衡”，Bundle ID 固定为 `top.qisw.wenheng`。
- iOS Deployment Target 固定为 16.0；iPhone 与 iPad 使用同一个功能集。
- iOS 端不得暴露教师或管理员后台路由。
- 长期访问令牌不得写入 iOS `localStorage` 或 `sessionStorage`；原生端使用 Keychain，React 只保留内存副本。
- 不在冷启动阶段请求摄像头、麦克风或通知权限。
- 本阶段不实现 APNs、Sign in with Apple、账号注销、加密考试库或 AVFoundation 监考；这些能力保持不可见，不使用假实现。
- Web 登录、教师后台和现有移动 Web 功能必须保持回归通过。
- Capacitor 核心、CLI 与 iOS 固定为 `8.5.0`；官方插件按当前实际版本固定：App `8.1.1`、Network `8.0.1`、Status Bar `8.0.3`、Splash Screen `8.0.2`。iOS 工程使用 Swift Package Manager。
- 未经用户明确授权不得执行 `git commit`；每个任务以测试、构建和 `git diff --check` 作为检查点。

---

## 文件职责映射

### 新建

- `apps/web/capacitor.config.ts`：Capacitor 应用标识、名称、Web 输出目录和 iOS 配置。
- `apps/web/src/platform/appTarget.ts`：纯函数解析 `web` 或 `ios` 构建目标。
- `apps/web/src/platform/appTarget.test.ts`：构建目标解析测试。
- `apps/web/src/app/mobile/mobileRouteManifest.ts`：iOS 可访问的考生路由白名单。
- `apps/web/src/app/mobile/mobileRouteManifest.test.ts`：验证后台和人脸登录路由不会进入 iOS。
- `apps/web/src/app/mobile/MobileAppRouter.tsx`：iOS 静态路由树。
- `apps/web/src/app/mobile/MobileAppLayout.tsx`：iOS 考生专用壳层。
- `apps/web/src/app/mobile/UnsupportedMobileRolePage.tsx`：教师或管理员进入 App 时的明确说明。
- `apps/web/src/platform/runtime/runtime.types.ts`：网络和生命周期类型及适配器接口。
- `apps/web/src/platform/runtime/webRuntime.ts`：浏览器运行时实现。
- `apps/web/src/platform/runtime/capacitorRuntime.ts`：Capacitor App/Network 实现。
- `apps/web/src/platform/runtime/RuntimeProvider.tsx`：向 React 提供统一运行时状态。
- `apps/web/src/platform/runtime/RuntimeProvider.test.tsx`：运行时初值与事件测试。
- `apps/web/src/platform/secure-session/secureSession.types.ts`：会话结构和适配器接口。
- `apps/web/src/platform/secure-session/nativeSecureSession.ts`：TypeScript Keychain 插件桥接。
- `apps/web/src/shared/api/core/storage.test.ts`：浏览器与原生会话存储测试。
- `apps/web/ios/App/App/WenhengSecureSessionPlugin.swift`：Security.framework Keychain 插件。
- `apps/web/ios/App/App/WenhengBridgeViewController.swift`：注册本地原生插件。
- `apps/web/ios/App/App/PrivacyInfo.xcprivacy`：首阶段隐私清单。

### 修改

- `apps/web/package.json`、`pnpm-lock.yaml`：Capacitor 依赖和 iOS 构建脚本。
- `apps/web/src/App.tsx`：按构建目标选择 Web 或 iOS Router，并挂载 RuntimeProvider。
- `apps/web/src/app/routes.tsx`：将现有 Router 明确导出为 `webRouter`。
- `apps/web/src/main.tsx`：渲染前完成原生会话初始化。
- `apps/web/src/shared/api/core/storage.ts`：增加 Keychain 适配器与内存令牌。
- `apps/web/src/shared/api/core/httpClient.ts`：等待异步凭证写入与清理。
- `apps/web/src/shared/api/endpoints/auth.ts`：退出登录时等待会话清理。
- `apps/web/src/shared/contexts/AuthContext.tsx`：登录、刷新和退出时等待安全存储。
- `apps/web/src/features/auth/pages/OAuthCallbackPage.tsx`：等待会话写入后再跳转。
- `apps/web/src/features/auth/pages/LoginPage.tsx`：iOS 隐藏 GitHub、人脸和扫码登录入口。
- `apps/web/src/shared/hooks/useOnlineStatus.ts`：读取统一运行时网络状态。
- `apps/web/ios/App/App/Base.lproj/Main.storyboard`：使用 `WenhengBridgeViewController`。
- `apps/web/ios/App/App/Info.plist`：问衡显示名、启动和网络安全基础配置。
- `apps/web/ios/App/App.xcodeproj/project.pbxproj`：Bundle ID、Deployment Target 和设备族。

---

### Task 1: 建立构建目标与 iOS 路由白名单

**Files:**
- Create: `apps/web/src/platform/appTarget.test.ts`
- Create: `apps/web/src/platform/appTarget.ts`
- Create: `apps/web/src/app/mobile/mobileRouteManifest.test.ts`
- Create: `apps/web/src/app/mobile/mobileRouteManifest.ts`

**Interfaces:**
- Produces: `resolveAppTarget(raw?: string, nativePlatform?: boolean): 'web' | 'ios'`。
- Produces: `mobileRouteManifest: readonly MobileRouteDefinition[]`。
- Consumed by: Task 2 Router 和 Task 4 Runtime 选择。

- [x] **Step 1: 写构建目标失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { resolveAppTarget } from './appTarget'

describe('resolveAppTarget', () => {
  it('显式 ios 构建返回 ios', () => expect(resolveAppTarget('ios', false)).toBe('ios'))
  it('原生平台兜底返回 ios', () => expect(resolveAppTarget(undefined, true)).toBe('ios'))
  it('普通浏览器保持 web', () => expect(resolveAppTarget(undefined, false)).toBe('web'))
  it('未知值不得误进原生路由', () => expect(resolveAppTarget('preview', false)).toBe('web'))
})
```

- [x] **Step 2: 运行测试并确认模块不存在**

Run: `pnpm -C apps/web test -- src/platform/appTarget.test.ts`
Expected: FAIL，包含 `Failed to resolve import "./appTarget"`。

- [x] **Step 3: 实现构建目标解析**

```ts
export type AppTarget = 'web' | 'ios'

export function resolveAppTarget(raw?: string, nativePlatform = false): AppTarget {
  if (String(raw || '').trim().toLowerCase() === 'ios') return 'ios'
  return nativePlatform ? 'ios' : 'web'
}
```

- [x] **Step 4: 写并实现移动路由清单**

清单只包含以下路径：

```ts
export type MobileRouteDefinition = { path: string; auth: 'public' | 'required'; immersive?: boolean }

export const mobileRouteManifest = [
  { path: '/login', auth: 'public' },
  { path: '/register', auth: 'public' },
  { path: '/forgot-password', auth: 'public' },
  { path: '/reset-password', auth: 'public' },
  { path: '/verify-email', auth: 'public' },
  { path: '/oauth/callback', auth: 'public' },
  { path: '/dashboard', auth: 'required' },
  { path: '/tasks/my', auth: 'required' },
  { path: '/tasks/detail/:id', auth: 'required' },
  { path: '/student/learning', auth: 'required' },
  { path: '/questions/:id/practice', auth: 'required' },
  { path: '/wrong-questions', auth: 'required' },
  { path: '/favorites', auth: 'required' },
  { path: '/profile', auth: 'required' },
  { path: '/settings', auth: 'required' },
  { path: '/exam/:id', auth: 'required', immersive: true },
  { path: '/exam/task/:taskId', auth: 'required', immersive: true },
  { path: '/results', auth: 'required' },
  { path: '/results/:id', auth: 'required' },
] as const satisfies readonly MobileRouteDefinition[]
```

测试必须断言清单不包含 `/admin`、`/m/face-auth`、`/qr`、`/papers` 和 `/users` 前缀。

- [x] **Step 5: 运行测试和类型检查**

Run:

```bash
pnpm -C apps/web test -- src/platform/appTarget.test.ts src/app/mobile/mobileRouteManifest.test.ts
pnpm -C apps/web typecheck
git diff --check
```

Expected: 全部退出码为 0。

---

### Task 2: 创建独立 iOS 考生 Router 与角色门禁

**Files:**
- Create: `apps/web/src/app/mobile/MobileAppRouter.tsx`
- Create: `apps/web/src/app/mobile/MobileAppLayout.tsx`
- Create: `apps/web/src/app/mobile/UnsupportedMobileRolePage.tsx`
- Create: `apps/web/src/app/mobile/MobileAppLayout.test.tsx`
- Modify: `apps/web/src/app/routes.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/features/auth/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `resolveAppTarget()` 和 `mobileRouteManifest`。
- Produces: `mobileRouter` 与 `MobileAppLayout`。
- Rule: `user.role !== 'student'` 时只显示 Web 后台指引，不加载后台菜单。

- [x] **Step 1: 写角色门禁失败测试**

使用 MemoryRouter 和伪造 AuthContext，断言学生显示子路由，教师与管理员显示“教师与管理员请使用问衡 Web 后台”，并且页面中不存在“系统管理”。

- [x] **Step 2: 运行测试确认组件不存在**

Run: `pnpm -C apps/web test -- src/app/mobile/MobileAppLayout.test.tsx`
Expected: FAIL，包含 `Failed to resolve import "./MobileAppLayout"`。

- [x] **Step 3: 实现原生角色门禁**

`MobileAppLayout` 使用以下决策：

```tsx
if (loading) return <LoadingSpinner center="page" text="正在恢复安全会话…" />
if (!user) return <Navigate to="/login" replace state={{ from: location }} />
if (user.role !== 'student') return <UnsupportedMobileRolePage />
if (/^\/exam\/(?:task\/)?\d+$/.test(location.pathname)) return <Outlet />
return <><main className="mobile-app-shell"><Outlet /></main><MobileStudentNav /></>
```

- [x] **Step 4: 实现 iOS 静态 Router**

复用现有页面注册表中的考生页面，但不请求动态菜单。根路径重定向到 `/dashboard`，未知路径进入移动 404；公开认证页与受保护考生页分别挂载。

- [x] **Step 5: 切换 Router 并隐藏不合规入口**

- 将 `routes.tsx` 的 `router` 重命名导出为 `webRouter`。
- `App.tsx` 在 `VITE_APP_TARGET=ios` 时使用 `mobileRouter`，其余使用 `webRouter`。
- `LoginPage.tsx` 在 iOS 构建时不渲染 `FaceCaptureWizard`、`QrLoginModal`、GitHub 登录按钮和扫码入口；邮箱密码保留，Google/Apple 在阶段二接入前不显示不可用按钮。

- [x] **Step 6: 运行路由、登录与 Web 回归**

Run:

```bash
pnpm -C apps/web test -- src/app/mobile src/features/auth
pnpm -C apps/web typecheck
pnpm -C apps/web build
git diff --check
```

Expected: iOS 路由测试通过，普通 Web 生产构建退出码为 0。

---

### Task 3: 引入 Capacitor 8 并生成 iOS 工程

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/capacitor.config.ts`
- Generate: `apps/web/ios/**`

**Interfaces:**
- Produces: `pnpm -C apps/web build:ios`、`cap:sync:ios`、`ios:build:sim`。
- Consumed by: Task 4–8 原生实现和验证。

- [x] **Step 1: 安装固定版本依赖**

Run:

```bash
pnpm -C apps/web add @capacitor/core@8.5.0 @capacitor/app@8.1.1 @capacitor/network@8.0.1 @capacitor/status-bar@8.0.3 @capacitor/splash-screen@8.0.2
pnpm -C apps/web add -D @capacitor/cli@8.5.0 @capacitor/ios@8.5.0
```

- [x] **Step 2: 新增脚本与配置**

`apps/web/package.json` 增加：

```json
"build:ios": "rimraf node_modules/.vite-temp && cross-env VITE_APP_TARGET=ios VITE_BASE_PATH=/ vite build",
"cap:sync:ios": "pnpm build:ios && cap sync ios",
"cap:open:ios": "cap open ios",
"ios:build:sim": "pnpm cap:sync:ios && xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath .build/ios-derived CODE_SIGNING_ALLOWED=NO build"
```

`capacitor.config.ts` 使用：

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'top.qisw.wenheng',
  appName: '问衡',
  webDir: 'dist',
  ios: { backgroundColor: '#F7F9FC', contentInset: 'automatic', preferredContentMode: 'mobile' },
}

export default config
```

- [x] **Step 3: 生成 Swift Package Manager iOS 工程**

Run:

```bash
pnpm -C apps/web exec cap add ios
pnpm -C apps/web cap:sync:ios
```

Expected: `apps/web/ios/App/App.xcodeproj` 存在，Capacitor 同步成功。

- [x] **Step 4: 固定 iOS 16 和 Bundle ID**

修改 Xcode 工程，使所有 App target build configuration 的 `IPHONEOS_DEPLOYMENT_TARGET` 为 `16.0`，`PRODUCT_BUNDLE_IDENTIFIER` 为 `top.qisw.wenheng`，`TARGETED_DEVICE_FAMILY` 为 `"1,2"`。

- [x] **Step 5: 验证生成工程**

Run:

```bash
pnpm -C apps/web build:ios
pnpm -C apps/web exec cap sync ios
xcodebuild -project apps/web/ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath apps/web/.build/ios-derived CODE_SIGNING_ALLOWED=NO build
git diff --check
```

Expected: Web 构建、Capacitor 同步、模拟器编译全部退出码为 0。

---

### Task 4: 建立统一网络与生命周期 Runtime

**Files:**
- Create: `apps/web/src/platform/runtime/runtime.types.ts`
- Create: `apps/web/src/platform/runtime/webRuntime.ts`
- Create: `apps/web/src/platform/runtime/capacitorRuntime.ts`
- Create: `apps/web/src/platform/runtime/RuntimeProvider.tsx`
- Create: `apps/web/src/platform/runtime/RuntimeProvider.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/shared/hooks/useOnlineStatus.ts`

**Interfaces:**

```ts
export type AppLifecycleState = 'active' | 'inactive' | 'background'
export type NetworkKind = 'wifi' | 'cellular' | 'none' | 'unknown'
export type RuntimeSnapshot = { lifecycle: AppLifecycleState; connected: boolean; network: NetworkKind }
export interface RuntimeAdapter {
  getSnapshot(): Promise<RuntimeSnapshot>
  subscribe(listener: (snapshot: RuntimeSnapshot) => void): Promise<() => void>
}
```

- [x] **Step 1: 写 Provider 失败测试**

测试适配器初值、网络断开事件、进入后台事件和卸载后的监听清理。

- [x] **Step 2: 运行测试确认模块不存在**

Run: `pnpm -C apps/web test -- src/platform/runtime/RuntimeProvider.test.tsx`
Expected: FAIL，包含缺失模块错误。

- [x] **Step 3: 实现 Web 与 Capacitor 适配器**

- Web 使用 `navigator.onLine`、`online`、`offline`、`visibilitychange`。
- iOS 使用 `Network.getStatus()`、`Network.addListener('networkStatusChange')` 和 `App.addListener('appStateChange')`。
- `RuntimeProvider` 向下提供 `snapshot` 和 `ready`，并在卸载时移除所有原生监听。

- [x] **Step 4: 接入现有在线状态 Hook**

`useOnlineStatus()` 改为从 RuntimeProvider 返回 `snapshot.connected`；Provider 不存在的测试环境回退到 `navigator.onLine`。

- [x] **Step 5: 运行测试与双目标构建**

Run:

```bash
pnpm -C apps/web test -- src/platform/runtime src/shared/hooks/useOnlineStatus.test.tsx
pnpm -C apps/web build
pnpm -C apps/web build:ios
git diff --check
```

Expected: 全部退出码为 0。

---

### Task 5: 实现 Swift Keychain 插件与类型化桥接

**Files:**
- Create: `apps/web/src/platform/secure-session/secureSession.types.ts`
- Create: `apps/web/src/platform/secure-session/nativeSecureSession.ts`
- Create: `apps/web/ios/App/App/WenhengSecureSessionPlugin.swift`
- Create: `apps/web/ios/App/App/WenhengBridgeViewController.swift`
- Modify: `apps/web/ios/App/App/Base.lproj/Main.storyboard`

**Interfaces:**

```ts
export type StoredNativeSession = {
  accessToken: string
  mode: 'session' | 'local' | '7d'
  expiresAt: number | null
}

export interface SecureSessionAdapter {
  read(): Promise<StoredNativeSession | null>
  write(session: StoredNativeSession): Promise<void>
  clear(): Promise<void>
}
```

- [x] **Step 1: 写 TypeScript 桥接契约测试**

使用伪造插件断言 `read` 对缺失值返回 `null`、`write` 保留 `expiresAt`、`clear` 传播原生失败。

- [x] **Step 2: 实现 Swift Keychain 插件**

插件名固定为 `WenhengSecureSession`，公开 `read`、`write`、`clear` 三个 Promise 方法。Keychain service 使用 `top.qisw.wenheng.session`，account 使用 `auth-session-v1`，数据为 JSON，访问级别使用 `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`。任何 Security.framework 非成功状态必须用稳定错误码拒绝调用，不能打印令牌。

- [x] **Step 3: 注册本地插件**

`WenhengBridgeViewController`：

```swift
import UIKit
import Capacitor

final class WenhengBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WenhengSecureSessionPlugin())
    }
}
```

将 `Main.storyboard` Bridge View Controller 的 custom class 改为 `WenhengBridgeViewController`。

- [x] **Step 4: 实现 TypeScript 注册**

```ts
import { registerPlugin } from '@capacitor/core'
import type { StoredNativeSession } from './secureSession.types'

type Plugin = {
  read(): Promise<{ session?: StoredNativeSession }>
  write(options: StoredNativeSession): Promise<void>
  clear(): Promise<void>
}

export const WenhengSecureSession = registerPlugin<Plugin>('WenhengSecureSession')
```

- [x] **Step 5: 验证桥接编译与 TypeScript 测试**

Run:

```bash
pnpm -C apps/web test -- src/platform/secure-session
pnpm -C apps/web cap:sync:ios
xcodebuild -project apps/web/ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath apps/web/.build/ios-derived CODE_SIGNING_ALLOWED=NO build
git diff --check
```

Expected: TypeScript 测试和 Swift 模拟器编译全部通过。

---

### Task 6: 将鉴权存储迁移为 Web/Keychain 双实现

**Files:**
- Create: `apps/web/src/shared/api/core/storage.test.ts`
- Modify: `apps/web/src/shared/api/core/storage.ts`
- Modify: `apps/web/src/shared/api/core/httpClient.ts`
- Modify: `apps/web/src/shared/api/endpoints/auth.ts`
- Modify: `apps/web/src/shared/contexts/AuthContext.tsx`
- Modify: `apps/web/src/features/auth/pages/OAuthCallbackPage.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**

```ts
export function getAccessToken(): string | null
export async function initializeAuthStorage(adapter?: SecureSessionAdapter): Promise<void>
export async function setAccessToken(token: string, mode?: AuthStorageMode): Promise<void>
export async function clearTokenAll(): Promise<void>
```

- [x] **Step 1: 写安全存储失败测试**

覆盖以下行为：

- Web `session`、`local`、`7d` 行为保持兼容。
- 原生初始化从适配器载入内存，且不写入 Web Storage。
- 原生 `setAccessToken` 等待 Keychain 写入完成。
- 过期的 `7d` 会话被清理并返回 `null`。
- 原生清理同时清除内存和 Keychain。

- [x] **Step 2: 运行测试并确认现实现不满足原生契约**

Run: `pnpm -C apps/web test -- src/shared/api/core/storage.test.ts`
Expected: FAIL，包含 `initializeAuthStorage is not a function`。

- [x] **Step 3: 实现内存令牌与适配器选择**

原生模式由 `resolveAppTarget(import.meta.env.VITE_APP_TARGET, Capacitor.isNativePlatform())` 决定。初始化完成前不渲染 React；原生访问令牌只保存在模块内存和 Keychain，Web 模式继续使用现有 Storage 键。

- [x] **Step 4: 更新所有异步调用点**

- `httpClient` 刷新成功后 `await setAccessToken`，清理和跳转前 `await clearTokenAll`。
- `AuthContext` 登录、刷新、已签发会话和退出都等待写入或清除完成。
- `auth.logout()` 和 OAuth 回调等待清理或写入。
- `main.tsx` 在 `await initializeAuthStorage()` 后调用 `ReactDOM.createRoot()`；初始化失败显示不含敏感信息的启动错误页。

- [x] **Step 5: 运行鉴权和构建回归**

Run:

```bash
pnpm -C apps/web test -- src/shared/api/core/storage.test.ts src/features/auth src/shared/contexts
pnpm -C apps/web typecheck
pnpm -C apps/web build
pnpm -C apps/web build:ios
git diff --check
```

Expected: 全部退出码为 0，iOS 构建产物中不出现 `localStorage.setItem('token'`。

---

### Task 7: 配置原生外观、隐私基础和后台遮盖

**Files:**
- Create: `apps/web/ios/App/App/PrivacyInfo.xcprivacy`
- Create: `apps/web/src/platform/privacy/BackgroundPrivacyCover.tsx`
- Create: `apps/web/src/platform/privacy/BackgroundPrivacyCover.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/ios/App/App/Info.plist`
- Modify: `apps/web/ios/App/App.xcodeproj/project.pbxproj`

**Interfaces:**
- Consumes: `RuntimeSnapshot.lifecycle`。
- Produces: App 非 active 时覆盖业务内容的隐私遮罩。

- [x] **Step 1: 写后台遮盖失败测试**

断言 `active` 不显示遮罩，`inactive` 和 `background` 显示问衡品牌及“内容已保护”，遮罩具备 `aria-live="polite"`。

- [x] **Step 2: 实现遮盖并接入 RuntimeProvider**

遮盖必须位于 Router 上方且不卸载考试页面，避免为了隐藏内容破坏答题状态。

- [x] **Step 3: 配置原生元数据**

- Display Name 为“问衡”。
- 支持 iPhone/iPad，最低 iOS 16。
- 默认竖屏；iPad 和后续受控横屏能力保留工程方向声明。
- 本阶段不添加摄像头、麦克风和通知用途文案，防止尚未实现的能力造成审核误解。
- `PrivacyInfo.xcprivacy` 声明不追踪；收集数据与 Required Reason API 仅按当前二进制真实行为填写。

- [x] **Step 4: 验证隐私文件进入 App Bundle**

Run:

```bash
pnpm -C apps/web test -- src/platform/privacy/BackgroundPrivacyCover.test.tsx
pnpm -C apps/web ios:build:sim
find apps/web/.build/ios-derived/Build/Products -name PrivacyInfo.xcprivacy -print
git diff --check
```

Expected: 测试和模拟器构建成功，构建产物中包含隐私清单。

---

### Task 8: 阶段一完整验证与交付说明

**Files:**
- Create: `docs/verification/2026-08-30-wenheng-ios-phase-1.md`
- Modify: `README-DEV.md`

**Interfaces:**
- Consumes: Task 1–7 全部产物。
- Produces: 可复现的阶段一验证记录和本地运行说明。

- [x] **Step 1: 运行前端和后端回归**

Run:

```bash
pnpm -C apps/web test
pnpm -C apps/web typecheck
pnpm -C apps/web build
pnpm -C apps/backend test
pnpm -C apps/backend typecheck
pnpm -C apps/backend build
```

Expected: 全部退出码为 0。

- [x] **Step 2: 运行 iOS 构建验证**

Run:

```bash
pnpm -C apps/web ios:build:sim
xcodebuild -project apps/web/ios/App/App.xcodeproj -scheme App -showBuildSettings | rg 'PRODUCT_BUNDLE_IDENTIFIER|IPHONEOS_DEPLOYMENT_TARGET|TARGETED_DEVICE_FAMILY'
```

Expected: 分别显示 `top.qisw.wenheng`、`16.0` 和 `1,2`。

- [x] **Step 3: 运行静态安全检查**

Run:

```bash
rg -n "localStorage\.setItem\(['\"]token|sessionStorage\.setItem\(['\"]token" apps/web/src --glob '!shared/api/core/storage.ts'
rg -n "NSCameraUsageDescription|NSMicrophoneUsageDescription|NSUserTrackingUsageDescription" apps/web/ios/App/App/Info.plist
git diff --check
```

Expected: 除受自动化测试保护的 Web 存储适配器外，不存在直接令牌写入；未实现权限用途键不存在；差异检查退出码为 0。

- [x] **Step 4: 记录证据边界**

验证文档必须分别记录：已实现、已通过模拟器构建、尚未完成真机、尚未接入账号区域/可靠考试/监考/APNs、未上传 TestFlight、未提交 App Store。不得把模拟器编译成功描述为可上架完成。

- [x] **Step 5: 更新开发说明**

在 `README-DEV.md` 增加以下命令：

```bash
pnpm -C apps/web build:ios
pnpm -C apps/web cap:sync:ios
pnpm -C apps/web ios:build:sim
pnpm -C apps/web cap:open:ios
```

- [x] **Step 6: 最终检查点**

Run: `git status --short && git diff --stat && git diff --check`
Expected: 仅包含本阶段和已确认文档的变更；不提交、不推送、不上传。

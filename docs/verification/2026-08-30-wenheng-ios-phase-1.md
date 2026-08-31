# 问衡 iOS 阶段一验证记录

日期：2026-08-30
分支：`codex/wenheng-ios-phase1`
结论：阶段一代码、Xcode 工程、Capacitor Swift Package、双架构模拟器编译和签名模拟器冷启动均已验证通过。iPhone 17 Pro（iOS 26.5）可正常进入问衡登录页；本结论只覆盖阶段一原生壳，不代表最终产品、真机或 App Store 上架验收完成。

## 已实现

- 品牌与应用标识：问衡，Bundle ID `top.qisw.wenheng`，最低 iOS 16，支持 iPhone/iPad。
- iOS 独立考生路由白名单；不请求动态后台菜单，教师和管理员只看到 Web 后台指引。
- iOS 第一阶段登录只展示邮箱密码；人脸、扫码、GitHub/Google 入口及个人页人脸录入卡均不渲染。
- Capacitor App/Network 统一网络与生命周期状态，Web 保留原有在线状态回退。
- Swift Keychain 插件 `WenhengSecureSession`；iOS 访问令牌只进入 Keychain 和 React 内存，不写入 Web Storage。
- App 进入非活动或后台状态时显示隐私遮罩，不卸载当前考试页面。
- `PrivacyInfo.xcprivacy` 已加入 App target 的 Resources；未声明追踪，未添加摄像头、麦克风或追踪用途键。
- iPhone 默认仅竖屏；iPad 保留工程声明中的横竖屏支持。

## 已通过验证

| 检查 | 结果 |
| --- | --- |
| `pnpm -C apps/web test` | 17 个测试文件、67 个用例全部通过 |
| `pnpm -C apps/web typecheck` | 通过 |
| `pnpm -C apps/web build` | 通过 |
| `pnpm -C apps/web build:ios` | 通过 |
| `pnpm -C apps/backend test` | 2 个用例全部通过；首次沙箱 IPC 失败后在允许本地临时管道的环境重跑通过 |
| `pnpm -C apps/backend typecheck` | 通过 |
| `pnpm -C apps/backend build` | 通过 |
| `pnpm -C apps/web ios:build:sim` | 通过；arm64 与 x86_64 模拟器目标均编译成功 |
| 签名模拟器构建、安装、冷启动 | 通过；iPhone 17 Pro（iOS 26.5）进入问衡登录页 |
| 原生 Runtime 冒烟 | `WenhengSecureSession.read`、`App.getState`、`Network.getStatus` 均成功返回 |
| Swift `-parse` | `WenhengSecureSessionPlugin.swift`、`WenhengBridgeViewController.swift` 语法通过 |
| `plutil -lint` | `Info.plist`、`PrivacyInfo.xcprivacy`、`project.pbxproj` 全部通过 |
| App Bundle 隐私清单 | `.build/ios-derived/Build/Products/Debug-iphonesimulator/App.app/PrivacyInfo.xcprivacy` 存在 |
| 静态权限检查 | `Info.plist` 不含摄像头、麦克风、追踪用途键 |
| 静态凭据检查 | 除受测试保护的 Web 存储适配器外，没有直接写入 `token` 的 Web Storage 调用 |

## 原生构建与启动证据

无签名双架构编译：

```bash
xcodebuild -project apps/web/ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath apps/web/.build/ios-derived \
  CODE_SIGNING_ALLOWED=NO build
```

结果：退出码 0，`BUILD SUCCEEDED`。该命令用于工程和 Swift 编译验证；因为显式关闭签名，不用于 Keychain 运行时验证。

签名模拟器冒烟使用具体设备目标构建，不传 `CODE_SIGNING_ALLOWED=NO`：

```bash
xcodebuild -project apps/web/ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=<SIMULATOR_UDID>' \
  -derivedDataPath apps/web/.build/ios-signed build
```

随后通过 `simctl install` 和 `simctl launch` 安装、启动。首次安装时 Keychain 返回“未找到旧会话”，JS 收到空对象并继续渲染登录页；App 和 Network 原生插件返回 active、Wi-Fi/在线状态。

构建产物隐私清单确认：

```bash
find apps/web/.build/ios-derived/Build/Products -name PrivacyInfo.xcprivacy -print
```

## 启动冒烟发现并修复的问题

- `SceneDelegate` 原先手动创建普通 `CAPBridgeViewController`，覆盖 storyboard 中的 `WenhengBridgeViewController`，导致自定义安全会话插件未注册；已改为直接创建 `WenhengBridgeViewController`。
- Keychain 首次安装返回 `errSecItemNotFound` 时，原生 `call.resolve()` 让 JS 收到 `undefined`；已改为返回空对象，与 TypeScript 契约一致。
- 无签名模拟器包访问 Keychain 会返回 `-34018`；改用正常模拟器临时签名后返回 `-25300`，证明确为测试构建方式差异，不是 Keychain 实现故障。
- 冷启动日志仍会在 WebView 完成加载前出现一次 Capacitor 通用 `JS Eval error`，但随后的自定义插件、App/Network Runtime 和页面渲染全部成功。该日志不影响本次冷启动验收，仍需在后续 WebView 进程恢复、深链和后台压力测试中持续观察。

## 尚未完成

- 尚未进行真机后台恢复、弱网、进程回收、深链和完整 Keychain 写入/恢复/清除链路验证。
- 尚未完成真实后端环境的登录、考试、自动保存、断网续答和交卷端到端验证。
- 尚未实现第二阶段账号/区域隔离、第三阶段可靠考试会话、第四阶段原生监考、第五阶段 APNs 与发布准备。
- 尚未接入 Sign in with Apple、Google、账号注销、会员/IAP、摄像头或麦克风原生权限。
- 未构建签名归档，未上传 TestFlight，未提交 App Store，也未公开发布。
- 未执行 Git 提交或推送。

模拟器编译通过只代表阶段一原生壳可编译，不代表最终产品可用或具备上架条件。

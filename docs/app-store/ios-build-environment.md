# iOS 发布构建环境

核对日期：2026-09-08。

## 已确认的拒绝信息

问衡 1.0（2026.9.83）于 15:34 提交后，Apple 邮件于 15:35 报告 `ITMS-90111: Unsupported SDK or Xcode version`。版本从 `WAITING_FOR_REVIEW` 变为 `INVALID_BINARY`，提交变为 `UNRESOLVED_ISSUES`。收件邮箱须以 App Store Connect 账号所有者为准，不要用审核联系邮箱替代。

实际包内主程序来自 Xcode 26.6（17F113）、iOS SDK 26.5（23F81a），构建主机字段为 `BuildMachineOSBuild=26A5425a`，对应本机 macOS 27 beta 8。Apple 官方将 Xcode 26.6 的支持主机范围列为 macOS 26.2–26.x；26.6 本身是正式版。不能仅通过 `xcodebuild -version` 判断整个发布环境合格。

参考：[Apple Xcode 系统要求](https://developer.apple.com/xcode/system-requirements)、[Apple 发布列表](https://developer.apple.com/news/releases/)。Capacitor 上游问题 #8537 的后续讨论亦指出测试版 macOS 可能造成同样错误；依赖旧 SDK 不是本次邮件明确指认的原因。

## 正式版虚拟机重建

- 复用已有 Parallels `macOS` 虚拟机，实际系统为 macOS 26.6（25G72），Xcode 26.6（17F113）。未降级或修改宿主系统。
- 复制原生工程、现有已构建的 `App/public` 与 4 个插件源码；保持 Capacitor 8.5.0 及插件版本不变。没有重新执行 `cap sync`，避免把网页版 `/wenheng/` 构建混入原生 App。
- 虚拟机下载 GitHub 二进制依赖超时后，传入同版本的本地 SwiftPM 缓存；保留官方二进制及其签名，仅将工作区缓存中的绝对路径映射到虚拟机目录。没有重编第三方框架。
- 虚拟机内从源码执行 Release archive，构建号改为 `2026.9.84`，使用 `CODE_SIGNING_ALLOWED=NO`；签名密钥没有传入虚拟机。
- 将完整归档传回宿主机，再用现有分发证书与 App Store 描述文件导出 IPA。导出只签名打包，归档中的真实构建系统仍为 25G72。没有伪改 `BuildMachineOSBuild` 或 SDK 信息。
- 84 归档通过；原生 Web 资源逐文件 SHA-256 与 83 完全一致，Capacitor 配置字节一致。最终 IPA 的签名及生产 API 配置核对通过。

## 再次发布时的核对

1. 先读取构建机 `sw_vers` 与 `xcodebuild -version`，核对 Apple 当前正式版/RC 及支持范围。
2. 在该系统内实际重新编译归档，再进行分发签名；不得将修改版本元数据当作更换构建环境。
3. 解包最终 IPA，核对主程序 `BuildMachineOSBuild`、`DTXcodeBuild`、`DTSDKName`、Bundle ID、构建号、正式 HTTPS 地址与原生 HTTP 配置；运行严格签名验证。
4. 上传通过、构建 `VALID` 和 `APP_STORE_ELIGIBLE` 不能代替提审后的检查。本次旧包正是在提交后被服务器拒绝。
5. 重新提审后，同时回读版本、审核提交、审核项目及实际通知邮件。保留先前失败构建的原因，不覆盖成“上传成功”。

当前重提审结果以同目录 `release-evidence.json` 和 `2026-09-08-release-status.md` 为准。

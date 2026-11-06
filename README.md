# Still · iPhone 私人播放器

原生 React Native 界面 + iOS MobileVLCKit 播放内核。不是网页、WebView 或系统 AVPlayer 控制面板。为个人 iPhone 16 Pro Max 与 Jellyfin 媒体库设计，日常开发可以使用 Windows。

## 当前状态

已实现 Jellyfin 登录、媒体库/文件夹逐层浏览、搜索、分页、继续观看、自定义播放控件、手势、码率/网络缓冲设置、音轨/字幕选择与播放进度同步。源码包含免费的 Apple ID 侧载构建路线。

**首个未签名 IPA 已在云端编译成功，但尚未连接你的 Jellyfin 或在 iPhone 上测试。** [源码仓库](https://github.com/oliverlorentino/ts_player)当前为公开仓库。[成功构建与制品](https://github.com/oliverlorentino/ts_player/actions/runs/42241661114)对应源码提交 `9477d759e8fab14707bbbd116a47a4c871645924`。Windows 本机安装包位于 `E:\ts_player\build\Still-unsigned.ipa`，安装步骤见 [INSTALL_IPHONE.md](INSTALL_IPHONE.md)。`dist/` 是 JS 发布产物，不是安装包。

验证结果：TypeScript 检查通过，13 项自动化测试通过，iOS Hermes 发布包导出成功，Expo iOS 配置解析通过。云端 Xcode 16.4 真机 Release 编译、IPA 打包和制品上传全部成功；本地校验了制品 SHA-256、ZIP 完整性、arm64 可执行文件和内置 JS 包。最低 iOS 版本为 15.1。Expo Doctor 为 16/17：剩余一项是 VLC 新架构兼容与旧图标包的目录元数据警告，详见下文。

## Windows 本地开发

安装 Node.js 22 LTS，然后在当前目录执行：

```powershell
npm ci
npm run check
```

- `npm run typecheck`：TypeScript 类型检查。
- `npm test`：接口协商、URL 安全、进度上报、文件夹查询和滑动计算测试。
- `npm run build`：生成 iOS JavaScript/Hermes 包，不生成 IPA。
- `npm start`：给已安装的开发构建提供热更新服务；不适用于普通 Expo Go。

VLC 是自定义原生模块，**不能用 Expo Go 测试这个播放器**。侧载 Release 包不依赖电脑上的开发服务器，手机能访问 Jellyfin 即可播放。

## 不购买 Mac、不付苹果开发者年费的安装路线

1. 把项目提交到你自己的 GitHub 仓库；不要提交 `node_modules`、凭据或构建产物。项目 `.gitignore` 已排除这些文件。
2. 在 GitHub 的 Actions 中选择 **Build iPhone IPA for personal sideloading**，点击 Run workflow。
3. 工作流在 macOS runner 上安装依赖、测试、生成 Xcode 项目、编译 arm64 真机 Release 包，再上传 `Still-iPhone-unsigned` 制品。它不需要 Apple ID、证书或签名密钥。
4. 下载制品并解压，得到 `Still-unsigned.ipa`。未签名 IPA 本身不能直接安装。
5. 按 [AltStore Windows 官方安装说明](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) 在 Windows 安装 AltServer，并把 AltStore Classic 装到 iPhone。按其要求配置 iTunes/iCloud、信任电脑与设备开发者模式。
6. 将 IPA 传到 iPhone“文件”中，用 AltStore 的 My Apps → `+` 选择文件，用你自己的免费 Apple ID 签名安装。Apple ID 只输入到你信任的签名工具，**不要发到聊天、仓库或工作流里**。
7. 免费签名通常 7 天到期，需要刷新；AltStore 可以在与 AltServer 连接条件满足时自动刷新。免费账号还有同时安装 App 数量限制，详见 [AltStore 官方说明](https://faq.altstore.io/altstore-classic/your-altstore)。

这条路线免苹果开发者年费，但 GitHub macOS 构建额度/费用取决于你的 GitHub 套餐与仓库设置。未越狱 iPhone 不能跳过签名。工作流已完成首次真实云构建；后续修改主分支中的源码或构建配置会自动重新构建，也可手动运行。GitHub 制品保留 7 天，本机已保存首个 IPA。

如果已经有付费开发者账号，可用 `eas.json` 的 `development` 或 `preview` 构建，通过 EAS 进行签名与设备分发；先在自己的终端完成 EAS 登录、项目关联和设备注册，再运行 `npm run ios:build`。此路线不作为免费侧载的前置要求。

## 使用

连接页填写完整的 Jellyfin 地址（支持局域网 HTTP、HTTPS 与 `/jellyfin` 子路径）、用户名和密码。允许 iOS 的“本地网络”权限。密码只用于登录，不落盘；访问令牌保存在 iOS 钥匙串。HTTPS 使用系统证书校验，不自动忽略不可信证书。

媒体库首页对应 Jellyfin 的用户视图；进入后使用 `ParentId`、`Recursive=false` 逐层浏览。呈现的是 Jellyfin 管理的媒体层级，不保证和服务器操作系统目录一一对应。搜索会包含当前文件夹下的子目录。网格/列表可切换。

播放手势：

| 操作 | 行为 |
| --- | --- |
| 左右拖动画面 | 不暂停，不弹出控件或跳转提示；只更新底部 2 点细线，松手提交一次 seek |
| 双击左 / 右半侧 | 默认后退 / 快进 10 秒，不显示提示；步长可调整 |
| 单击画面 | 切换自定义控件，4 秒自动隐藏 |
| 拖动底部细线 | 跳转绝对位置；视觉高度 2 点，实际触摸高度 28 点 |
| 播放设置 | 倍速、内嵌音轨/字幕、外挂字幕与兼容转码 |
| 横屏按钮 / 转动手机 | 播放时可横竖屏；退出恢复竖屏 |

VLC 内核优先直放 MKV、MP4、HEVC、H.264、DTS 等常见组合。不兼容或无法播放时自动尝试一次 Jellyfin H.264/AAC HLS 转码，也可以手动切换。播放位置每 10 秒、暂停、跳转和退出时同步；本机保留短期进度用于网络失败后的恢复。

网络缓冲设置为 VLC 的 `network-caching`，默认 1500 毫秒，可改成 500/3000/5000。保留 VLC 自动硬件解码选择、HTTP 重连，拖动松手后才请求跳转。**尚未实现整片离线下载、磁盘分片缓存或预测预读**；这些设置不能保证未缓存的远距离跳转零等待。片源码率、服务器磁盘、网络与关键帧间隔都会影响跳转。

## 架构与兼容性说明

- `App.tsx`：会话、设置与原生全屏播放入口。
- `src/lib/jellyfin.ts`：设备能力协商、直放/转码、文件夹 API 和播放会话上报。
- `src/screens/Player.tsx`：裸 VLC 画面、自定义控件、无提示手势、轨道切换。
- `src/lib/storage.ts`：钥匙串令牌、本机偏好和恢复点。
- `.github/workflows/ios-unsigned.yml`：macOS 构建未签名真机 IPA。
- `scripts/patch-vlc.cjs`：安装后对锁定版本的 iOS 桥接代码做小范围修复；校验原文防止升级时悄悄失效。

目前锁定 Expo SDK 54 / React Native 0.81 的旧架构，因为 VLC 桥接库未声明新架构兼容。不要直接升级到强制新架构的 SDK。Expo Doctor 的 React Native Directory 检查可能仍报告 VLC 未测试新架构及其旧图标依赖缺少元数据；这不是原生编译通过的证明。

底层修复包括初始化参数类型、播放音频会话、进入后台暂停、出错回调、释放委托以及关闭可能包含媒体访问令牌的 VLC 调试日志。iOS 桥接发出的时间值是**毫秒**，界面和 Jellyfin 进度使用秒/100ns ticks，已做转换。

## 必须完成的真机验收

参见 [DEVICE_TESTS.md](DEVICE_TESTS.md)。目前不承诺杜比视界、HDR 色彩、所有封装/字幕、4K 高码率流畅度、AirPlay、画中画或后台播放。AirPlay、画中画、离线下载尚未实现；后台策略是暂停。内嵌 ASS/PGS 交给 VLC；外挂文本字幕目前通过 Jellyfin 转成 VTT，样式可能丢失，外挂图片字幕尚未验证。

## 参考

- [VLC React Native 播放器及 Expo 集成](https://github.com/razorRun/react-native-vlc-media-player)
- [Expo 自定义原生开发构建](https://docs.expo.dev/develop/development-builds/introduction/)
- [Jellyfin 格式与转码说明](https://jellyfin.org/docs/general/clients/codec-support/)

项目引入的第三方组件保留各自许可证；VLC/VLCKit 的许可证与分发义务需要在对外分发前核实，当前目标为个人自用开发。

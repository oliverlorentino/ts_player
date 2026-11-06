# 把 Still 装到自己的 iPhone

首个原生 Release 包已构建成功。它包含应用代码和 VLC 内核，不需要电脑一直运行开发服务器。它仍是**未签名包**，需要用自己的 Apple ID 通过侧载工具签名。

## 安装包

- Windows 本机：`E:\ts_player\build\Still-unsigned.ipa`
- GitHub：[成功构建页面](https://github.com/oliverlorentino/ts_player/actions/runs/42241661114)，底部 Artifacts → `Still-iPhone-unsigned`，下载 ZIP 后解压得到 IPA。GitHub 制品约在 2026-11-13 23:30（北京时间）过期；本机文件不受此期限影响。
- 版本：0.1.0；arm64 真机；最低 iOS 15.1；包标识：`com.still.personalplayer`。
- IPA SHA-256：`05d05858a3fb13195bb752f86848052aa171cef6fa129fde2295e40684dbb0fa`。

## 免费 Apple ID + Windows

1. 如果手机上还没有 AltStore Classic，按 [AltStore 的 Windows 官方安装说明](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) 配置 AltServer、iTunes/iCloud，并安装 AltStore 到手机。使用官方来源；按照设备提示信任电脑、开发者证书并开启开发者模式。
2. 将 `Still-unsigned.ipa` 传入 iPhone 的“文件”App。也可以在 iPhone 上登录 GitHub 后下载上述构建制品，再解压 ZIP。
3. 打开 AltStore → My Apps → `+`，选择 IPA，由 AltStore 使用你的 Apple ID 签名安装。账号和密码只输入签名工具，不放进源码、GitHub 或聊天。
4. 打开 Still，填写 Jellyfin 地址、用户名和密码。局域网连接时允许本地网络权限。

免费签名通常 7 天到期，需要通过 AltStore 刷新；自动刷新依赖 AltServer 的可连接状态。免费账号同时侧载的 App 数量受限制，见 [官方说明](https://faq.altstore.io/altstore-classic/your-altstore)。这一步不能通过直接点开 IPA 来跳过。

## 第一轮体验检查

先播放一个 MP4 和一个 MKV；测试左右拖动、左右双击、细进度条、音轨/字幕、退出后的继续观看。默认网络缓冲为 1.5 秒，可在设置调整。播放时单击才显示控件，拖动时隐藏控件。

当前验证覆盖云端编译和安装包结构，**尚未在你的 iPhone 上实测安装、HDR 显示或拖动性能**。详细检查项见 [DEVICE_TESTS.md](DEVICE_TESTS.md)。

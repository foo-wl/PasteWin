# 技术栈 — Paste for Windows

## 1. 推荐方案（Tauri 2）

| 层 | 选型 | 版本 | 说明 |
|---|---|---|---|
| 壳 | Tauri | 2.x | 安装包 ~10 MB，Windows 走 WebView2 |
| 核心 | Rust | 1.7x stable | 直调 Win32，无 GC 停顿 |
| Win32 | `windows` crate | 0.58+ | 剪贴板、热键、SendInput、Monitor |
| 前端 | React + TypeScript + Vite | 18 / 5 / 5 | 卡片流 UI |
| 样式 | Tailwind CSS | 3.x | 快速还原截图的渐变/纹理/圆角 |
| 状态 | Zustand | 4.x | 面板 UI 状态（选中、筛选、搜索） |
| 虚拟滚动 | `@tanstack/react-virtual` | 3.x | 横向虚拟化，支撑上万张卡片 |
| 图标 | `lucide-react` + 自家 App 图标映射 | — | 来源应用图标 |
| DB | SQLite via `rusqlite`（`bundled` 含 FTS5） | 0.32+ | WAL 模式 |
| 图片 | `image` crate | 0.25 | 缩略图生成（DIB→PNG/WebP） |
| 哈希 | `sha2` | 0.10 | 内容去重 |
| 日志 | `tracing` + `tracing-appender` | — | 滚动日志 |
| 插件 | `global-shortcut` `autostart` `single-instance` `updater` `store` `opener` | 2.x | 官方插件 |

### 初始化

```bash
# 需在 Windows 上执行（macOS 只能开发前端 + 交叉编译，剪贴板无法实测）
npm create tauri-app@latest paste-win -- --template react-ts
cd paste-win
npm i -D tailwindcss postcss autoprefixer
npm i zustand @tanstack/react-virtual lucide-react
```

```toml
# src-tauri/Cargo.toml 追加
[dependencies]
windows = { version = "0.58", features = [
  "Win32_System_DataExchange",   # 剪贴板
  "Win32_System_Memory",
  "Win32_System_Threading",
  "Win32_UI_Input_KeyboardAndMouse",
  "Win32_UI_WindowsAndMessaging", # 热键/SendInput/窗口
  "Win32_Graphics_Gdi",
  "Win32_Foundation",
] }
rusqlite = { version = "0.32", features = ["bundled", "chrono"] }
image = "0.25"
sha2 = "0.10"
```

## 2. 备选方案（WPF / .NET 8）

| 层 | 选型 | 说明 |
|---|---|---|
| 运行时 | .NET 8 + WPF | `PublishSingleFile` + `PublishTrimmed` |
| Win32 | `P/Invoke` / `CsWin32` 源生成器 | 剪贴板、热键、SendInput |
| MVVM | CommunityToolkit.Mvvm | — |
| DB | `Microsoft.Data.Sqlite` + FTS5 | 同上 |
| 图片 | `SixLabors.ImageSharp` | 缩略图 |
| UI | 自绘 `ItemsControl` + `VirtualizingStackPanel` | 卡片流需手写样式与动画 |

适用条件：团队更熟 C#、不接受 WebView2 依赖、要求单文件绿色版。

## 3. 明确不选

| 方案 | 否决原因 |
|---|---|
| Electron | 常驻 180–300 MB 内存，与"后台常驻工具"定位冲突 |
| WinUI 3 | 打包/部署链路复杂，社区坑多，收益不抵成本 |
| Python + Qt | 分发体积大、启动慢、Win32 调用绕 |
| 键盘钩子实现热键 | 杀软误报 + 全局性能损耗 |

## 4. 开发环境要求

| 项 | 要求 |
|---|---|
| OS | Windows 10 1809+ / Windows 11（**当前工作机是 macOS，需补 Windows 环境**） |
| 构建 | Rust toolchain (MSVC target)、Node 20+、Visual Studio Build Tools（C++ 桌面 workload） |
| 测试机 | 建议 Parallels / VMware + Win11（ARM 版注意 `windows` crate 与 x64 交叉编译差异），或一台实体机/云主机 |
| 交叉编译 | macOS 上可用 `cargo-xwin` 编出 x64 产物用于 CI 验证，但**无法实测剪贴板与热键** |

## 5. CI/CD

```
push tag v*  → GitHub Actions (windows-latest)
  ├─ cargo fmt / clippy / test
  ├─ npm run build
  ├─ tauri build  → MSI + NSIS
  ├─ 签名（cert in secrets）
  └─ 上传 Release + latest.json（自动更新清单）
```

## 6. 许可证与合规注意

- SQLite 为 public domain；Rust 生态多为 MIT/Apache-2.0。
- 不复制 Paste 的图标、字体与美术资源；UI 布局参考属功能性设计，视觉需自行重绘。
- 若商用，代码签名证书为必需支出项。

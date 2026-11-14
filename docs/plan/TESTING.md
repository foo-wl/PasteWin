# 构建与测试闭环（无 Windows 开发机方案）

> 现状：开发机是 macOS（Intel i7-8850H），测试机是一台独立的 Win11。
> 结论：**不在本地编 Windows 包，全部交给 GitHub Actions 的 `windows-latest` 云端构建**，你只负责下载安装包 + 人工验收。

## 1. 为什么不用本地交叉编译

| 方案 | 可行性 | 问题 |
|---|---|---|
| macOS + `cargo-xwin` 交叉编译 | 理论可行 | 需装 Rust + Windows SDK/CRT(≈1GB) + LLVM + NSIS；`sqlx` 的 bundled SQLite 需 clang-cl 交叉编译 C 代码；Intel Mac 全量 release 构建 15–25 分钟/次，失败点分散 |
| 本地装 Rust 直编 mac 版看效果 | 部分可行 | mac 版走的是另一套 `cfg(target_os)` 分支，验不出 Windows 的剪贴板/UIPI/窗口行为 |
| **GitHub Actions `windows-latest`** | ✅ | 真 Windows 环境、原生 MSVC 工具链、缓存后 ~6–10 分钟/次、公开仓库免费无限 |

## 2. 一次性准备

本地仓库已就绪：`Paste/pastepaw/`（上游 v1.6.0 内容 + 改造过的 CI，已初始化 git，1 个基线 commit）。

**第 1 步 · 建仓库**：GitHub 网页 → New repository → 名称自定（如 `pastepaw`）→ **Public** → **不要**勾选 Add README / .gitignore / license → Create。

**第 2 步 · 推上去**：

```bash
cd /Users/wanglei/works/projects/private/AI/WorkBuddy/Working/Paste/pastepaw
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

首次 push 需输入 GitHub 用户名 + **Personal Access Token**（Settings → Developer settings → Tokens (classic) → 勾 `repo` + `workflow`）。密码方式已不支持。

装了 GitHub CLI 则更省事：`brew install gh && gh auth login`，然后 `gh repo create <名字> --public --source=. --push`。

**第 3 步 · 等构建**：push 后仓库 Actions 页自动跑 `build-windows`，约 6–10 分钟（首次无缓存约 12 分钟）。

**第 4 步 · 取包**：Actions → 最新 run → 页面底部 Artifacts → `pastepaw-x64-<sha>.zip` → 解压得 `PastePaw_1.6.0_x64-setup.exe`（约 3.7 MB）。

**第 5 步 · 传 Win11 测试**：U 盘/微信/网盘均可，装完按 §5 清单逐项验收。

后续迭代：改完代码 `git add -A && git commit -m "..." && git push`，重复第 3–5 步。

其余可选配置：

1. Settings → Actions → General → Workflow permissions 选 **Read and write**（之后打 tag 发 Release 需要）
2. 阶段 D 再配置签名密钥，A–C 阶段不要：
   - `pnpm tauri signer generate -w ~/.tauri/pastepaw.key`
   - Secrets 添加 `TAURI_SIGNING_PRIVATE_KEY`（文件内容）与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - 同时把 `tauri.conf.json` 的 `bundle.createUpdaterArtifacts` 改回 `true`，`updater.endpoints` 换成自己仓库的 `latest.json`

## 3. 出包与下载

```
git push                     → Actions 自动构建 → Artifacts → 下载 zip
git tag v0.1.0 && git push --tags → 构建 + 自动挂到 Release
```

- Actions 页面 → 目标 run → 底部 **Artifacts** → `pastepaw-x64-<sha>.zip`
- 解压得到 `PastePaw_x.y.z_x64-setup.exe`（NSIS，约 3.7 MB）
- Artifact 需登录 GitHub 才能下（私有库）；公开库的 Release 资源可直接下载

## 4. Win11 上安装

1. 若本机装过官方 PastePaw，**先卸载**（fork 版 identifier 已改，但阶段 A 未改前会冲突）
2. 双击 setup.exe；SmartScreen 提示「Windows 已保护你的电脑」→ 更多信息 → 仍要运行（未签名必然出现）
3. 首次启动后确认托盘图标存在、`Ctrl+Shift+V` 能呼出面板
4. WebView2：Win11 自带，无需安装；Win10 旧版若报错，装 Evergreen Runtime

## 5. 首轮验收清单（基线）

在 Win11 上逐项勾，任何一项失败都截图 + 记日志：

- [ ] 托盘图标存在，右键菜单有 Show / Quit
- [ ] `Ctrl+Shift+V` 呼出，再按一次隐藏；Esc 隐藏
- [ ] 复制一段中文文本 → 面板出现卡片，来源 App 图标正确
- [ ] 复制图片（截图工具）→ 卡片显示缩略图，粘贴回画图/微信正常
- [ ] 从 Chrome 复制带格式文本 → 粘贴到 Word 保留格式
- [ ] `←` `→` 切换选中，`Enter` 粘贴到原窗口（含 VS Code、记事本、PowerShell）
- [ ] `Delete` 删除、`P` 键（预期无效，记录现状）
- [ ] `Ctrl+F` 搜索，中文子串能命中
- [ ] 多显示器：鼠标在副屏时热键，面板出现在副屏
- [ ] 密码管理器（如 Bitwarden）复制 → 不产生记录
- [ ] 连续快速复制 5 次 → 不重复、不乱序
- [ ] 关闭再启动 → 历史仍在
- [ ] 卸载后无残留进程

## 6. 反馈怎么给

每次报问题请带四样：

1. **现象 + 复现步骤**（越短越好：1. 打开 X 2. 复制 Y 3. 按 Z）
2. **截图**（面板状态、错题弹窗）
3. **日志**：`%APPDATA%\PastePaw\logs\`（未改 identifier 前）；改之后在你自己的目录下。整个目录打包
4. **环境**：Win11 版本号、x64/ARM64、显示器数量与缩放比例

## 7. 已知限制（不必当 bug 报）

| 现象 | 原因 |
|---|---|
| 粘不进「以管理员运行」的程序 | UIPI 完整性隔离，需应用自身提权 |
| 首次运行 SmartScreen 警告 | 未购买代码签名证书 |
| 复制文件（资源管理器）不产生记录 | 上游未实现 `CF_HDROP`，改造项 B2 |
| 历史超过一万条后搜索变慢 | 上游用 `LIKE '%q%'` 全表扫，改造项 B3 |
| 按 `P` 没反应 | 上游 `clips` 表缺 `is_pinned` 列，改造项 C1 |

## 8. 迭代节奏

```
改代码(mac) → push → CI 构建(8min) → 下载 exe → Win11 安装验收 → 回传问题
```

- 纯 UI 样式改动可在 mac 上 `pnpm dev` 用浏览器预览（Tauri API 会报错，仅看布局与配色）
- 涉及剪贴板/热键/窗口/粘贴的改动**必须**走完整闭环，浏览器预览验不出来

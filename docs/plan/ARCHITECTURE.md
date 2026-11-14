# 架构设计 — Paste for Windows

## 1. 进程与线程模型

```
PasteWin.exe
├─ Tauri 主线程         事件循环、窗口管理、托盘
├─ Clipboard Watcher    专用线程：创建 message-only 窗口，跑 GetMessage 循环
│                       （AddClipboardFormatListener → WM_CLIPBOARDUPDATE）
├─ Storage Worker       独立线程或 tokio 任务：写库、生成缩略图、清理
└─ WebView2 (UI 进程)   面板 / 设置 / 预览
```

关键原则：
- **剪贴板读取绝不阻塞 UI**。`WM_CLIPBOARDUPDATE` 里只做"取 sequence number + 置标志"，实际解析交给 worker，避免长时间 `OpenClipboard` 占用导致其他程序粘贴失败。
- **写入前自标记**：`let mut expected_seq`，写完记录序列号，下一个 `WM_CLIPBOARDUPDATE` 若匹配则丢弃。
- **面板窗口常驻隐藏**，唤起只做 show + position + focus，保证 120ms 内可见（不重建 WebView）。

## 2. 模块划分

| 模块 | 职责 | 关键 API / crate |
|---|---|---|
| `clipboard::watcher` | 监听变更事件 | `AddClipboardFormatListener`, `WM_CLIPBOARDUPDATE` |
| `clipboard::reader` | 解析各格式 | `GetClipboardData`, `CF_UNICODETEXT` `HTML Format` `Rich Text Format` `CF_DIBV5` `CF_HDROP` |
| `clipboard::writer` | 回写多格式 | `OpenClipboard`(重试) → `EmptyClipboard` → `SetClipboardData` |
| `storage` | SQLite 读写、FTS5、blob 仓 | `rusqlite` (bundled + fts5) |
| `hotkey` | 全局热键注册与冲突检测 | `RegisterHotKey` / `WM_HOTKEY` |
| `injector` | 焦点恢复 + 模拟粘贴 | `GetForegroundWindow` `SetForegroundWindow` `SendInput` |
| `policy` | 黑名单、去重、长度阈值 | `GetWindowThreadProcessId` + `QueryFullProcessImageNameW` |
| `window` | 无边框面板、定位、失焦隐藏、多屏 DPI | `MonitorFromPoint` `GetCursorPos`、Tauri window API |
| `tray` | 托盘图标与菜单 | `tauri::tray` |
| `settings` | 配置持久化 | JSON 文件（`%APPDATA%\PasteWin\config.json`） |

## 3. IPC 契约（前端 ←→ Rust）

```ts
// commands
listItems({ pinboardId?, query?, kind?, limit, cursor })  -> Item[]
pasteItem({ id, plainText: boolean, targetHwnd })         -> { ok }
deleteItem({ id })                                        -> void
togglePin({ id })                                         -> Item
createPinboard({ name, color, icon })                     -> Pinboard
moveItem({ id, pinboardId })                              -> void
updateSettings({ patch })                                 -> Settings
exportData({ path })                                      -> void

// events (Rust -> UI)
'clipboard:new'    { item }         // 新条目，面板可见时增量插入
'clipboard:update' { id, useCount }
'panel:shown'      { targetHwnd }   // 面板打开时带上目标窗口句柄
'stack:advance'    { index, total }
```

- 列表分页用 cursor（`created_at + id`），不用 offset，避免大表跳页慢。
- 图片以 `asset://` 协议读本地缩略图，不走 base64 IPC。

## 4. 数据流

**捕获**
```
用户 Ctrl+C
  → WM_CLIPBOARDUPDATE
  → 取 sequence number → 与 expected_seq 比对（相等则忽略）
  → 取前台窗口 exe → 黑名单？
  → worker: 枚举格式 → 解析 → 计算 hash → 查重
      ├ 命中: UPDATE use_count+1, created_at
      └ 未命中: 写 blob 文件 + INSERT items + items_fts
  → emit 'clipboard:new'
```

**粘贴**
```
热键 / 托盘
  → 记录 targetHwnd = GetForegroundWindow()
  → show panel（定位到光标所在屏，居上 1/4）
用户 Enter
  → 从 DB 取完整内容（含 html/rtf/blob）
  → OpenClipboard 重试 → 写入全部格式
  → 隐藏面板 → SetForegroundWindow(targetHwnd)
  → Sleep(30ms) → SendInput(Ctrl+V)
  → UPDATE used_at, use_count
```

## 5. 存储布局

```
%LOCALAPPDATA%\PasteWin\
├─ paste.db            # SQLite（WAL 模式）
├─ blobs\
│  ├─ ab\abc123.png    # 原图，按 hash 分两级目录
│  └─ thumbs\abc123.webp
└─ logs\
%APPDATA%\PasteWin\config.json
```

SQLite 设置：`journal_mode=WAL`、`synchronous=NORMAL`、`cache_size=-16000`（16 MB）。
清理任务：每小时检查条数/天数/总体积，按 `created_at` 升序删除（`pinned=1` 永不删）。

## 6. 关键技术难点与对策

### 6.1 富文本保真
`HTML Format` 不是裸 HTML，而是带 `Version:0.9 / StartHTML / EndHTML / StartFragment / EndFragment` 头的偏移式结构，且不同应用填充的偏移存在偏差。对策：
- 读取时解析头，取 `[StartFragment, EndFragment)` 区间作为片段；`EndHTML` 越界则回退到整段。
- 回写时自己生成规范的 `HTML Format`（UTF-8 + 正确的 10 位定宽偏移）。
- RTF 直接透传字节，不改写。

### 6.2 延迟渲染（Delay Render）
部分应用（如 Office）用 `SetClipboardData(fmt, NULL)` 声明格式，实际数据在 `WM_RENDERFORMAT` 时提供。对策：单次捕获时对已知格式尝试读取，读取失败且 `IsClipboardFormatAvailable` 为真则跳过该格式，只保留能拿到的（通常是 `CF_UNICODETEXT`）。

### 6.3 UIPI 提权粘贴
Windows 的完整性级别隔离使普通进程无法向管理员窗口发送输入。对策（三选一，已排优先级）：
1. 文档化限制 + 面板内明确提示（默认方案，零成本）。
2. 提供"以管理员身份重启"菜单项（`ShellExecuteEx` + `runas`），用户自行承担。
3. 可选安装 `PasteWinService`（SYSTEM 权限）代为注入（成本高，二期评估）。

### 6.4 热键冲突
`RegisterHotKey` 失败返回具体原因；启动时对候选组合做批量探测，把可用组合推荐给用户。禁止用 `SetWindowsHookEx(WH_KEYBOARD_LL)` 实现，避免杀软误判与性能损耗。

### 6.5 多显示器与 DPI
面板定位：`GetCursorPos` → `MonitorFromPoint(MONITOR_DEFAULTTONEAREST)` → 用该显示器 work area 计算位置；跨屏 DPI 变化需 `WM_DPICHANGED` 处理（Tauri 侧监听 `scaleFactorChanged` 重算尺寸）。

## 7. 测试策略

| 层次 | 手段 |
|---|---|
| 单元 | 剪贴板格式解析（HTML header 偏移、RTF 透传、DIB→PNG）、去重哈希、清理策略 —— 用真实样本字节做 fixture |
| 集成 | 在 Windows CI / VM 上跑"复制→捕获→粘贴"端到端脚本（PowerShell 设置剪贴板 → 调用 CLI 断言 DB） |
| UI | Playwright 驱动 WebView（mock IPC）验证键盘导航与卡片渲染 |
| 手工 | 目标应用矩阵：Chrome / Edge / Word / Excel / VS Code / Explorer / 微信 / Terminal |

## 8. 打包与分发

- 安装器：NSIS（`tauri build`），per-machine 安装到 `%ProgramFiles%`，per-user 数据。
- 签名：OV/EV 代码签名证书，否则 SmartScreen 首次运行有强警告。
- 更新：`tauri-plugin-updater` + `latest.json`（GitHub Releases 或自托管）。
- 卸载：保留用户数据目录（询问是否一并删除）。

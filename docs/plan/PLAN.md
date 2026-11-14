# Paste for Windows — 开发计划

> 目标：在 Windows 10/11 上复刻 macOS Paste 的核心体验（剪贴板历史 + 卡片面板 + Pinboards + 极速粘贴），并在 Windows 平台能力上做增强。
> 参考截图：[docs/assets/reference-paste-macos.png](docs/assets/reference-paste-macos.png)

---

## 1. 产品定位

| 项 | 内容 |
|---|---|
| 一句话 | 按一下热键，过去复制过的一切以卡片流呈现，选中即粘贴 |
| 目标用户 | 开发者、文案、运营、设计等高频复制场景的重度键鼠用户 |
| 核心价值 | 零打断：热键 → 视觉检索 → 一键粘贴，全程不离开键盘 |
| 差异化 | Win 原生富文本/文件/图片捕获保真；本地优先、可加密、无云依赖 |
| 非目标（首版） | 跨设备云同步、协作共享、AI 摘要改写 |

对 macOS Paste 的取舍：**保留卡片横向流 + Pinboard 分组 + 键盘直选**这套交互骨架；**去掉** iCloud 依赖和订阅模型；**补充** Windows 特有的文件/多格式剪贴板处理。

---

## 2. 功能清单

详见 [docs/FEATURES.md](docs/FEATURES.md)。优先级速览：

### P0 — MVP 必须（缺一不可用）

| # | 功能 | 说明 |
|---|---|---|
| 1 | 常驻后台 + 托盘 | 托盘菜单：暂停记录 / 清空历史 / 设置 / 退出 |
| 2 | 全局热键唤起面板 | 默认 `Ctrl+Shift+V`，可自定义，首次启动做冲突检测 |
| 3 | 剪贴板捕获 | 文本 / 富文本(HTML+RTF) / 图片(DIB/PNG) / 文件列表(CF_HDROP) |
| 4 | 内容去重 | 内容哈希去重，连续重复合并并累加使用次数 |
| 5 | 卡片面板 UI | 复刻截图：横向卡片、彩色 header、来源 App 图标、字符数、选中高亮 |
| 6 | 键盘操作 | ←/→ 移动、Enter 粘贴、`Ctrl+1..9` 直选、Esc 关闭、直接输入即搜索 |
| 7 | 回写并粘贴 | 恢复前台窗口 → 写剪贴板 → SendInput `Ctrl+V` |
| 8 | 纯文本粘贴 | `Ctrl+Enter` 剥离格式后粘贴 |
| 9 | 全文搜索 | SQLite FTS5（中文用 trigram tokenizer 支持子串） |
| 10 | 持久化 + 保留策略 | 按条数/天数/体积上限自动清理 |
| 11 | 应用排除黑名单 | 密码管理器、银行类默认排除，不记录 |
| 12 | 设置页 | 热键、保留策略、主题、开机自启、排除列表、存储路径 |
| 13 | 主题 | 跟随系统 + 手动亮/暗 |
| 14 | 工程化 | 单实例、开机自启、安装包（MSI/NSIS）、无边框圆角窗口 |

### P1 — 体验补齐

Pinboards（多钉板/自定义颜色图标/`Tab` 切换/拖拽归档）、Snippets（常用片段模板）、Paste Stack（队列依次粘贴）、多选批量操作、类型智能识别（链接/颜色/代码/路径）、大图预览、自动更新、数据导入导出。

### P2 — 增强

云同步（WebDAV/OneDrive）、团队共享钉板、脚本扩展、高级搜索语法（`app:` `type:` `before:`）、拖拽导出到资源管理器、多语言。

---

## 3. 技术选型

| 方案 | 包体积 | 常驻内存 | 剪贴板/热键 | UI 复刻难度 | 结论 |
|---|---|---|---|---|---|
| **Tauri 2 + Rust + React/TS** | 8–15 MB | 60–90 MB | 优秀（windows-rs 直调 Win32） | 低（CSS 还原卡片流） | **推荐** |
| WPF / .NET 8 | 60 MB（self-contained）/ 15 MB（框架依赖） | 40–60 MB | 优秀（P/Invoke） | 高（需自绘卡片与动画） | 备选 |
| WinUI 3 | 30 MB+ | 60–90 MB | 良好 | 中（控件现代但打包/稳定性坑多） | 不推荐 |
| Electron | 90 MB+ | 180–300 MB | 一般（需 native 模块） | 最低 | 不推荐（常驻工具内存敏感） |

**主方案：Tauri 2 + Rust + React 18 + TypeScript + Tailwind + SQLite(rusqlite bundled)**

理由：
1. 常驻后台的第一硬指标是内存，Rust 主进程 + WebView2 共享运行时，空闲 60–90 MB。
2. 剪贴板监听、全局热键、UIPI 提权粘贴都必须直调 Win32，Rust `windows-rs` 无中间层。
3. 卡片流 UI 是 CSS 密集型（渐变、纹理、圆角、动画），Web 前端 1:1 复刻成本最低。

依赖基线：Windows 10 1809+ / Windows 11，WebView2 已随系统预装（旧版 Win10 由安装器引导下载）。

详见 [docs/TECH-STACK.md](docs/TECH-STACK.md)。

---

## 4. 架构

```
┌─────────────────────────── Tauri App ───────────────────────────┐
│  WebView (React)                                                │
│   ├─ Panel   卡片流 / 搜索 / 键盘导航                             │
│   ├─ Settings 设置 / 排除列表 / 快捷键                            │
│   └─ Preview 大图 / 富文本预览                                    │
│              ▲  Tauri IPC (invoke / event)                      │
│  Rust Core                                                      │
│   ├─ clipboard   监听线程 (WM_CLIPBOARDUPDATE) + 格式解析/写回      │
│   ├─ storage     SQLite + FTS5 + 图片文件仓 + 清理任务             │
│   ├─ hotkey      RegisterHotKey + 冲突检测                       │
│   ├─ injector    焦点恢复 + SendInput 粘贴 (+ 提权 helper)         │
│   ├─ window      无边框面板定位（跟随光标所在屏） / 失焦隐藏 / 托盘   │
│   └─ policy      黑名单 / 去重 / 敏感内容过滤                       │
└─────────────────────────────────────────────────────────────────┘
```

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 5. 数据模型（SQLite）

```sql
items(id, kind, text, html, rtf, blob_path, thumb_path, hash,
      source_app, source_exe, source_title, pinned, pinboard_id,
      char_count, byte_size, created_at, used_at, use_count)
pinboards(id, name, color, icon, sort_order, hotkey)
snippets(id, name, content, hotkey)
excluded_apps(exe_name, display_name)
settings(key, value)
items_fts  -- FTS5(text, tokenize='trigram')
```

- 图片/大对象走文件仓 `%LOCALAPPDATA%\PasteWin\blobs\`，DB 只存路径 + 哈希，避免 DB 膨胀。
- 默认保留 10,000 条 / 90 天，可配置。

---

## 6. 关键技术与风险

| 主题 | 方案 | 风险 |
|---|---|---|
| 剪贴板监听 | `AddClipboardFormatListener` + 独立消息循环窗口；**不用轮询** | 低 |
| 自触发死循环 | 写入前打标记 + 比对 `GetClipboardSequenceNumber` 忽略自身写入 | 中（易漏判） |
| 富文本碎片化 | 直接读 `HTML Format`(CF_HTML) / `Rich Text Format` 原始字节，按规范裁剪 header 偏移 | 中（Word/Chrome/Excel 各不相同） |
| 延迟渲染 | 检测 `SetClipboardData(NULL)` 的 owner，需发 `WM_RENDERFORMAT` 才能取到数据 | 中 |
| 粘贴到管理员窗口 | UIPI 拦截：提供"以管理员身份运行"选项 + 可选提权 helper | 高（无法完全规避，需文档说明） |
| 全局热键 | `RegisterHotKey`，失败即提示冲突并引导更换；**不用键盘钩子**（杀软敏感） | 中（`Win+V` 被系统占用，不可用） |
| 中文搜索 | FTS5 `trigram` tokenizer（SQLite ≥ 3.34）支持任意子串 | 低 |
| 性能 | 热键→面板可见 < 120ms；捕获落库 < 20ms；10 万条查询 < 50ms | 中 |
| 杀软误报 | 不使用 SetWindowsHookEx / 进程注入；代码签名（EV 或 OV 证书） | 高（无签名必报 SmartScreen） |
| 开发环境 | 当前为 macOS，需 Windows 11 机器或 VM 做编译与剪贴板实测 | **高（阻塞项）** |

---

## 7. 里程碑

假设单人全职，Windows 环境就绪为前提。

| 阶段 | 产出 | 验收标准 |
|---|---|---|
| **M0 骨架**（3 天） | Tauri 2 工程、无边框窗口、托盘、单实例、GitHub Actions 交叉编译 | 双击运行出托盘，热键能呼出一个空面板 |
| **M1 剪贴板内核**（5 天） | 监听/解析/去重/写回/粘贴注入/热键 | 复制任意内容 → 面板出现卡片 → 选中回贴到目标窗口，全类型跑通 |
| **M2 存储与搜索**（5 天） | SQLite schema、FTS5、blob 仓、清理任务 | 重启后历史仍在；中文/英文子串搜索命中 |
| **M3 主界面**（8 天） | 卡片流复刻、键盘导航、搜索栏、筛选、暗色主题、多屏定位 | 与参考截图观感一致；纯键盘完成全流程 |
| **M4 组织能力**（5 天） | Pinboards、Snippets、拖拽归档 | 多钉板切换、颜色自定义、快捷键归档 |
| **M5 设置与隐私**（4 天） | 排除黑名单、保留策略、开机自启、导入导出、加密选项 | 密码管理器内容不落库 |
| **M6 发布**（3 天） | MSI/NSIS 安装包、自动更新、签名、首启引导 | 干净 Win11 虚拟机安装→使用→卸载无残留 |

**总计约 33 个工作日（6.5–7 周）**；若只求可用 MVP：M0+M1+M3 = **约 3 周**。

并行建议：UI 可在 M1 期间用 mock 数据先行开发（前端与 Rust 用 IPC 契约解耦）。

---

## 8. 目录结构（规划）

```
Paste/
├─ PLAN.md                 # 本文件
├─ README.md
├─ docs/
│  ├─ FEATURES.md          # 功能详细清单与交互规格
│  ├─ ARCHITECTURE.md      # 模块划分、数据流、IPC 契约
│  ├─ TECH-STACK.md        # 选型对比与依赖清单
│  └─ assets/              # 设计参考图
├─ src/                    # React 前端
│  ├─ components/Card.tsx  # 卡片（header/body/footer）
│  ├─ views/Panel.tsx
│  ├─ views/Settings.tsx
│  └─ lib/ipc.ts
└─ src-tauri/
   ├─ src/clipboard/
   ├─ src/storage/
   ├─ src/hotkey.rs
   ├─ src/injector.rs
   └─ src/window.rs
```

---

## 9. 待拍板决策

1. **技术栈**：确认 Tauri 2（推荐）还是 WPF / .NET？
2. **Windows 环境**：有实体 Win11 机器 / Parallels+Win11 ARM / 云主机？（无此环境则 M1 无法验证）
3. **提权粘贴**：是否接受"需以管理员运行才能粘到管理员窗口"的限制？
4. **默认热键**：`Ctrl+Shift+V`（可能抢浏览器纯文本粘贴）还是 `Alt+V` / `Ctrl+\``？
5. **定位**：个人工具 / 开源（GitHub）/ 商用（需签名证书 ¥1–3k/年）？
6. **云同步**：本期是否纳入范围（默认 P2，不做）？

---

## 10. 参考实现调研：XueshiQiao/PastePaw

> 调研日期 2026-11-14。仓库 <https://github.com/XueshiQiao/PastePaw>，GPL-3.0，164 ★ / 9 fork，v1.6.0（2026-11-01）。

**结论：这是一个与本计划技术栈完全同构的成熟实现（Tauri 2 + Rust + React 18 + TS + SQLite + Tailwind），已覆盖 P0 的约 80%。**

### 覆盖情况

| 本计划 P0 项 | PastePaw | 备注 |
|---|---|---|
| 托盘常驻 | 未验证 | 有 `show_window` / `hide_window`，README 未提托盘 |
| 全局热键 | ✅ | 默认 `Ctrl+Shift+V`，可自定义 |
| 文本 / HTML / RTF / 图片捕获 | ✅ | 富文本受 `preserve_formatting` 开关控制 |
| **文件列表 CF_HDROP** | ❌ | 源码中无 `CF_HDROP` / `DragQueryFile` |
| 哈希去重 | ✅ | `content_hash` + 稳定哈希 + 自身粘贴忽略 |
| 卡片面板 | ✅ | 横向卡片流（`react-window` Grid 单行，210px 卡片 + 16px 间距，`scrollToColumn` 跟随）|
| 键盘直选 `Ctrl+1..9` | ❌ | 仅 ↑↓ / Enter / Delete / P / Ctrl+F |
| 回写粘贴 | ✅ | 用 `Shift+Insert`（终端兼容），图片由前端 `navigator.clipboard.write` 写入 |
| **全文搜索** | ⚠️ | `LIKE '%q%'` 全表扫描，**无 FTS5**，10 万条会明显慢 |
| **保留策略** | ❌ | 无自动过期清理，仅手动清空/去重 |
| 应用黑名单 | ✅ | exe 名 + 全路径双粒度，大小写不敏感 |
| 设置页 / 主题 / 多屏 | ✅ | Mica 效果、跟随光标所在显示器 |
| 安装包 / 自动更新 / winget | ✅ | 3.7 MB，`winget install XueshiQiao.PastePaw` |

额外具备：AI 动作（OpenAI/DeepSeek 兼容，摘要/翻译/解释代码/修语法）、文件夹分组（含颜色与图标）、幽灵剪贴板过滤、无限滚动。

### 可复用的工程结论（已验证有效，直接吸收）

1. **图片剪贴板写入放在前端**：Rust 后台线程写图片会触发 `OSError 1418`（线程未持有剪贴板），改由 WebView2 的 `navigator.clipboard.write` 写图片 Blob，Rust 只负责落库与触发粘贴。
2. **粘贴用 `Shift+Insert` 而非 `Ctrl+V`**：`Ctrl+V` 在 PowerShell / WSL / VS Code 终端发送控制字符，`Shift+Insert` 兼容性最好。
3. **事件触发瞬间抓来源应用**：在剪贴板变更回调里立刻 `GetClipboardOwner` + 取 exe，不能等异步落库时再取前台窗口（此时已切换）。
4. **幽灵剪贴板过滤**：`GetClipboardOwner` 为空时视为其他剪贴板工具的"幽灵复制"，按设置丢弃。
5. **150ms 防抖 + 原子计数器**丢弃过期事件，避免连续复制时乱序写入。

### 与本计划的差异（即差异化空间）

~~横向卡片流视觉~~ **（已具备，先前判断有误，实际是 `react-window` Grid 单行横向）**、文件类型支持、FTS5 检索、自动保留策略、Snippets、Paste Stack、多选批量、`Ctrl+数字` 直选、`P` 置顶实际无效（`clips` 表无 `is_pinned` 列）。

### 三条路线

| 路线 | 成本 | 代价 |
|---|---|---|
| A. 直接用 / 参与上游 | 0 | 无差异化；功能缺口（文件、搜索、保留策略）依赖上游 |
| B. Fork 后改造 | 低（1–1.5 周） | **GPL-3.0 传染**：衍生作品分发必须同样开源；不可闭源商用 |
| C. 从零实现（本计划） | 3–7 周 | 自持代码与许可证，可自由商业化 |

选 B 还是 C 取决于分发意图：内部自用 / 开源 → B 更快；闭源或商用 → 必须 C（或自研，仅借鉴公开思路，不复制代码）。

> **决策（2026-11-14）：走路线 B —— fork 后二次开发，自用 + GPL-3.0 开源发布。**
> 具体改造清单、许可证合规、上游同步策略见 [FORK-PLAN.md](FORK-PLAN.md)。本文档 §5–§7 保留作为"若从零重做"的参考基线。

---

*创建于 2026-11-14 · 基于 macOS Paste 交互参考 + Windows 平台能力重设计*

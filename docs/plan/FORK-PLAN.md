# 二次开发计划（基于 PastePaw）

> 决策：Fork `XueshiQiao/PastePaw`（GPL-3.0）→ 自用 + 开源发布到 GitHub。
> 前置结论：上游比预期完整得多，**不需要重写**，改造量约 8–9 个工作日。

## 0. 执行进度

| 时间 | 事项 | 状态 |
|---|---|---|
| 11-14 | 产品名定为 **PasteWin** | ✅ |
| 11-14 | 源码落地 `Paste/pastepaw/`（tarball 方式，git clone 被限速到 16KB/s） | ✅ |
| 11-14 | 基线提交 `7304e16`（上游 v1.6.0 原样） | ✅ |
| 11-14 | 品牌重命名 + 移除遥测 + 切断上游更新源 | ✅ 提交 `7954ec1` |
| 11-14 | 前端 `tsc --noEmit` 类型检查 | ✅ 0 error |
| 11-14 | 建 GitHub 仓库 `foo-wl/Pastewin` | ✅ |
| 11-14 | 首次 push | ⚠️ **推错了**：`git init` 建在父目录 `Paste/`，只把计划文档推上去，源码成了指向本地提交的 submodule 指针（远端无代码、无 workflow、CI 未触发） |
| 11-14 | 纠正：仓库根 = 应用源码，计划文档归档到 `docs/plan/` | ✅ |
| 11-14 | 阶段 B-1：`Ctrl+1..9` 直选 + 卡片数字角标 + 输入框焦点保护 | ✅ `9f53968` |
| 11-14 | 阶段 B-2：`P` 键置顶（`is_pinned` 列 + `toggle_pin` 命令 + 置顶优先排序 + 卡片钉图标） | ✅ |
| 待办 | `git push --force` 覆盖远端错误历史（GitHub 暂不可达，暂停） | ⬜ |
| 待办 | Win11 装机验收（`docs/TESTING.md` §5 清单） | ⬜ |
| 待办 | 阶段 B-3：文件类型 `CF_HDROP` → FTS5 → 保留策略 | ⬜ |

**已完成的改名范围**：`productName` / 窗口标题 / crate 名 / `identifier`（`com.pastewin.app`）/ 数据目录（`PasteWin/images`）/ assetProtocol scope / 托盘 tooltip 与菜单 / 单实例通知 / 自身进程排除（`PasteWin.exe`）/ 前端 i18n 5 语言 / localStorage key / 设置页 About 区 / 调试假数据 / README 中英双版。

**遥测清理**：`tauri-plugin-aptabase` 依赖、`capabilities` 权限、`Builder::new("A-US-2920723583")`、`track_event("startup")` 全部移除，`grep` 复核无残留（仅 `Cargo.lock` 与 `gen/schemas` 生成物保留旧条目，cargo 构建时会自动刷新）。

**更新通道**：`bundle.createUpdaterArtifacts` → `false`（无自有签名密钥），`updater.endpoints` → `example.invalid`（原指向作者 releases，会把你推回官方版并覆盖安装）。阶段 D 再换成自己的 minisign 公钥与 `latest.json`。


---

## 1. 上游真实形态（读源码核实，非 README）

| 方面 | 实际实现 | 文件 |
|---|---|---|
| 列表布局 | **已经是横向卡片流**：`react-window` 的 `Grid` 单行横向，卡片 210px + 16px 间距，`scrollToColumn` 平滑跟随选中项 | `frontend/src/components/ClipList.tsx` |
| 窗口 | 1920×540 无边框透明横条、`skipTaskbar`、`visible:false`，从屏幕下缘 150ms 滑入（15 步 `SetWindowPos`） | `src-tauri/tauri.conf.json`、`lib.rs::animate_window_show` |
| 卡片 | 来源 App 图标 + 名称、复制按钮、内容预览、footer 显示字符数/图片大小、选中态描边 + 光晕 | `ClipCard.tsx` |
| 托盘 | ✅ `TrayIconBuilder`，随系统主题换图标，菜单 Show/Quit | `lib.rs` |
| 单实例 | ✅ `tauri_plugin_single_instance` | `lib.rs` |
| 开机自启 | ✅ `tauri_plugin_autostart` | `lib.rs` |
| 热键 | ✅ `global_shortcut`，切换式（可见且聚焦→隐藏，否则弹出） | `lib.rs` |
| 失焦隐藏 | ✅ 500ms 防抖 + 动画锁 + 跨屏自动跟随 | `on_window_event` |
| 多显示器 | ✅ 光标所在屏，宽度 = 工作区 − 边距×2 | `get_monitor_at_cursor` |
| 剪贴板 | 文本 / HTML / RTF / 图片；150ms 防抖、稳定哈希、幽灵复制过滤、黑名单双粒度 | `clipboard.rs` |
| 分组 | 文件夹（含 color/icon），非 Pinboard | `folders` 表 |
| 键盘 | Esc / Ctrl+F / Delete / P / ←→ / Enter | `hooks/useKeyboard.ts` |
| AI | OpenAI 兼容（摘要/翻译/解释代码/修语法） | `ai.rs` |

**注意：我先前说"纵向列表"是错的**，`App.tsx` 里 `onNavigateLeft/Right` + `Grid.scrollToColumn` 证明是横向。原计划里"重写卡片流"这一项可以整个删掉，省 1.5 周。

---

## 2. 缺口清单（改造对象）

| # | 缺口 | 证据 | 工作量 |
|---|---|---|---|
| 1 | **文件类型 `CF_HDROP` 不支持** | `clipboard.rs` 无 `CF_HDROP`/`DragQueryFileW` | 1.5–2 天 |
| 2 | **搜索用 `LIKE '%q%'`**，无 FTS5，全表扫描 | `commands.rs::search_clips` | 1 天 |
| 3 | **无自动保留策略**，历史无限增长 | `commands.rs` 只有手动清空 | 0.5 天 |
| 4 | ~~**无 `Ctrl+1..9` 直选**~~ **已实现**：`useKeyboard.onPasteIndex`，卡片 footer 显示 1–9 角标，输入框聚焦时屏蔽 | `useKeyboard.ts` / `App.tsx` / `ClipCard.tsx` | 已完成 |
| 5 | ~~**`P` 键置顶无效**~~ **已实现**：新增 `is_pinned` 列（`add_column_if_missing` 迁移）、`toggle_pin` 命令、`ORDER BY is_pinned DESC, created_at DESC`、卡片钉图标、右键菜单项 | `database.rs` / `commands.rs` / `models.rs` | 已完成 |
| 6 | 无 Snippets（片段模板） | 无 | 1.5 天 |
| 7 | 无 Paste Stack（队列粘贴） | 无 | 1 天 |
| 8 | 无多选批量 | 无 | 1 天 |

---

## 3. 第 0 步：fork 后当天必须做的清理（不做会出事）

| 项 | 现状 | 必须改成 | 后果 |
|---|---|---|---|
| `identifier` | `me.xueshi.pastepaw` | `你的域名.pastepaw-fork` 或 `com.<you>.xxx` | 与本机已装官方版**冲突覆盖** |
| `productName` / 图标 | PastePaw | 你自己的名字 | 品牌与商标风险 |
| **更新源** | `endpoints` 指向原作者 `releases/latest/download/latest.json` + 原 pubkey | 换成你自己的仓库 + 重新生成 minisign 密钥 | 否则你的用户会收到**别人发布的更新**，等于远程代码执行后门 |
| **遥测** | `tauri-plugin-aptabase`，App Key `A-US-2920723583` | 移除依赖与 `track_event` 调用 | 你 fork 的用户数据会打到原作者账号 |
| `window-vibrancy` | git 依赖指向作者的 fork 仓库 | 换 crates.io 版本或 vendor | 上游删库即构建失败 |
| macOS 商店分支 | `feature = "app-store"` | 保留但默认关闭即可 | 编译条件已隔离，无需动 |
| 本地数据目录 | `$LOCALDATA/PastePaw/images` | 跟随新 identifier 自动变 | 旧数据不会自动迁移，自用可忽略 |

清理约 0.5–1 天。**这四件事（identifier / 更新源 / 遥测 / git 依赖）是 fork 的安全底线。**

---

## 4. 许可证合规（GPL-3.0，你已决定开源，完全兼容）

发布到 GitHub 时必须满足：

1. 保留 `LICENSE`（GPL-3.0 全文）与所有源文件头部的版权声明。
2. **显著标注修改**：README 顶部写「Fork of [XueshiQiao/PastePaw](...)，修改部分 © 你，GPL-3.0」，并在改动文件里注明修改日期（GPLv3 §5a 要求）。
3. 整体仍以 **GPL-3.0** 分发，提供完整源码，不得追加限制条款。
4. 不能用 MIT/Apache 重新授权；不能闭源分发（自用不受限，你已声明开源，无冲突）。
5. 保留原作者署名，不要暗示原作者为你的版本背书。

---

## 5. 改造路线

### 阶段 A · 清理与可构建（1 天）
Fork → clone → 改 identifier/名称/图标 → 移除 aptabase → 换更新源 → 在 Windows 上 `pnpm tauri dev` 跑通 → 提交一个 `chore: rebrand fork` commit。

### 阶段 B · 四个高性价比补齐（3–4 天）

**B1 `Ctrl+1..9` 直选**（2h，收益最高）
- `useKeyboard.ts` 加 `onPasteIndex?: (n: number) => void`，`if (/^[1-9]$/.test(e.key) && (e.ctrlKey || e.metaKey))`
- `App.tsx` 传入 `(n) => handlePaste(clips[n - 1]?.id)`
- `ClipCard` footer 左侧加序号（当前只有字符数），与 Paste 一致

**B2 文件类型 `CF_HDROP`**（1.5–2 天，最难）
- 读：`IsClipboardFormatAvailable(CF_HDROP)` → `GetClipboardData` → `DragQueryFileW` 枚举路径
- 存：`clip_type='files'`，`content` = paths 的 JSON 数组，`text_preview` = 文件名拼接；**不入 FTS 的内容列**
- 写：必须在 Rust 侧构造 `DROPFILES` + 双 `\0` 结尾的宽字符路径块，`GMEM_MOVEABLE` + `SetClipboardData(CF_HDROP)`。不能走前端 `navigator.clipboard.write`（Web 剪贴板不支持写文件供资源管理器粘贴）
- 写剪贴板要在**持有窗口的主线程**做，避免复现 `OSError 1418`
- UI：`ClipCard` 加文件类型分支（图标 + 前 3 个文件名 + 「等 N 个」），footer 显示文件数
- 单测：构造 3 条路径的 DROPFILES，dump 字节比对偏移

**B3 FTS5 全文检索**（1 天）
```sql
CREATE VIRTUAL TABLE clips_fts USING fts5(
  text_preview,
  content='clips', content_rowid='id',
  tokenize='trigram'          -- 中文可子串匹配，SQLite ≥ 3.34
);
-- 三个触发器同步 INSERT/UPDATE/DELETE
-- 首次迁移：INSERT INTO clips_fts(clips_fts) VALUES('rebuild');
```
- `search_clips` 改 `WHERE clips_fts MATCH ?`，用户输入用 `"…"` 包裹做 phrase 查询，转义内部双引号
- 保留 `LIKE` 作为降级路径（`MATCH` 语法错误时回退）
- 收益：10 万条从全表扫降到毫秒级

**B4 自动保留策略**（0.5 天）
- 设置项 `max_items`（默认 10000）/ `max_days`（默认 90）
- 每小时后台任务：先取待删 clip 的图片路径 → 删文件 → `DELETE FROM clips` → `cleanup_orphan_clip_image_files()`
- 直接复用现有 `delete_clip_image_file_by_uuid` 的删除顺序（该项目已踩过"事务 CASCADE 留孤儿文件"的坑）

### 阶段 C · 体验补齐（3–4 天，可分批发版）

| 项 | 做法 |
|---|---|
| `P` 键置顶修复 | `clips` 加 `is_pinned INTEGER DEFAULT 0`，列表与搜索排序改 `ORDER BY is_pinned DESC, created_at DESC` |
| Snippets | 新表 `snippets(id,name,content,hotkey)`；设置页新 tab；搜索框输入 `;name` 命中直接粘贴 |
| Paste Stack | 前端维护队列 id 列表 + 当前游标；每次热键弹出后 `Enter` 粘队首并前进；面板顶部显示 `2/5` |
| 多选批量 | `ClipList` 持 `Set<string>`，`Shift+点击` 区间、`Ctrl+点击` 加选，支持批量删除/移动文件夹/合并粘贴 |

### 阶段 D · 发布（0.5 天）
- GitHub Actions：`tags/v*` → windows-latest 构建 x64 + arm64 → 上传 Release + 生成 `latest.json`
- 自己的 minisign 公钥写回 `tauri.conf.json`
- README：截图、功能差异表（相对上游）、GPL 声明与上游链接
- 可选：无代码签名证书时，README 说明 SmartScreen 提示与 VirusTotal 链接

---

## 6. 工期

| 阶段 | 内容 | 工作日 |
|---|---|---|
| A | 清理 + 跑通 | 1 |
| B | 4 项核心补齐 | 3.5 |
| C | 4 项体验 | 3.5 |
| D | CI + 发布 | 0.5 |
| **合计** | | **约 8.5 天**（不含环境搭建） |

环境搭建另计 0.5–1 天：Windows 11（实体机或 Parallels）+ VS Build Tools（C++ 桌面）+ Rust MSVC + Node 18+/pnpm + WebView2。

> macOS 上只能跑 `pnpm dev` 看纯前端 UI（Tauri API 会报错），剪贴板/热键/窗口动画**必须 Windows 实测**。

---

## 7. 分支与上游同步

```
main        ← 你的发布分支（可随时构建）
upstream    ← git remote add upstream https://github.com/XueshiQiao/PastePaw.git
```
- 每月 `git fetch upstream && git merge upstream/main`，冲突集中在 `lib.rs` / `commands.rs`（你改动最多的地方）
- 把改造尽量收敛到**新增文件 + 少量钩子**：例如文件类型逻辑放 `clipboard_files.rs`、检索放 `search.rs`，减少与上游的冲突面
- 上游 0 open issues、单作者、更新节奏约 1–2 月一版，跟进成本低

---

## 8. 风险

| 风险 | 说明 | 对策 |
|---|---|---|
| identifier 冲突 | 与本机官方 PastePaw 互相覆盖安装 | 改 identifier 后再安装；卸载官方版 |
| 更新源遗漏 | 忘记改 `endpoints` → 收到他人更新 | 阶段 A 第一件事就改，CI 中断言 endpoint 含自己仓库名 |
| DROPFILES 写入踩坑 | 偏移/对齐错误导致资源管理器粘贴空 | 先写单测 + 在记事本/资源管理器双向验证 |
| 上游大重构 | 一次 merge 冲突面过大 | 收敛改动面 + 每季度 merge 一次 |
| 文件体积增长 | 图片+文件引用让 DB 膨胀 | B4 的保留策略必须与 B2 同期上线 |

---

*创建于 2026-11-14 · 基于 PastePaw v1.6.0 源码核实*

# 设计档案 / Planning Archive

这些是 PasteWin fork 立项与设计阶段的文档，保留在此作为决策记录。

> 注意：文档写于 fork 之前，其中的路径（如 `Paste/docs/TESTING.md`）对应当时的本地目录结构，
> 在本仓库中对应 `docs/plan/`。

| 文件 | 内容 |
|---|---|
| [PLAN.md](PLAN.md) | 从零重构方案的原始计划（后被 fork 方案取代，保留原因见其开头） |
| [FORK-PLAN.md](FORK-PLAN.md) | **实际执行计划**：上游代码核实结果、缺口清单、四阶段工期 |
| [FEATURES.md](FEATURES.md) | 功能明细：界面拆解、交互规格、验收标准、性能指标 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 架构设计：进程线程模型、模块划分、IPC 契约、Win32 难点对策 |
| [TECH-STACK.md](TECH-STACK.md) | 技术选型对比与依赖清单 |
| [TESTING.md](TESTING.md) | 手工测试清单（改代码后照着跑） |

## 与上游的关系

PasteWin 是 [XueshiQiao/PastePaw](https://github.com/XueshiQiao/PastePaw) 的 fork，
遵循 GPL-3.0。上述文档中关于上游实现的描述来自对 v1.6.0 源码的实际阅读，
如上游后续变动，以源码为准。

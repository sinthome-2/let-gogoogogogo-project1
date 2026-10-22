# AI 术语辞典 · 整改清单（总表）

> 定稿：2026-10-22 ｜ 共 **5 梯队 31 项** ｜ 来源合并：用户反馈 a–f + PM 走查 P1–P12 + DeepSeek 复查 R01–R22（已逐条实证/修正）
> 规则：按梯队顺序施工；开工前先查「轮子」列（搬/借鉴/自写三方评估）；完成一项把状态改为 ✅ 并补完成日期。

## 总览一张表

| 梯队 | # | 项目 | 内容摘要 | 来源 | 轮子 / 参考 | 预估 | 状态 |
|---|---|---|---|---|---|---|---|
| **A 合规与部署欠账** | A1 | 部署归一 | 删 deploy.yml 的 upload/deploy，降级为一致性检查（保留分支部署）；简化 ci-check.mjs 的 dist 逻辑；README 写明发布路径 | DS R01 | GitHub 官方文档（已用） | 2h | ⬜ |
| A | A2 | CI 门禁 | deploy 依赖 test job；**修正 README「CI 绿才会发布」错误陈述** | DS R02 | 无轮子 | 1h | ⬜ |
| A | A3 | 泄漏清理 | terms_contribution.json.json 移 docs/ 或删除；`git grep LENOVO` 全仓清扫 | DS R03 | 无轮子 | 30min | ⬜ |
| A | A4 | LICENSE | 根目录加 MIT LICENSE；README 注内容署名；满足 Apache-2.0 随附要求 | 我方 P7 | choosealicense 模板 | 30min | ⬜ |
| A | A5 | 404 页 | 404.html 带返回首页导航 | 我方 P9 | Pages 约定，自写 | 30min | ⬜ |
| **B 已上线 bug 与接缝** | B1 | PWA 修复 | SW 缓存版本改 terms.json 哈希注入；导航 network-first、静态资源 SWR；新增 manifest.webmanifest（192/512 icons） | DS R08=我方P8 | Workbox（MIT）vs 手写，开工评估二选一 | 4h | ⬜ |
| B | B2 | 主题跨页+FOUC | 抽 js/theme.js 三页共用；head 内联脚本防刷新白闪 | DS R07=反馈c | pico data-theme 机制（同构自写） | 2h | ⬜ |
| B | B3 | 焦点陷阱接线 | drawer 打开时激活仓库内死代码 focus-trap.js；Esc 回焦点；补 Tab 循环测试 | DS R06 | 自家模块 + WAI-ARIA dialog 模式 | 2h | ⬜ |
| B | B4 | 静态页三连 | ①相关词条锚文本 id→可读名 ②{{CITE_DATE}} 改「复制引用」按钮（不用时间戳，保幂等）③「被提及」反向 related（SPA+静态双端派生） | DS R04+R05+R11 | 无轮子；改 build-pages.mjs 一次重生成 156 页 | 4h | ⬜ |
| **C 数据补全批** | C1 | difficulty | 156 条填 beginner/intermediate/advanced；validate 加枚举校验；详情页显示难度 | DS R09=我方P1 | 无轮子 | 1d（内容） | ⬜ |
| C | C2 | nameZh/acronym | 脚本从 aliases 派生 nameZh；acronym 只填真缩写；重建拼音索引；搜索提权 | DS R10 | 无轮子 | 半天 | ⬜ |
| C | C3 | sources+外部参考 | 156 条补 sources≥1（只放链接）；详情页 Wikipedia/知网跳转（URL 模板零维护） | 我方P5=DS R14 | Wikipedia/知网 URL 约定 | 1d（内容） | ⬜ |
| C | C4 | tldr+深度化 | 全量 tldr 补齐；Top 30 定义 100–200 字+misconceptions≥2+sources≥1（上下限防注水）；覆盖率报告落 docs/ | DS R14（修正） | 无轮子 | 2d（内容） | ⬜ |
| C | C5 | 学习路径扩容 | 每步加 note+前置；路径加 audience/estimatedTime；可选步骤自测+进度 | 反馈d2 | freeCodeCamp/MDN 借鉴编排 | 半天（内容） | ⬜ |
| **D 用户可感功能** | D1 | 搜索容错 | 模糊匹配/suggest 增强 | 我方P2 | **Fuse.js（MIT,~10KB）优先评估**，自写距离兜底 | 半天 | ⬜ |
| D | D2 | 学习路径独立路由 | SPA 内 #paths 路由；词条页「返回路径」回跳 | 反馈d1 | 无轮子，复用 hash 路由 | 半天 | ⬜ |
| D | D3 | 闪卡修复+进度 | ①翻转改 grid 叠放修凸出 ②图标加文字提示 ③进度/得分面板 | 反馈a/b | MDN backface 模式；Anki 参考交互 | 半天 | ⬜ |
| D | D4 | 引用进互动版 | renderTermDetail 加引用块（与 citation.mjs 同源）+一键复制 | 反馈e=我方P6 | 复用自家 citation.mjs | 半天 | ⬜ |
| D | D5 | A–Z 全部词条页 | #/all 字母分组+锚点+计数；侧边栏入口 | DS R12 | Wikipedia glossary 版式参考 | 半天 | ⬜ |
| D | D6 | 收藏/已读/Anki | 词条页收藏+已读；#/starred 列表；Anki CSV 导出（UTF-8 BOM） | DS R13 | Anki 官方 CSV 规范 | 1天 | ⬜ |
| D | D7 | 交互细节 | 快捷键页面内提示；首页新手引导锚点 | 我方P3/P4 | 无轮子 | 1h | ⬜ |
| **E 视觉与架构** | E1 | 视觉改版 | 设计 token（间距/字号/圆角阴影）+页面壳统一+换肤；等用户投喂参考项目 | 反馈f=我方P12 | **Water.css/MVP.css/pico（均MIT）** | 1–2天 | ⬜ |
| E | E2 | 仓库改名 | GitHub 重命名（自动重定向），需 owner 决策 | 我方P10 | 无轮子 | 10min | ⬜ |
| **F 长期方向** | F1 | 正文自动内链 | definition/tldr 术语自动链（首次+上限3+不自链+不嵌套）；先做 SPA 端 | DS R15 | aho-corasick（npm,MIT,构建期） | 1天 | ⬜ |
| F | F2 | 对比页 | comparisons.json 人工策展 10 对，/vs/a-vs-b/ 静态页 | DS R16 | 无轮子 | 1天（内容为主） | ⬜ |
| F | F3 | 概念年表 | timeline.json 12–15 里程碑，#/timeline | DS R17 | 无轮子 | 半天 | ⬜ |
| F | F4 | 人话翻译层 | 每词 ≤40 字 plain callout，先 Top 30 | DS R18 | 无轮子 | 半天（内容） | ⬜ |
| F | F5 | 命令面板 | Cmd/Ctrl+K 聚合入口（搜索/最近/随机/路径/收藏） | DS R19 | cmdk/kbar 系 React 不适用，自写~100行 | 1天 | ⬜ |
| F | F6 | 质量仪表盘 | /stats 覆盖率可视化（复用 validate 数据源） | DS R20 | 无轮子 | 半天 | ⬜ |
| F | F7 | EPUB/PDF 导出 | build-epub.mjs，pandoc 串联，不进 CI | DS R21 | pandoc（本机已有） | 半天 | ⬜ |
| F | F8 | 英文版 | 缓做，等 C 批内容稳定后评估 | DS R22 | — | 未定 | ⬜ |

## 施工纪律（每条通用）

1. `pnpm test` 全绿（基线 113 条）+ `pnpm validate` 0 错误，方算完成。
2. 同梯队标「互斥/串行」的按顺序做；跨梯队可并行须触点不重叠（js/app.js 是热点，碰它一律串行）。
3. 数据红线：`data/terms.json` 已有 id/name 不改；新增内容必须原创；计数绝不硬编码。
4. 触 build-pages.mjs 的卡合并重生成静态页，一轮做完（B4 合并即为此）。

## 不做的

- 同时保留两套部署；为凑数造低质词条；引入运行时框架/TS/打包器；粗糙正则嵌套 `<a>`；F8 与 C 批并行；提交 dist/。

## 备忘（非施工项）

- commit 保留 `Co-Authored-By: Claude Code`（诚实），面试前准备 search.js 评分函数与 SW 缓存策略讲解。
- 分支部署公开托管仓库根目录（data/tests 可 URL 访问）＝与公开仓库等价，知悉即可。

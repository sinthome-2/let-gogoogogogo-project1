# AI 术语辞典

一个可长期维护的 **AI 术语互动辞典网站**，按三层结构收录人工智能领域的技术、使用与学术术语（词条数量以 `data/terms.json` 为准）。

- **Level 1（一级分类）**：技术、使用、学术
- **Level 2（二级子类）**：每个分类下的具体领域
- **Level 3（词条）**：具体术语，如 Skill、Harmfulness、Prompt 等

**在线地址**：<https://sinthome-2.github.io/let-gogoogogogo-project1/>

## 功能

- **层级浏览**：左侧边栏展示“技术 / 使用 / 学术”三大类及其子类，点击即可浏览词条卡片。
- **全局搜索**：顶部搜索框实时搜索词条名称、别名、定义、示例、速记与常见误解；支持多关键词 AND 与引号短语，支持拼音全拼与首字母匹配（如 `zhq` → Transformer）。
- **键盘流**：`/` 聚焦搜索框，`↑` `↓` 移动搜索结果高亮，`Enter` 打开，`Esc` 清空。
- **词条详情**：点击卡片进入详情页，展示定义、示例、相关词条、一句话速记、常见误解、参考来源、扩展阅读和面包屑导航。
- **学习路径**：首页提供「零基础入门 / 工程实践 / 学术纵深」三条 curated 学习路径，数据在 `data/learning-paths.json`。
- **闪卡练习**：`flashcards.html` 提供抽认卡自测，答错可回链词条复习。
- **随机一词**：搜索框旁 🎲 按钮随机跳转一个词条。
- **暗色模式**：跟随系统或手动切换，选择持久保存。
- **PWA 离线**：Service Worker 预缓存核心资源，离线可浏览（sw.js 派生自 GoogleChrome/samples，Apache-2.0）。
- **SEO 静态页**：每个词条有独立的静态详情页（`term/<id>/`），附 sitemap.xml 与 JSON-LD。
- **URL 状态保持**：详情页和分类页通过 hash 路由记录状态，刷新或分享链接后可恢复。

## 快速开始

### 方式一：直接打开

双击 `index.html`。注意：部分浏览器在 `file://` 协议下会限制本地 JSON 加载，遇到问题请用方式二。

### 方式二：本地服务器（推荐）

```bash
python -m http.server 8000
# 然后访问 http://localhost:8000
```

### 方式三：Node 环境

```bash
pnpm install
pnpm test        # 单元测试
pnpm validate    # 校验词条数据（悬空引用、别名冲突等）
pnpm index       # 重建拼音索引 data/term-index.json
pnpm build       # 重建静态词条页 term/ 与 sitemap.xml
```

## 项目结构

```
├── index.html / flashcards.html   # 入口页与闪卡页
├── css/style.css                  # 页面样式（CSS 变量双主题）
├── js/                            # 原生 JS：app/search/utils/drawer/focus-trap/flashcard
├── data/                          # 内容数据：categories / terms / term-index / learning-paths
├── term/<id>/index.html           # 生成的静态词条页（pnpm build 产物，勿手改）
├── sw.js                          # Service Worker（离线缓存）
├── tools/                         # 构建与校验脚本
├── tests/                         # Vitest 测试（含 axe 可访问性检查）
├── .github/workflows/             # CI（测试+校验）与 Pages 部署
├── docs/PROJECT_DOC.md            # 架构说明，可 pandoc 导出 项目代码.docx
└── README.txt                     # 初始想法记录（历史文件，无说明含义）
```

## 添加新词条

1. 复制 `data/_todo/_template.json` 中的模板对象，追加到 `data/terms.json` 的 `terms` 数组。
2. `category` / `subcategory` 必须是 `data/categories.json` 里已有的 id；`related` / `related_reading` 必须指向已存在的词条 id。
3. 释义必须原创或已获授权，勿直接复制受版权保护的文本。
4. 跑 `pnpm validate` 确认零错误，再 `pnpm index && pnpm build` 重建索引与静态页。

也可以直接开 Issue：仓库自带「词条请求」模板（.github/ISSUE_TEMPLATE/）。

## 测试与部署

- `pnpm test`：全量测试（搜索、渲染、可访问性、构建产物一致性、搬运源比对等）。
- `pnpm validate`：数据质量红线，悬空引用与别名冲突必须为 0。
- push 到 `main` 自动触发 CI（测试 + 校验）与 GitHub Pages 部署；CI 绿才会发布。

## 技术栈

- HTML5 + CSS3 + 原生 JavaScript，零运行时依赖、零构建步骤
- JSON 数据（内容与展示分离）
- Vitest + vitest-axe（测试）、pinyin-pro（仅 devDep，拼音索引）
- GitHub Actions（CI + Pages 部署）

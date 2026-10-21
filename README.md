# AI 术语辞典

一个可长期维护的 **AI 术语互动辞典网站**，按三层结构收录人工智能领域的技术、使用与学术术语。

- **Level 1（一级分类）**：技术、使用、学术
- **Level 2（二级子类）**：每个分类下的具体领域
- **Level 3（词条）**：具体术语，如 Skill、Harmfulness、Prompt 等

## 快速开始

### 方式一：直接打开

双击 `index.html`，或在浏览器地址栏输入：

```
D:\project1\index.html
```

> 注意：部分浏览器在 `file://` 协议下会限制本地 JSON 加载。如果遇到问题，请使用方式二。

### 方式二：本地服务器（推荐）

在项目根目录运行：

```bash
python -m http.server 8000
```

然后访问：

```
http://localhost:8000
```

## 项目结构

```
D:\project1
├── index.html              # 入口页面
├── css/style.css           # 页面样式
├── js/app.js               # 主逻辑：导航、渲染、路由
├── js/search.js            # 搜索评分模块
├── data/categories.json    # Level 1 / Level 2 分类体系
├── data/terms.json         # Level 3 词条数据
├── docs/PROJECT_DOC.md     # 项目说明与核心代码片段
├── 项目代码.docx           # 由 PROJECT_DOC.md 导出的 Word 文档
├── .gitignore              # Git 忽略规则
└── README.txt              # 初始想法记录（历史文件）
```

## 功能

- **层级浏览**：左侧边栏展示“技术 / 使用 / 学术”三大类及其子类，点击即可浏览词条卡片。
- **全局搜索**：顶部搜索框实时搜索词条名称、别名、定义、示例、速记与常见误解；支持多关键词 AND 与引号短语，支持拼音全拼与首字母匹配。
- **词条详情**：点击卡片进入详情页，展示定义、示例、相关词条、一句话速记、常见误解、参考来源、扩展阅读和面包屑导航。
- **URL 状态保持**：详情页和分类页通过 hash 路由记录状态，刷新或分享链接后可恢复。

## 添加新词条

1. 打开 `data/terms.json`。
2. 在 `terms` 数组中新增一个对象：

```json
{
  "id": "new-term-id",
  "name": "术语英文名",
  "category": "technical",
  "subcategory": "model-architecture",
  "aliases": ["中文别名一", "中文别名二"],
  "definition": "术语的完整解释。",
  "examples": ["示例一", "示例二"],
  "related": ["related-term-id"],
  "tldr": "一句话速记（可选）。",
  "misconceptions": ["常见误解一", "常见误解二"],
  "sources": [
    { "title": "来源标题", "url": "https://example.com" }
  ],
  "related_reading": ["existing-term-id"]
}
```

3. `category` 和 `subcategory` 必须与 `data/categories.json` 中的 `id` 一致；新字段全部可选，旧词条不填时渲染与之前完全一致。
4. 保存后刷新浏览器即可看到新词条。

## 更新项目代码.docx

当 `docs/PROJECT_DOC.md` 更新后，运行：

```bash
pandoc docs/PROJECT_DOC.md -o 项目代码.docx
```

## 测试

项目使用 [Vitest](https://vitest.dev/) 进行单元测试。

```bash
pnpm install
pnpm test
```

```bash
# 校验词条数据
pnpm validate

# 重建拼音索引
pnpm index
```

搜索覆盖名称、别名、定义、示例、速记、误解与来源标题；支持多关键词 AND、`"quoted phrase"` 短语匹配，以及拼音全拼与首字母匹配（如 `zhq` → Transformer）。

## 技术栈

- HTML5
- CSS3
- 原生 JavaScript
- JSON 数据
- Pandoc（用于生成 Word 文档）

## 后续演进

- 词条数量增多后，将 `terms.json` 拆分为每个词条一个 Markdown 文件。
- 引入 Eleventy / Astro 等静态站点生成器。
- 搜索引入 Fuse.js 或 Pagefind，支持模糊匹配和高亮。

# AI 术语互动辞典 —— 项目文档

> 本文档是 `D:\project1` 的项目说明，记录架构、文件职责与核心代码片段。可通过 Pandoc 导出为 `项目代码.docx`：
>
> ```bash
> pandoc docs/PROJECT_DOC.md -o 项目代码.docx
> ```

## 1. 项目目标

建立一个可长期维护的 **AI 术语互动辞典网站**，按三层结构组织内容：

- **Level 1（一级分类）**：技术、使用、学术
- **Level 2（二级子类）**：在一级分类下展开的具体领域
- **Level 3（词条）**：具体术语，例如 Skill、Harmfulness、Prompt 等

网站需支持：层级浏览、全局搜索、词条详情展示、URL 状态保持。

## 2. 技术选型

- **HTML5** + **CSS3** + **原生 JavaScript**：零构建步骤，直接用浏览器打开 `index.html` 即可运行。
- **JSON** 作为数据格式：内容（数据）与展示（页面）分离，便于长期更新和后续迁移。
- **Pandoc**：用于把本文档导出为 `项目代码.docx`。

当未来词条量增大时，可平滑迁移到 Eleventy、Astro 等静态站点生成器。拼音索引通过 `pnpm index` 重新生成，搜索支持拼音全拼与首字母匹配。

## 3. 文件结构

```
D:\project1
├── index.html              # 入口页面
├── css
│   └── style.css           # 页面样式
├── js
│   ├── app.js              # 主逻辑：导航、渲染、路由
│   └── search.js           # 搜索评分模块
├── data
│   ├── categories.json     # Level 1 / Level 2 分类体系
│   └── terms.json          # Level 3 词条数据
├── docs
│   └── PROJECT_DOC.md      # 本说明文档
├── .gitignore              # Git 忽略规则
├── README.txt              # 初始想法记录
└── 项目代码.docx           # 由 Pandoc 从本文件生成
```

## 4. 数据 schema

### 4.1 `data/categories.json`

定义分类层级，每个一级分类包含若干二级子类：

```json
{
  "categories": [
    {
      "id": "technical",
      "name": "技术",
      "description": "与 AI 系统实现、训练、部署、安全相关的术语。",
      "subcategories": [
        { "id": "model-architecture", "name": "模型架构", "description": "..." }
      ]
    }
  ]
}
```

### 4.2 `data/terms.json`

词条采用平铺数组，通过 `category` 和 `subcategory` 字段挂接到层级，便于搜索。字段分为必填与可选两类，所有可选字段缺失时旧词条渲染保持不变：

```json
{
  "terms": [
    {
      "id": "skill",
      "name": "Skill",
      "category": "technical",
      "subcategory": "model-architecture",
      "aliases": ["能力", "技能"],
      "definition": "模型在特定任务上表现出的稳定能力...",
      "examples": ["代码生成 skill", "多语言翻译 skill"],
      "related": ["capability", "fine-tuning"],
      "tldr": "一句话速记（可选）",
      "misconceptions": ["常见误解一", "常见误解二"],
      "sources": [
        { "title": "来源标题", "url": "https://example.com" }
      ],
      "related_reading": ["existing-term-id"]
    }
  ]
}
```

可选字段说明：

- `tldr`：字符串，一句话速记。
- `misconceptions`：字符串数组，常见误解。
- `sources`：对象数组，每项必须包含 `title` 和 `url` 字符串。
- `related_reading`：字符串数组，扩展阅读词条 id；不存在的 id 会渲染为"待收录"。

## 5. 核心代码

### 5.1 `index.html`

页面骨架：顶部搜索栏、左侧分类导航、主内容区。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 术语辞典</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="site-header">
    <div class="brand">
      <h1>AI 术语辞典</h1>
      <span class="subtitle">技术 · 使用 · 学术</span>
    </div>
    <div class="search-box">
      <input type="search" id="searchInput" placeholder="搜索术语、别名、定义…">
    </div>
  </header>

  <div class="layout">
    <aside class="sidebar" id="sidebar"></aside>
    <main class="content" id="content"></main>
  </div>

  <script src="js/search.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

### 5.2 `js/search.js`

不依赖外部库的搜索评分模块：

```javascript
const Search = (function () {
  function normalize(text) {
    return String(text || '').toLowerCase().trim();
  }

  function scoreTerm(term, query) {
    const q = normalize(query);
    if (!q) return { match: false, score: 0 };

    const name = normalize(term.name);
    const aliases = (term.aliases || []).map(normalize).join(' ');
    const definition = normalize(term.definition);

    let score = 0;
    if (name === q) score += 100;
    else if (name.startsWith(q)) score += 75;
    else if (name.includes(q)) score += 50;

    if (aliases.includes(q)) score += 30;
    if (definition.includes(q)) score += 10;

    return { match: score > 0, score };
  }

  function search(terms, query) {
    if (!query || !query.trim()) return [];
    return terms
      .map(term => ({ term, result: scoreTerm(term, query) }))
      .filter(item => item.result.match)
      .sort((a, b) => b.result.score - a.result.score)
      .map(item => item.term);
  }

  return { search };
})();
```

### 5.3 `js/app.js`

主应用逻辑负责：加载 JSON、渲染侧边栏、处理路由、渲染详情与搜索结果。

关键路由约定：

- `#term/skill` → 显示 Skill 详情
- `#category/technical/model-architecture` → 显示“模型架构”子类词条
- `#search/skill` → 显示搜索结果
- 空 hash → 欢迎页

核心片段：

```javascript
async function init() {
  const [catRes, termRes] = await Promise.all([
    fetch('data/categories.json'),
    fetch('data/terms.json')
  ]);
  const catData = await catRes.json();
  const termData = await termRes.json();
  state.categories = catData.categories;
  state.terms = termData.terms;

  renderSidebar();
  setupSearch();
  setupRouting();
  handleHash();
}

function handleHash() {
  const hash = decodeURIComponent(location.hash.replace(/^#\/?/, '')).trim();
  if (!hash) { renderHome(); return; }

  const parts = hash.split('/');
  switch (parts[0]) {
    case 'term': renderTermDetail(parts[1]); break;
    case 'category': renderSubcategory(parts[1], parts[2]); break;
    case 'search': renderSearchResults(parts[1]); break;
    default: renderHome();
  }
}
```

### 5.4 `css/style.css`

页面使用 CSS 变量统一配色，固定左侧边栏，主内容区自适应：

```css
:root {
  --bg: #f8f9fa;
  --surface: #ffffff;
  --text: #1f2937;
  --primary: #2563eb;
  --sidebar-width: 260px;
  --header-height: 64px;
}

.layout {
  display: flex;
  padding-top: var(--header-height);
  min-height: 100vh;
}

.sidebar {
  width: var(--sidebar-width);
  position: fixed;
  top: var(--header-height);
  bottom: 0;
  left: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
}

.content {
  flex: 1;
  margin-left: var(--sidebar-width);
  padding: 28px 32px;
}
```

## 6. 如何添加新词条

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

3. `category` 和 `subcategory` 必须与 `data/categories.json` 中的 `id` 一致；`tldr`、`misconceptions`、`sources`、`related_reading` 为可选字段，缺失不影响旧词条渲染。
4. 保存后刷新浏览器即可看到新词条。

## 7. 如何预览

### 方式一：直接打开（部分浏览器可能受限）

双击 `index.html`，或在浏览器地址栏输入：

```
D:\project1\index.html
```

### 方式二：本地服务器（推荐）

在项目根目录运行：

```bash
python -m http.server 8000
```

然后访问：

```
http://localhost:8000
```

## 8. 后续演进方向

- 词条数量增多后，将 `terms.json` 拆分为每个词条一个 Markdown 文件。
- 引入 Eleventy / Astro 生成静态页面，提升 SEO 和加载性能。
- 搜索引入 Fuse.js 或 Pagefind，支持模糊匹配和高亮。
- 增加标签云、词条编辑表单、Dark Mode 等功能。

## 9. 记录

- 创建日期：2026-10-14
- Demo 版词条：共 101 个，覆盖技术、使用、学术三大分类
- 涵盖范围：高普及度术语（LLM、Transformer、Token、Prompt Engineering、RAG、Agent、AGI 等）以及部分进阶/不常用术语（MoE、Constitutional AI、Chinese Room、Cybernetics 等）

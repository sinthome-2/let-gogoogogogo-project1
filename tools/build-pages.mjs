/**
 * 静态词条页生成器
 * 读取 terms.json / categories.json，生成 SEO 友好的纯静态词条页、
 * sitemap.xml、robots.txt 与 .nojekyll。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatGbt7714, formatApa } from './citation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasChinese(text) {
  return /[一-龥]/.test(String(text || ''));
}

function getDescription(term) {
  if (term.tldr) return term.tldr;
  const def = String(term.definition || '').trim();
  if (def.length <= 80) return def;
  return def.slice(0, 80) + '…';
}

function truncateForTitle(name, chineseAlias) {
  const suffix = '是什么？— AI 术语辞典';
  if (chineseAlias) {
    return `${name}（${chineseAlias}）${suffix}`;
  }
  return `${name}${suffix}`;
}

function buildCategoryMaps(categories) {
  const catMap = new Map();
  const subMap = new Map();
  for (const cat of categories || []) {
    catMap.set(cat.id, cat.name);
    for (const sub of cat.subcategories || []) {
      subMap.set(`${cat.id}/${sub.id}`, sub.name);
    }
  }
  return { catMap, subMap };
}

function buildTermPage(term, categories, base, termIdSet) {
  const { catMap, subMap } = buildCategoryMaps(categories);
  const categoryName = catMap.get(term.category) || term.category;
  const subcategoryName = subMap.get(`${term.category}/${term.subcategory}`) || term.subcategory;
  const pageBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const canonicalUrl = `${pageBase}/term/${term.id}/`;

  const chineseAlias = (term.aliases || []).find(hasChinese);
  const titleText = truncateForTitle(term.name, chineseAlias);
  const descriptionText = getDescription(term);
  const descriptionHtml = escapeHtml(descriptionText);

  const examplesHtml = term.examples && term.examples.length
    ? `<h2>示例</h2>\n<ul>\n${term.examples.map(ex => `  <li>${escapeHtml(ex)}</li>`).join('\n')}\n</ul>`
    : '';

  const relatedHtml = term.related && term.related.length
    ? `<h2>相关词条</h2>\n<ul class="related-list">\n${term.related.map(id => {
        const exists = termIdSet.has(id);
        if (exists) {
          return `  <li><a href="${pageBase}/term/${id}/">${escapeHtml(id)}</a></li>`;
        }
        return `  <li>${escapeHtml(id)}<small>（待收录）</small></li>`;
      }).join('\n')}\n</ul>`
    : '';

  const ldJson = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term.name,
    description: descriptionText,
    inLanguage: 'zh-CN',
    url: canonicalUrl,
    isPartOf: {
      '@type': 'DefinedTermSet',
      name: 'AI 术语辞典',
      url: `${pageBase}/`
    }
  };
  const ldScript = JSON.stringify(ldJson, null, 2).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titleText)}</title>
  <meta name="description" content="${descriptionHtml}">
  <meta property="og:title" content="${escapeHtml(titleText)}">
  <meta property="og:description" content="${descriptionHtml}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="${pageBase}/assets/favicon.svg">
  <link rel="canonical" href="${canonicalUrl}">
  <script type="application/ld+json">\n${ldScript}\n  </script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 24px; color: #1f2937; }
    .breadcrumb { font-size: 0.9rem; color: #6b7280; margin-bottom: 16px; }
    .breadcrumb a { color: #2563eb; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    h1 { margin: 0 0 8px; font-size: 1.8rem; }
    .chinese-name { color: #6b7280; margin-bottom: 20px; }
    h2 { font-size: 1.1rem; margin: 28px 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    ul { padding-left: 22px; }
    li { margin-bottom: 6px; }
    .related-list a { color: #2563eb; text-decoration: none; }
    .related-list a:hover { text-decoration: underline; }
    .related-list small { color: #6b7280; margin-left: 4px; }
    .interactive-link { display: inline-block; margin-top: 28px; padding: 8px 16px; background: #2563eb; color: #fff; border-radius: 6px; text-decoration: none; }
    .interactive-link:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <nav class="breadcrumb">
    <a href="${pageBase}/">${escapeHtml(categoryName)}</a> › ${escapeHtml(subcategoryName)} › ${escapeHtml(term.name)}
  </nav>

  <h1>${escapeHtml(term.name)}</h1>
  ${chineseAlias ? `<div class="chinese-name">${escapeHtml(chineseAlias)}</div>` : ''}

  <h2>定义</h2>
  <p>${escapeHtml(term.definition)}</p>

  ${examplesHtml}

  ${relatedHtml}

  <a class="interactive-link" href="${pageBase}/#term/${term.id}">打开交互版</a>

  <details id="citation">
    <summary>引用本文</summary>
    <pre>${escapeHtml(formatGbt7714({ name: term.name, url: canonicalUrl, date: '{{CITE_DATE}}' }))}</pre>
    <button type="button" data-copy>复制 GB/T 7714</button>
    <pre>${escapeHtml(formatApa({ name: term.name, url: canonicalUrl, date: '{{CITE_DATE}}' }))}</pre>
    <button type="button" data-copy>复制 APA</button>
  </details>

  <script>
    document.querySelectorAll('button[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pre = btn.previousElementSibling;
        const text = pre.textContent.replace(/{{CITE_DATE}}/g, new Date().toLocaleDateString('sv'));
        navigator.clipboard.writeText(text).catch(err => console.warn('复制失败', err));
      });
    });
  </script>
</body>
</html>
`;
}

function buildSitemap(sortedTerms, base) {
  const pageBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const urls = sortedTerms.map(term => `  <url>\n    <loc>${pageBase}/term/${term.id}/</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildRobots(base) {
  const pageBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `User-agent: *\nAllow: /\nSitemap: ${pageBase}/sitemap.xml\n`;
}

/**
 * 纯函数：根据词条与分类数据生成静态文件内容映射。
 * @param {Object} options
 * @param {Array<Object>} options.terms 词条数组
 * @param {Array<Object>} options.categories 分类数组
 * @param {string} [options.base='/let-gogoogogogo-project1'] 站点根路径
 * @returns {{files: Object<string, string>}}
 */
export function buildPages({ terms, categories, base = '/let-gogoogogogo-project1' }) {
  const sortedTerms = (terms || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const termIdSet = new Set(sortedTerms.map(t => t.id));

  const files = {};
  for (const term of sortedTerms) {
    const path = `term/${term.id}/index.html`;
    files[path] = buildTermPage(term, categories, base, termIdSet);
  }

  files['sitemap.xml'] = buildSitemap(sortedTerms, base);
  files['robots.txt'] = buildRobots(base);
  files['.nojekyll'] = '';

  return { files };
}

function main() {
  const termsPath = join(__dirname, '..', 'data', 'terms.json');
  const categoriesPath = join(__dirname, '..', 'data', 'categories.json');

  const termsData = JSON.parse(readFileSync(termsPath, 'utf8'));
  const categoriesData = JSON.parse(readFileSync(categoriesPath, 'utf8'));

  const base = process.env.PAGES_BASE !== undefined ? process.env.PAGES_BASE : '/let-gogoogogogo-project1';
  const { files } = buildPages({
    terms: termsData.terms,
    categories: categoriesData.categories,
    base
  });

  const rootDir = join(__dirname, '..');
  const termDir = join(rootDir, 'term');

  if (existsSync(termDir)) {
    rmSync(termDir, { recursive: true, force: true });
  }

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(rootDir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }

  const termCount = Object.keys(files).filter(p => p.startsWith('term/') && p.endsWith('/index.html')).length;
  console.log(`Generated ${termCount} term pages, sitemap.xml, robots.txt, .nojekyll`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

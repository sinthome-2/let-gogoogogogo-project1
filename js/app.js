/**
 * AI 术语辞典 — 主应用逻辑
 * 负责加载数据、渲染导航、处理路由和交互。
 */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('Service Worker 注册失败', err);
      });
    });
  }

  const state = {
    categories: [],
    terms: [],
    index: null
  };

  const els = {
    sidebar: document.getElementById('sidebar'),
    content: document.getElementById('content'),
    searchInput: document.getElementById('searchInput')
  };

  // ===== 数据加载 =====

  async function init() {
    try {
      const [catRes, termRes] = await Promise.all([
        fetch('data/categories.json'),
        fetch('data/terms.json')
      ]);

      if (!catRes.ok) throw new Error(`无法加载 categories.json（${catRes.status}）`);
      if (!termRes.ok) throw new Error(`无法加载 terms.json（${termRes.status}）`);

      const catData = await catRes.json();
      const termData = await termRes.json();

      state.categories = catData.categories || [];
      state.terms = termData.terms || [];

      // 建立子类 id → 中文名映射，并注入词条，用于搜索
      const subcategoryMap = new Map();
      for (const category of state.categories) {
        for (const sub of category.subcategories || []) {
          subcategoryMap.set(sub.id, sub.name);
        }
      }
      for (const term of state.terms) {
        term._subcategoryName = subcategoryMap.get(term.subcategory) || '';
      }

      try {
        const idxRes = await fetch('data/term-index.json');
        if (idxRes.ok) {
          const idxData = await idxRes.json();
          state.index = idxData.terms || null;
        }
      } catch (err) {
        console.warn('拼音索引加载失败，搜索将不使用拼音索引', err);
      }

      renderSidebar();
      setupSearch();
      setupRouting();
      handleHash();
    } catch (err) {
      console.error(err);
      els.content.innerHTML = `
        <div class="error">
          <strong>加载数据失败</strong>
          <p>${escapeHtml(err.message)}</p>
          <p>如果直接通过 <code>file://</code> 协议打开，部分浏览器会阻止本地文件请求。建议运行一个本地服务器：</p>
          <pre><code>python -m http.server 8000</code></pre>
          <p>然后在浏览器中访问 <code>http://localhost:8000</code>。</p>
        </div>
      `;
    }
  }

  // ===== 数据查询辅助 =====

  function getCategory(id) {
    return state.categories.find(c => c.id === id);
  }

  function getSubcategory(categoryId, subcategoryId) {
    const category = getCategory(categoryId);
    if (!category) return null;
    return category.subcategories.find(s => s.id === subcategoryId);
  }

  function getTerm(id) {
    return state.terms.find(t => t.id === id);
  }

  function getTermsBySubcategory(categoryId, subcategoryId) {
    return state.terms.filter(t =>
      t.category === categoryId && t.subcategory === subcategoryId
    );
  }

  // ===== 渲染：侧边栏 =====

  function renderSidebar() {
    els.sidebar.innerHTML = '';

    const totalTerms = state.terms.length;
    const sortedCategories = state.categories.slice().sort((a, b) => {
      const ao = a.order === undefined ? Infinity : a.order;
      const bo = b.order === undefined ? Infinity : b.order;
      return ao - bo;
    });

    sortedCategories.forEach(category => {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'nav-category';
      categoryEl.dataset.categoryId = category.id;

      const termCount = state.terms.filter(t => t.category === category.id).length;
      const icon = category.icon ? `${category.icon} ` : '';
      const toggle = document.createElement('button');
      toggle.className = 'nav-category-toggle';
      toggle.innerHTML = `
        <span>${icon}${escapeHtml(category.name)} (${termCount}/${totalTerms})</span>
        <span class="arrow" aria-hidden="true">▶</span>
      `;
      toggle.addEventListener('click', () => {
        categoryEl.classList.toggle('open');
      });

      const subList = document.createElement('ul');
      subList.className = 'nav-subcategory-list';

      category.subcategories.forEach(sub => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.textContent = sub.name;
        btn.dataset.categoryId = category.id;
        btn.dataset.subcategoryId = sub.id;
        btn.addEventListener('click', () => {
          location.hash = `#category/${category.id}/${sub.id}`;
        });
        li.appendChild(btn);
        subList.appendChild(li);
      });

      categoryEl.appendChild(toggle);
      categoryEl.appendChild(subList);
      els.sidebar.appendChild(categoryEl);
    });
  }

  function updateSidebarActive(categoryId, subcategoryId) {
    // 重置所有激活状态
    els.sidebar.querySelectorAll('.nav-category').forEach(cat => {
      cat.classList.remove('open');
      cat.querySelector('.nav-category-toggle').classList.remove('active');
    });
    els.sidebar.querySelectorAll('.nav-subcategory-list button').forEach(btn => {
      btn.classList.remove('active');
    });

    if (!categoryId) return;

    const categoryEl = els.sidebar.querySelector(`.nav-category[data-category-id="${categoryId}"]`);
    if (categoryEl) {
      categoryEl.classList.add('open');
      categoryEl.querySelector('.nav-category-toggle').classList.add('active');

      if (subcategoryId) {
        const btn = categoryEl.querySelector(
          `.nav-subcategory-list button[data-subcategory-id="${subcategoryId}"]`
        );
        if (btn) btn.classList.add('active');
      }
    }
  }

  // ===== 渲染：欢迎页 =====

  function renderHome() {
    updateSidebarActive(null, null);
    els.searchInput.value = '';

    const totalTerms = state.terms.length;
    const totalCategories = state.categories.length;

    let html = `
      <h2 class="page-title">欢迎使用 AI 术语辞典</h2>
      <p class="page-desc">
        本项目收录人工智能领域的技术、使用与学术术语，按三层结构组织：
        一级分类 → 二级子类 → 具体词条。当前已收录 ${totalTerms} 个词条，分布于 ${totalCategories} 个大类。
      </p>
      <div class="overview-grid">
    `;

    state.categories.forEach(category => {
      const subCount = category.subcategories.length;
      const termCount = state.terms.filter(t => t.category === category.id).length;
      html += `
        <div class="overview-card">
          <h3>${escapeHtml(category.name)}</h3>
          <p>${escapeHtml(category.description)}</p>
          <ul>
            <li>${subCount} 个子类</li>
            <li>${termCount} 个词条</li>
          </ul>
        </div>
      `;
    });

    html += '</div>';
    els.content.innerHTML = html;
  }

  // ===== 渲染：子类词条列表 =====

  function renderSubcategory(categoryId, subcategoryId) {
    const category = getCategory(categoryId);
    const subcategory = getSubcategory(categoryId, subcategoryId);

    if (!category || !subcategory) {
      els.content.innerHTML = `<div class="error">未找到该分类。</div>`;
      return;
    }

    updateSidebarActive(categoryId, subcategoryId);
    els.searchInput.value = '';

    const terms = getTermsBySubcategory(categoryId, subcategoryId);

    let html = `
      <nav class="breadcrumb">
        <a href="#">首页</a>
        <span>/</span>
        <span>${escapeHtml(category.name)}</span>
        <span>/</span>
        <span>${escapeHtml(subcategory.name)}</span>
      </nav>
      <h2 class="page-title">${escapeHtml(subcategory.name)}</h2>
      <p class="page-desc">${escapeHtml(subcategory.description)}</p>
    `;

    if (terms.length === 0) {
      html += `<div class="empty-state">该子类下暂无词条，欢迎补充。</div>`;
    } else {
      html += '<div class="term-grid">';
      terms.forEach(term => {
        html += renderTermCard(term);
      });
      html += '</div>';
    }

    els.content.innerHTML = html;
    bindTermCardClicks();
  }

  function renderTermCard(term) {
    const aliases = term.aliases && term.aliases.length
      ? `别名：${term.aliases.map(escapeHtml).join('、')}`
      : '';
    const snippet = term.definition ? term.definition.slice(0, 80) + '…' : '';

    return `
      <article class="term-card" data-term-id="${escapeHtml(term.id)}" tabindex="0" role="button">
        <h4>${escapeHtml(term.name)}</h4>
        ${aliases ? `<div class="aliases">${aliases}</div>` : ''}
        <div class="snippet">${escapeHtml(snippet)}</div>
      </article>
    `;
  }

  function bindTermCardClicks() {
    els.content.querySelectorAll('.term-card').forEach(card => {
      const open = () => {
        const id = card.dataset.termId;
        location.hash = `#term/${id}`;
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  // ===== 渲染：词条详情 =====

  function renderTermDetail(termId) {
    const term = getTerm(termId);
    if (!term) {
      els.content.innerHTML = `<div class="error">未找到该词条。</div>`;
      return;
    }

    const category = getCategory(term.category);
    const subcategory = getSubcategory(term.category, term.subcategory);

    updateSidebarActive(term.category, term.subcategory);
    els.searchInput.value = '';

    const aliasesHtml = term.aliases && term.aliases.length
      ? term.aliases.map(escapeHtml).join('、')
      : '无';

    const examplesHtml = term.examples && term.examples.length
      ? `<ul>${term.examples.map(ex => `<li>${escapeHtml(ex)}</li>`).join('')}</ul>`
      : '<p>暂无示例。</p>';

    const relatedHtml = term.related && term.related.length
      ? `<div class="related-tags">${
          term.related.map(id => {
            const relatedTerm = getTerm(id);
            const label = relatedTerm ? relatedTerm.name : id;
            if (relatedTerm) {
              return `<a href="#term/${escapeHtml(id)}">${escapeHtml(label)}</a>`;
            }
            return `<span class="related-missing">${escapeHtml(label)}<small>（待收录）</small></span>`;
          }).join('')
        }</div>`
      : '<p>暂无相关词条。</p>';

    const tldrHtml = term.tldr
      ? `<div class="tldr">${escapeHtml(term.tldr)}</div>`
      : '';

    const misconceptionsHtml = term.misconceptions && term.misconceptions.length
      ? `<h3>常见误解</h3><ul>${term.misconceptions.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`
      : '';

    const sourcesHtml = term.sources && term.sources.length
      ? `<h3>参考来源</h3><ul class="source-list">${
          term.sources.map(s =>
            `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a></li>`
          ).join('')
        }</ul>`
      : '';

    const relatedReadingHtml = term.related_reading && term.related_reading.length
      ? `<h3>扩展阅读</h3><div class="related-tags">${
          term.related_reading.map(id => {
            const relatedTerm = getTerm(id);
            const label = relatedTerm ? relatedTerm.name : id;
            if (relatedTerm) {
              return `<a href="#term/${escapeHtml(id)}">${escapeHtml(label)}</a>`;
            }
            return `<span class="related-missing">${escapeHtml(label)}<small>（待收录）</small></span>`;
          }).join('')
        }</div>`
      : '';

    els.content.innerHTML = `
      <nav class="breadcrumb">
        <a href="#">首页</a>
        <span>/</span>
        ${category ? `<a href="#category/${category.id}/${term.subcategory}">${escapeHtml(category.name)}</a>` : '<span>未知分类</span>'}
        <span>/</span>
        ${subcategory ? `<a href="#category/${term.category}/${subcategory.id}">${escapeHtml(subcategory.name)}</a>` : '<span>未知子类</span>'}
        <span>/</span>
        <span>${escapeHtml(term.name)}</span>
      </nav>

      <article class="term-detail">
        <h2>${escapeHtml(term.name)}</h2>
        <div class="aliases">别名：${aliasesHtml}</div>
        ${tldrHtml}

        <h3>定义</h3>
        <p>${escapeHtml(term.definition)}</p>

        <h3>示例</h3>
        ${examplesHtml}

        ${misconceptionsHtml}

        ${sourcesHtml}

        <h3>相关词条</h3>
        ${relatedHtml}

        ${relatedReadingHtml}
      </article>
    `;
  }

  // ===== 渲染：搜索结果 =====

  function renderSearchResults(query) {
    const results = Search.search(state.terms, query, state.index);

    updateSidebarActive(null, null);
    els.searchInput.value = decodeURIComponent(query);

    let html = `
      <h2 class="page-title">搜索结果</h2>
      <p class="search-meta">查询“<strong>${escapeHtml(decodeURIComponent(query))}</strong>”，找到 ${results.length} 个结果。</p>
    `;

    if (results.length === 0) {
      html += `<div class="empty-state">未找到匹配的词条，请尝试其他关键词。</div>`;

      const decodedQuery = decodeURIComponent(query);
      const suggestions = Search.suggest(state.terms, decodedQuery, state.index);
      if (suggestions.length > 0) {
        html += `<div class="search-suggestions">
          <strong>你是不是想找：</strong>
          ${suggestions.map(t => `<a href="#term/${escapeHtml(t.id)}" class="suggestion-link">${escapeHtml(t.name)}</a>`).join('、')}
        </div>`;
      }

      const issueTitle = '【词条收录】' + decodedQuery;
      html += `<div class="search-submit">
        <a href="https://github.com/sinthome-2/let-gogoogogogo-project1/issues/new?title=${encodeURIComponent(issueTitle)}" target="_blank" rel="noopener noreferrer" class="submit-term-btn">提交这个词条</a>
      </div>`;
    } else {
      html += '<div class="search-list">';
      results.forEach(term => {
        const aliases = term.aliases && term.aliases.length
          ? `别名：${term.aliases.map(escapeHtml).join('、')}`
          : '';
        html += `
          <div class="search-item" data-term-id="${escapeHtml(term.id)}" tabindex="0" role="button">
            <h4>${escapeHtml(term.name)}</h4>
            ${aliases ? `<div class="aliases">${aliases}</div>` : ''}
            <div class="snippet">${Search.buildSnippet(term, decodeURIComponent(query), state.index)}</div>
          </div>
        `;
      });
      html += '</div>';
    }

    els.content.innerHTML = html;

    // 绑定点击事件
    els.content.querySelectorAll('.search-item').forEach(item => {
      const open = () => {
        location.hash = `#term/${item.dataset.termId}`;
      };
      item.addEventListener('click', open);
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  // ===== 路由 =====

  function setupRouting() {
    window.addEventListener('hashchange', handleHash);
  }

  function handleHash() {
    const route = Utils.parseHash(location.hash);

    switch (route.view) {
      case 'term':
        renderTermDetail(route.termId);
        break;
      case 'category':
        renderSubcategory(route.categoryId, route.subcategoryId);
        break;
      case 'search':
        renderSearchResults(route.query);
        break;
      case 'home':
      default:
        renderHome();
        break;
    }
  }

  // ===== 搜索框 =====

  function setupSearch() {
    const debouncedSearch = Utils.debounce((q) => {
      if (q) {
        // 使用 replaceState 避免每次输入都产生新的历史记录
        history.replaceState(null, '', `#search/${encodeURIComponent(q)}`);
        handleHash();
      }
      // 清空搜索时：不回首页，保持当前页面
    }, 150);

    els.searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      debouncedSearch(q);
    });
  }

  // ===== 工具函数 =====

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== 启动 =====

  init();
})();

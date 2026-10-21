/**
 * 搜索模块
 * 提供对词条数组的评分搜索，不依赖外部库。
 * 支持：多关键词 AND、引号短语、扩展字段（id/acronym/nameZh/别名/定义/示例/速记/误解/来源标题/子类名）、拼音/首字母索引。
 */
const Search = (function () {
  function normalize(text) {
    return String(text || '').toLowerCase().trim();
  }

  function join(values) {
    return (values || [])
      .map(v => normalize(typeof v === 'string' ? v : v && v.title))
      .filter(Boolean)
      .join(' ');
  }

  function optional(text) {
    return text ? normalize(text) : '';
  }

  /**
   * 压缩文本：去除所有非字母/数字字符，用于跨空格、连字符、标点匹配。
   */
  function compact(text) {
    return text.replace(/[^\p{L}\p{N}]+/gu, '');
  }

  /**
   * 解析查询字符串。
   * 引号内的内容作为一个短语保留，其余按空白分割。
   * @returns {Array<{text: string, phrase: boolean}>}
   */
  function parseQuery(raw) {
    const q = normalize(raw);
    if (!q) return [];

    const tokens = [];
    const re = /"([^"]*)"|(\S+)/g;
    let match;
    while ((match = re.exec(q)) !== null) {
      const text = normalize(match[1] !== undefined ? match[1] : match[2]);
      if (text) {
        tokens.push({ text, phrase: match[1] !== undefined });
      }
    }
    return tokens;
  }

  function contains(text, token) {
    return compact(text).includes(compact(token.text));
  }

  function pinyinMatches(idx, text) {
    if (!idx) return { full: false, initials: false };

    const c = text.replace(/\s+/g, '');
    let full = false;
    let initials = false;

    for (const py of idx.pinyin || []) {
      const pyCompact = py.replace(/\s+/g, '');
      if (pyCompact.includes(c) || py.includes(c)) {
        full = true;
        break;
      }
    }

    for (const initial of idx.initials || []) {
      if (initial.includes(c)) {
        initials = true;
        break;
      }
    }

    return { full, initials };
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findTokenPositions(text, tokens) {
    const intervals = [];
    const lower = text.toLowerCase();
    for (const token of tokens) {
      const t = token.toLowerCase();
      if (!t) continue;
      let pos = 0;
      while ((pos = lower.indexOf(t, pos)) !== -1) {
        const end = pos + t.length;
        const overlap = intervals.some(iv => pos < iv.end && end > iv.start);
        if (!overlap) {
          intervals.push({ start: pos, end });
        }
        pos = end;
      }
    }
    intervals.sort((a, b) => a.start - b.start);
    return intervals;
  }

  /**
   * 生成带高亮的摘要片段。
   * @param {Object} term 词条对象
   * @param {string} query 查询字符串
   * @param {Object|null} [index] 拼音索引对象
   * @returns {string} 已转义的 HTML 字符串
   */
  function buildSnippet(term, query, index) {
    const tokens = parseQuery(query)
      .map(t => t.text)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (!term || tokens.length === 0) {
      const fallback = String(term?.name || term?.definition || '').trim();
      return fallback.length <= 60 ? escapeHtml(fallback) : escapeHtml(fallback.slice(0, 60)) + '…';
    }

    const nameRaw = String(term.name || '').trim();
    const aliasesRaw = join(term.aliases);
    const definitionRaw = String(term.definition || '').trim();

    const fields = [
      { key: 'name', text: nameRaw },
      { key: 'aliases', text: aliasesRaw },
      { key: 'definition', text: definitionRaw }
    ].filter(f => f.text);

    function hasAnyToken(text) {
      return tokens.some(t => text.toLowerCase().includes(t.toLowerCase()));
    }

    let chosenField = null;
    for (const field of fields) {
      if (hasAnyToken(field.text)) {
        chosenField = field;
        break;
      }
    }

    // 字面未命中（如纯拼音）→ fallback 到 name 开头，无 mark
    if (!chosenField) {
      const fallback = nameRaw || String(term.name || '');
      return fallback.length <= 60 ? escapeHtml(fallback) : escapeHtml(fallback.slice(0, 60)) + '…';
    }

    // 以命中的字段为锚点，在 name + aliases + definition 的拼接文本中取窗口
    const separator = ' ';
    const combined = fields.map(f => f.text).join(separator);
    const fieldStart = fields
      .slice(0, fields.findIndex(f => f.key === chosenField.key))
      .reduce((sum, f) => sum + f.text.length + separator.length, 0);

    const fieldLower = chosenField.text.toLowerCase();
    let firstPos = Infinity;
    for (const t of tokens) {
      const idx = fieldLower.indexOf(t.toLowerCase());
      if (idx !== -1 && idx < firstPos) {
        firstPos = idx;
      }
    }
    if (firstPos === Infinity) firstPos = 0;

    const globalHitPos = fieldStart + firstPos;
    let start = Math.max(0, globalHitPos - 30);
    let end = Math.min(combined.length, start + 60);
    if (end - start < 60) {
      start = Math.max(0, end - 60);
    }

    const snippet = combined.slice(start, end);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < combined.length ? '…' : '';

    const intervals = findTokenPositions(snippet, tokens);
    let html = prefix;
    let last = 0;
    for (const iv of intervals) {
      html += escapeHtml(snippet.slice(last, iv.start));
      html += '<mark>' + escapeHtml(snippet.slice(iv.start, iv.end)) + '</mark>';
      last = iv.end;
    }
    html += escapeHtml(snippet.slice(last));
    html += suffix;
    return html;
  }

  /**
   * 计算词条与查询字符串的匹配分数。
   * @param {Object} term 词条对象
   * @param {string} query 查询字符串
   * @param {Object|null} [index] 拼音索引对象，形如 { <id>: { pinyin: [...], initials: [...] } }
   * @returns {{match: boolean, score: number}}
   */
  function scoreTerm(term, query, index) {
    const tokens = parseQuery(query);
    if (tokens.length === 0) {
      return { match: false, score: 0 };
    }

    const idText = optional(term.id);
    const name = normalize(term.name);
    const acronym = optional(term.acronym);
    const nameZh = optional(term.nameZh);
    const aliases = join(term.aliases);
    const definition = normalize(term.definition);
    const examples = join(term.examples);
    const tldr = normalize(term.tldr);
    const misconceptions = join(term.misconceptions);
    const sources = join(term.sources);
    const subcategoryName = optional(term._subcategoryName);

    const fullText = [
      idText, name, acronym, nameZh, aliases, definition,
      examples, tldr, misconceptions, sources, subcategoryName
    ].join(' ');

    const fields = [idText, name, acronym, nameZh, aliases, definition, examples, tldr, misconceptions, sources, subcategoryName];

    const queryText = tokens.map(t => t.text).join(' ').trim();
    const queryCompact = compact(queryText);
    const nameCompact = compact(name);
    const aliasesCompact = compact(aliases);

    let score = 0;

    // 名称 / 别名层面的压缩匹配奖励（兼容连字符、空格差异）
    if (nameCompact === queryCompact) {
      score += 100;
    } else if (nameCompact.startsWith(queryCompact)) {
      score += 75;
    } else if (nameCompact.includes(queryCompact)) {
      score += 50;
    }

    if (aliasesCompact === queryCompact) {
      score += 60;
    } else if (aliasesCompact.includes(queryCompact)) {
      score += 30;
    }

    // 逐个 token 做 AND 匹配；允许拼音/首字母单独命中
    let allMatch = true;
    let pinyinFullHit = false;
    let initialsHit = false;

    for (const token of tokens) {
      const textHit = token.phrase
        ? fields.some(field => contains(field, token))
        : contains(fullText, token);
      const py = index ? pinyinMatches(index[term.id], token.text) : { full: false, initials: false };

      if (!textHit && !py.full && !py.initials) {
        allMatch = false;
        continue;
      }

      if (textHit) {
        score += 10;
        if (contains(name, token) || contains(aliases, token)) {
          score += 5;
        }
      }
      if (py.full) pinyinFullHit = true;
      if (py.initials) initialsHit = true;
    }

    if (!allMatch) {
      return { match: false, score: 0 };
    }

    // 多 token 时，若完整查询短语出现在定义 / 示例 / 速记中，额外奖励
    if (tokens.length > 1 && (
      compact(definition).includes(queryCompact) ||
      compact(examples).includes(queryCompact) ||
      compact(tldr).includes(queryCompact)
    )) {
      score += 15;
    }

    if (pinyinFullHit) score += 40;
    if (initialsHit) score += 35;

    return { match: true, score };
  }

  /**
   * 在词条列表中搜索并返回按相关度排序的结果。
   * @param {Array<Object>} terms 词条数组
   * @param {string} query 查询字符串
   * @param {Object|null} [index] 拼音索引对象
   * @returns {Array<Object>}
   */
  function search(terms, query, index) {
    if (!query || !query.trim()) {
      return [];
    }

    return terms
      .map((term, origIndex) => ({ term, result: scoreTerm(term, query, index), origIndex }))
      .filter(item => item.result.match)
      .sort((a, b) => {
        const scoreDiff = b.result.score - a.result.score;
        if (scoreDiff !== 0) return scoreDiff;
        const aWords = String(a.term.name || '').trim().split(/\s+/).filter(Boolean).length;
        const bWords = String(b.term.name || '').trim().split(/\s+/).filter(Boolean).length;
        if (aWords !== bWords) return aWords - bWords;
        const nameCmp = String(a.term.name || '').localeCompare(String(b.term.name || ''));
        if (nameCmp !== 0) return nameCmp;
        return a.origIndex - b.origIndex;
      })
      .map(item => item.term);
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    if (Math.abs(a.length - b.length) > 2) return Infinity;

    let prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 0; i < a.length; i++) {
      const curr = new Array(b.length + 1);
      curr[0] = i + 1;
      let rowMin = curr[0];
      for (let j = 0; j < b.length; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        curr[j + 1] = Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost);
        rowMin = Math.min(rowMin, curr[j + 1]);
      }
      if (rowMin > 2) return Infinity;
      prev = curr;
    }
    return prev[b.length] <= 2 ? prev[b.length] : Infinity;
  }

  function normalizeCandidate(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, '');
  }

  /**
   * 未命中时给出拼写建议。
   * @param {Array<Object>} terms 词条数组
   * @param {string} query 查询字符串
   * @param {Object|null} [index] 拼音索引对象
   * @returns {Array<Object>} 最多 3 个建议词条
   */
  function suggest(terms, query, index) {
    const q = normalizeCandidate(query);
    if (!q) return [];

    const items = [];
    for (const term of terms) {
      const candidates = [normalizeCandidate(term.name)];
      for (const alias of term.aliases || []) {
        candidates.push(normalizeCandidate(alias));
      }
      const idx = index ? index[term.id] : null;
      if (idx && idx.initials) {
        for (const initial of idx.initials) {
          candidates.push(normalizeCandidate(initial));
        }
      }

      let minDist = Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const d = levenshtein(q, c);
        // name/alias 允许 ≤2，initials 只取 ≤1，避免短串误召回
        const threshold = i === 0 || i <= (term.aliases || []).length ? 2 : 1;
        if (d <= threshold && d < minDist) minDist = d;
      }

      if (minDist <= 2) {
        items.push({ term, dist: minDist });
      }
    }

    items.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return String(a.term.name || '').localeCompare(String(b.term.name || ''));
    });

    const seen = new Set();
    const result = [];
    for (const item of items) {
      if (!seen.has(item.term.id)) {
        seen.add(item.term.id);
        result.push(item.term);
        if (result.length >= 3) break;
      }
    }
    return result;
  }

  return { search, buildSnippet, suggest };
})();

/**
 * 搜索模块
 * 提供对词条数组的简单评分搜索，不依赖外部库。
 */
const Search = (function () {
  function normalize(text) {
    return String(text || '').toLowerCase().trim();
  }

  /**
   * 计算词条与查询字符串的匹配分数。
   * @param {Object} term 词条对象
   * @param {string} query 查询字符串
   * @param {Object|null} [index] 拼音索引对象，形如 { <id>: { pinyin: [...], initials: [...] } }
   * @returns {{match: boolean, score: number}}
   */
  function scoreTerm(term, query, index) {
    const q = normalize(query);
    if (!q) {
      return { match: false, score: 0 };
    }

    const name = normalize(term.name);
    const aliases = (term.aliases || []).map(normalize).join(' ');
    const definition = normalize(term.definition);

    let score = 0;

    if (name === q) {
      score += 100;
    } else if (name.startsWith(q)) {
      score += 75;
    } else if (name.includes(q)) {
      score += 50;
    }

    if (aliases === q) {
      score += 60;
    } else if (aliases.includes(q)) {
      score += 30;
    }

    if (definition.includes(q)) {
      score += 10;
    }

    // 拼音/首字母索引加分（+40 / +35），不影响无索引时的行为
    const idx = index && index[term.id];
    if (idx) {
      const qCompact = q.replace(/\s+/g, '');

      for (const py of idx.pinyin || []) {
        const pyCompact = py.replace(/\s+/g, '');
        if (pyCompact.includes(qCompact) || py.includes(qCompact)) {
          score += 40;
          break;
        }
      }

      for (const initial of idx.initials || []) {
        if (initial.includes(qCompact)) {
          score += 35;
          break;
        }
      }
    }

    return { match: score > 0, score };
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
      .map(term => ({ term, result: scoreTerm(term, query, index) }))
      .filter(item => item.result.match)
      .sort((a, b) => b.result.score - a.result.score)
      .map(item => item.term);
  }

  return { search };
})();

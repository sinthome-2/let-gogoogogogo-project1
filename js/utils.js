/**
 * 通用工具函数
 * 提供与 DOM 无关、可单元测试的纯函数。
 */
const Utils = (function () {
  'use strict';

  /**
   * 解析 URL hash，返回结构化的路由信息。
   * 规则：先按 '/' 分割，再对每个部分做 decodeURIComponent，
   * 避免解码后的内容中包含 '/' 时被错误拆分。
   *
   * @param {string} hash 形如 '#term/skill' 或 '#search/%E6%8F%90%E7%A4%BA'
   * @returns {Object}
   */
  function parseHash(hash) {
    const raw = String(hash || '').replace(/^#\/?/, '').trim();

    if (!raw) {
      return { view: 'home' };
    }

    const parts = raw.split('/').map(decodeURIComponent);
    const view = parts[0];

    switch (view) {
      case 'term':
        return parts[1]
          ? { view: 'term', termId: parts[1] }
          : { view: 'home' };
      case 'category':
        return parts[1] && parts[2]
          ? { view: 'category', categoryId: parts[1], subcategoryId: parts[2] }
          : { view: 'home' };
      case 'search':
        return parts[1]
          ? { view: 'search', query: parts[1] }
          : { view: 'home' };
      default:
        return { view: 'home' };
    }
  }

  /**
   * 创建一个防抖函数。
   * @param {Function} fn 要执行的函数
   * @param {number} delay 延迟毫秒数
   * @returns {Function}
   */
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  return {
    parseHash,
    debounce
  };
})();

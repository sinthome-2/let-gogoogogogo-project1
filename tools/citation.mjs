/**
 * 引用格式生成
 * 格式裁定见 t18-brief，无搬运源。
 */

export function formatGbt7714({ name, url, date }) {
  return `AI 术语辞典. ${name}[EB/OL]. [${date}]. ${url}.`;
}

export function formatApa({ name, url, date }) {
  return `AI 术语辞典. (${date}). ${name}. AI 术语辞典. ${url}`;
}

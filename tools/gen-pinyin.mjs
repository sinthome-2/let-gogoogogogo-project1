/**
 * 拼音索引生成器
 * 读取 data/terms.json，为每条词条的含中文 name / alias 生成无声调全拼与首字母索引，
 * 写入 data/term-index.json。输出按 id 排序，保证可重复构建。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(root, filename), 'utf8'));
}

const HAN_RE = /\p{Script=Han}/u;

function hasHan(text) {
  return HAN_RE.test(text);
}

function buildPinyin(text) {
  return pinyin(text, { toneType: 'none', type: 'array' });
}

function main() {
  const { terms } = loadJSON('data/terms.json');
  const index = {};

  for (const term of terms) {
    const candidates = [];

    if (hasHan(term.name || '')) {
      candidates.push(term.name);
    }

    for (const alias of term.aliases || []) {
      if (hasHan(alias)) {
        candidates.push(alias);
      }
    }

    const pinyinList = [];
    const initialsList = [];

    for (const text of candidates) {
      const py = buildPinyin(text);
      pinyinList.push(py.join(' '));
      initialsList.push(py.map(s => s.charAt(0)).join(''));
    }

    index[term.id] = { pinyin: pinyinList, initials: initialsList };
  }

  const sortedIds = Object.keys(index).sort();
  const output = { version: 1, terms: {} };
  for (const id of sortedIds) {
    output.terms[id] = index[id];
  }

  writeFileSync(
    join(root, 'data/term-index.json'),
    JSON.stringify(output, null, 2) + '\n',
    'utf8'
  );

  console.log(`Indexed ${sortedIds.length} terms.`);
}

main();

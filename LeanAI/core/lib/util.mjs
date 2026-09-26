// LeanAI — utilitários base do motor. Somente builtins do Node (>=18).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Lê texto removendo BOM e normalizando quebras de linha para LF. */
export function readText(file) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r\n/g, '\n');
}

/** Escreve texto em UTF-8 sem BOM, sempre com LF e newline final. */
export function writeText(file, content) {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\s*$/, '') + '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, normalized, { encoding: 'utf8' });
  return normalized;
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

export function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

/** Lista subdiretórios diretos, ordenados — determinismo. */
export function listDirs(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Caminho relativo sempre com "/" — comparável entre Windows e POSIX. */
export function toPosix(p) {
  return p.split(path.sep).join('/');
}

/** Percorre recursivamente retornando caminhos relativos POSIX ordenados. */
export function walkFiles(dir, base = dir) {
  if (!exists(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, base));
    else if (entry.isFile()) out.push(toPosix(path.relative(base, full)));
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// Subconjunto de YAML suficiente para frontmatter de SKILL.md.
// Suporta: escalares, blocos > e |, listas simples e um nível de mapa aninhado.
// ---------------------------------------------------------------------------

export function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) return { frontmatter: null, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, body: text };
  const fmText = text.slice(4, end + 1);
  let body = text.slice(end + 4);
  if (body.startsWith('\n')) body = body.slice(1);
  return { frontmatter: fmText, body };
}

function unquote(v) {
  const t = v.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.at(-1) === '"') || (t[0] === "'" && t.at(-1) === "'"))) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

export function parseYamlSubset(fmText) {
  if (!fmText) return {};
  const lines = fmText.split('\n');
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) { i++; continue; }
    const m = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line);
    if (!m) { i++; continue; }
    const [, key, rawRest] = m;
    const rest = rawRest.trim();
    if (rest === '>' || rest === '|' || rest === '>-' || rest === '|-') {
      const folded = rest.startsWith('>');
      const block = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        block.push(lines[i].replace(/^ {2}/, ''));
        i++;
      }
      while (block.length && block.at(-1).trim() === '') block.pop();
      out[key] = folded
        ? block.map((l) => l.trim()).filter(Boolean).join(' ')
        : block.join('\n');
      continue;
    }
    if (rest === '') {
      // lista ou mapa aninhado
      const items = [];
      const map = {};
      i++;
      let isList = false;
      while (i < lines.length && /^\s+\S/.test(lines[i])) {
        const child = lines[i].trim();
        if (child.startsWith('- ')) { isList = true; items.push(unquote(child.slice(2))); }
        else {
          const cm = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(child);
          if (cm) map[cm[1]] = unquote(cm[2]);
        }
        i++;
      }
      out[key] = isList ? items : map;
      continue;
    }
    out[key] = unquote(rest);
    i++;
  }
  return out;
}

function emitScalar(v) {
  const s = String(v);
  // Sempre entre aspas duplas: seguro para ":", "#", "-", acentos e emojis.
  return JSON.stringify(s.split(String.fromCharCode(10)).join(" "));
}

/** Serializa determinísticamente respeitando uma ordem de chaves preferida. */
export function emitYaml(obj, keyOrder = []) {
  const keys = [...keyOrder.filter((k) => k in obj), ...Object.keys(obj).filter((k) => !keyOrder.includes(k)).sort()];
  const lines = [];
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${emitScalar(item)}`);
    } else if (typeof v === 'object') {
      lines.push(`${k}:`);
      for (const ck of Object.keys(v).sort()) lines.push(`  ${ck}: ${emitScalar(v[ck])}`);
    } else {
      lines.push(`${k}: ${emitScalar(v)}`);
    }
  }
  return lines.join('\n');
}

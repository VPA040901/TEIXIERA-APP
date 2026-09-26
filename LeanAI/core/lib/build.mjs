// LeanAI — geração determinística dos artefatos de runtime a partir da fonte canônica.
import fs from 'node:fs';
import path from 'node:path';
import {
  readText, writeText, sha256, exists, listDirs, walkFiles,
  splitFrontmatter, parseYamlSubset, emitYaml,
} from './util.mjs';

export const AVISO_GERADO =
  '<!-- GERADO PELO LeanAI — NÃO EDITE ESTE ARQUIVO.\n' +
  '     Fonte canônica: {FONTE}\n' +
  '     Regenere com: node core/bin/leanai.mjs sync -->';

const FIM_BRANCO = /\s*$/;

export function loadConfig(root) {
  const cfg = JSON.parse(readText(path.join(root, 'core', 'leanai.config.json')));
  cfg.__root = root;
  return cfg;
}

/** Substitui os tokens universais pelos valores do runtime alvo. */
export function renderTokens(text, agentKey, cfg) {
  const a = cfg.agentes[agentKey];
  const outroKey = Object.keys(cfg.agentes).find((k) => k !== agentKey);
  const outro = cfg.agentes[outroKey];
  const invocar = (nome) => a.sintaxeInvocacao.replace('{skill}', nome);
  return text
    .replace(/\{\{INVOCAR:([a-zA-Z0-9_-]+)\}\}/g, (_, n) => invocar(n))
    .replace(/\{\{AGENTE\}\}/g, a.nome)
    .replace(/\{\{OUTRO_AGENTE\}\}/g, outro ? outro.nome : '')
    .replace(/\{\{SKILLS_DIR\}\}/g, a.skillsDir)
    .replace(/\{\{SKILLS_DIR_GLOBAL\}\}/g, agentKey === 'claude' ? '~/.claude/skills' : '~/.agents/skills')
    .replace(/\{\{ARQUIVO_REGRAS\}\}/g, a.arquivoRegras)
    .replace(/\{\{SINTAXE_INVOCACAO\}\}/g, invocar('nome-da-skill'))
    .replace(/\{\{PRODUTO\}\}/g, cfg.produto)
    // Escape literal: "{{!TOKEN}}" sai como "{{TOKEN}}" sem ser substituído.
    // Permite documentar os próprios tokens dentro das regras e skills.
    .replace(/\{\{!([^}]*)\}\}/g, '{{$1}}');
}

export function listSkills(root, cfg) {
  return listDirs(path.join(root, cfg.fonteCanonica.skills))
    .filter((d) => exists(path.join(root, cfg.fonteCanonica.skills, d, 'SKILL.md')));
}

/** Constrói o SKILL.md gerado para um agente, a partir do canônico + adapters. */
export function buildSkill(root, skillName, agentKey, cfg) {
  const skillDir = path.join(root, cfg.fonteCanonica.skills, skillName);
  const canonical = readText(path.join(skillDir, 'SKILL.md'));
  const { frontmatter, body } = splitFrontmatter(canonical);
  if (!frontmatter) throw new Error(`skill "${skillName}": SKILL.md sem frontmatter YAML`);

  const fm = parseYamlSubset(frontmatter);
  if (!fm.name) throw new Error(`skill "${skillName}": frontmatter sem "name"`);
  if (!fm.description) throw new Error(`skill "${skillName}": frontmatter sem "description"`);
  if (fm.name !== skillName) throw new Error(`skill "${skillName}": name="${fm.name}" difere do nome da pasta`);

  // Frontmatter específico do runtime (opcional).
  const fmExtraPath = path.join(skillDir, 'adapters', `${agentKey}.yaml`);
  if (exists(fmExtraPath)) Object.assign(fm, parseYamlSubset(readText(fmExtraPath)));

  // Descarta chaves não suportadas pelo runtime alvo — evita frontmatter inválido.
  const permitido = new Set(cfg.agentes[agentKey].frontmatterPermitido);
  const descartadas = [];
  for (const k of Object.keys(fm)) {
    if (!permitido.has(k)) { descartadas.push(k); delete fm[k]; }
  }

  const metaBase = (fm.metadata && typeof fm.metadata === 'object' && !Array.isArray(fm.metadata)) ? fm.metadata : {};
  fm.metadata = { ...metaBase, 'leanai-fonte': `skills/${skillName}/SKILL.md` };

  // O frontmatter é a superfície de descoberta: os tokens precisam ser resolvidos
  // aqui também, senão a description chega ao modelo com "{{INVOCAR:...}}" cru.
  for (const [k, v] of Object.entries(fm)) {
    if (typeof v === 'string') fm[k] = renderTokens(v, agentKey, cfg);
    else if (Array.isArray(v)) fm[k] = v.map((x) => (typeof x === 'string' ? renderTokens(x, agentKey, cfg) : x));
    else if (v && typeof v === 'object') {
      for (const [ck, cv] of Object.entries(v)) {
        if (typeof cv === 'string') v[ck] = renderTokens(cv, agentKey, cfg);
      }
    }
  }

  // Corpo específico do runtime (opcional), anexado ao final.
  let corpo = body.trim();
  const bodyExtraPath = path.join(skillDir, 'adapters', `${agentKey}.md`);
  if (exists(bodyExtraPath)) corpo += '\n\n' + readText(bodyExtraPath).trim();

  const aviso = AVISO_GERADO.replace('{FONTE}', `skills/${skillName}/SKILL.md`);
  const conteudo = [
    '---',
    emitYaml(fm, ['name', 'description']),
    '---',
    '',
    aviso,
    '',
    renderTokens(corpo, agentKey, cfg),
  ].join('\n');

  const outputs = new Map();
  const destDir = `${cfg.agentes[agentKey].skillsDir}/${skillName}`;
  outputs.set(`${destDir}/SKILL.md`, conteudo);

  // Recursos de apoio acompanham a skill, exceto a pasta adapters/.
  for (const sub of ['references', 'scripts', 'assets']) {
    const from = path.join(skillDir, sub);
    for (const rel of walkFiles(from)) {
      outputs.set(`${destDir}/${sub}/${rel}`, readText(path.join(from, rel)));
    }
  }
  return { outputs, descartadas };
}

/** Monta CLAUDE.md / AGENTS.md a partir das regras canônicas. */
export function buildRulesFile(root, agentKey, cfg) {
  const a = cfg.agentes[agentKey];
  const partes = [];
  for (const arquivo of cfg.ordemRegras) {
    const p = path.join(root, cfg.fonteCanonica.regras, arquivo);
    if (!exists(p)) throw new Error(`regra canônica ausente: ${cfg.fonteCanonica.regras}/${arquivo}`);
    partes.push(readText(p).trim());
  }

  const linhas = listSkills(root, cfg).map((s) => {
    const fmText = splitFrontmatter(readText(path.join(root, cfg.fonteCanonica.skills, s, 'SKILL.md'))).frontmatter;
    const fm = parseYamlSubset(fmText);
    return `| \`${a.sintaxeInvocacao.replace('{skill}', s)}\` | ${resumo(String(fm.description || ''))} |`;
  }).join('\n');

  const cabecalho = [
    `# ${cfg.produto} — instruções para ${a.nome}`,
    '',
    AVISO_GERADO.replace('{FONTE}', `${cfg.fonteCanonica.regras}/ (+ core/leanai.config.json)`),
    '',
    `> ${cfg.descricao}`,
    `> Motor ${cfg.produto} v${cfg.engineVersion} · runtime: **${a.nome}** · skills em \`${a.skillsDir}/\``,
    '',
    '',
  ].join('\n');

  const rodape = [
    '',
    '',
    '---',
    '',
    '## Skills disponíveis',
    '',
    `Invocação neste runtime: \`${a.sintaxeInvocacao.replace('{skill}', 'nome-da-skill')}\``,
    '',
    '| Comando | O que faz |',
    '| --- | --- |',
    linhas,
    '',
    `As definições canônicas vivem em \`skills/<nome>/SKILL.md\`. Os arquivos em \`${a.skillsDir}/\` são **gerados** — nunca edite lá.`,
    '',
    '---',
    '',
    '## Regras específicas deste negócio',
    '',
    MARCA_INICIO,
    '<!-- O /instalar escreve aqui. Este bloco é preservado entre sincronizações. -->',
    MARCA_FIM,
  ].join('\n');

  return cabecalho + renderTokens(partes.join('\n\n---\n\n'), agentKey, cfg) + rodape;
}

/** Primeira frase da description, cortada em limite de palavra. */
function resumo(texto, limite = 100) {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  const frase = limpo.split('. ')[0];
  if (frase.length <= limite) return frase;
  const corte = frase.slice(0, limite);
  return corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:—-]$/, '') + '…';
}

const MARCA_INICIO = '<!-- LEANAI:INICIO-PERSONALIZADO -->';
const MARCA_FIM = '<!-- LEANAI:FIM-PERSONALIZADO -->';

/** Preserva o bloco personalizado do arquivo já existente no disco. */
export function preservarPersonalizado(novo, caminhoExistente) {
  if (!exists(caminhoExistente)) return novo;
  const antigo = readText(caminhoExistente);
  const i = antigo.indexOf(MARCA_INICIO);
  const f = antigo.indexOf(MARCA_FIM);
  if (i === -1 || f === -1 || f < i) return novo;
  const bloco = antigo.slice(i + MARCA_INICIO.length, f);
  const ni = novo.indexOf(MARCA_INICIO);
  const nf = novo.indexOf(MARCA_FIM);
  if (ni === -1 || nf === -1) return novo;
  return novo.slice(0, ni + MARCA_INICIO.length) + bloco + novo.slice(nf);
}

/** Plano completo: todo arquivo gerado, com seu conteúdo final. */
export function plan(root, cfg) {
  const outputs = new Map();
  const avisos = [];
  const agentes = Object.entries(cfg.agentes).filter(([, a]) => a.habilitado !== false);
  for (const [key] of agentes) {
    for (const skill of listSkills(root, cfg)) {
      const { outputs: o, descartadas } = buildSkill(root, skill, key, cfg);
      for (const [rel, c] of o) outputs.set(rel, c);
      if (descartadas.length) {
        avisos.push(`${skill}: chaves de frontmatter sem suporte em ${key} foram removidas (${descartadas.join(', ')})`);
      }
    }
    const rules = cfg.agentes[key].arquivoRegras;
    outputs.set(rules, preservarPersonalizado(buildRulesFile(root, key, cfg), path.join(root, rules)));
  }
  return { outputs, avisos };
}

export function manifestPath(root, cfg) {
  return path.join(root, cfg.manifesto);
}

export function readManifest(root, cfg) {
  const p = manifestPath(root, cfg);
  if (!exists(p)) return { engineVersion: null, gerados: {} };
  try { return JSON.parse(readText(p)); } catch { return { engineVersion: null, gerados: {} }; }
}

function normalizar(texto) {
  return texto.replace(FIM_BRANCO, '') + '\n';
}

/** Aplica o plano no disco e reescreve o manifesto de hashes. */
export function apply(root, cfg, { dryRun = false } = {}) {
  const { outputs, avisos } = plan(root, cfg);
  const anterior = readManifest(root, cfg);
  const escritos = [];
  const inalterados = [];

  for (const [rel, conteudo] of ordenado(outputs)) {
    const abs = path.join(root, rel);
    const alvo = normalizar(conteudo);
    const atual = exists(abs) ? readText(abs) : null;
    if (atual === alvo) { inalterados.push(rel); continue; }
    if (!dryRun) writeText(abs, conteudo);
    escritos.push(rel);
  }

  // Remove apenas o que ESTE motor gerou antes e não gera mais. Nunca toca em desconhecido.
  const removidos = [];
  for (const rel of Object.keys(anterior.gerados || {})) {
    if (outputs.has(rel)) continue;
    const abs = path.join(root, rel);
    if (!exists(abs)) continue;
    if (sha256(readText(abs)) !== anterior.gerados[rel]) continue; // editado à mão: preserva
    if (!dryRun) { fs.rmSync(abs); limparVazios(path.dirname(abs), root); }
    removidos.push(rel);
  }

  const manifesto = {
    produto: cfg.produto,
    engineVersion: cfg.engineVersion,
    nota: 'Hashes SHA-256. Sem timestamp: a saída é determinística e o diff fica limpo.',
    fontes: hashesDasFontes(root, cfg),
    gerados: Object.fromEntries(ordenado(outputs).map(([rel, c]) => [rel, sha256(normalizar(c))])),
  };
  if (!dryRun) writeText(manifestPath(root, cfg), JSON.stringify(manifesto, null, 2));
  return { escritos, inalterados, removidos, avisos, total: outputs.size };
}

function ordenado(mapa) {
  return [...mapa].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function limparVazios(dir, root) {
  let d = dir;
  while (d.startsWith(root) && d !== root) {
    try {
      if (fs.readdirSync(d).length > 0) return;
      fs.rmdirSync(d);
    } catch { return; }
    d = path.dirname(d);
  }
}

export function hashesDasFontes(root, cfg) {
  const out = {};
  for (const skill of listSkills(root, cfg)) {
    const base = path.join(root, cfg.fonteCanonica.skills, skill);
    for (const rel of walkFiles(base)) {
      out[`${cfg.fonteCanonica.skills}/${skill}/${rel}`] = sha256(readText(path.join(base, rel)));
    }
  }
  for (const arquivo of cfg.ordemRegras) {
    const p = path.join(root, cfg.fonteCanonica.regras, arquivo);
    if (exists(p)) out[`${cfg.fonteCanonica.regras}/${arquivo}`] = sha256(readText(p));
  }
  return out;
}

/** Verifica divergência entre fonte canônica e artefatos gerados. */
export function check(root, cfg) {
  const { outputs, avisos } = plan(root, cfg);
  const divergencias = [];
  for (const [rel, conteudo] of ordenado(outputs)) {
    const abs = path.join(root, rel);
    const alvo = normalizar(conteudo);
    if (!exists(abs)) {
      divergencias.push({ rel, tipo: 'AUSENTE', esperado: sha256(alvo).slice(0, 12), encontrado: '—' });
      continue;
    }
    const atual = readText(abs);
    if (atual !== alvo) {
      divergencias.push({ rel, tipo: 'DIVERGENTE', esperado: sha256(alvo).slice(0, 12), encontrado: sha256(atual).slice(0, 12) });
    }
  }
  const anterior = readManifest(root, cfg);
  const orfaos = Object.keys(anterior.gerados || {}).filter((r) => !outputs.has(r) && exists(path.join(root, r)));
  return { divergencias, orfaos, avisos, total: outputs.size };
}

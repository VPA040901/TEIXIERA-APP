#!/usr/bin/env node
// LeanAI — CLI do motor. Zero dependências externas; roda em Windows, macOS e Linux.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadConfig, apply, check, listSkills, plan } from '../lib/build.mjs';
import { readText, writeText, exists, listDirs, sha256 } from '../lib/util.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');

const cor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  ok: (s) => (cor ? `\x1b[32m${s}\x1b[0m` : s),
  erro: (s) => (cor ? `\x1b[31m${s}\x1b[0m` : s),
  aviso: (s) => (cor ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s) => (cor ? `\x1b[2m${s}\x1b[0m` : s),
  forte: (s) => (cor ? `\x1b[1m${s}\x1b[0m` : s),
};

const OK = 'OK';
const FALHA = 'FALHA';

function cabecalho(titulo) {
  console.log('');
  console.log(c.forte(`LeanAI · ${titulo}`));
  console.log(c.dim('─'.repeat(Math.min(60, 9 + titulo.length))));
}

// ---------------------------------------------------------------------------
// Detecção de ferramentas — sem depender do PATH apenas.
// ---------------------------------------------------------------------------

const CANDIDATOS_EXTRA = {
  claude: [
    path.join(process.env.USERPROFILE || process.env.HOME || '', '.vscode', 'extensions'),
  ],
  codex: [
    path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'bin'),
  ],
};

function tentarComando(cmd, args = ['--version']) {
  try {
    const out = execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000, shell: process.platform === 'win32' });
    return String(out).trim().split('\n')[0].trim();
  } catch { return null; }
}

function buscarBinario(nome) {
  // 1) PATH
  const versaoPath = tentarComando(nome);
  if (versaoPath) return { encontrado: true, via: 'PATH', comando: nome, versao: versaoPath };

  // 2) locais conhecidos de instalação (Windows sobretudo)
  for (const base of CANDIDATOS_EXTRA[nome] || []) {
    if (!base || !exists(base)) continue;
    const alvo = procurarExecutavel(base, nome, 0);
    if (alvo) {
      const v = tentarComando(alvo);
      if (v) return { encontrado: true, via: 'caminho detectado', comando: alvo, versao: v };
    }
  }
  return { encontrado: false, via: null, comando: null, versao: null };
}

function procurarExecutavel(dir, nome, profundidade) {
  if (profundidade > 4) return null;
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  const exe = process.platform === 'win32' ? `${nome}.exe` : nome;
  for (const e of entradas) {
    if (e.isFile() && e.name.toLowerCase() === exe) return path.join(dir, e.name);
  }
  for (const e of entradas) {
    if (!e.isDirectory()) continue;
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const achado = procurarExecutavel(path.join(dir, e.name), nome, profundidade + 1);
    if (achado) return achado;
  }
  return null;
}

function detectarAmbiente() {
  return {
    so: `${process.platform} ${process.arch}`,
    node: process.version,
    git: buscarBinario('git'),
    gh: buscarBinario('gh'),
    claude: buscarBinario('claude'),
    codex: buscarBinario('codex'),
  };
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

function cmdSync(args) {
  const cfg = loadConfig(RAIZ);
  const dryRun = args.includes('--dry-run');
  cabecalho(dryRun ? 'sync (simulação)' : 'sync');
  const r = apply(RAIZ, cfg, { dryRun });
  for (const a of r.avisos) console.log(c.aviso(`  aviso  ${a}`));
  for (const f of r.escritos) console.log(`  ${c.ok('escrito')}  ${f}`);
  for (const f of r.removidos) console.log(`  ${c.aviso('removido')} ${f}`);
  console.log('');
  console.log(`  ${r.total} artefatos · ${r.escritos.length} escritos · ${r.inalterados.length} inalterados · ${r.removidos.length} removidos`);
  console.log(c.ok(`  ${OK} — Claude Code e Codex enxergam a mesma versão.`));
  return 0;
}

function cmdCheck() {
  const cfg = loadConfig(RAIZ);
  cabecalho('check — divergência entre fonte canônica e artefatos gerados');
  const r = check(RAIZ, cfg);
  for (const a of r.avisos) console.log(c.aviso(`  aviso  ${a}`));

  if (!r.divergencias.length && !r.orfaos.length) {
    console.log(`  ${r.total} artefatos verificados por hash SHA-256.`);
    console.log(c.ok(`  ${OK} — nenhuma divergência.`));
    return 0;
  }
  console.log('');
  console.log('  ESTADO       ESPERADO      ENCONTRADO    ARQUIVO');
  for (const d of r.divergencias) {
    console.log(`  ${c.erro(d.tipo.padEnd(11))}  ${d.esperado.padEnd(12)}  ${String(d.encontrado).padEnd(12)}  ${d.rel}`);
  }
  for (const o of r.orfaos) console.log(`  ${c.aviso('ÓRFÃO'.padEnd(11))}  ${''.padEnd(12)}  ${''.padEnd(12)}  ${o}`);
  console.log('');
  console.log(c.erro(`  ${FALHA} — ${r.divergencias.length} divergência(s), ${r.orfaos.length} órfão(s).`));
  console.log(c.dim('  Corrija com: node core/bin/leanai.mjs sync'));
  return 1;
}

function cmdDoctor() {
  cabecalho('doctor — ambiente');
  const amb = detectarAmbiente();
  console.log(`  Sistema         ${amb.so}`);
  console.log(`  Node.js         ${amb.node}`);
  const linha = (rot, d, obrig) => {
    const status = d.encontrado ? c.ok('encontrado') : (obrig ? c.erro('ausente') : c.aviso('ausente'));
    const detalhe = d.encontrado ? `${d.versao}  ${c.dim(`(${d.via})`)}` : (obrig ? 'obrigatório' : 'opcional');
    console.log(`  ${rot.padEnd(15)} ${status.padEnd(cor ? 21 : 10)} ${detalhe}`);
  };
  linha('git', amb.git, true);
  linha('gh (GitHub CLI)', amb.gh, false);
  linha('Claude Code', amb.claude, false);
  linha('Codex', amb.codex, false);

  const agentes = [amb.claude.encontrado && 'Claude Code', amb.codex.encontrado && 'Codex'].filter(Boolean);
  console.log('');
  if (agentes.length === 2) console.log(c.ok('  Modo recomendado: Claude Code + Codex (dual).'));
  else if (agentes.length === 1) console.log(c.ok(`  Modo disponível: ${agentes[0]}.`));
  else console.log(c.aviso('  Nenhum agente detectado. Instale Claude Code e/ou Codex para usar o LeanAI.'));
  if (!amb.git.encontrado) { console.log(c.erro('  git é obrigatório.')); return 1; }
  return 0;
}

function cmdVerify() {
  const cfg = loadConfig(RAIZ);
  cabecalho('verify — estrutura');
  let falhas = 0;
  const teste = (nome, cond, detalhe = '') => {
    console.log(`  ${cond ? c.ok('PASS') : c.erro('FAIL')}  ${nome}${detalhe ? c.dim('  ' + detalhe) : ''}`);
    if (!cond) falhas++;
  };

  const skills = listSkills(RAIZ, cfg);
  teste('fonte canônica skills/ existe', exists(path.join(RAIZ, cfg.fonteCanonica.skills)));
  teste(`${skills.length} skills canônicas encontradas`, skills.length > 0, skills.join(', '));

  for (const arq of cfg.ordemRegras) {
    teste(`regra canônica ${arq}`, exists(path.join(RAIZ, cfg.fonteCanonica.regras, arq)));
  }
  for (const [key, a] of Object.entries(cfg.agentes)) {
    if (a.habilitado === false) continue;
    teste(`${a.nome}: ${a.arquivoRegras}`, exists(path.join(RAIZ, a.arquivoRegras)));
    teste(`${a.nome}: ${a.skillsDir}/ com ${skills.length} skills`,
      listDirs(path.join(RAIZ, a.skillsDir)).length === skills.length,
      `${listDirs(path.join(RAIZ, a.skillsDir)).length} encontradas`);
  }
  for (const dir of Object.values(cfg.workspace)) {
    teste(`workspace ${dir}/`, exists(path.join(RAIZ, dir)));
  }
  teste('.gitignore', exists(path.join(RAIZ, '.gitignore')));
  teste('NOTICE.md (origem preservada)', exists(path.join(RAIZ, 'NOTICE.md')));

  console.log('');
  if (falhas) { console.log(c.erro(`  ${FALHA} — ${falhas} verificação(ões) falharam.`)); return 1; }
  console.log(c.ok(`  ${OK} — estrutura íntegra.`));
  return 0;
}

/**
 * Guarda de push.
 *
 * Modo "local" (padrão de toda instalação de empresa): nenhum push é permitido.
 * O trabalho da empresa nasce e morre na pasta. O GitHub só serve para baixar o
 * LeanAI e consultar atualizações.
 *
 * Modo "base" (a cópia de quem mantém o LeanAI): publica o motor, mas nunca com
 * dados de empresa modificados na árvore.
 */
function cmdGuard(args) {
  cabecalho('guard — validação de destino de push');
  const cfg = loadConfig(RAIZ);
  const inst = lerInstalacao();
  const remoto = args.find((a) => !a.startsWith('-')) || 'origin';

  console.log(`  modo            ${inst.modo}${inst.empresa ? ` (${inst.empresa})` : ''}`);

  let url;
  try {
    url = String(execFileSync('git', ['remote', 'get-url', remoto], { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] })).trim();
  } catch {
    console.log(c.erro(`  ${FALHA} — remoto "${remoto}" não existe neste repositório.`));
    return 1;
  }
  console.log(`  remoto          ${remoto}`);
  console.log(`  url             ${url}`);

  // ----- Modo local: push desativado por princípio, não por lista de exceções.
  if (inst.modo !== 'base') {
    const autorizado = inst.backupRemotoAutorizado;
    if (autorizado && autorizado === remoto) {
      console.log(c.aviso(`  ${OK} — "${remoto}" foi autorizado explicitamente como backup desta instalação.`));
      console.log(c.dim('  Confira o que vai subir antes de enviar: o workspace contém dados da empresa.'));
      return 0;
    }
    console.log(c.erro(`  ${FALHA} — push BLOQUEADO: esta instalação é LOCAL.`));
    console.log(c.dim('  Memória, identidade, projetos e saídas ficam nesta pasta e não saem da máquina.'));
    console.log(c.dim(`  O remoto "${cfg.local.remotoBase}" existe só para baixar atualizações do LeanAI.`));
    console.log(c.dim('  Para autorizar um backup remoto desta empresa (ação deliberada), edite'));
    console.log(c.dim('  core/instalacao.json e defina "backupRemotoAutorizado": "<nome-do-remoto>".'));
    return 1;
  }

  // ----- Modo base: só o mantenedor do LeanAI chega aqui.
  const proibidos = [
    { padrao: /mazzeoia\/MazyOS/i, motivo: 'repositório de origem (MazyOS) — jamais receber push' },
    { padrao: new RegExp(`^${cfg.local.remotoBase}$`, 'i'), motivo: `"${cfg.local.remotoBase}" é somente leitura` },
  ];
  const alvo = `${remoto} ${url}`;
  for (const p of proibidos) {
    if (p.padrao.test(alvo)) {
      console.log(c.erro(`  ${FALHA} — push BLOQUEADO: ${p.motivo}.`));
      return 1;
    }
  }
  if (/^(upstream|leanai-upstream)$/i.test(remoto)) {
    console.log(c.erro(`  ${FALHA} — push BLOQUEADO: "${remoto}" é um upstream, não um destino de trabalho.`));
    return 1;
  }
  const sujos = arquivosDeClienteModificados();
  if (sujos.length) {
    console.log(c.erro(`  ${FALHA} — push BLOQUEADO: instalação BASE com dados de workspace modificados:`));
    for (const s of sujos.slice(0, 20)) console.log(`      ${s}`);
    console.log(c.dim('  Dados de empresa nunca entram no LeanAI Base.'));
    return 1;
  }
  console.log(c.ok(`  ${OK} — destino válido.`));
  return 0;
}

/**
 * Uma instalação sem marcador é LOCAL. É o padrão à prova de falha: um clone
 * recém-baixado nunca consegue enviar nada para lugar nenhum. Só a cópia de quem
 * mantém o LeanAI declara "base" explicitamente.
 */
function lerInstalacao() {
  const p = path.join(RAIZ, 'core', 'instalacao.json');
  if (!exists(p)) return { modo: 'local', empresa: null };
  try {
    const j = JSON.parse(readText(p));
    return { modo: j.modo === 'base' ? 'base' : 'local', ...j };
  } catch { return { modo: 'local', empresa: null }; }
}

function arquivosDeClienteModificados() {
  const cfg = loadConfig(RAIZ);
  const prefixos = Object.values(cfg.workspace).map((d) => `${d}/`);
  let saida;
  try {
    saida = String(execFileSync('git', ['status', '--porcelain'], { stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch { return []; }
  return saida.split('\n').map((l) => l.slice(3).trim()).filter(Boolean)
    .filter((f) => prefixos.some((p) => f.startsWith(p)))
    .filter((f) => !/(^|\/)README\.md$/.test(f) && !/(^|\/)\.gitkeep$/.test(f));
}

/** Varredura de segredos no working tree (não substitui revisão humana). */
function cmdScan() {
  cabecalho('scan — varredura de segredos e dados sensíveis');
  const padroes = [
    ['OpenAI API key', /\bsk-[A-Za-z0-9_-]{20,}/],
    ['GitHub PAT clássico', /\bghp_[A-Za-z0-9]{30,}/],
    ['GitHub PAT fine-grained', /\bgithub_pat_[A-Za-z0-9_]{30,}/],
    ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
    ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}/],
    ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
    ['Meta long-lived token', /\bEAA[A-Za-z0-9]{40,}/],
    ['Chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ];
  const ignorar = new Set(['.git', 'node_modules', '.venv', 'dist', 'build']);
  const achados = [];
  const binario = /\.(png|jpe?g|gif|webp|pdf|zip|exe|dll|woff2?|ttf|otf|mp4|mov|ico|sqlite|db)$/i;

  (function varrer(dir) {
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (ignorar.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { varrer(full); continue; }
      if (!e.isFile() || binario.test(e.name)) continue;
      let texto;
      try { texto = readText(full); } catch { continue; }
      if (texto.length > 2_000_000) continue;
      for (const [rotulo, re] of padroes) {
        const m = re.exec(texto);
        if (m) {
          const linha = texto.slice(0, m.index).split('\n').length;
          achados.push({ rotulo, arquivo: path.relative(RAIZ, full).split(path.sep).join('/'), linha });
        }
      }
    }
  })(RAIZ);

  const env = [];
  (function varrerEnv(dir) {
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (ignorar.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { varrerEnv(full); continue; }
      if (/^\.env($|\.)/.test(e.name) && e.name !== '.env.example') {
        env.push(path.relative(RAIZ, full).split(path.sep).join('/'));
      }
    }
  })(RAIZ);

  for (const a of achados) console.log(`  ${c.erro('SEGREDO')}  ${a.arquivo}:${a.linha}  ${a.rotulo}`);
  for (const f of env) console.log(`  ${c.aviso('.ENV')}     ${f}  ${c.dim('(deve estar no .gitignore)')}`);
  console.log('');
  if (achados.length) { console.log(c.erro(`  ${FALHA} — ${achados.length} possível(is) segredo(s).`)); return 1; }
  console.log(c.ok(`  ${OK} — nenhum segredo detectado${env.length ? `; ${env.length} arquivo(s) .env presentes (ignorados pelo git)` : ''}.`));
  return 0;
}

function cmdSkills(args) {
  const cfg = loadConfig(RAIZ);
  const json = args.includes('--json');
  const skills = listSkills(RAIZ, cfg);
  if (json) {
    const dados = skills.map((s) => {
      const t = readText(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'SKILL.md'));
      return {
        nome: s,
        claude: cfg.agentes.claude.sintaxeInvocacao.replace('{skill}', s),
        codex: cfg.agentes.codex.sintaxeInvocacao.replace('{skill}', s),
        hash: sha256(t).slice(0, 12),
      };
    });
    console.log(JSON.stringify(dados, null, 2));
    return 0;
  }
  cabecalho(`skills — ${skills.length} canônicas`);
  console.log('  CLAUDE CODE            CODEX                  HASH');
  for (const s of skills) {
    const t = readText(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'SKILL.md'));
    const cl = cfg.agentes.claude.sintaxeInvocacao.replace('{skill}', s);
    const cx = cfg.agentes.codex.sintaxeInvocacao.replace('{skill}', s);
    console.log(`  ${cl.padEnd(22)} ${cx.padEnd(22)} ${sha256(t).slice(0, 12)}`);
  }
  return 0;
}

/**
 * Marca a instalação e blinda os remotos.
 *
 * Um clone recém-baixado tem "origin" apontando para o LeanAI público, com push
 * habilitado. Este comando transforma isso em "leanai", somente leitura: fetch
 * continua funcionando para receber atualizações, push falha no próprio git.
 */
function cmdInit(args) {
  const cfg = loadConfig(RAIZ);
  const nome = args.filter((a) => !a.startsWith('-')).join(' ').trim();
  const base = args.includes('--base');
  cabecalho(base ? 'init — instalação BASE (mantenedor)' : 'init — instalação LOCAL da empresa');

  if (!base && !nome) {
    console.log(c.erro(`  ${FALHA} — informe o nome da empresa: leanai init "Nome da Empresa"`));
    return 1;
  }

  const dados = base
    ? { modo: 'base', empresa: null, engineVersion: cfg.engineVersion, criadoEm: hoje() }
    : {
      modo: 'local',
      empresa: nome,
      engineVersion: cfg.engineVersion,
      criadoEm: hoje(),
      pushDesativado: true,
      backupRemotoAutorizado: null,
      nota: 'Instalação local. Memória, identidade, projetos e saídas ficam nesta pasta. Nada é enviado para a internet.',
    };
  writeText(path.join(RAIZ, 'core', 'instalacao.json'), JSON.stringify(dados, null, 2));
  console.log(`  modo            ${dados.modo}`);
  if (nome) console.log(`  empresa         ${nome}`);

  if (!base) blindarRemotos(cfg);

  console.log(c.ok(`\n  ${OK} — core/instalacao.json escrito.`));
  return 0;
}

function hoje() { return new Date().toISOString().slice(0, 10); }

/** Converte o "origin" herdado do clone em um remoto de leitura chamado "leanai". */
function blindarRemotos(cfg) {
  const nomeBase = cfg.local.remotoBase;
  const urlBloqueada = cfg.local.urlPushBloqueada;
  let remotos;
  try { remotos = git(['remote']).split('\n').filter(Boolean); } catch { return; }

  const ehRepoBase = (u) => /github\.com[:/]+leangiraldes\/LeanAI(\.git)?$/i.test((u || '').trim());

  // 1) Um "origin" que aponta para o LeanAI público vira "leanai".
  if (remotos.includes('origin') && !remotos.includes(nomeBase)) {
    let urlOrigin = '';
    try { urlOrigin = git(['remote', 'get-url', 'origin']); } catch { /* sem url */ }
    if (ehRepoBase(urlOrigin)) {
      git(['remote', 'rename', 'origin', nomeBase]);
      remotos = git(['remote']).split('\n').filter(Boolean);
      console.log(`  remoto          origin → ${nomeBase}  (era o clone do LeanAI público)`);
    }
  }

  // 2) Se nem origin nem leanai existem, cria o leanai para permitir atualizações.
  if (!remotos.includes(nomeBase)) {
    git(['remote', 'add', nomeBase, cfg.local.repositorioBase]);
    remotos.push(nomeBase);
    console.log(`  remoto          ${nomeBase} criado (somente leitura)`);
  }

  // 3) Push desabilitado no git, além do bloqueio do guard.
  git(['remote', 'set-url', '--push', nomeBase, urlBloqueada]);
  console.log(`  ${nomeBase.padEnd(15)} fetch ${git(['remote', 'get-url', nomeBase])}`);
  console.log(`  ${''.padEnd(15)} push  ${c.aviso('bloqueado')}`);

  // 4) Qualquer outro remoto sobrando é sinalizado — não removido em silêncio.
  const sobrando = remotos.filter((r) => r !== nomeBase);
  if (sobrando.length) {
    console.log(c.aviso(`\n  Atenção: outros remotos configurados: ${sobrando.join(', ')}`));
    console.log(c.dim('  O guard bloqueia push para todos eles no modo local. Remova com'));
    console.log(c.dim(`  "git remote remove <nome>" se não forem necessários.`));
  }
}

function git(args, opcoes = {}) {
  return String(execFileSync('git', args, {
    cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opcoes,
  })).trim();
}

/**
 * Compara o projeto de origem com o LeanAI. Só leitura: busca, compara e relata.
 * Nunca mescla — o LeanAI é um repositório independente, não um fork.
 */
function cmdUpstream(args) {
  const cfg = loadConfig(RAIZ);
  const org = cfg.origemTecnica;
  if (!org) { console.log(c.erro('  core/leanai.config.json sem "origemTecnica".')); return 1; }
  const remoto = org.remotoSugerido || 'upstream';

  if (args.includes('--merge') || args.includes('merge')) {
    cabecalho('upstream');
    console.log(c.erro(`  ${FALHA} — este comando nunca mescla.`));
    console.log(c.dim('  O LeanAI é independente. Traga mudanças manualmente, arquivo a arquivo,'));
    console.log(c.dim('  depois de ler o relatório e decidir o que faz sentido.'));
    return 1;
  }

  cabecalho(`upstream — comparar com ${org.projeto} (somente leitura)`);

  let remotos = [];
  try { remotos = git(['remote']).split('\n').filter(Boolean); } catch {
    console.log(c.erro(`  ${FALHA} — não é um repositório git.`)); return 1;
  }

  if (!remotos.includes(remoto)) {
    if (!args.includes('--configurar')) {
      console.log(c.aviso(`  O remoto "${remoto}" não está configurado.`));
      console.log(`  Para adicioná-lo como referência técnica (sem push, sem fork):`);
      console.log(c.dim(`\n      node core/bin/leanai.mjs upstream --configurar\n`));
      console.log(c.dim(`  Ele apontaria para ${org.repositorio}`));
      return 1;
    }
    git(['remote', 'add', remoto, org.repositorio]);
    // Push desabilitado no próprio git: defesa a mais, além do guard.
    git(['remote', 'set-url', '--push', remoto, 'PUSH-BLOQUEADO-PELO-LEANAI']);
    console.log(c.ok(`  remoto "${remoto}" adicionado como somente leitura`));
    console.log(c.dim(`    fetch: ${org.repositorio}`));
    console.log(c.dim(`    push:  desabilitado no git, além do bloqueio do "guard"`));
  }

  console.log(c.dim(`  buscando ${remoto}…`));
  try { git(['fetch', '--quiet', remoto], { stdio: ['ignore', 'pipe', 'inherit'] }); } catch (e) {
    console.log(c.erro(`  ${FALHA} — não foi possível buscar o remoto. Sem rede ou repositório indisponível.`));
    return 1;
  }

  const base = org.commitBase;
  const ref = `${remoto}/main`;
  let topo;
  try { topo = git(['rev-parse', ref]); } catch {
    console.log(c.erro(`  ${FALHA} — "${ref}" não existe no remoto.`)); return 1;
  }

  console.log('');
  console.log(`  base do LeanAI     ${org.commitBaseCurto}  (${org.commitBaseData ?? '—'})`);
  console.log(`  topo do ${org.projeto}      ${topo.slice(0, 7)}`);

  if (topo === base) {
    console.log('');
    console.log(c.ok(`  ${OK} — o ${org.projeto} não recebeu nenhuma atualização desde a base do LeanAI.`));
    return 0;
  }

  const commits = git(['log', '--oneline', `${base}..${ref}`]).split('\n').filter(Boolean);
  const arquivos = git(['diff', '--name-status', base, ref]).split('\n').filter(Boolean);

  console.log('');
  console.log(c.aviso(`  ${commits.length} commit(s) novo(s) no ${org.projeto}:`));
  for (const l of commits) console.log(`    ${l}`);

  console.log('');
  console.log(`  ${arquivos.length} arquivo(s) alterado(s):`);
  for (const l of arquivos) {
    const [estado, ...resto] = l.split(/\s+/);
    console.log(`    ${estado.padEnd(3)} ${resto.join(' ')}`);
  }

  // Skills tocadas do lado do projeto de origem, e o risco de conflito no LeanAI.
  const reescritas = new Set(org.skillsReescritas || []);
  const skillsLocais = new Set(listSkills(RAIZ, cfg));
  const tocadas = [];
  for (const l of arquivos) {
    const m = /\.claude\/skills\/([a-z0-9-]+)\/SKILL\.md/.exec(l);
    if (m && !tocadas.includes(m[1])) tocadas.push(m[1]);
  }

  console.log('');
  if (!tocadas.length) {
    console.log('  Nenhuma skill alterada do lado do projeto de origem.');
  } else {
    console.log(`  ${tocadas.length} skill(s) alterada(s) — e o que isso significa no LeanAI:`);
    for (const s of tocadas) {
      if (!skillsLocais.has(s)) {
        console.log(`    ${c.aviso('NOVA')}        ${s.padEnd(22)} não existe no LeanAI — avaliar se cabe`);
      } else if (reescritas.has(s)) {
        console.log(`    ${c.erro('CONFLITO')}    ${s.padEnd(22)} reescrita no LeanAI — não copiar; ler e decidir`);
      } else {
        console.log(`    ${c.ok('COMPARÁVEL')}  ${s.padEnd(22)} núcleo preservado — a mudança pode ser aplicável`);
      }
    }
  }

  console.log('');
  console.log(c.dim('  Nada foi mesclado. Para ver uma mudança específica:'));
  console.log(c.dim(`      git diff ${org.commitBaseCurto} ${ref} -- .claude/skills/<nome>/SKILL.md`));
  console.log(c.dim('  Ao trazer algo, edite a fonte canônica em skills/<nome>/SKILL.md e rode "sync".'));
  console.log(c.dim('  Lembre que a licença do projeto de origem continua valendo — ver NOTICE.md.'));
  return 0;
}

// Caminhos que pertencem ao motor. Só estes são tocados por uma atualização.
const CAMINHOS_MOTOR = [
  'core/regras', 'core/templates', 'core/lib', 'core/bin', 'core/leanai.config.json',
  'skills', 'adapters', 'installer', 'tests', 'docs', '.github',
  'README.md', 'NOTICE.md', 'package.json', '.gitattributes', '.gitignore',
];

/**
 * Atualiza o motor a partir do LeanAI público. Sempre no sentido
 *     instalação local  ←  github.com/leangiraldes/LeanAI
 * e nunca o contrário. Nenhum arquivo local é enviado em nenhum momento.
 */
function cmdUpdate(args) {
  const cfg = loadConfig(RAIZ);
  const nomeBase = cfg.local.remotoBase;
  const aplicar = args.includes('--aplicar');
  cabecalho(aplicar ? 'update — aplicar atualização do motor' : 'update — consultar atualizações');

  let remotos;
  try { remotos = git(['remote']).split('\n').filter(Boolean); } catch {
    console.log(c.erro(`  ${FALHA} — não é um repositório git.`)); return 1;
  }
  if (!remotos.includes(nomeBase)) {
    console.log(c.erro(`  ${FALHA} — o remoto "${nomeBase}" não existe.`));
    console.log(c.dim(`  Configure com: node core/bin/leanai.mjs init "<Nome da Empresa>"`));
    return 1;
  }

  console.log(c.dim(`  consultando ${git(['remote', 'get-url', nomeBase])} …`));
  try { git(['fetch', '--quiet', nomeBase]); } catch {
    console.log(c.erro(`  ${FALHA} — não foi possível consultar. Sem internet?`));
    console.log(c.dim('  O LeanAI continua funcionando normalmente offline — a atualização é opcional.'));
    return 1;
  }

  const ref = `${nomeBase}/main`;
  let topo;
  try { topo = git(['rev-parse', ref]); } catch {
    console.log(c.erro(`  ${FALHA} — "${ref}" não existe no remoto.`)); return 1;
  }
  const atual = git(['rev-parse', 'HEAD']);

  let versaoRemota = '?';
  try {
    versaoRemota = JSON.parse(git(['show', `${ref}:core/leanai.config.json`])).engineVersion;
  } catch { /* config remoto ilegível */ }

  console.log('');
  console.log(`  instalado       v${cfg.engineVersion}   ${atual.slice(0, 7)}`);
  console.log(`  disponível      v${versaoRemota}   ${topo.slice(0, 7)}`);

  if (topo === atual) {
    console.log('');
    console.log(c.ok(`  ${OK} — já está na versão mais recente. Nada a fazer.`));
    return 0;
  }

  const novos = git(['log', '--oneline', `${atual}..${ref}`]).split('\n').filter(Boolean);
  if (!novos.length) {
    console.log('');
    console.log(c.aviso('  Esta instalação tem commits próprios à frente do LeanAI público.'));
    console.log(c.dim('  Nada novo para trazer.'));
    return 0;
  }

  const alterados = git(['diff', '--name-only', atual, ref]).split('\n').filter(Boolean);
  const ehMotor = (f) => CAMINHOS_MOTOR.some((p) => f === p || f.startsWith(p + '/'));
  const motor = alterados.filter(ehMotor);
  const foraDoMotor = alterados.filter((f) => !ehMotor(f));

  console.log('');
  console.log(c.aviso(`  ${novos.length} atualização(ões) disponível(is):`));
  for (const l of novos.slice(0, 15)) console.log(`    ${l}`);
  if (novos.length > 15) console.log(c.dim(`    … e mais ${novos.length - 15}`));

  console.log('');
  console.log(`  ${motor.length} arquivo(s) de motor seriam atualizados:`);
  for (const f of motor.slice(0, 25)) console.log(`    ${f}`);
  if (motor.length > 25) console.log(c.dim(`    … e mais ${motor.length - 25}`));

  if (foraDoMotor.length) {
    console.log('');
    console.log(c.dim(`  ${foraDoMotor.length} arquivo(s) fora do motor seriam IGNORADOS (não são atualizáveis):`));
    for (const f of foraDoMotor.slice(0, 10)) console.log(c.dim(`    ${f}`));
  }

  const preservados = Object.values(cfg.workspace).filter((d) => exists(path.join(RAIZ, d)));
  console.log('');
  console.log(c.ok('  Permanece intocado nesta máquina:'));
  for (const d of preservados) console.log(`    ${d}/`);
  console.log('    core/instalacao.json');
  console.log('    bloco personalizado de CLAUDE.md e AGENTS.md');
  console.log('    skills criadas nesta instalação');

  if (!aplicar) {
    console.log('');
    console.log(c.dim('  Nada foi alterado. Para aplicar:'));
    console.log(c.dim('      node core/bin/leanai.mjs update --aplicar'));
    return 0;
  }

  // ----- Aplicação -----
  console.log('');
  const sujo = git(['status', '--porcelain']).split('\n').filter(Boolean);
  if (sujo.length) {
    console.log(c.erro(`  ${FALHA} — há trabalho não commitado. Rode a skill "salvar" antes de atualizar.`));
    for (const l of sujo.slice(0, 10)) console.log(`      ${l}`);
    return 1;
  }

  const pontoRetorno = `leanai-antes-da-atualizacao-${hoje()}`;
  try { git(['branch', '-f', pontoRetorno, 'HEAD']); } catch { /* já existe */ }
  console.log(`  ponto de retorno criado: ${pontoRetorno}`);

  const agentesAntes = Object.fromEntries(
    Object.entries(cfg.agentes).map(([k, a]) => [k, a.habilitado !== false]),
  );
  const instalacaoAntes = lerInstalacao();

  const alvos = CAMINHOS_MOTOR.filter((p) => {
    try { git(['cat-file', '-e', `${ref}:${p}`]); return true; } catch { return false; }
  });
  git(['checkout', ref, '--', ...alvos]);
  console.log(`  ${alvos.length} caminho(s) de motor atualizado(s)`);

  // A escolha de agentes e o modo da instalação são desta máquina, não do motor.
  const cfgNovo = JSON.parse(readText(path.join(RAIZ, 'core', 'leanai.config.json')));
  for (const [k, ligado] of Object.entries(agentesAntes)) {
    if (cfgNovo.agentes[k]) cfgNovo.agentes[k].habilitado = ligado;
  }
  writeText(path.join(RAIZ, 'core', 'leanai.config.json'), JSON.stringify(cfgNovo, null, 2));
  writeText(path.join(RAIZ, 'core', 'instalacao.json'), JSON.stringify({
    ...instalacaoAntes, engineVersion: cfgNovo.engineVersion, atualizadoEm: hoje(),
  }, null, 2));
  console.log('  escolha de agentes e identificação da instalação preservadas');

  console.log('');
  console.log(c.ok(`  ${OK} — motor atualizado para v${cfgNovo.engineVersion}.`));
  console.log(c.dim('  Agora rode:  sync  ·  check  ·  verify  ·  node tests/run.mjs'));
  console.log(c.dim(`  Para desfazer:  git reset --hard ${pontoRetorno}`));
  return 0;
}

/** Liga/desliga agentes em core/leanai.config.json. Ex.: leanai agentes claude codex */
function cmdAgentes(args) {
  cabecalho('agentes — quais runtimes este workspace atende');
  const cfgPath = path.join(RAIZ, 'core', 'leanai.config.json');
  const cfg = JSON.parse(readText(cfgPath));
  const validos = Object.keys(cfg.agentes);

  const pedidos = args.filter((a) => !a.startsWith('-')).flatMap((a) => a.split(',')).map((s) => s.trim()).filter(Boolean);
  if (!pedidos.length) {
    for (const [k, a] of Object.entries(cfg.agentes)) {
      console.log(`  ${a.habilitado === false ? c.dim('desligado') : c.ok('ligado   ')}  ${k.padEnd(8)} ${a.nome}`);
    }
    console.log(c.dim('\n  Para mudar: leanai agentes claude codex   (lista os que ficam ligados)'));
    return 0;
  }
  const desconhecidos = pedidos.filter((p) => !validos.includes(p));
  if (desconhecidos.length) {
    console.log(c.erro(`  ${FALHA} — agente desconhecido: ${desconhecidos.join(', ')}. Válidos: ${validos.join(', ')}`));
    return 1;
  }
  for (const k of validos) cfg.agentes[k].habilitado = pedidos.includes(k);
  writeText(cfgPath, JSON.stringify(cfg, null, 2));
  for (const k of validos) {
    console.log(`  ${cfg.agentes[k].habilitado ? c.ok('ligado   ') : c.dim('desligado')}  ${k.padEnd(8)} ${cfg.agentes[k].nome}`);
  }
  console.log(c.ok(`\n  ${OK} — rode "sync" para regenerar os artefatos.`));
  return 0;
}

const ARQUIVOS_CONTEXTO = [
  '_memoria/empresa.md',
  '_memoria/preferencias.md',
  '_memoria/estrategia.md',
  'identidade/design-guide.md',
];

/**
 * Distingue arquivo de contexto preenchido de placeholder.
 * O marcador explícito manda: um template pode trazer defaults úteis que uma
 * heurística leria como conteúdo do cliente. O /instalar remove o marcador ao
 * escrever de verdade. A heurística fica como rede para arquivos sem marcador.
 */
function temConteudoReal(texto) {
  if (texto.includes('leanai:placeholder')) return false;
  for (const bruta of texto.split('\n')) {
    let l = bruta.trim();
    if (!l || l.startsWith('#') || l.startsWith('>') || l.startsWith('---') || l.startsWith('|')) continue;
    l = l.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');   // marcador de lista
    l = l.replace(/\*\*/g, '').replace(/^_+|_+$/g, '').trim(); // ênfase
    if (!l) continue;
    if (l.includes(':')) {
      const valor = l.slice(l.indexOf(':') + 1).trim();
      // "Nome:" vazio, ou só um comentário em itálico, continua sendo placeholder.
      if (!valor || /^\*?\(.*\)\*?$/.test(valor)) continue;
      return true;
    }
    if (l.split(/\s+/).length >= 3) return true; // prosa de verdade
  }
  return false;
}

/** Reporta quais arquivos de contexto já têm conteúdo real. */
function cmdEstado(args) {
  const json = args.includes('--json');
  const preenchidos = [];
  const vazios = [];
  for (const rel of ARQUIVOS_CONTEXTO) {
    const p = path.join(RAIZ, rel);
    if (!exists(p)) { vazios.push(rel); continue; }
    (temConteudoReal(readText(p)) ? preenchidos : vazios).push(rel);
  }
  const inst = lerInstalacao();
  if (json) {
    console.log(JSON.stringify({ modo: inst.modo, empresa: inst.empresa ?? null, preenchidos, vazios }, null, 2));
    return 0;
  }
  cabecalho('estado — contexto da instalação');
  console.log(`  modo            ${inst.modo}${inst.empresa ? ` (${inst.empresa})` : ''}`);
  for (const f of preenchidos) console.log(`  ${c.ok('preenchido')}  ${f}`);
  for (const f of vazios) console.log(`  ${c.dim('em branco ')}  ${f}`);
  console.log('');
  console.log(preenchidos.length
    ? c.aviso(`  ${preenchidos.length} arquivo(s) com contexto real — não sobrescrever sem confirmar.`)
    : c.ok('  Memória em branco — pronta para o onboarding.'));
  return 0;
}

function cmdAjuda() {
  console.log(`
${c.forte('LeanAI')} — sistema operacional inteligente para empresas.
Compatível com Claude Code e Codex a partir de uma fonte única.

  node core/bin/leanai.mjs <comando>

Comandos
  sync [--dry-run]   Gera .claude/skills/, .agents/skills/, CLAUDE.md e AGENTS.md
                     a partir da fonte canônica em skills/ e core/regras/.
  check              Detecta divergência entre fonte e artefatos (hash SHA-256).
                     Sai com código 1 se houver diferença. Use em CI e pré-push.
  doctor             Detecta git, gh, Claude Code, Codex e Node.
  verify             Valida a estrutura do projeto.
  scan               Varre segredos e dados sensíveis no working tree.
  guard [remoto]     Valida o destino antes de um push. Numa instalação local, bloqueia
                     TODOS os destinos — os dados da empresa não saem da máquina.
  skills [--json]    Lista as skills e como invocá-las em cada runtime.
  estado [--json]    Diz quais arquivos de contexto já têm conteúdo real.
  agentes [lista]    Mostra ou define quais runtimes ficam ativos (ex.: agentes claude codex).
  upstream [--configurar]
                     Compara o projeto de origem com o LeanAI. Só leitura: nunca mescla,
                     nunca faz push. --configurar adiciona o remoto sem permissão de push.
  init <empresa>     Marca a instalação como LOCAL e blinda os remotos: o clone do
                     LeanAI público vira "leanai", somente leitura. (--base: cópia do mantenedor.)
  update [--aplicar] Consulta atualizações do LeanAI público e mostra o que mudaria.
                     Só altera algo com --aplicar. Nunca envia nada.
  help               Esta ajuda.
`);
  return 0;
}

const comandos = {
  sync: cmdSync, check: cmdCheck, doctor: cmdDoctor, verify: cmdVerify,
  scan: cmdScan, guard: cmdGuard, skills: cmdSkills, init: cmdInit, estado: cmdEstado, agentes: cmdAgentes, upstream: cmdUpstream, update: cmdUpdate,
  help: cmdAjuda, '--help': cmdAjuda, '-h': cmdAjuda,
};

const [, , cmd = 'help', ...resto] = process.argv;
const fn = comandos[cmd];
if (!fn) {
  console.error(c.erro(`comando desconhecido: ${cmd}`));
  cmdAjuda();
  process.exit(2);
}
try {
  process.exit(fn(resto) || 0);
} catch (e) {
  console.error(c.erro(`\n  ERRO  ${e.message}`));
  if (process.env.LEANAI_DEBUG) console.error(e.stack);
  process.exit(1);
}

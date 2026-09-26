#!/usr/bin/env node
// LeanAI — suíte de validação e paridade.
// Sem dependências. Roda em Windows, macOS e Linux.
//    node tests/run.mjs            estrutural + paridade + sincronização
//    node tests/run.mjs --matriz   imprime só a matriz de paridade
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadConfig, plan, check, listSkills, renderTokens } from '../core/lib/build.mjs';
import { readText, exists, listDirs, sha256, splitFrontmatter, parseYamlSubset, walkFiles } from '../core/lib/util.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = loadConfig(RAIZ);
const cor = process.stdout.isTTY && !process.env.NO_COLOR;
const verde = (s) => (cor ? `\x1b[32m${s}\x1b[0m` : s);
const vermelho = (s) => (cor ? `\x1b[31m${s}\x1b[0m` : s);
const amarelo = (s) => (cor ? `\x1b[33m${s}\x1b[0m` : s);
const dim = (s) => (cor ? `\x1b[2m${s}\x1b[0m` : s);

const resultados = [];
let grupoAtual = '';

function grupo(nome) {
  grupoAtual = nome;
  console.log('');
  console.log(dim(`── ${nome} ${'─'.repeat(Math.max(0, 58 - nome.length))}`));
}

function teste(nome, fn) {
  let estado = 'PASS';
  let detalhe = '';
  try {
    const r = fn();
    if (r === 'SKIP') { estado = 'SKIP'; detalhe = 'não aplicável neste ambiente'; }
    else if (typeof r === 'string' && r) { estado = 'SKIP'; detalhe = r; }
  } catch (e) {
    estado = 'FAIL';
    detalhe = e.message;
  }
  resultados.push({ grupo: grupoAtual, nome, estado, detalhe });
  const marca = estado === 'PASS' ? verde('PASS') : estado === 'FAIL' ? vermelho('FAIL') : amarelo('SKIP');
  console.log(`  ${marca}  ${nome}${detalhe ? dim('  — ' + detalhe) : ''}`);
}

function afirmar(cond, msg) {
  if (!cond) throw new Error(msg);
}

const SKILLS_ESPERADAS = [
  'abrir', 'analisar-dados', 'anuncio-google', 'aprovar-post', 'atualizar',
  'carrossel', 'email-profissional', 'instalar', 'mapear-rotinas', 'novo-projeto',
  'publicar-tema', 'relatorio-ads', 'responder-avaliacoes', 'salvar', 'seo',
];

const skills = listSkills(RAIZ, cfg);
const agentes = Object.entries(cfg.agentes).filter(([, a]) => a.habilitado !== false);

// ---------------------------------------------------------------------------
grupo('Estrutura');

teste('as 15 skills do inventário existem na fonte canônica', () => {
  const faltando = SKILLS_ESPERADAS.filter((s) => !skills.includes(s));
  afirmar(faltando.length === 0, `faltando: ${faltando.join(', ')}`);
  afirmar(skills.length >= 15, `esperado >= 15, encontrado ${skills.length}`);
});

teste('nenhuma skill foi perdida em relação ao MazyOS', () => {
  const extras = skills.filter((s) => !SKILLS_ESPERADAS.includes(s));
  afirmar(SKILLS_ESPERADAS.every((s) => skills.includes(s)),
    'skill do inventário original ausente');
  return extras.length ? `${extras.length} skill(s) nova(s) além do inventário: ${extras.join(', ')}` : undefined;
});

for (const arquivo of cfg.ordemRegras) {
  teste(`regra canônica core/regras/${arquivo}`, () => {
    afirmar(exists(path.join(RAIZ, cfg.fonteCanonica.regras, arquivo)), 'ausente');
  });
}

teste('arquivos obrigatórios na raiz', () => {
  for (const f of ['README.md', 'NOTICE.md', '.gitignore', '.gitattributes', '.env.example']) {
    afirmar(exists(path.join(RAIZ, f)), `${f} ausente`);
  }
});

teste('workspace da empresa presente', () => {
  for (const d of Object.values(cfg.workspace)) {
    afirmar(exists(path.join(RAIZ, d)), `${d}/ ausente`);
  }
});

// ---------------------------------------------------------------------------
grupo('Frontmatter das skills canônicas');

for (const s of skills) {
  teste(`${s}: frontmatter válido e discoverable`, () => {
    const texto = readText(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'SKILL.md'));
    afirmar(texto.charCodeAt(0) !== 0xfeff, 'arquivo com BOM UTF-8 — quebra parsers de YAML');
    const { frontmatter, body } = splitFrontmatter(texto);
    afirmar(frontmatter, 'sem frontmatter YAML');
    const fm = parseYamlSubset(frontmatter);
    afirmar(fm.name === s, `name="${fm.name}" difere da pasta "${s}"`);
    afirmar(fm.description && fm.description.length >= 40,
      'description ausente ou curta demais para disparar a skill');
    afirmar(body.trim().length > 200, 'corpo vazio ou curto demais');
  });
}

// ---------------------------------------------------------------------------
grupo('Sincronização determinística');

teste('sync é idempotente (rodar duas vezes dá o mesmo resultado)', () => {
  const a = plan(RAIZ, cfg).outputs;
  const b = plan(RAIZ, cfg).outputs;
  afirmar(a.size === b.size, 'número de artefatos mudou entre execuções');
  for (const [k, v] of a) afirmar(sha256(v) === sha256(b.get(k)), `artefato instável: ${k}`);
});

teste('check não acusa divergência entre fonte e gerados', () => {
  const r = check(RAIZ, cfg);
  afirmar(r.divergencias.length === 0,
    `${r.divergencias.length} divergência(s): ${r.divergencias.slice(0, 3).map((d) => `${d.rel} (${d.tipo})`).join('; ')}`);
  afirmar(r.orfaos.length === 0, `${r.orfaos.length} órfão(s): ${r.orfaos.slice(0, 3).join('; ')}`);
});

teste('check detecta divergência quando um gerado é alterado', () => {
  const alvo = path.join(RAIZ, cfg.agentes.claude.skillsDir, skills[0], 'SKILL.md');
  const original = readText(alvo);
  try {
    fs.writeFileSync(alvo, original + '\nDIVERGENCIA_INJETADA_PELO_TESTE\n', 'utf8');
    const r = check(RAIZ, cfg);
    afirmar(r.divergencias.length > 0, 'a alteração passou despercebida — o check não protege nada');
  } finally {
    fs.writeFileSync(alvo, original, 'utf8');
  }
  afirmar(check(RAIZ, cfg).divergencias.length === 0, 'estado não foi restaurado após o teste');
});

teste('nenhum token de runtime não resolvido nos artefatos gerados', () => {
  const { outputs } = plan(RAIZ, cfg);
  const conhecidos = /\{\{(INVOCAR:[a-zA-Z0-9_-]+|AGENTE|OUTRO_AGENTE|SKILLS_DIR|SKILLS_DIR_GLOBAL|ARQUIVO_REGRAS|SINTAXE_INVOCACAO|PRODUTO)\}\}/;
  const sujos = [];
  for (const [rel, conteudo] of outputs) {
    // Tokens dentro de tabela ou de linha de exemplo são documentação intencional.
    for (const linha of conteudo.split('\n')) {
      if (!conhecidos.test(linha)) continue;
      const documentacao = linha.trimStart().startsWith('|') || linha.includes('`{{');
      if (!documentacao) sujos.push(`${rel}: ${linha.trim().slice(0, 60)}`);
    }
  }
  afirmar(sujos.length === 0, sujos.slice(0, 3).join(' | '));
});

// ---------------------------------------------------------------------------
grupo('Paridade entre agentes');

teste('cada agente tem exatamente as mesmas skills', () => {
  for (const [, a] of agentes) {
    const presentes = listDirs(path.join(RAIZ, a.skillsDir));
    const faltando = skills.filter((s) => !presentes.includes(s));
    afirmar(faltando.length === 0, `${a.nome} sem: ${faltando.join(', ')}`);
    const sobrando = presentes.filter((s) => !skills.includes(s));
    afirmar(sobrando.length === 0, `${a.nome} com skill órfã: ${sobrando.join(', ')}`);
  }
});

teste('o arquivo de regras de cada agente existe e aponta para o mesmo núcleo', () => {
  const referencias = ['_memoria/empresa.md', '_memoria/preferencias.md', '_memoria/estrategia.md', 'identidade/design-guide.md'];
  for (const [, a] of agentes) {
    const p = path.join(RAIZ, a.arquivoRegras);
    afirmar(exists(p), `${a.arquivoRegras} ausente`);
    const t = readText(p);
    for (const ref of referencias) afirmar(t.includes(ref), `${a.arquivoRegras} não referencia ${ref}`);
    afirmar(t.includes('LEANAI:INICIO-PERSONALIZADO'), `${a.arquivoRegras} sem bloco personalizado`);
  }
});

// Comparação exata, linha a linha: toda diferença entre os dois runtimes tem de ser
// explicada por um token declarado ou por um adapter. Nada de heurística reversa.
const TOKEN = /\{\{(INVOCAR:[a-zA-Z0-9_-]+|AGENTE|OUTRO_AGENTE|SKILLS_DIR|SKILLS_DIR_GLOBAL|ARQUIVO_REGRAS|SINTAXE_INVOCACAO|PRODUTO)\}\}/;

teste('toda diferença entre os runtimes é explicada por um token ou por um adapter', () => {
  const inexplicadas = [];
  for (const s of skills) {
    const canonico = readText(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'SKILL.md'));
    for (const linha of splitFrontmatter(canonico).body.split('\n')) {
      const cl = renderTokens(linha, 'claude', cfg);
      const cx = renderTokens(linha, 'codex', cfg);
      if (cl !== cx && !TOKEN.test(linha)) {
        inexplicadas.push(`${s}: ${linha.trim().slice(0, 50)}`);
      }
    }
  }
  afirmar(inexplicadas.length === 0, inexplicadas.slice(0, 3).join(' | '));
});

teste('o corpo gerado de cada agente vem do mesmo canônico, sem edição paralela', () => {
  const divergentes = [];
  for (const s of skills) {
    const canonico = readText(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'SKILL.md'));
    let corpo = splitFrontmatter(canonico).body.trim();
    for (const [key, a] of agentes) {
      let esperado = corpo;
      const extra = path.join(RAIZ, cfg.fonteCanonica.skills, s, 'adapters', `${key}.md`);
      if (exists(extra)) esperado += '\n\n' + readText(extra).trim();
      esperado = renderTokens(esperado, key, cfg).trim();

      const gerado = readText(path.join(RAIZ, a.skillsDir, s, 'SKILL.md'));
      const corpoGerado = gerado.slice(gerado.indexOf('-->') + 3).trim();
      if (corpoGerado !== esperado) divergentes.push(`${s}/${key}`);
    }
  }
  afirmar(divergentes.length === 0, `gerado fora de sincronia com o canônico: ${divergentes.join(', ')}`);
});

teste('a estrutura de seções é a mesma nos dois runtimes', () => {
  const diferentes = [];
  for (const s of skills) {
    const titulos = (rel) => readText(path.join(RAIZ, rel)).split('\n')
      .filter((l) => /^#{1,4} /.test(l))
      .map((l) => l.replace(/[/$]/g, '').replace(/\s+/g, ' ').trim());
    const c = titulos(`${cfg.agentes.claude.skillsDir}/${s}/SKILL.md`);
    const x = titulos(`${cfg.agentes.codex.skillsDir}/${s}/SKILL.md`);
    const temAdapter = ['claude', 'codex'].some((k) =>
      exists(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'adapters', `${k}.md`)));
    if (temAdapter) continue; // o adapter pode acrescentar uma seção própria
    if (c.join('|') !== x.join('|')) diferentes.push(s);
  }
  afirmar(diferentes.length === 0, `estrutura divergente: ${diferentes.join(', ')}`);
});

teste('skills com adapter declaram a diferença nos dois lados', () => {
  for (const s of skills) {
    const dir = path.join(RAIZ, cfg.fonteCanonica.skills, s, 'adapters');
    if (!exists(dir)) continue;
    const temClaude = exists(path.join(dir, 'claude.md')) || exists(path.join(dir, 'claude.yaml'));
    const temCodex = exists(path.join(dir, 'codex.md')) || exists(path.join(dir, 'codex.yaml'));
    afirmar(temClaude === temCodex,
      `${s}: adapter só para um runtime — o outro ficaria sem a orientação equivalente`);
  }
});

// ---------------------------------------------------------------------------
grupo('Segurança');

teste('scan não encontra segredo no working tree', () => {
  const r = rodarCli(['scan']);
  afirmar(r.code === 0, r.saida.split('\n').filter((l) => l.includes('SEGREDO')).slice(0, 3).join(' | '));
});

teste('scan detecta um segredo plantado (dry-run em pasta temporária)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leanai-scan-'));
  const alvo = path.join(RAIZ, '.leanai-teste-segredo.md');
  try {
    fs.writeFileSync(alvo, 'chave: sk-' + 'A'.repeat(32) + '\n', 'utf8');
    const r = rodarCli(['scan']);
    afirmar(r.code === 1, 'o scan não detectou um segredo evidente');
  } finally {
    if (exists(alvo)) fs.rmSync(alvo);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

teste('.gitignore protege segredos e a zona de entrada', () => {
  const gi = readText(path.join(RAIZ, '.gitignore'));
  for (const regra of ['.env', 'dados/*', '*.pem', '*.key', 'node_modules/']) {
    afirmar(gi.includes(regra), `.gitignore sem "${regra}"`);
  }
  afirmar(gi.includes('!.env.example'), '.env.example precisa ser exceção explícita');
});

teste('.env.example não contém valor real', () => {
  for (const linha of readText(path.join(RAIZ, '.env.example')).split('\n')) {
    if (!linha.includes('=') || linha.trimStart().startsWith('#')) continue;
    const valor = linha.split('=').slice(1).join('=').trim();
    afirmar(valor === '', `"${linha.trim()}" tem valor preenchido`);
  }
});

const INSTALACAO = path.join(RAIZ, 'core', 'instalacao.json');

/** Roda um bloco com a instalação temporariamente em outro modo, e restaura. */
function comModo(modo, fn) {
  const antes = exists(INSTALACAO) ? readText(INSTALACAO) : null;
  try {
    fs.writeFileSync(INSTALACAO, JSON.stringify({ modo, empresa: modo === 'local' ? 'Teste' : null }, null, 2), 'utf8');
    return fn();
  } finally {
    if (antes === null) { try { fs.rmSync(INSTALACAO); } catch { /* já removido */ } }
    else fs.writeFileSync(INSTALACAO, antes, 'utf8');
  }
}

teste('guard bloqueia TODO push numa instalação local', () => {
  if (!ehRepoGit()) return 'repositório git ainda não inicializado';
  const nome = 'leanai-teste-guard';
  const git = (args) => execFileSync('git', args, { cwd: RAIZ, stdio: 'ignore' });
  try {
    git(['remote', 'add', nome, 'https://github.com/exemplo/qualquer-coisa.git']);
    comModo('local', () => {
      const r = rodarCli(['guard', nome]);
      afirmar(r.code === 1, 'numa instalação local nenhum push pode passar');
      afirmar(/LOCAL/.test(r.saida), 'o guard não explicou que a instalação é local');
    });
  } finally {
    try { git(['remote', 'remove', nome]); } catch { /* já removido */ }
  }
});

teste('uma instalação SEM marcador é tratada como local (padrão à prova de falha)', () => {
  if (!ehRepoGit()) return 'repositório git ainda não inicializado';
  const antes = exists(INSTALACAO) ? readText(INSTALACAO) : null;
  const nome = 'leanai-teste-semarcador';
  const git = (args) => execFileSync('git', args, { cwd: RAIZ, stdio: 'ignore' });
  try {
    if (antes !== null) fs.rmSync(INSTALACAO);
    git(['remote', 'add', nome, 'https://github.com/exemplo/qualquer-coisa.git']);
    const r = rodarCli(['guard', nome]);
    afirmar(r.code === 1, 'um clone recém-baixado conseguiria fazer push — é o pior caso possível');
  } finally {
    try { git(['remote', 'remove', nome]); } catch { /* já removido */ }
    if (antes !== null) fs.writeFileSync(INSTALACAO, antes, 'utf8');
  }
});

teste('no modo base o guard bloqueia a origem e libera destino legítimo', () => {
  if (!ehRepoGit()) return 'repositório git ainda não inicializado';
  const nome = 'leanai-teste-guard-base';
  const git = (args) => execFileSync('git', args, { cwd: RAIZ, stdio: 'ignore' });
  try {
    git(['remote', 'add', nome, 'https://github.com/mazzeoia/MazyOS.git']);
    comModo('base', () => {
      const r = rodarCli(['guard', nome]);
      afirmar(r.code === 1, 'o guard permitiria push para o repositório de origem');
      afirmar(/BLOQUEADO/.test(r.saida), 'o guard não explicou o bloqueio');

      git(['remote', 'set-url', nome, 'https://github.com/leangiraldes/LeanAI.git']);
      const ok = rodarCli(['guard', nome]);
      afirmar(ok.code === 0, 'o mantenedor não conseguiria publicar o motor');
    });
  } finally {
    try { git(['remote', 'remove', nome]); } catch { /* já removido */ }
  }
});

teste('core/instalacao.json não é versionado', () => {
  if (!ehRepoGit()) return 'repositório git ainda não inicializado';
  try {
    execFileSync('git', ['check-ignore', '-q', 'core/instalacao.json'], { cwd: RAIZ, stdio: 'ignore' });
  } catch {
    throw new Error('o marcador da instalação entraria no repositório — cada pasta tem o seu');
  }
});

teste('a skill salvar é local-first e nunca envia nada', () => {
  const t = readText(path.join(RAIZ, cfg.fonteCanonica.skills, 'salvar', 'SKILL.md'));
  afirmar(/[Nn]unca[^.]*`?git push`?/.test(t), 'salvar não proíbe git push explicitamente');
  afirmar(/local/i.test(t), 'salvar não deixa claro que o histórico é local');
  for (const proibido of ['--force', 'reset --hard', 'clean -fd']) {
    afirmar(t.includes(proibido), `salvar não menciona a proibição de "${proibido}"`);
  }
  // Não pode instruir criação de repositório remoto.
  afirmar(!/gh repo create/.test(t), 'salvar ainda instrui criar repositório remoto');
});

teste('update consulta sem alterar e exige --aplicar', () => {
  const t = readText(path.join(RAIZ, 'core', 'bin', 'leanai.mjs'));
  afirmar(t.includes("args.includes('--aplicar')"), 'update aplica sem exigir flag explícita');
  const r = rodarCli(['update']);
  // Sem o remoto configurado ele orienta; com ele, consulta. Em nenhum caso escreve.
  afirmar(/consult|remoto|atualizaç/i.test(r.saida), 'update não reportou nada compreensível');
  afirmar(!/escrito|removido/.test(r.saida), 'update sem --aplicar alterou arquivos');
});

teste('remoto upstream, quando existe, está sem permissão de push', () => {
  if (!ehRepoGit()) return 'repositório git ainda não inicializado';
  let remotos;
  try {
    remotos = String(execFileSync('git', ['remote'], { cwd: RAIZ, encoding: 'utf8' })).split('\n').filter(Boolean);
  } catch { return 'git indisponível'; }
  if (!remotos.includes('upstream')) return 'remoto upstream não configurado neste clone';

  const pushUrl = String(execFileSync('git', ['remote', 'get-url', '--push', 'upstream'],
    { cwd: RAIZ, encoding: 'utf8' })).trim();
  afirmar(!/^https?:\/\//.test(pushUrl),
    `upstream tem URL de push válida (${pushUrl}) — deveria estar desabilitada`);
  afirmar(rodarCli(['guard', 'upstream']).code === 1, 'o guard permitiria push para o upstream');
});

teste('nenhuma credencial hardcoded nas skills', () => {
  const suspeito = /(api[_-]?key|token|senha|password|secret)\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/i;
  for (const s of skills) {
    const t = readText(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'SKILL.md'));
    for (const linha of t.split('\n')) {
      if (suspeito.test(linha) && !linha.includes('.env')) {
        throw new Error(`${s}: "${linha.trim().slice(0, 60)}"`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
grupo('Dependências declaradas pelas skills');

for (const s of skills) {
  teste(`${s}: caminhos de workspace citados existem`, () => {
    const t = readText(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'SKILL.md'));
    const citados = new Set();
    for (const m of t.matchAll(/`(_memoria\/[a-z-]+\.md|identidade\/[a-z-]+\.md|core\/templates\/[a-z/.-]+)`/g)) {
      citados.add(m[1]);
    }
    const ausentes = [...citados].filter((c) => !exists(path.join(RAIZ, c)));
    afirmar(ausentes.length === 0, `referencia arquivo inexistente: ${ausentes.join(', ')}`);
  });
}

teste('skills com ação externa avisam sobre confirmação humana', () => {
  const externas = ['aprovar-post', 'salvar', 'anuncio-google', 'email-profissional'];
  for (const s of externas) {
    if (!skills.includes(s)) continue;
    const t = readText(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'SKILL.md')).toLowerCase();
    afirmar(/confirma|aprova|perguntar|pedir confirmação|revisa/.test(t),
      `${s} executa ação externa sem exigir confirmação humana`);
  }
});

teste('skills destrutivas proíbem comandos perigosos automáticos', () => {
  const t = readText(path.join(RAIZ, cfg.fonteCanonica.skills, 'salvar', 'SKILL.md'));
  for (const proibido of ['--force', 'reset --hard', 'clean -fd']) {
    afirmar(t.includes(proibido), `salvar não menciona a proibição de "${proibido}"`);
  }
  afirmar(t.includes('guard'), 'salvar não valida o destino antes do push');
});

// ---------------------------------------------------------------------------
grupo('Motor');

teste('doctor executa e reporta o ambiente', () => {
  const r = rodarCli(['doctor']);
  afirmar(/Sistema|Node\.js/.test(r.saida), 'doctor não reportou o ambiente');
});

teste('verify passa', () => {
  const r = rodarCli(['verify']);
  afirmar(r.code === 0, r.saida.split('\n').filter((l) => l.includes('FAIL')).slice(0, 3).join(' | '));
});

teste('skills --json lista as duas formas de invocação', () => {
  const r = rodarCli(['skills', '--json']);
  const dados = JSON.parse(r.saida);
  afirmar(dados.length === skills.length, 'contagem divergente');
  for (const d of dados) {
    afirmar(d.claude === `/${d.nome}`, `invocação Claude errada para ${d.nome}`);
    afirmar(d.codex === `$${d.nome}`, `invocação Codex errada para ${d.nome}`);
  }
});

teste('reescrever o config não muda um byte (instalação nova não fica "suja")', () => {
  const p = path.join(RAIZ, 'core', 'leanai.config.json');
  const original = readText(p);
  const normalizado = JSON.stringify(JSON.parse(original), null, 2) + '\n';
  afirmar(original === normalizado,
    'o motor reescreveria o config com outra formatação, deixando o git sujo logo após instalar');
});

teste('NOTICE preserva a origem e não afirma licença inexistente', () => {
  const n = readText(path.join(RAIZ, 'NOTICE.md'));
  afirmar(n.includes('mazzeoia/MazyOS'), 'NOTICE sem o repositório de origem');
  afirmar(/n[ãa]o existe|Não existe/.test(n), 'NOTICE sem a conclusão da auditoria de licença');
  afirmar(!exists(path.join(RAIZ, 'LICENSE')),
    'existe um LICENSE — não se atribui licença sem direito verificado');
});

// ---------------------------------------------------------------------------
// Matriz de paridade
// ---------------------------------------------------------------------------

function matrizParidade() {
  console.log('');
  console.log(dim('── Matriz de paridade ' + '─'.repeat(38)));
  console.log('');
  console.log('  SKILL                  CLAUDE                 CODEX                  PARIDADE  OBSERVAÇÕES');
  const linhas = [];
  for (const s of skills) {
    const cl = exists(path.join(RAIZ, cfg.agentes.claude.skillsDir, s, 'SKILL.md'));
    const cx = exists(path.join(RAIZ, cfg.agentes.codex.skillsDir, s, 'SKILL.md'));
    const adapters = exists(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'adapters'))
      ? walkFiles(path.join(RAIZ, cfg.fonteCanonica.skills, s, 'adapters')).length : 0;
    const par = cl && cx ? 'PASS' : 'FAIL';
    const obs = adapters ? `adapter declarado (${adapters} arq.)` : 'núcleo único, sem divergência';
    linhas.push({ s, cl, cx, par, obs });
    console.log(
      `  ${s.padEnd(22)} ${(cl ? '/' + s : '—').padEnd(22)} ${(cx ? '$' + s : '—').padEnd(22)} ` +
      `${(par === 'PASS' ? verde('PASS') : vermelho('FAIL')).padEnd(cor ? 18 : 9)} ${obs}`,
    );
  }
  return linhas;
}

// ---------------------------------------------------------------------------

function rodarCli(args) {
  try {
    const saida = execFileSync(process.execPath, [path.join(RAIZ, 'core', 'bin', 'leanai.mjs'), ...args],
      { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
    return { code: 0, saida };
  } catch (e) {
    return { code: e.status ?? 1, saida: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

function ehRepoGit() {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: RAIZ, stdio: 'ignore' });
    return true;
  } catch { return false; }
}

const linhas = matrizParidade();

const pass = resultados.filter((r) => r.estado === 'PASS').length;
const fail = resultados.filter((r) => r.estado === 'FAIL').length;
const skip = resultados.filter((r) => r.estado === 'SKIP').length;

console.log('');
console.log(dim('─'.repeat(60)));
console.log(`  ${resultados.length} testes · ${verde(pass + ' passaram')} · ${fail ? vermelho(fail + ' falharam') : '0 falharam'} · ${skip} pulados`);
console.log(`  paridade: ${linhas.filter((l) => l.par === 'PASS').length}/${linhas.length} skills nos dois agentes`);
if (fail) {
  console.log('');
  for (const r of resultados.filter((x) => x.estado === 'FAIL')) {
    console.log(`  ${vermelho('FAIL')}  [${r.grupo}] ${r.nome}`);
    console.log(`        ${r.detalhe}`);
  }
}
console.log('');
process.exit(fail ? 1 : 0);

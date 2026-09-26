# Diff conceitual — MazyOS → LeanAI

Auditoria de continuidade. A pergunta que este documento responde: **alguma coisa do MazyOS
desapareceu no caminho?**

Resposta curta: **não**. Os 34 arquivos do MazyOS (commit `83ed079`) têm contrapartida no
LeanAI. Nada foi removido; três coisas foram *movidas* e uma foi *transformada*.

---

## 1. Mapeamento arquivo a arquivo

Gerado programaticamente comparando a árvore do MazyOS com a do LeanAI.

| Arquivo no MazyOS | Onde está no LeanAI |
| --- | --- |
| `.claude/skills/abrir/SKILL.md` | `skills/abrir/SKILL.md` → gerado para `.claude/` e `.agents/` |
| `.claude/skills/analisar-dados/SKILL.md` | `skills/analisar-dados/SKILL.md` → gerado para os dois |
| `.claude/skills/anuncio-google/SKILL.md` | `skills/anuncio-google/SKILL.md` → gerado para os dois |
| `.claude/skills/aprovar-post/SKILL.md` | `skills/aprovar-post/SKILL.md` → gerado para os dois |
| `.claude/skills/atualizar/SKILL.md` | `skills/atualizar/SKILL.md` → gerado para os dois |
| `.claude/skills/carrossel/SKILL.md` | `skills/carrossel/SKILL.md` → gerado para os dois |
| `.claude/skills/email-profissional/SKILL.md` | `skills/email-profissional/SKILL.md` → gerado para os dois |
| `.claude/skills/instalar/SKILL.md` | `skills/instalar/SKILL.md` → gerado para os dois |
| `.claude/skills/mapear-rotinas/SKILL.md` | `skills/mapear-rotinas/SKILL.md` → gerado para os dois |
| `.claude/skills/novo-projeto/SKILL.md` | `skills/novo-projeto/SKILL.md` → gerado para os dois |
| `.claude/skills/publicar-tema/SKILL.md` | `skills/publicar-tema/SKILL.md` → gerado para os dois |
| `.claude/skills/relatorio-ads/SKILL.md` | `skills/relatorio-ads/SKILL.md` → gerado para os dois |
| `.claude/skills/responder-avaliacoes/SKILL.md` | `skills/responder-avaliacoes/SKILL.md` → gerado para os dois |
| `.claude/skills/salvar/SKILL.md` | `skills/salvar/SKILL.md` → gerado para os dois |
| `.claude/skills/seo/SKILL.md` | `skills/seo/SKILL.md` → gerado para os dois |
| `CLAUDE.md` | `core/regras/*.md` → gerado para `CLAUDE.md` **e** `AGENTS.md` |
| `README.md` | `README.md` |
| `.gitignore` | `.gitignore` (ampliado) |
| `_memoria/empresa.md` | `_memoria/empresa.md` |
| `_memoria/preferencias.md` | `_memoria/preferencias.md` |
| `_memoria/estrategia.md` | `_memoria/estrategia.md` |
| `identidade/design-guide.md` | `identidade/design-guide.md` |
| `dados/README.md` | `dados/README.md` |
| `marketing/README.md` | `marketing/README.md` |
| `saidas/README.md` | `saidas/README.md` |
| `scripts/README.md` | `scripts/README.md` |
| `templates/skills/catalogo.md` | `core/templates/skills/catalogo.md` |
| `templates/ferramentas/catalogo.md` | `core/templates/ferramentas/catalogo.md` |
| `templates/identidade/exemplos/design-guide-agencia.md` | `core/templates/identidade/exemplos/design-guide-agencia.md` |
| `templates/identidade/exemplos/design-guide-solopreneur.md` | `core/templates/identidade/exemplos/design-guide-solopreneur.md` |
| `templates/perfis/claude-md-agencia.md` | `core/templates/perfis/perfil-agencia.md` |
| `templates/perfis/claude-md-empresa.md` | `core/templates/perfis/perfil-empresa.md` |
| `templates/perfis/claude-md-freelancer.md` | `core/templates/perfis/perfil-freelancer.md` |
| `templates/perfis/claude-md-solopreneur.md` | `core/templates/perfis/perfil-solopreneur.md` |

**34 de 34 mapeados. Zero sem contrapartida.**

---

## 2. O que foi movido, e por quê

| Movimento | Motivo |
| --- | --- |
| `.claude/skills/` → `skills/` | `.claude/` é diretório de **um** runtime. A fonte canônica não pode morar dentro da casa de um dos consumidores. `.claude/skills/` continua existindo — agora gerado. |
| `templates/` → `core/templates/` | Separa o que é **motor** (versionado, atualizável a partir do LeanAI Base) do que é **workspace da empresa** (nunca sai da instalação). |
| `templates/perfis/claude-md-*.md` → `core/templates/perfis/perfil-*.md` | O nome do arquivo citava um runtime. O conteúdo serve aos dois — o perfil alimenta o bloco personalizado tanto do `CLAUDE.md` quanto do `AGENTS.md`. |

Nenhum movimento perdeu conteúdo. O texto dos templates foi preservado; mudou o branding e
as referências de runtime.

---

## 3. O que foi transformado

### `CLAUDE.md` mantido à mão → `core/regras/` gerado

**Antes:** um arquivo de 4,5 KB, editado à mão, exclusivo do Claude Code.

**Agora:** sete arquivos em `core/regras/`, dos quais o motor gera `CLAUDE.md` **e**
`AGENTS.md`. Os cinco blocos originais estão todos lá:

| Bloco do MazyOS | Onde está agora |
| --- | --- |
| Contexto do negócio | `core/regras/10-contexto-negocio.md` |
| Fluxo de trabalho | `core/regras/20-fluxo-trabalho.md` |
| Aprender com correções | `core/regras/30-aprender-com-correcoes.md` |
| Manter contexto atualizado | `core/regras/40-manter-contexto.md` |
| Criação de skills | `core/regras/50-criacao-de-skills.md` |

Dois blocos novos: `00-sistema.md` (explica a fonte única) e `60-seguranca-e-git.md`
(segredos, destinos de push, comandos destrutivos).

### Skills mantidas à mão → skills geradas

**Antes:** editar `.claude/skills/carrossel/SKILL.md` diretamente.
**Agora:** editar `skills/carrossel/SKILL.md` e rodar `sync`.

O texto é o mesmo. O que mudou:

- BOM UTF-8 removido dos 13 arquivos que o tinham — o BOM antes do `---` pode quebrar
  parsers de YAML frontmatter
- `/skill` virou `{{INVOCAR:skill}}`; `.claude/skills/` virou `{{SKILLS_DIR}}`;
  `CLAUDE.md` virou `{{ARQUIVO_REGRAS}}`; "o Claude" virou `{{AGENTE}}`
- nomes de ferramentas específicas de um runtime (`WebSearch`, `WebFetch`) saíram do corpo
  canônico e viraram adapters — a skill fala em "busca na web", e cada runtime recebe a
  instrução concreta

---

## 4. O que ganhou funcionalidade

Nenhuma skill perdeu comportamento. Seis ganharam:

| Skill | O que tinha | O que tem agora |
| --- | --- | --- |
| **instalar** | 6 fases; entrevista de 10 perguntas | 10 fases; detecção de ambiente; escolha de agentes (1/2/3, sugerindo dual); 15 perguntas (segmento, produtos, responsáveis, posicionamento, objetivos, processos); sync + check + verify; configuração de Git com remotos separados; marcação da instalação |
| **salvar** | commit + push; regra contra `--force` | valida o destino com `guard` antes de commit **e** de push; `scan` de segredos antes do commit; `check` de paridade; repositório sempre privado; proibições explícitas de `reset --hard` e `clean -fd` |
| **atualizar** | varredura de contexto | dois modos explicitamente separados: Contexto (padrão) e Motor (sob pedido), com ponto de retorno, escopo restrito a caminhos de motor, e revalidação |
| **novo-projeto** | `CLAUDE.md` por projeto | `contexto.md` como documento único + dois ponteiros de 3 linhas; herança documentada; registro na memória |
| **mapear-rotinas** | criava em `.claude/skills/` | cria na fonte canônica; obriga `sync` + `check`; documenta os tokens; ensina a usar adapter em vez de duplicar |
| **abrir** | memória + síntese de 5 linhas | memória + projetos ativos + pendências + estado do git |

As outras nove — `carrossel`, `publicar-tema`, `aprovar-post`, `seo`,
`responder-avaliacoes`, `anuncio-google`, `relatorio-ads`, `analisar-dados`,
`email-profissional` — mantiveram o comportamento integralmente. Três receberam adapters
para funcionar igual nos dois runtimes.

---

## 5. O que é novo no LeanAI

Nada disto existia no MazyOS:

| Item | Para quê |
| --- | --- |
| `core/bin/leanai.mjs` + `core/lib/` | motor: sync, check por hash, doctor, verify, scan, guard, estado, agentes, init |
| `core/leanai.config.json` | manifesto multi-agente — adicionar um agente novo é acrescentar um bloco |
| Adapters por skill | diferença de runtime sem duplicar a skill |
| Tokens de runtime | skill escrita uma vez, renderizada para cada agente |
| `AGENTS.md` + `.agents/skills/` | suporte ao Codex |
| `installer/install.ps1` + `install.sh` | instalação em Windows, macOS e Linux |
| `tests/run.mjs` | 63 testes, incluindo matriz de paridade |
| `.github/workflows/ci.yml` | valida estrutura, paridade, segredos e instaladores nos 3 sistemas |
| `guard` + modo base/empresa | isolamento entre clientes e proteção de destino de push |
| `NOTICE.md` | origem, autoria e situação de licença |
| `projetos/` | pasta explícita para trabalho por cliente |
| `.env.example`, `.gitattributes` | segredos e fim de linha |

---

## 6. O que foi removido

**Nada.**

Duas mudanças de superfície que valem registro:

1. **Instruções de instalação do README.** O MazyOS mandava clonar
   `github.com/mazzeoia/MazyOS` e rodar `/instalar`. O LeanAI aponta para o repositório do
   próprio usuário, porque instalar a partir do repositório de origem faria toda empresa
   compartilhar o mesmo `origin` — o oposto do isolamento exigido.

2. **Renomear a pasta.** O MazyOS pedia para renomear `MazyOS/` para o nome do negócio. O
   LeanAI mantém a sugestão, e acrescenta `leanai init "<Empresa>"`, que registra a
   identidade da instalação em `core/instalacao.json` — usado pelo `guard` para impedir que
   dados de empresa vazem para o LeanAI Base.

---

## 7. Verificação

```bash
node core/bin/leanai.mjs verify     # estrutura
node core/bin/leanai.mjs check      # paridade por hash
node tests/run.mjs                  # 63 testes + matriz de paridade
```

O teste `as 15 skills do inventário existem na fonte canônica` falha se qualquer skill do
MazyOS sumir. Está no CI.

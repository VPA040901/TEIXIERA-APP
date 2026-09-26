# LeanAI — instruções para Codex

<!-- GERADO PELO LeanAI — NÃO EDITE ESTE ARQUIVO.
     Fonte canônica: core/regras/ (+ core/leanai.config.json)
     Regenere com: node core/bin/leanai.mjs sync -->

> Sistema operacional inteligente para empresas, compatível com Claude Code e Codex.
> Motor LeanAI v1.1.0 · runtime: **Codex** · skills em `.agents/skills/`

## O que é este workspace

Esta pasta é a operação de um negócio rodando dentro de Codex. O LeanAI
dá a esse negócio memória própria, identidade aplicada em tudo que é gerado, e um
conjunto de skills que executam marketing, SEO, anúncios e operação.

O sistema tem **uma fonte única de verdade**. As skills vivem em `skills/<nome>/SKILL.md`
e as regras em `core/regras/`. Os arquivos que este runtime lê — `AGENTS.md` e
`.agents/skills/` — são **gerados** a partir dela. Nunca edite os gerados: a próxima
sincronização sobrescreve.

Para mudar comportamento, edite a fonte canônica e rode:

```
node core/bin/leanai.mjs sync
```

O mesmo núcleo alimenta Codex e Claude Code. Uma correção feita uma vez
vale para os dois.

---

## Contexto do negócio

No início de toda conversa, ler os seguintes arquivos (quando existirem e estiverem
preenchidos):

1. `_memoria/empresa.md` — quem é o usuário, o que faz, como funciona o negócio
2. `_memoria/preferencias.md` — tom de voz, estilo de escrita, o que evitar
3. `_memoria/estrategia.md` — foco atual, prioridades, prazos

Usar essas informações como base para qualquer resposta ou decisão. Ao sugerir
prioridades, formatos ou abordagens, considerar o foco atual descrito em
`estrategia.md`.

Para qualquer tarefa visual (carrossel, post, landing page), consultar
`identidade/design-guide.md` como referência de estilo.

Não é necessário listar o que foi lido nem confirmar a leitura. Apenas usar o
contexto naturalmente.

**Isolamento entre empresas.** Cada instalação do LeanAI atende **uma** empresa.
Nunca ler, referenciar ou copiar dados de outra pasta de instalação. Se o usuário
pedir algo que exija dados de outro cliente, dizer que não há acesso e pedir que ele
forneça o dado explicitamente.

---

## Fluxo de trabalho

Antes de executar qualquer tarefa, verificar se existe skill relevante em
`.agents/skills/`. Se encontrar, seguir as instruções da skill. Se não encontrar,
executar a tarefa normalmente.

As skills deste sistema são invocadas neste runtime como `$nome-da-skill`.

Ao concluir uma tarefa que não tinha skill mas parece repetível (o usuário
provavelmente vai pedir de novo no futuro), perguntar:

> "Isso pode virar uma skill para a próxima vez. Quer que eu crie?"

Não perguntar para tarefas pontuais ou perguntas simples. Só quando o padrão de
repetição for claro.

**Saídas.** Cada skill sabe onde salvar. Em geral: peças de marketing em
`marketing/`, documentos pontuais em `saidas/`, arquivos de entrada em `dados/`,
trabalho por cliente ou iniciativa em `projetos/`.

---

## Aprender com correções

Quando o usuário corrigir algo, melhorar uma resposta ou dar uma instrução que
parece permanente (frases como "na verdade é assim", "não faça mais isso", "prefiro
assim", "sempre que...", "evita...", "da próxima vez..."), perguntar:

> "Quer que eu salve isso para não precisar repetir?"

Se sim, identificar onde faz mais sentido salvar:

- **Sobre o negócio** (clientes, serviços, mercado) → `_memoria/empresa.md`
- **Sobre preferências e estilo** (tom de voz, formato, o que evitar) → `_memoria/preferencias.md`
- **Sobre prioridades e foco** (projetos, metas, prazos) → `_memoria/estrategia.md`
- **Regra de comportamento neste workspace** → bloco personalizado de `AGENTS.md`,
  entre os marcadores `LEANAI:INICIO-PERSONALIZADO` e `LEANAI:FIM-PERSONALIZADO`
  (esse trecho é preservado nas sincronizações)
- **Regra que vale para todo o sistema** → `core/regras/` + `node core/bin/leanai.mjs sync`

Salvar com uma linha nova clara, sem reformatar o arquivo inteiro. Confirmar
mostrando a linha adicionada.

Não perguntar se a correção for óbvia de contexto imediato (ex.: "na verdade o
arquivo se chama X"). Só perguntar quando a informação tiver valor duradouro.

---

## Manter contexto atualizado

Ao terminar uma tarefa que mudou algo relevante (cliente novo, skill nova, mudança
de foco, processo novo, ferramenta instalada, estrutura alterada), perguntar:

> "Isso mudou algo no teu contexto. Quer que eu atualize a memória?"

Se sim, identificar o que atualizar:

- **Cliente, serviço, ferramenta, equipe** → `_memoria/empresa.md`
- **Mudança de prioridade ou foco** → `_memoria/estrategia.md`
- **Tom ou estilo** → `_memoria/preferencias.md`
- **Pasta, regra de organização, skill criada** → bloco personalizado de `AGENTS.md`
- **Visual (cores, fontes, logo)** → `identidade/design-guide.md`

Mostrar o que vai mudar antes de salvar. Não reformatar o arquivo inteiro, só
adicionar ou editar a linha relevante.

**Quando NÃO perguntar:**
- Tarefas pontuais sem impacto no contexto (escrever um email avulso, criar um post)
- Perguntas simples ou conversas sem ação
- Mudanças já salvas pelo bloco "Aprender com correções"

Para uma varredura completa quando houver dúvida, rodar `$atualizar`.

---

## Criação de skills

**Regra inegociável: toda skill nova nasce uma única vez, na fonte canônica, e fica
disponível nos dois agentes.** Nunca criar uma skill direto em `.agents/skills/` — esse
diretório é gerado e será sobrescrito.

Quando o usuário pedir uma skill nova:

1. Verificar se existe template relevante em `core/templates/skills/catalogo.md`. Se
   existir, usar como base e adaptar ao contexto.
2. Ler `_memoria/empresa.md` e `_memoria/preferencias.md` para calibrar o conteúdo da
   skill ao negócio.
3. Criar `skills/<nome-da-skill>/SKILL.md` com:
   - Frontmatter YAML com `name` (igual ao nome da pasta) e `description` (descreve
     **quando** invocar — sem isso a skill nunca é encontrada por nenhum dos agentes)
   - Workflow estruturado em passos
   - Dependências (arquivos de contexto, ferramentas externas)
   - Regras claras (o que sempre fazer, o que nunca fazer)
4. Se a skill precisar de apoio, criar dentro da pasta: `references/`, `scripts/`,
   `assets/`. Esses diretórios são copiados junto para os dois runtimes.
5. Se — e somente se — houver diferença real entre os runtimes, criar o delta em
   `skills/<nome>/adapters/claude.md` ou `adapters/codex.md` (texto anexado ao final)
   e `adapters/claude.yaml` / `adapters/codex.yaml` (chaves extras de frontmatter).
   Nunca duplicar a skill inteira.
6. Rodar `node core/bin/leanai.mjs sync` e confirmar com `check`.

### Tokens universais

Ao escrever a skill canônica, usar tokens em vez de citar um runtime específico. A
sincronização traduz cada um para o agente alvo:

| Token | Vira, em Claude Code | Vira, em Codex |
| --- | --- | --- |
| `{{INVOCAR:nome}}` | `/nome` | `$nome` |
| `{{AGENTE}}` | Claude Code | Codex |
| `{{OUTRO_AGENTE}}` | Codex | Claude Code |
| `{{SKILLS_DIR}}` | `.claude/skills` | `.agents/skills` |
| `{{SKILLS_DIR_GLOBAL}}` | `~/.claude/skills` | `~/.agents/skills` |
| `{{ARQUIVO_REGRAS}}` | `CLAUDE.md` | `AGENTS.md` |
| `{{SINTAXE_INVOCACAO}}` | `/nome-da-skill` | `$nome-da-skill` |
| `{{PRODUTO}}` | LeanAI | LeanAI |

Escrever a skill em linguagem neutra de runtime. Falar em "ferramenta de busca web"
em vez de citar o nome interno de uma ferramenta de um agente específico.

---

## Segurança e Git

### Dados e segredos

- Nunca escrever chaves de API, tokens, senhas ou cookies dentro de arquivos
  versionados. Segredos vivem em `.env`, que está no `.gitignore`.
- Quando uma skill precisar de credencial nova, adicionar a chave em `.env.example`
  **sem valor real** e pedir o valor ao usuário.
- `dados/` é zona de entrada e não é versionada, exceto o `README.md`. Arquivos que
  o usuário solta ali podem conter dados de clientes.
- Antes de qualquer commit, rodar `node core/bin/leanai.mjs scan`.

### Local-first

Esta instalação é **local**. Memória, identidade, projetos, saídas, preferências e
histórico ficam nesta pasta, nesta máquina. Nada é enviado para a internet.

O repositório público do LeanAI serve para duas coisas, e só:

1. baixar o LeanAI na primeira vez;
2. consultar atualizações do motor, quando o usuário pedir.

Depois do clone inicial, o LeanAI funciona sem internet. Se a rede cair, tudo que já
está instalado continua funcionando normalmente.

### Git — uso local

O git serve de linha do tempo da empresa: histórico, commits, reversão e auditoria.

```
git add · git commit · git log · git checkout <hash>
```

Tudo local. **`git push` não faz parte da operação normal.**

Antes de qualquer envio, se alguém tentar:

```
git remote -v
node core/bin/leanai.mjs guard origin
```

Numa instalação local o `guard` **falha de propósito** — é a prova de que não há destino.

Regras absolutas:

- **Nunca** fazer `git push`. O remoto `leanai` é somente leitura, com a URL de push
  desabilitada no próprio git.
- **Nunca** criar repositório remoto, pedir token, login ou conta para salvar trabalho.
- **Nunca** enviar dados da empresa para lugar nenhum — nem para o LeanAI público,
  nem para o repositório de origem do projeto (MazyOS), nem para terceiros.
- **Nunca** usar `git push --force`, `git reset --hard`, `git clean -fd`, `git
  checkout --` sobre trabalho não commitado, ou equivalentes destrutivos, sem que o
  usuário peça explicitamente naquele momento.
- Backup remoto de uma empresa é ação deliberada do usuário: exige configurar o remoto e
  declarar `backupRemotoAutorizado` em `core/instalacao.json`. Nunca fazer por conta própria.

### Aprovação humana

Toda ação irreversível ou externa — publicar post, disparar email, subir campanha,
criar repositório, apagar arquivo — exige confirmação explícita do usuário no momento.
Aprovação dada para uma ação não vale para a próxima.

---

## Skills disponíveis

Invocação neste runtime: `$nome-da-skill`

| Comando | O que faz |
| --- | --- |
| `$abrir` | Abre uma sessão de trabalho carregando a memória do negócio (empresa, preferências, estratégia… |
| `$analisar-dados` | Analisa um arquivo de dados (CSV, Excel, TXT, JSON) e gera um resumo executivo com os principais… |
| `$anuncio-google` | Cria estrutura completa de campanha do Google Ads a partir de um briefing ou da pesquisa SEO |
| `$aprovar-post` | Aprova e publica um post da fila — flipa o blog de draft pra published, copia os PNGs do carrossel… |
| `$atualizar` | Duas responsabilidades separadas e nunca misturadas — (1) atualizar a memória e o contexto… |
| `$carrossel` | Cria carrosséis e posts visuais pra Instagram, TikTok, LinkedIn com a identidade visual da marca |
| `$email-profissional` | Rascunha um email profissional a partir de um contexto livre |
| `$instalar` | Instala o LeanAI no negócio do usuário |
| `$mapear-rotinas` | Mapeia tarefas repetitivas do dia a dia e transforma em skills novas do LeanAI |
| `$novo-projeto` | Cria uma pasta de projeto nova com contexto dedicado, depois de uma entrevista curta (cliente… |
| `$publicar-tema` | Orquestra a criação completa de uma peça de conteúdo SEO + redes sociais a partir de um tema |
| `$relatorio-ads` | Gera relatório semanal de performance de anúncios pagos (Google Ads + Meta Ads) |
| `$responder-avaliacoes` | Escreve respostas curtas e humanas pras avaliações do Google Meu Negócio |
| `$salvar` | Salva o estado local do trabalho da empresa — memória, contexto, decisões, projetos, saídas e… |
| `$seo` | Fluxo completo de SEO, GEO e Google Ads em 8 passos: pesquisa de demanda, análise de concorrência… |

As definições canônicas vivem em `skills/<nome>/SKILL.md`. Os arquivos em `.agents/skills/` são **gerados** — nunca edite lá.

---

## Regras específicas deste negócio

<!-- LEANAI:INICIO-PERSONALIZADO -->
<!-- O /instalar escreve aqui. Este bloco é preservado entre sincronizações. -->
<!-- LEANAI:FIM-PERSONALIZADO -->

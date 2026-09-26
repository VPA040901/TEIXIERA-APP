# Paridade funcional — Claude Code × Codex

O objetivo é **paridade funcional**, não paridade artificial de interface. Cada skill faz a
mesma coisa nos dois agentes; a forma de chamar é a oficial de cada runtime.

O LeanAI **não** inventa suporte a `/abrir` no Codex nem a `$abrir` no Claude Code. Fingir
uma interface que o runtime não suporta produziria falha silenciosa — exatamente o que este
sistema existe para evitar.

---

## Como invocar cada skill

| Skill | Claude Code | Codex |
| --- | --- | --- |
| abrir | `/abrir` | `$abrir` |
| analisar-dados | `/analisar-dados` | `$analisar-dados` |
| anuncio-google | `/anuncio-google` | `$anuncio-google` |
| aprovar-post | `/aprovar-post` | `$aprovar-post` |
| atualizar | `/atualizar` | `$atualizar` |
| carrossel | `/carrossel` | `$carrossel` |
| email-profissional | `/email-profissional` | `$email-profissional` |
| instalar | `/instalar` | `$instalar` |
| mapear-rotinas | `/mapear-rotinas` | `$mapear-rotinas` |
| novo-projeto | `/novo-projeto` | `$novo-projeto` |
| publicar-tema | `/publicar-tema` | `$publicar-tema` |
| relatorio-ads | `/relatorio-ads` | `$relatorio-ads` |
| responder-avaliacoes | `/responder-avaliacoes` | `$responder-avaliacoes` |
| salvar | `/salvar` | `$salvar` |
| seo | `/seo` | `$seo` |

Nos dois agentes as skills também são **descobertas automaticamente** pela `description`
quando o pedido do usuário casa com o trigger — não é obrigatório digitar o comando.

---

## Matriz de paridade

Gerada por `node tests/run.mjs`.

| Skill | Claude | Codex | Paridade | Observações |
| --- | --- | --- | --- | --- |
| abrir | `/abrir` | `$abrir` | **PASS** | núcleo único, sem divergência |
| analisar-dados | `/analisar-dados` | `$analisar-dados` | **PASS** | adapter: leitura de `.xlsx`/`.pdf`/`.docx` usa as skills nativas no Claude Code e os plugins `spreadsheets`/`pdf`/`documents` no Codex |
| anuncio-google | `/anuncio-google` | `$anuncio-google` | **PASS** | adapter: pesquisa web (`WebSearch` vs busca nativa/plugin `browser`) |
| aprovar-post | `/aprovar-post` | `$aprovar-post` | **PASS** | núcleo único, sem divergência |
| atualizar | `/atualizar` | `$atualizar` | **PASS** | núcleo único, sem divergência |
| carrossel | `/carrossel` | `$carrossel` | **PASS** | núcleo único; Playwright roda como processo local nos dois |
| email-profissional | `/email-profissional` | `$email-profissional` | **PASS** | núcleo único, sem divergência |
| instalar | `/instalar` | `$instalar` | **PASS** | núcleo único; detecção de ambiente vem do motor, igual nos dois |
| mapear-rotinas | `/mapear-rotinas` | `$mapear-rotinas` | **PASS** | núcleo único; cria sempre na fonte canônica |
| novo-projeto | `/novo-projeto` | `$novo-projeto` | **PASS** | núcleo único; gera `CLAUDE.md` **e** `AGENTS.md` como ponteiros |
| publicar-tema | `/publicar-tema` | `$publicar-tema` | **PASS** | núcleo único, sem divergência |
| relatorio-ads | `/relatorio-ads` | `$relatorio-ads` | **PASS** | núcleo único, sem divergência |
| responder-avaliacoes | `/responder-avaliacoes` | `$responder-avaliacoes` | **PASS** | núcleo único, sem divergência |
| salvar | `/salvar` | `$salvar` | **PASS** | núcleo único; `git` e o motor são os mesmos nos dois |
| seo | `/seo` | `$seo` | **PASS** | adapter: pesquisa web; o Codex verifica acesso à rede antes de começar |

**15/15 com paridade.** Três skills têm adapter declarado; doze são núcleo puro.

---

## Como a paridade é garantida

Não por promessa. Por quatro testes automatizados que rodam no CI:

| Teste | O que impede |
| --- | --- |
| `cada agente tem exatamente as mesmas skills` | uma skill existir só de um lado |
| `toda diferença entre os runtimes é explicada por um token ou por um adapter` | divergência de texto que ninguém declarou |
| `o corpo gerado de cada agente vem do mesmo canônico, sem edição paralela` | alguém editar `.claude/skills/` direto e o conteúdo passar a divergir da fonte |
| `a estrutura de seções é a mesma nos dois runtimes` | um dos lados perder um passo do workflow |

Mais `node core/bin/leanai.mjs check`, que compara todos os 32 artefatos por SHA-256 e sai
com código 1 em qualquer diferença.

---

## Evidência de runtime

Testes executados nesta máquina, contra as instalações reais, em 2026-09-05.

### Codex 0.152.1

`codex debug prompt-input` renderiza como JSON exatamente o que o modelo recebe. Executado
na raiz do LeanAI:

```
15/15 skills do LeanAI descobertas pelo Codex
AGENTS.md carregado ............ SIM
Invocação renderizada como $ ... SIM
CLAUDE.md vazou para o Codex ... não
.claude/skills lido pelo Codex . não (ignorado, como esperado)
```

### Claude Code 2.1.261

Sessão real em modo `--print`, na raiz do LeanAI:

> **Pergunta:** "Liste APENAS os nomes das skills do LeanAI disponíveis nesta sessão…"
>
> **Resposta:** `abrir, analisar-dados, anuncio-google, aprovar-post, atualizar, carrossel,
> email-profissional, instalar, mapear-rotinas, novo-projeto, publicar-tema, relatorio-ads,
> responder-avaliacoes, salvar, seo`
>
> E, sobre a memória: `memoria vazia` — leitura correta do placeholder em
> `_memoria/empresa.md`.

### Teste de sincronização ponta a ponta

Uma skill canônica de teste foi criada, versionada e removida, verificando os dois runtimes
reais a cada passo:

| Passo | Resultado |
| --- | --- |
| Criar canônica v1 **sem** sincronizar | `check` acusou 4 divergências (2 arquivos ausentes × 2 runtimes) |
| `sync` | escreveu nos dois diretórios |
| Codex real | enxergou **v1** |
| Alterar canônica para v2 | `check` acusou 2 divergências — impossível ficar "Claude v1 / Codex v2" em silêncio |
| `sync` | atualizou os dois |
| Codex real | enxergou **v2** |
| Nova versão v3 + `sync` | **Claude Code real** respondeu `MARCADOR_VERSAO_3` · **Codex real** respondeu `MARCADOR_VERSAO_3` |
| Remover canônica + `sync` | removeu dos dois; `check` voltou a OK com 15 skills de cada lado |

Uma edição, feita uma vez, chegou idêntica aos dois agentes — confirmada por consulta aos
runtimes, não por inspeção de arquivo.

---

## Diferenças reais entre os runtimes

Registradas para que ninguém precise redescobrir.

| Aspecto | Claude Code | Codex |
| --- | --- | --- |
| Skills do projeto | `.claude/skills/<nome>/SKILL.md` | `.agents/skills/<nome>/SKILL.md` (e `.codex/skills/` também funciona) |
| Skills globais | `~/.claude/skills/` | `~/.agents/skills/` (e `~/.codex/skills/`) |
| Instruções persistentes | `CLAUDE.md` (raiz e aninhado) | `AGENTS.md` (raiz e aninhado) |
| Invocação explícita | `/nome` | `$nome` |
| Frontmatter | `name`, `description` + muitas opcionais (`allowed-tools`, `context: fork`, `model`, `paths`…) | `name`, `description`, `metadata` |
| Symlinks em `skills/` | não documentado | **explicitamente ignorados** |
| Metadados de UI | — | `agents/openai.yaml` |
| Busca web | `WebSearch` / `WebFetch` | busca nativa + plugin `browser` |
| Documentos | skills `pdf`, `docx`, `xlsx`, `pptx` | plugins `pdf`, `documents`, `spreadsheets`, `presentations` |

O motor lida com a diferença de frontmatter automaticamente: `frontmatterPermitido` no
`core/leanai.config.json` filtra as chaves que o runtime alvo não entende, em vez de emitir
YAML que ele ignoraria — ou pior, rejeitaria.

---

## O que **não** foi testado

Honestidade sobre os limites desta validação:

- As skills foram testadas quanto a **descoberta, leitura de contexto e paridade**. A
  execução ponta a ponta de cada workflow de negócio (gerar um carrossel real, subir uma
  campanha real, postar no Instagram) **não** foi executada — envolve credenciais de
  terceiros e efeitos externos irreversíveis.
- As skills com ação externa (`aprovar-post`, `anuncio-google`, `salvar`, `relatorio-ads`)
  têm, por instrução, um passo de confirmação humana antes de qualquer efeito. Isso é
  verificado estruturalmente pelo teste `skills com ação externa avisam sobre confirmação
  humana`, não por execução real.
- Testado em **Windows 11** com Claude Code 2.1.261 e Codex 0.152.1. macOS e Linux estão
  cobertos pelo CI (estrutura, paridade, instaladores), mas **não** foram testados com os
  agentes reais nessas plataformas.

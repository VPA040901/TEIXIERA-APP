## Criação de skills

**Regra inegociável: toda skill nova nasce uma única vez, na fonte canônica, e fica
disponível nos dois agentes.** Nunca criar uma skill direto em `{{SKILLS_DIR}}/` — esse
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
| `{{!INVOCAR:nome}}` | `/nome` | `$nome` |
| `{{!AGENTE}}` | Claude Code | Codex |
| `{{!OUTRO_AGENTE}}` | Codex | Claude Code |
| `{{!SKILLS_DIR}}` | `.claude/skills` | `.agents/skills` |
| `{{!SKILLS_DIR_GLOBAL}}` | `~/.claude/skills` | `~/.agents/skills` |
| `{{!ARQUIVO_REGRAS}}` | `CLAUDE.md` | `AGENTS.md` |
| `{{!SINTAXE_INVOCACAO}}` | `/nome-da-skill` | `$nome-da-skill` |
| `{{!PRODUTO}}` | LeanAI | LeanAI |

Escrever a skill em linguagem neutra de runtime. Falar em "ferramenta de busca web"
em vez de citar o nome interno de uma ferramenta de um agente específico.

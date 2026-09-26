---
name: mapear-rotinas
description: >
  Mapeia tarefas repetitivas do dia a dia e transforma em skills novas do LeanAI. Faz uma
  entrevista curta sobre o que o usuário repete toda semana, propõe skills concretas e cria
  as aprovadas na fonte canônica `skills/`, sincronizando para todos os agentes ativos de
  uma vez. Use quando o usuário pedir "{{INVOCAR:mapear-rotinas}}", "criar skills personalizadas",
  "automatizar minhas tarefas" ou "o que dá para automatizar".
---

# {{INVOCAR:mapear-rotinas}} — Rotinas repetitivas viram skills

Skill de descoberta + criação. Transforma o que o usuário repete em automação ativa.

**Regra que governa esta skill: uma skill nova é criada UMA VEZ, na fonte canônica, e passa
a valer em todos os agentes.** Nunca criar skill exclusiva de um agente por padrão.

## Passo 1 — Entrevista de descoberta

Três perguntas, uma por vez:

1. "Quais 3 tarefas você repete toda semana e gostaria de não ter que pensar mais? (ex.: 'criar carrossel', 'mandar relatório para o cliente', 'fazer briefing')"
2. "Para cada uma, qual o input típico? (ex.: 'um link de notícia', 'uma planilha', 'um nome de cliente')"
3. "E o que você espera de output? (ex.: '5 slides em PNG', 'um email pronto', 'um PDF resumindo')"

## Passo 2 — Conferir o que já existe

Ler `core/templates/skills/catalogo.md` e listar as skills canônicas em `skills/`. Se a
tarefa já for coberta, sugerir a existente em vez de criar outra:

> "A tarefa X já é resolvida pela skill {{SINTAXE_INVOCACAO}} que já vem no sistema. Quer usar
> ela em vez de criar uma nova?"

## Passo 3 — Proposta

Para cada tarefa sem cobertura:

```
### <nome-da-skill>
**O que faz:** [uma frase]
**Input:** [o que recebe]
**Output:** [o que entrega]
**Dependências:** [arquivos de _memoria/, identidade/, ou ferramentas externas]
**Diferença entre agentes:** [nenhuma | o que muda e por quê]
```

Mostrar todas juntas e perguntar:
> "Quais dessas você quer que eu crie agora? (todas, algumas, nenhuma — também dá para pedir ajustes)"

## Passo 4 — Criação na fonte canônica

Para cada skill aprovada:

1. Criar `skills/<nome>/SKILL.md` — **nunca** direto em `{{SKILLS_DIR}}/`, que é gerado
2. Frontmatter com:
   - `name` idêntico ao nome da pasta
   - `description` descrevendo **quando** invocar. Sem isso a skill nunca é encontrada, em
     nenhum dos dois agentes
3. Corpo com workflow em passos, dependências e regras (o que sempre fazer, o que nunca fazer)
4. Escrever em **linguagem neutra de runtime**, usando os tokens universais:
   `{{!INVOCAR:nome}}`, `{{!AGENTE}}`, `{{!SKILLS_DIR}}`, `{{!ARQUIVO_REGRAS}}`.
   Falar em "busca na web" em vez do nome interno da ferramenta de um agente específico
5. Apoio opcional dentro da pasta da skill: `references/`, `scripts/`, `assets/` — copiados
   junto para os dois runtimes
6. **Só se houver diferença real** entre os agentes, criar o delta:
   - `skills/<nome>/adapters/claude.md` / `adapters/codex.md` — texto anexado ao final
   - `skills/<nome>/adapters/claude.yaml` / `adapters/codex.yaml` — chaves extras de frontmatter

   Nunca duplicar a skill inteira. O tronco comum fica no canônico
7. Calibrar tom e regras por `_memoria/preferencias.md` e `_memoria/empresa.md`

## Passo 5 — Sincronizar e provar

Obrigatório, sempre, ao final:

```bash
node core/bin/leanai.mjs sync
node core/bin/leanai.mjs check
```

Se o `check` não passar, a skill não está pronta. Corrigir antes de entregar.

## Passo 6 — Resumo

```
Criei [N] skills na fonte canônica:
✓ <nome1> — skills/<nome1>/SKILL.md
✓ <nome2> — skills/<nome2>/SKILL.md

Disponíveis agora em:
  Claude Code: /<nome1>
  Codex:       $<nome1>

Para ajustar depois: edita skills/<nome>/SKILL.md e roda
  node core/bin/leanai.mjs sync
```

Mostrar as duas formas de chamar mesmo que o usuário só tenha um agente ativo — quando ele
instalar o outro, já funciona.

---

## Regras

- Não criar skill para tarefa que aconteceu uma vez só. Tem que ser repetível
- Máximo 5 skills por sessão. Mais que isso, dividir em rodadas
- Toda skill precisa de trigger claro na `description` — sem isso ela nunca é encontrada
- Se a skill depender de ferramenta que o usuário não tem, avisar antes de criar e oferecer
  a versão simplificada
- **Nunca** criar skill diretamente em `{{SKILLS_DIR}}/` — o próximo `sync` apaga
- **Nunca** entregar sem rodar `sync` e `check`

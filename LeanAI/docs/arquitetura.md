# Arquitetura do LeanAI

## O problema

Claude Code e Codex leem instruções de lugares diferentes. Nenhum lê o do outro. A solução
ingênua — manter uma "versão Claude" e uma "versão Codex" — falha em semanas: alguém
corrige uma skill de um lado, esquece do outro, e a partir daí o sistema mente sobre si
mesmo.

## A evidência

Antes de decidir a arquitetura, a descoberta de skills foi **medida**, não presumida.

O Codex expõe `codex debug prompt-input`, que renderiza como JSON exatamente o que o modelo
vê no início da sessão. Um diretório de teste foi montado com uma skill-sonda em cada local
candidato e um `AGENTS.md` com marcador:

```
codex-probe/
├── AGENTS.md                                    MARKER_AGENTS_MD_LOADED
├── .agents/skills/leanai-probe-agents/SKILL.md  MARKER_SKILL_agents
├── .codex/skills/leanai-probe-codex/SKILL.md    MARKER_SKILL_codex
└── .claude/skills/leanai-probe-claude/SKILL.md  MARKER_SKILL_claude
```

Resultado com **Codex 0.152.1**:

| Marcador | Apareceu no prompt do modelo? |
| --- | --- |
| `MARKER_AGENTS_MD_LOADED` | **sim** |
| `MARKER_SKILL_agents` (`.agents/skills/`) | **sim** |
| `MARKER_SKILL_codex` (`.codex/skills/`) | **sim** |
| `MARKER_SKILL_claude` (`.claude/skills/`) | **não** |

Confirmado pelo manual oficial do Codex, que traz a tabela:

| Camada | Global | Repositório |
| --- | --- | --- |
| AGENTS | `~/.codex/AGENTS.md` | `AGENTS.md` na raiz ou em subdiretórios |
| Skills | `~/.agents/skills` | `.agents/skills` no repositório |

Para o Claude Code, a documentação oficial (`code.claude.com/docs/en/skills`) lista
`~/.claude/skills/` (pessoal), `.claude/skills/` (projeto) e
`<subdiretório>/.claude/skills/` (monorepo). O schema de settings da versão 2.1.261,
inspecionado localmente, **não** tem nenhuma chave relacionada a `AGENTS.md`.

### Por que não symlink

O manual do Codex é explícito: *"Symbolic links directly under `skills/` aren't imported as
skills; each skill must be a real directory containing `SKILL.md`."* Some-se a isso que
symlink no Windows exige privilégio elevado ou modo desenvolvedor, e que o git precisa de
`core.symlinks=true` — configuração que muitas instalações corporativas não têm.

**Conclusão:** cópia física é obrigatória. A única decisão real é se ela é mantida à mão
(e diverge) ou gerada e verificada.

## A solução

```
                    ┌──────────────────────────────┐
                    │      FONTE CANÔNICA          │
                    │  skills/<nome>/SKILL.md       │
                    │  core/regras/*.md             │
                    └───────────────┬──────────────┘
                                    │
                        core/bin/leanai.mjs sync
                                    │
                ┌───────────────────┴───────────────────┐
                ▼                                       ▼
      ┌───────────────────┐                   ┌───────────────────┐
      │   Claude Code     │                   │      Codex        │
      │ CLAUDE.md         │                   │ AGENTS.md         │
      │ .claude/skills/   │                   │ .agents/skills/   │
      │ /nome             │                   │ $nome             │
      └───────────────────┘                   └───────────────────┘
                └───────────── check ──────────────────┘
                    SHA-256 · falha se divergirem
```

## O pipeline de geração

Para cada skill e cada agente ativo:

1. **Ler** `skills/<nome>/SKILL.md`, removendo BOM e normalizando para LF
2. **Separar** frontmatter YAML e corpo
3. **Validar** que `name` bate com o nome da pasta e que `description` existe
4. **Mesclar** `adapters/<agente>.yaml` no frontmatter, se houver
5. **Filtrar** chaves de frontmatter não suportadas pelo runtime alvo
   (`frontmatterPermitido` no config) — evita frontmatter inválido
6. **Anexar** `adapters/<agente>.md` ao corpo, se houver
7. **Renderizar** os tokens, no frontmatter **e** no corpo
8. **Escrever** com aviso de arquivo gerado e `metadata.leanai-fonte` apontando o canônico
9. **Copiar** `references/`, `scripts/` e `assets/` da skill, se existirem

Depois, `CLAUDE.md` e `AGENTS.md` são montados na ordem de `ordemRegras`, com a tabela de
skills daquele runtime, **preservando o bloco personalizado** entre
`LEANAI:INICIO-PERSONALIZADO` e `LEANAI:FIM-PERSONALIZADO`.

Por fim, `core/.leanai-sync.json` guarda o SHA-256 de cada fonte e de cada artefato.

## Propriedades garantidas

| Propriedade | Como |
| --- | --- |
| **Determinismo** | Ordenação estável de skills e arquivos; sem timestamp no manifesto; LF forçado. Rodar `sync` duas vezes produz bytes idênticos — testado. |
| **Detecção de divergência** | `check` recalcula o plano e compara por hash. Exit 1 em qualquer diferença. Testado com divergência injetada e revertida. |
| **Remoção segura** | `sync` só apaga artefato que **este motor gerou antes** e cujo hash ainda bate com o do manifesto. Arquivo editado à mão é preservado, não deletado. |
| **Windows** | Sem symlink. `path.join` em todo lugar. LF via `.gitattributes`. Caminhos com espaço citados nos scripts. CI roda nos três sistemas. |
| **Sem dependências** | Só builtins do Node 18+. Nada de `npm install` para o motor funcionar. |

## Adapters — quando a diferença é real

O corpo canônico é neutro de runtime. Quando a diferença é de uma palavra, o token resolve.
Quando é maior, entra um adapter:

```
skills/analisar-dados/
├── SKILL.md                  o workflow inteiro — 100% comum
└── adapters/
    ├── claude.md             "use as skills pdf / docx / xlsx"
    └── codex.md              "use os plugins pdf / documents / spreadsheets"
```

O adapter é **anexado** ao final, nunca substitui. Hoje 3 das 15 skills têm adapter
(`analisar-dados`, `seo`, `anuncio-google`); as outras 12 são núcleo puro.

A suíte de testes exige que, se uma skill tem adapter para um runtime, tenha para o outro
também — senão um dos agentes fica sem a orientação equivalente.

## Adicionar um agente novo

```json
"gemini": {
  "nome": "Gemini CLI",
  "habilitado": true,
  "skillsDir": ".gemini/skills",
  "arquivoRegras": "GEMINI.md",
  "sintaxeInvocacao": "/{skill}",
  "frontmatterPermitido": ["name", "description"]
}
```

Um bloco em `core/leanai.config.json` e `sync`. Nenhuma skill é reescrita. Se o agente novo
tiver alguma exigência própria, ela vira `adapters/gemini.md` nas skills que precisarem.

O que **não** deve acontecer: espalhar `if (é Claude)` pelo corpo das skills. Toda diferença
de runtime mora em duas camadas — o config e os adapters.

## Camadas e responsabilidades

| Camada | Contém | Atualizada por |
| --- | --- | --- |
| `core/` | motor, regras, templates | `atualizar` modo Motor |
| `skills/` | as 15 canônicas + as criadas pelo cliente | `mapear-rotinas`, `atualizar` modo Motor |
| `adapters/` | metadados por runtime | raramente |
| `_memoria/`, `identidade/` | contexto da empresa | `instalar`, `atualizar` modo Contexto |
| `dados/`, `marketing/`, `saidas/`, `projetos/` | trabalho | as skills de produção |
| gerados | `CLAUDE.md`, `AGENTS.md`, `.claude/skills/`, `.agents/skills/` | só o `sync` |

A fronteira entre "motor" e "empresa" é o que permite atualizar uma instalação de cliente
sem tocar nos dados dele.

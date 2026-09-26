# projetos/ — trabalho por cliente ou iniciativa

Cada projeto ganha uma subpasta aqui, criada pela skill `novo-projeto`
(`/novo-projeto` no Claude Code, `$novo-projeto` no Codex).

```
projetos/
└── Acme/
    ├── contexto.md      o documento vivo do projeto — briefing, objetivo, entregas
    ├── CLAUDE.md        ponteiro de 3 linhas para o contexto.md (Claude Code)
    ├── AGENTS.md        ponteiro de 3 linhas para o contexto.md (Codex)
    ├── ads/
    └── conteudo/
```

## Herança, não cópia

O projeto **não repete** a memória nem a identidade da empresa. Os dois agentes leem
instruções em cascata: as regras da raiz sempre valem, e o arquivo da subpasta acrescenta
o que é específico.

Isso vem de graça:

- `_memoria/` — quem é a empresa, tom de voz, foco atual
- `identidade/` — cores, tipografia, logo
- todas as skills do LeanAI

Só o que é do projeto fica aqui: briefing, objetivo, entregas, convenções locais.

## Por que dois ponteiros

Claude Code lê `CLAUDE.md` aninhado; Codex lê `AGENTS.md` aninhado. Nenhum lê o do outro.
Os dois arquivos são idênticos, têm três linhas e **nenhuma lógica** — apontam para
`contexto.md`, que é onde a informação de verdade mora. Toda edição acontece lá.

## Trabalhando num projeto

Abra o terminal dentro da pasta do projeto. Assim o agente carrega o contexto específico
junto com o da raiz.

---
name: abrir
description: >
  Abre uma sessão de trabalho carregando a memória do negócio (empresa, preferências,
  estratégia, identidade), o estado recente do workspace e as pendências, e devolve uma
  síntese curta. Use quando o usuário disser "abrir", "começar o dia", "{{INVOCAR:abrir}}" ou
  no primeiro turno de uma sessão depois do {{INVOCAR:instalar}}.
---

# {{INVOCAR:abrir}} — Abertura de sessão

Curto e direto. Carregar contexto e devolver uma síntese que cabe na tela, para o usuário
começar a trabalhar sabendo onde parou.

## Workflow

### Passo 1 — Ler a memória

Em ordem:
- `_memoria/empresa.md` — qual empresa é, o que faz, quem é a equipe
- `_memoria/preferencias.md` — tom de voz
- `_memoria/estrategia.md` — foco atual, objetivos, prioridades
- `identidade/design-guide.md` — só para saber se está preenchido ou em branco

Se algum dos três primeiros estiver em branco (placeholder), responder:
> "Vi que `_memoria/<arquivo>.md` ainda não foi preenchido. Quer rodar {{INVOCAR:instalar}} agora?"

E parar.

### Passo 2 — Ler o estado recente

Levantar, sem narrar o processo:
- projetos ativos: subpastas de `projetos/` (e de `clientes/`, se existir)
- trabalho recente: arquivos modificados nos últimos 7 dias em `marketing/`, `saidas/`, `projetos/`
- pendências: itens não concluídos em `tarefas.md` (se existir) e rascunhos marcados
  como `draft: true` em conteúdo de blog
- estado do versionamento: `git status --porcelain` (existe trabalho não salvo?)

### Passo 3 — Devolver a síntese

Uma mensagem só, neste formato:

```
[Nome do negócio] — [o que faz em 5-8 palavras]
Foco atual: [prioridade da estratégia, em uma frase]
Tom: [resumo de 3-4 palavras do tom de voz]

Em andamento: [1-3 projetos ativos, ou "nada aberto"]
Pendente: [pendências concretas, ou omitir a linha se não houver]
[Se houver trabalho não commitado: "N arquivos não salvos — {{INVOCAR:salvar}} quando quiser"]

Pronto. O que vamos fazer?
```

### Passo 4 — Não narrar

Não listar quais arquivos foram lidos. Não confirmar leitura. Só usar o contexto.

---

## Regras

- A resposta cabe em 8 linhas no terminal. Se não couber, cortar as pendências menos relevantes
- Não fazer perguntas além de "o que vamos fazer?"
- Se o `design-guide.md` estiver em branco, não mencionar — só vira problema quando uma
  skill visual for chamada
- Omitir linhas vazias em vez de escrever "nenhum" para tudo
- Não abrir arquivo de outra instalação, mesmo que exista no mesmo computador

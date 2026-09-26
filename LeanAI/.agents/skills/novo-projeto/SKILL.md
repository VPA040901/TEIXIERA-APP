---
name: "novo-projeto"
description: "Cria uma pasta de projeto nova com contexto dedicado, depois de uma entrevista curta (cliente, objetivo, entregas previstas). O projeto herda memória, identidade e skills da raiz sem copiar nada, e funciona igual em todos os agentes. Use quando o usuário disser \"novo projeto\", \"novo cliente\", \"$novo-projeto\", \"começar projeto para X\" ou pedir para estruturar um trabalho novo."
metadata:
  leanai-fonte: "skills/novo-projeto/SKILL.md"
---

<!-- GERADO PELO LeanAI — NÃO EDITE ESTE ARQUIVO.
     Fonte canônica: skills/novo-projeto/SKILL.md
     Regenere com: node core/bin/leanai.mjs sync -->

# $novo-projeto — Projeto novo com contexto dedicado

Quando o usuário começa um projeto (cliente, iniciativa, produto), cria a pasta com um
contexto próprio que **herda** o da raiz e acrescenta só o que é específico.

## Como a herança funciona

Os dois agentes leem arquivos de instrução em cascata: o da raiz sempre vale, e o da
subpasta acrescenta quando o trabalho acontece ali dentro. Claude Code usa `CLAUDE.md`
aninhado; Codex usa `AGENTS.md` aninhado.

Para não manter dois documentos, o projeto tem **um** arquivo de contexto real —
`contexto.md` — e dois ponteiros de três linhas que apenas apontam para ele. Os ponteiros
nunca mudam; toda a informação viva fica no `contexto.md`.

O que o projeto **herda automaticamente** e por isso **não** se repete na pasta:

- memória do negócio (`_memoria/`)
- identidade visual (`identidade/`)
- regras de operação do sistema (arquivo de regras da raiz)
- todas as skills (`.agents/skills/` da raiz vale no workspace inteiro)

O que **fica** na pasta do projeto: briefing, objetivo, entregas, convenções que valem só ali.

## Passo 1 — Entrevista (4 perguntas)

1. "Qual o nome do projeto ou cliente?"
2. "É cliente novo, projeto interno ou iniciativa pessoal?"
3. "Qual o objetivo principal? (uma frase)"
4. "Que tipo de entrega vai ter? (ads, site, conteúdo, automação, proposta — pode ser mais de uma)"

## Passo 2 — Decidir o local

Pela resposta 2:

- **Cliente novo:** `projetos/<Nome>/` — ou `clientes/<Nome>/` se o bloco personalizado das
  regras da raiz já estabelecer essa convenção. Conferir antes
- **Projeto interno:** `projetos/<nome>/`
- **Iniciativa pessoal:** perguntar onde o usuário prefere

## Passo 3 — Estrutura

Criar a pasta com:

- `contexto.md` — o documento vivo do projeto
- `CLAUDE.md` e `AGENTS.md` — ponteiros de três linhas
- subpastas conforme as entregas mencionadas (mencionou "ads e conteúdo" → `ads/` e `conteudo/`)

### `contexto.md`

```markdown
# [Nome do projeto]

> Projeto criado em [data]. Instruções aqui valem dentro desta pasta e complementam as da raiz.

## Sobre
[Objetivo da resposta 3]

## Tipo
[Cliente novo / Projeto interno / Iniciativa pessoal]

## Entregas previstas
- [entrega 1]
- [entrega 2]

## Onde salvar o que
- Briefing e contexto: nesta pasta
- Entregas: cada subpasta criada (ads/, conteudo/, site/, ...)

## Herda da raiz
Tom de voz, marca e contexto do negócio vêm de `_memoria/` e `identidade/` da raiz.
Todas as skills do LeanAI valem aqui. Não duplicar essas informações neste arquivo.

## Específico deste projeto
[Vazio — preencher conforme for descobrindo]
```

### `CLAUDE.md` e `AGENTS.md` (ponteiros idênticos, três linhas)

```markdown
# [Nome do projeto]

O contexto deste projeto está em `./contexto.md`. Leia esse arquivo antes de trabalhar aqui.
As regras gerais e as skills do LeanAI continuam valendo a partir da raiz do workspace.
```

Os dois arquivos têm o mesmo conteúdo de propósito: são ponteiros sem lógica, um para cada
runtime. Toda mudança de conteúdo acontece no `contexto.md`.

## Passo 4 — Resumo

```
Pasta criada: [caminho]
✓ contexto.md — o documento do projeto
✓ CLAUDE.md + AGENTS.md — ponteiros (não editar; edite o contexto.md)
✓ Subpastas: [lista]

Funciona igual em Claude Code e Codex. Trabalhe com o terminal aberto dentro da pasta —
assim o contexto do projeto carrega junto com o da raiz.
```

## Passo 5 — Registrar

Oferecer atualizar `_memoria/empresa.md` com o cliente/projeto novo. Se o usuário aceitar,
adicionar só a linha relevante.

---

## Regras

- Nome de pasta: usar o nome como o usuário falou, sem normalizar demais (manter acentos,
  espaços viram hífen, o nome tem que continuar reconhecível)
- Não criar subpasta que não foi pedida "para organizar melhor". Só o que foi mencionado
- Projeto já existente com o mesmo nome: avisar e perguntar se é para adicionar dentro ou
  criar com sufixo. **Nunca** sobrescrever
- Não copiar memória nem identidade para dentro do projeto. Herança, não cópia
- Não criar skills dentro do projeto. Skill nova nasce em `skills/` via $mapear-rotinas

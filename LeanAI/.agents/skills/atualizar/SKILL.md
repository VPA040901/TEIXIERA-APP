---
name: "atualizar"
description: "Duas responsabilidades separadas e nunca misturadas — (1) atualizar a memória e o contexto empresarial comparando os arquivos de contexto com o estado real do workspace, e (2) quando pedido explicitamente, atualizar o motor LeanAI a partir do repositório público, preservando tudo que é local da empresa. Nenhum arquivo local é enviado em nenhum dos dois modos. Use quando o usuário disser \"atualiza\", \"$atualizar\", \"varre o projeto\", \"atualizar o LeanAI\" ou pedir uma reconciliação geral."
metadata:
  leanai-fonte: "skills/atualizar/SKILL.md"
---

<!-- GERADO PELO LeanAI — NÃO EDITE ESTE ARQUIVO.
     Fonte canônica: skills/atualizar/SKILL.md
     Regenere com: node core/bin/leanai.mjs sync -->

# $atualizar — Atualização de contexto e de motor

Esta skill faz **duas coisas diferentes**. Elas nunca rodam juntas por conta própria.

| Modo | O que mexe | Quando roda |
| --- | --- | --- |
| **A — Contexto** | `_memoria/`, `identidade/`, bloco personalizado das regras | padrão |
| **B — Motor** | `core/`, `skills/`, `adapters/`, `installer/`, `tests/` | só se o usuário pedir explicitamente |

## Roteamento

- "atualiza", "varre o projeto", "reconcilia o contexto", $atualizar sem argumento
  → **Modo A**
- "atualiza o LeanAI", "pega as melhorias do LeanAI", "atualizar o motor",
  $atualizar motor → **Modo B**

Se estiver ambíguo, perguntar em uma linha qual dos dois. Não adivinhar: são operações com
riscos completamente diferentes.

---

# Modo A — Contexto do negócio

Compara o que está nos arquivos de contexto com o estado real do workspace e propõe
atualizações.

## Passo 1 — Levantamento

Listar:
- Pastas na raiz (cada uma representa uma área de trabalho)
- Subpastas em `projetos/` e `clientes/` (se existirem) — cada uma é um projeto/cliente
- Skills canônicas em `skills/` — quais existem hoje
- Arquivos recentes (últimos 30 dias) em `marketing/`, `saidas/`, `projetos/`

## Passo 2 — Comparação

- **`_memoria/empresa.md`:** clientes / serviços / equipe / ferramentas batem com a realidade?
- **`_memoria/estrategia.md`:** o foco atual ainda faz sentido (datas, prioridades, objetivos)?
- **Bloco personalizado das regras:** as convenções de pasta descritas batem com o que existe?
- **`identidade/design-guide.md`:** continua coerente com as últimas peças geradas?

## Passo 3 — Proposta

```
Encontrei [N] coisas para atualizar:

1. _memoria/empresa.md — falta o cliente "Acme" (vi projetos/Acme/ criado em [data])
2. Regras — diz "propostas em propostas/" mas vejo propostas em projetos/<x>/propostas/
3. _memoria/estrategia.md — fala em "fechar 1º cliente em fevereiro", já é abril e tem 3 ativos

Quer que eu aplique? Posso aplicar todas, escolher algumas, ou nenhuma.
```

## Passo 4 — Aplicação

Se aprovado, editar com cirurgia — só a linha relevante, sem reformatar o documento.
Mostrar o diff de cada mudança. Regras de negócio vão para o bloco personalizado do arquivo
de regras, entre `LEANAI:INICIO-PERSONALIZADO` e `LEANAI:FIM-PERSONALIZADO`.

## Regras do Modo A

- Não inventar fatos — só registrar o que tem evidência no workspace
- Evidência ambígua (pasta vazia chamada "Cliente Novo") → perguntar antes
- Não apagar conteúdo dos arquivos de contexto — só atualizar e adicionar
- Nada para mudar → "Está tudo coerente, nada para atualizar"

---

# Modo B — Motor LeanAI

Traz melhorias do LeanAI público para esta instalação **sem tocar nos dados da empresa** e
**sem enviar nada**. O sentido é sempre um só:

```
instalação local  ←  github.com/leangiraldes/LeanAI
```

Nunca o contrário. Nenhum arquivo local sai da máquina em nenhum momento deste processo.

## Passo 1 — Consultar

```bash
node core/bin/leanai.mjs update
```

Isso busca o repositório público, compara com a versão instalada e **mostra**:

- versão instalada × versão disponível
- commits novos
- quais arquivos de motor seriam atualizados
- o que permanece intocado nesta máquina

**Não altera nada.** É só leitura.

Se não houver internet, o comando avisa e para. O LeanAI continua funcionando normalmente
offline — atualizar é opcional, nunca obrigatório.

Se já estiver na versão mais recente, responder "Está atualizado" e encerrar.

## Passo 2 — Apresentar e pedir confirmação

Mostrar ao usuário, em linguagem simples:

```
LeanAI v<atual> → v<nova>

O que muda:
  - [resumo dos commits, em uma linha cada]

O que é atualizado:
  <N> arquivos do motor (core/, skills/, installer/, tests/, docs/)

O que NÃO é tocado:
  _memoria/  identidade/  marketing/  saidas/  projetos/  dados/  scripts/
  core/instalacao.json
  o bloco personalizado do arquivo de regras
  as skills criadas nesta instalação

Quer aplicar?
```

**Nunca aplicar sem essa confirmação explícita.**

## Passo 3 — Aplicar

Só depois do "sim":

```bash
node core/bin/leanai.mjs update --aplicar
```

O comando exige working tree limpo — se houver trabalho não salvo, ele para e manda rodar
$salvar antes. Ele cria uma branch de retorno automaticamente, traz apenas os
caminhos de motor, e preserva a escolha de agentes e a identificação da instalação.

## Passo 4 — Revalidar

```bash
node core/bin/leanai.mjs sync
node core/bin/leanai.mjs check
node core/bin/leanai.mjs verify
node tests/run.mjs
```

Se algo falhar, oferecer o retorno — o comando informa o nome da branch:

```bash
git reset --hard leanai-antes-da-atualizacao-<data>
```

Esse é o **único** caso em que um comando destrutivo é aceitável, e mesmo assim só com
confirmação explícita, porque o ponto de retorno foi criado antes de qualquer mudança.

## Passo 5 — Resumo

```
Motor atualizado: v<antes> → v<depois>
Arquivos de motor alterados: <N>
Dados da empresa: intactos
Skills: <N> · paridade verificada
Ponto de retorno: <branch>

Nada foi enviado para a internet.
```

Depois, $salvar para registrar a atualização no histórico local.

## Regras do Modo B

- **Nunca** fazer push, em nenhuma etapa. Nem para `leanai`, nem para nenhum outro remoto
- **Nunca** enviar arquivo local durante a consulta ou a aplicação
- **Nunca** tocar em arquivo de workspace da empresa
- **Nunca** aplicar sem confirmação explícita do usuário
- **Nunca** rodar com working tree sujo ou sem ponto de retorno
- Sem internet: avisar e encerrar. Não é erro — é uma instalação local funcionando normalmente
- Se houver conflito, mostrar e resolver com o usuário. Nunca resolver sozinho descartando
  o lado do cliente

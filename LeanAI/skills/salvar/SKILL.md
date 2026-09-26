---
name: salvar
description: >
  Salva o estado local do trabalho da empresa — memória, contexto, decisões, projetos,
  saídas e preferências — em um commit no histórico da própria pasta. Não envia nada para
  a internet, não exige GitHub e não cria repositório remoto. Use quando o usuário disser
  "salvar", "salva o progresso", "commit", "{{INVOCAR:salvar}}", "guarda isso" ou pedir para
  registrar o estado do trabalho.
---

# {{INVOCAR:salvar}} — Salvar o estado local

Uma função só: registrar, no histórico local da pasta, tudo que mudou no trabalho da
empresa. Serve de linha do tempo, ponto de retorno e auditoria — sem depender de internet,
de conta em serviço nenhum, e sem que um byte saia da máquina.

## O modelo

O LeanAI é **local-first**. Esta pasta é a instalação da empresa e é onde tudo vive:

```
memória · identidade · projetos · saídas · preferências · contexto · documentos
```

O repositório público do LeanAI serve para **baixar** o sistema e **consultar** atualizações.
Nunca para receber nada. O push está desativado no próprio git e bloqueado pelo `guard`.

**Esta skill nunca:**
- faz `git push`
- cria repositório remoto
- pede login, conta ou token
- envia qualquer arquivo para a internet

Se o usuário pedir explicitamente um backup remoto, isso é outra conversa: exige que ele
configure e autorize um destino em `core/instalacao.json`, e não é feito por esta skill.

## Workflow

### Passo 1 — Garantir histórico local

Conferir com `git rev-parse --is-inside-work-tree`. Se não for um repositório:

```bash
git init -b main
```

Se `user.name` / `user.email` não estiverem configurados, perguntar e configurar **no
repositório local** (`git config user.name`, sem `--global`), explicando em uma linha que
serve só para assinar o histórico da pasta.

**Não** adicionar remoto. **Não** perguntar sobre GitHub.

### Passo 2 — Confirmar que nada pode escapar

```bash
node core/bin/leanai.mjs guard origin
```

Numa instalação local, esse comando **deve falhar** — é o comportamento correto e a prova de
que não existe destino de push. Se por acaso ele passar, significa que alguém autorizou um
backup remoto; nesse caso, avisar o usuário antes de seguir.

### Passo 3 — Varrer segredos

```bash
node core/bin/leanai.mjs scan
```

Se aparecer segredo, **parar** e mostrar. Chave de API, token ou credencial não entra nem no
histórico local: uma pasta é copiada, compactada e movida, e o histórico vai junto.

Só seguir depois que o usuário remover o segredo ou confirmar que aquilo é exemplo falso.

### Passo 4 — Conferir a coerência do sistema

```bash
node core/bin/leanai.mjs check
```

Se acusar divergência, oferecer rodar `sync` antes — senão o histórico guarda um estado em
que um agente vê uma versão da skill e o outro vê outra.

### Passo 5 — Revisar o que mudou

`git status --short`. Sem mudanças → "Está tudo salvo, nada novo desde o último ponto" e
parar.

Mostrar o resumo agrupado por natureza, não a lista crua:

```
Memória e contexto:   _memoria/empresa.md, _memoria/estrategia.md
Identidade:           identidade/design-guide.md
Projetos:             projetos/Acme/contexto.md
Saídas:               marketing/conteudo/carrossel-x-2026-09-05/
```

Para arquivos de contexto (`_memoria/`, `identidade/`), mostrar também o `git diff` resumido
— é o que o usuário mais quer conferir antes de registrar.

Se alguma mudança relevante do negócio ainda não estiver refletida na memória, oferecer
atualizar antes de salvar (ver {{INVOCAR:atualizar}}).

### Passo 6 — Registrar

Perguntar:
> "Vou salvar isso no histórico local. Quer descrever em uma frase ou uso o resumo automático?"

Mensagem do usuário, se houver. Senão, gerar uma linha a partir do que mudou
("Atualiza memória e cria projeto Acme", "Carrossel sobre X + legendas").

```bash
git add -A
git commit -m "<mensagem>"
```

### Passo 7 — Confirmar

```
Salvo no histórico local.

  <hash curto>  <mensagem>
  <N> arquivo(s) · <caminho da pasta>

Nada saiu desta máquina.
Para ver a linha do tempo:  git log --oneline
Para voltar a um ponto:     git checkout <hash>
```

---

## Regras

- **Nunca** `git push`. Nem para o remoto `leanai`, nem para nenhum outro
- **Nunca** criar repositório remoto, pedir token, login ou conta
- **Nunca** `git push --force`, `git reset --hard`, `git clean -fd` ou
  `git checkout --` sobre trabalho não commitado — a menos que o usuário peça
  explicitamente naquele momento, entendendo o que perde
- **Nunca** commitar `.env`, chave, token ou credencial. Se aparecerem no `git status`,
  parar e corrigir o `.gitignore` primeiro
- `dados/` fica fora do histórico de propósito — é zona de entrada com material de
  terceiros. Se o usuário quiser guardar algo de lá, mover para `saidas/` ou `projetos/`
  antes, depois de conferir que não há dado sensível
- Se o usuário pedir backup remoto, explicar que é ação deliberada: configurar o remoto,
  declarar `backupRemotoAutorizado` em `core/instalacao.json`, e revisar o que sobe. Não
  fazer isso por conta própria

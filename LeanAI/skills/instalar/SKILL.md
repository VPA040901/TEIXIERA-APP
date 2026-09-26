---
name: instalar
description: >
  Instala o LeanAI no negócio do usuário. Detecta o ambiente (git, gh, Claude Code, Codex,
  Node), escolhe quais agentes ativar, entrevista sobre empresa, tom de voz, foco atual e
  identidade visual, preenche `_memoria/empresa.md`, `_memoria/preferencias.md`,
  `_memoria/estrategia.md` e `identidade/design-guide.md`, e sincroniza as skills para todos
  os agentes ativos. Use quando o usuário acabou de clonar o repositório e quer instalar o
  sistema, ou quando pedir "rodar {{INVOCAR:instalar}}", "instalar o LeanAI", "primeiro setup".
---

# {{INVOCAR:instalar}} — Instalação inicial do LeanAI

Primeiro comando depois de clonar o repositório. Não pode falhar e não pode soar
burocrático. Trata como conversa de descoberta — pergunta uma coisa por vez, escuta de
verdade, não enfileira tudo. O sistema tem que sair daqui sabendo quem é a empresa, como
ela fala, e onde está o atrito do dia a dia.

**Tudo que for coletado vai para o CORE** (`_memoria/`, `identidade/`), nunca para dentro
de arquivos exclusivos de um agente. É isso que garante que Claude Code e Codex leiam
exatamente o mesmo contexto.

---

## Fase 0 — Ambiente

Rodar e mostrar o resultado ao usuário:

```bash
node core/bin/leanai.mjs doctor
```

Isso reporta: sistema operacional, Node, `git`, `gh` (GitHub CLI), Claude Code e Codex —
procurando inclusive nos caminhos de instalação típicos do Windows, não só no `PATH`.

Interpretar assim:

| Ferramenta | Papel | Se faltar |
| --- | --- | --- |
| `git` | obrigatório — versionamento e atualizações | **parar** e mandar instalar em git-scm.com |
| Node.js 18+ | obrigatório — motor do LeanAI | **parar**; sem Node nada sincroniza |
| Claude Code | opcional — um dos runtimes | seguir sem ele |
| Codex | opcional — um dos runtimes | seguir sem ele |
| `gh` | não é necessário — o LeanAI é local-first | seguir sem ele |
| Python | opcional — só se alguma skill futura pedir | seguir |

Depois do clone inicial, **nada mais exige internet**. Se a rede cair, o LeanAI continua
funcionando com tudo que já está instalado.

Se **nenhum** dos dois agentes for detectado, avisar que o LeanAI ainda pode ser instalado
(os arquivos são gerados para os dois), mas que só será utilizável quando um deles estiver
disponível. Seguir mesmo assim.

## Fase 1 — Escolha dos agentes

Perguntar:

> "Qual agente você vai usar neste computador?
> 1 — Claude Code
> 2 — Codex
> 3 — Claude Code + Codex"

**Sugerir a opção 3 quando os dois forem detectados na Fase 0**, explicando em uma linha:
as skills, a memória e as regras são as mesmas nos dois; muda só como você chama.

Aplicar a escolha em `core/leanai.config.json`, no campo `agentes.<nome>.habilitado`
(`true`/`false`). Não remover o bloco do agente desativado — só desligar, para poder
religar depois sem refazer nada.

> A instalação funciona com apenas um agente presente. Nunca condicionar o setup à
> presença dos dois.

## Fase 2 — Nome da pasta

Conferir o nome da pasta atual (`basename "$(pwd)"`). Se for `LeanAI`, `leanai`,
`LeanAI-main` ou variação genérica, avisar que ao final o ideal é renomear para o nome do
negócio, e seguir. Registrar o nome atual para a Fase 7.

## Fase 3 — Estado atual

Conferir se algum arquivo de memória já tem conteúdo real (não placeholder):
`_memoria/empresa.md`, `_memoria/preferencias.md`, `_memoria/estrategia.md`,
`identidade/design-guide.md`.

Rodar:

```bash
node core/bin/leanai.mjs estado
```

Ele reporta quais arquivos de contexto já têm conteúdo real. Um arquivo ainda intocado
carrega a linha `<!-- leanai:placeholder ... -->`; **ao escrever o conteúdo real, remover
essa linha** — é o que faz o sistema parar de tratar o arquivo como vazio.

Se algum já estiver preenchido, perguntar:

> "Já tem contexto preenchido aqui. Quer que eu sobrescreva (recomeçar do zero) ou
> complemente o que falta?"

**Nunca apagar dado de cliente sem essa confirmação explícita.**

## Fase 4 — Perfil

Perguntar qual perfil mais combina com o negócio:

1. **Solopreneur / criador solo** — uma pessoa só, mistura de marca pessoal e negócio
2. **Freelancer** — atende clientes, organiza por projeto/cliente
3. **Agência / consultoria** — equipe pequena entregando para vários clientes
4. **Empresa** — empresa estabelecida com setores (marketing, comercial, financeiro, etc.)

A resposta determina qual template aplicar, em `core/templates/perfis/perfil-<perfil>.md`.

## Fase 5 — Entrevista

Fazer as perguntas em ordem, esperando a resposta de cada uma antes de seguir. Se vier
resposta vaga, repetir uma vez pedindo concretude. Não insistir mais que isso — registrar
o que vier.

**Sobre o negócio:**
1. "Como você chama o que você faz? (nome da empresa, ou seu nome se for marca pessoal)"
2. "Qual o segmento? Em que mercado vocês atuam?"
3. "O que sua empresa entrega, em uma frase do jeito que você falaria para o vizinho?"
4. "Quais os principais produtos ou serviços? (pode listar)"
5. "Quem te paga? (perfil de cliente real — uma ou duas frases, sem persona genérica)"
6. "Você toca sozinho ou tem equipe? Se tem, quantos e cada um fazendo o quê? Quem são os responsáveis por cada frente?"

**Sobre posicionamento e voz:**
7. "O que faz alguém escolher vocês em vez do concorrente? (posicionamento, em uma frase)"
8. "Me cola um exemplo da tua escrita — uma legenda, um email para cliente, qualquer coisa real e recente. Assim eu calibro o jeito de escrever sem adivinhar."
9. "O que te dá ranço quando alguém escreve assim? (ex.: 'vamos juntos!', emoji em email formal, 'caro cliente', jargão de guru, 'alavancar', 'sinergia')"

**Sobre foco e operação:**
10. "Qual o gargalo do teu negócio hoje? O que está segurando ele de crescer?"
11. "Quais os objetivos dos próximos 3 a 6 meses?"
12. "Descreve um processo que se repete toda semana aí dentro — quem faz, em que ordem, o que entra e o que sai."
13. "Se eu pudesse tirar UMA coisa que você repete toda semana das tuas costas, qual seria?"

**Sobre identidade visual:**
14. "Tem identidade visual definida ou está no zero? Se tem, me passa as cores principais e a fonte."
15. "Tem logo? Se sim, joga o arquivo em `identidade/logo.png` (ou `.svg`) e me confirma."

## Fase 6 — Preenchimento (tudo no CORE)

### `_memoria/empresa.md`
Perguntas 1-7. Nome, segmento, o que faz, produtos/serviços, perfil de cliente, equipe e
responsáveis, posicionamento.

### `_memoria/preferencias.md`
Perguntas 8-9. Estrutura:
- **Tom de voz:** derivar do exemplo real da pergunta 8 (2-3 frases descrevendo o jeito de escrever, com referência ao exemplo)
- **O que evitar:** lista direta da resposta 9
- **Estilo geral:** síntese do que combina e do que destoa

### `_memoria/estrategia.md`
Perguntas 10-13. Estrutura:
- **Gargalo atual:** resposta 10
- **Objetivos (3-6 meses):** resposta 11
- **Processos recorrentes:** resposta 12 — registrar como contexto operacional
- **Para tirar das costas:** resposta 13 — candidata a virar skill via {{INVOCAR:mapear-rotinas}}
- **Próximas prioridades:** derivar do gargalo (o que ataca o gargalo direto)

### `identidade/design-guide.md`
Perguntas 14-15. Se o usuário não tiver identidade, deixar como está e avisar:
> "Deixei o `identidade/design-guide.md` em branco. Quando você definir a identidade,
> edita lá — as skills visuais leem esse arquivo antes de criar qualquer peça."

### Regras específicas do negócio
Pegar o template do perfil escolhido (`core/templates/perfis/perfil-<perfil>.md`), adaptar
com o nome do negócio e a estrutura de pastas mencionada, e escrever **dentro do bloco
personalizado** de cada arquivo de regras ativo, entre os marcadores
`LEANAI:INICIO-PERSONALIZADO` e `LEANAI:FIM-PERSONALIZADO`.

Esse bloco é preservado pelas sincronizações. Nunca escrever fora dele: o resto do arquivo
é gerado e será sobrescrito.

## Fase 7 — Sincronização e validação

```bash
node core/bin/leanai.mjs sync
node core/bin/leanai.mjs check
node core/bin/leanai.mjs verify
node core/bin/leanai.mjs init "<Nome da Empresa>"
```

- `sync` gera as skills e o arquivo de regras de cada agente ativo
- `check` prova por hash que os agentes enxergam a mesma versão
- `verify` valida a estrutura
- `init` marca esta cópia como instalação **local** da empresa e blinda os remotos: o
  `origin` herdado do clone vira `leanai`, somente leitura

Se `check` acusar divergência, **parar** e reportar. Não seguir com o sistema inconsistente.

## Fase 8 — Histórico local

O LeanAI é **local-first**. Tudo da empresa fica nesta pasta e não sai da máquina. Não há
repositório por empresa, não há upload, não há conta a criar.

Confirmar o resultado da blindagem feita pelo `init`:

```bash
git remote -v
node core/bin/leanai.mjs guard origin
```

O esperado é:

```
leanai  https://github.com/leangiraldes/LeanAI.git   (fetch)
leanai  PUSH-BLOQUEADO-LEANAI-E-SOMENTE-LEITURA      (push)
```

E o `guard` deve **falhar** — é o comportamento correto: não existe destino de push. Se ele
passar, algo está errado; parar e reportar.

Explicar ao usuário em duas linhas:

> "O histórico fica aqui na sua máquina. `{{INVOCAR:salvar}}` registra cada ponto de trabalho
> localmente — dá para ver a linha do tempo e voltar atrás. Nada é enviado para a internet.
> O único uso do GitHub é baixar atualizações do próprio LeanAI, quando você pedir."

Se ainda não houver repositório git na pasta, criar um: `git init -b main`. Configurar
`user.name` e `user.email` **locais** (sem `--global`) se não existirem.

**Nunca** criar repositório remoto. **Nunca** pedir token, login ou conta. **Nunca** adicionar
um remoto de push.

## Fase 9 — Resumo

```
✓ Agentes ativos: [Claude Code | Codex | ambos]
✓ Perfil: [perfil]
✓ Empresa: _memoria/empresa.md
✓ Tom de voz: _memoria/preferencias.md
✓ Foco e objetivos: _memoria/estrategia.md
✓ Marca: identidade/design-guide.md  [preenchida | em branco]
✓ Skills sincronizadas: <N> · paridade verificada por hash
✓ Instalação: local — tudo fica em <caminho da pasta>
✓ Push: desativado · nenhum dado sai desta máquina
```

Se a pasta ainda tiver nome genérico, gerar o slug do nome da empresa (minúsculas, sem
acentos, espaços viram hífen) e mostrar como renomear: fechar o editor, renomear a pasta
no Explorer/Finder, abrir de novo.

## Fase 10 — Próximos passos

> "Pronto. O LeanAI já conhece o teu negócio.
>
> Tudo que combinamos aqui está nesta pasta, na tua máquina. Não subiu para lugar nenhum.
>
> No começo de cada sessão, roda {{INVOCAR:abrir}} — eu carrego tudo antes da primeira frase.
> Ao terminar, {{INVOCAR:salvar}} registra o ponto no histórico local.
>
> Você mencionou que repete '<resposta 13>' toda semana. Quando quiser tirar isso das
> costas de vez, roda {{INVOCAR:mapear-rotinas}} — a skill nasce uma vez e passa a valer nos
> dois agentes."

---

## Regras

- Não inventar dados. Resposta vaga entra do jeito que veio, ou vira placeholder explícito
- Não escrever avisos de placeholder nos arquivos finais
- O setup deve durar 8-10 minutos. Se o usuário enrolar numa pergunta, registra e segue
- Não fazer perguntas além das listadas sem motivo claro
- **Nunca sobrescrever memória existente sem a confirmação da Fase 3**
- **Nunca armazenar senha ou token em arquivo versionado.** Credencial vai para `.env`,
  que está no `.gitignore`; a chave correspondente entra em `.env.example` sem valor
- Rodar `{{INVOCAR:instalar}}` uma segunda vez deve ser seguro: detecta o estado e pergunta
  antes de qualquer sobrescrita
- **Nunca criar repositório remoto, pedir conta, token ou login.** A instalação é local:
  depois do clone inicial, o LeanAI funciona sem internet
- **Nunca deixar um remoto com push habilitado.** O `init` transforma o `origin` do clone
  em `leanai` somente leitura; conferir isso na Fase 8 e reportar se não acontecer

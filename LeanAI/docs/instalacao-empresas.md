# Instalação em empresas — local-first

> Antes de instalar em qualquer empresa cliente, leia [NOTICE.md](../NOTICE.md).

## O modelo

O LeanAI é **local-first**. O repositório público serve para **baixar** o sistema e, quando
você pedir, **consultar atualizações**. Depois do clone, tudo acontece na pasta.

```
        github.com/leangiraldes/LeanAI          ← público, só distribuição
                     │
                     │  git clone   (uma vez)
                     ▼
        C:\Empresa\LeanAI\                      ← a instalação da empresa
        ├── _memoria/        quem é a empresa, tom de voz, foco
        ├── identidade/      cores, tipografia, logo
        ├── projetos/        trabalho por cliente ou iniciativa
        ├── marketing/       carrosséis, SEO, campanhas
        ├── saidas/          análises, emails, documentos
        ├── dados/           zona de entrada (fora do git)
        ├── scripts/         utilitários da empresa
        └── .git/            histórico LOCAL — commits, reversão, auditoria

                     ▲
                     │  git fetch leanai   (opcional, quando você pedir)
                     │
        NUNCA no sentido contrário. Nada sobe.
```

Não existe repositório por empresa. Não existe upload. Não existe conta a criar. Se a
internet cair, o LeanAI continua funcionando com tudo que já está instalado.

## Instalar

### Windows

```powershell
git clone https://github.com/leangiraldes/LeanAI.git
cd LeanAI
.\installer\install.ps1
```

### macOS e Linux

```bash
git clone https://github.com/leangiraldes/LeanAI.git
cd LeanAI
bash installer/install.sh
```

Depois, em qualquer sistema:

```
claude   →  /instalar
codex    →  $instalar
```

E pronto. O `/instalar` entrevista o negócio e grava tudo em `_memoria/` e `identidade/`,
dentro da pasta.

Se quiser, renomeie a pasta para o nome do negócio — `C:\Acme\LeanAI\`, por exemplo. O
sistema não depende do nome.

## Blindagem do clone

Um clone recém-baixado vem com `origin` apontando para o LeanAI público, **com push
habilitado**. Isso é o risco óbvio: alguém roda `git push` por hábito e dados da empresa vão
parar num repositório público.

O `leanai init` — chamado pelo instalador — desarma isso:

```
antes                                     depois
origin  fetch  leangiraldes/LeanAI        leanai  fetch  leangiraldes/LeanAI
origin  push   leangiraldes/LeanAI        leanai  push   PUSH-BLOQUEADO-LEANAI-E-SOMENTE-LEITURA
```

`git fetch leanai` continua funcionando — é assim que as atualizações chegam.
`git push leanai` falha no próprio git, antes de qualquer rede.

Conferir a qualquer momento:

```bash
git remote -v
node core/bin/leanai.mjs guard origin
```

Numa instalação local o `guard` **falha de propósito**. Essa falha é a garantia.

## As camadas de proteção

| Camada | O que faz | Falha como |
| --- | --- | --- |
| **1. Sem destino** | não existe remoto de push configurado | `git push` não tem para onde ir |
| **2. URL inválida** | o remoto `leanai` tem a URL de push desabilitada | o git recusa antes da rede |
| **3. `guard`** | no modo local, bloqueia **todos** os destinos | exit 1, com explicação |
| **4. Padrão à prova de falha** | instalação sem `core/instalacao.json` é tratada como local | um clone novo já nasce bloqueado |
| **5. `.gitignore`** | segredos, `dados/`, exports e uploads nunca entram no histórico | nem em commit local |

A camada 4 importa mais do que parece: se alguém apagar o marcador ou clonar a pasta para
outro lugar, o sistema continua bloqueado. O estado inseguro exige uma ação deliberada, não
um esquecimento.

## O que fica versionado localmente

Duas camadas, e a distinção é intencional:

**Versionado localmente** — precisa de histórico, commit e reversão:
`_memoria/` · `identidade/` · `marketing/` · `saidas/` · `projetos/` · `scripts/`

É o trabalho da empresa. `/salvar` registra cada ponto e você consegue ver a linha do tempo
e voltar atrás. Não sai da máquina porque não há destino de push.

**Nunca versionado** — nem localmente:
`.env` · tokens · credenciais · cookies · sessões · bancos locais · `dados/` · `exports/` ·
`uploads/` · `core/instalacao.json`

Uma pasta é copiada, compactada e movida — e o histórico vai junto. Segredo e material de
terceiros ficam fora de qualquer commit.

Nada disso impede os arquivos de **existirem**. Eles existem, no disco, e as skills os leem
normalmente. O que se impede é a publicação.

## Salvar o trabalho

```
/salvar        (Claude Code)
$salvar        (Codex)
```

Varre segredos, confere a coerência do sistema, mostra o que mudou e registra um commit
**local**. Sem push, sem GitHub, sem conta.

```
Salvo no histórico local.
  a1b2c3d  Atualiza memória e cria projeto Acme
  7 arquivos · C:\Empresa\LeanAI

Nada saiu desta máquina.
```

Para navegar o histórico: `git log --oneline`. Para voltar a um ponto: `git checkout <hash>`.

## Atualizar o motor

```
/atualizar motor       (Claude Code)
$atualizar motor       (Codex)
```

Ou direto:

```bash
node core/bin/leanai.mjs update              # consulta e mostra — não altera nada
node core/bin/leanai.mjs update --aplicar    # aplica, depois da sua confirmação
```

A consulta mostra a versão instalada, a disponível, os commits novos, quais arquivos de
motor mudariam e o que permanece intocado. Só altera algo com `--aplicar`, que exige working
tree limpo e cria uma branch de retorno antes de qualquer mudança.

Entram só caminhos de motor: `core/`, `skills/`, `adapters/`, `installer/`, `tests/`,
`docs/`, `.github/`. Nunca `_memoria/`, `identidade/`, `dados/`, `marketing/`, `saidas/`,
`projetos/`, `scripts/`, `core/instalacao.json` nem o bloco personalizado das regras.

Skills criadas nesta instalação por `mapear-rotinas` sobrevivem: `git checkout <ref> -- <caminho>`
sobrescreve o que existe no remoto e não remove o que só existe localmente.

Sem internet, o comando avisa e encerra. Não é erro — é uma instalação local funcionando.

## Várias empresas no mesmo computador

Uma pasta por empresa. Sem configuração compartilhada, sem repositório, sem overlap:

```
C:\Empresa\
├── acme\LeanAI\
├── bravo\LeanAI\
└── charlie\LeanAI\
```

Abra o agente na pasta da empresa com quem você vai trabalhar. Claude Code e Codex descobrem
skills e regras a partir do diretório de trabalho, então o contexto carregado é o daquela
pasta. A regra `10-contexto-negocio.md` também instrui explicitamente a nunca ler dados de
outra instalação.

O isolamento é estrutural: são árvores de arquivos distintas, sem nada que as conecte.

## Backup — se você quiser, um dia

Backup remoto de uma empresa **não** faz parte do modelo padrão e não é feito por nenhuma
skill. Se você decidir configurar um para uma empresa específica, é ação deliberada:

1. criar o repositório **privado** você mesmo
2. `git remote add backup <url>`
3. editar `core/instalacao.json` e definir `"backupRemotoAutorizado": "backup"`
4. revisar com cuidado o que sobe — o workspace contém memória, estratégia e material do
   negócio

Só depois disso o `guard` libera aquele remoto específico. Nenhuma skill faz isso sozinha, e
nenhuma vai sugerir.

## Perguntas frequentes

**Preciso de conta no GitHub para usar o LeanAI?**
Não. Só para o `git clone` inicial, que é público e não exige login. Depois disso, nada.

**Uma empresa pode ver dados de outra?**
Não. Pastas separadas, sem configuração compartilhada.

**E se eu apagar `core/instalacao.json`?**
A instalação passa a ser tratada como local — que é o modo mais restritivo. Você perde só o
nome da empresa no relatório do `guard`. Rode `leanai init "<Nome>"` para recolocar.

**Posso usar o LeanAI offline?**
Sim, completamente, depois do clone inicial. Só `update` precisa de internet, e é opcional.

**Como levo uma melhoria feita numa empresa para o LeanAI público?**
Manualmente e com revisão: copie **só** a skill ou o arquivo de motor para a sua cópia do
LeanAI Base — aquela marcada com `leanai init --base` — sem nenhum dado do cliente, e
publique de lá. O `guard` bloqueia o caminho automático justamente para forçar essa revisão.

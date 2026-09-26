## Segurança e Git

### Dados e segredos

- Nunca escrever chaves de API, tokens, senhas ou cookies dentro de arquivos
  versionados. Segredos vivem em `.env`, que está no `.gitignore`.
- Quando uma skill precisar de credencial nova, adicionar a chave em `.env.example`
  **sem valor real** e pedir o valor ao usuário.
- `dados/` é zona de entrada e não é versionada, exceto o `README.md`. Arquivos que
  o usuário solta ali podem conter dados de clientes.
- Antes de qualquer commit, rodar `node core/bin/leanai.mjs scan`.

### Local-first

Esta instalação é **local**. Memória, identidade, projetos, saídas, preferências e
histórico ficam nesta pasta, nesta máquina. Nada é enviado para a internet.

O repositório público do {{PRODUTO}} serve para duas coisas, e só:

1. baixar o {{PRODUTO}} na primeira vez;
2. consultar atualizações do motor, quando o usuário pedir.

Depois do clone inicial, o {{PRODUTO}} funciona sem internet. Se a rede cair, tudo que já
está instalado continua funcionando normalmente.

### Git — uso local

O git serve de linha do tempo da empresa: histórico, commits, reversão e auditoria.

```
git add · git commit · git log · git checkout <hash>
```

Tudo local. **`git push` não faz parte da operação normal.**

Antes de qualquer envio, se alguém tentar:

```
git remote -v
node core/bin/leanai.mjs guard origin
```

Numa instalação local o `guard` **falha de propósito** — é a prova de que não há destino.

Regras absolutas:

- **Nunca** fazer `git push`. O remoto `leanai` é somente leitura, com a URL de push
  desabilitada no próprio git.
- **Nunca** criar repositório remoto, pedir token, login ou conta para salvar trabalho.
- **Nunca** enviar dados da empresa para lugar nenhum — nem para o {{PRODUTO}} público,
  nem para o repositório de origem do projeto (MazyOS), nem para terceiros.
- **Nunca** usar `git push --force`, `git reset --hard`, `git clean -fd`, `git
  checkout --` sobre trabalho não commitado, ou equivalentes destrutivos, sem que o
  usuário peça explicitamente naquele momento.
- Backup remoto de uma empresa é ação deliberada do usuário: exige configurar o remoto e
  declarar `backupRemotoAutorizado` em `core/instalacao.json`. Nunca fazer por conta própria.

### Aprovação humana

Toda ação irreversível ou externa — publicar post, disparar email, subir campanha,
criar repositório, apagar arquivo — exige confirmação explícita do usuário no momento.
Aprovação dada para uma ação não vale para a próxima.

# dados/ — drop zone

> Chame qualquer skill com `/nome` no Claude Code ou `$nome` no Codex.
> Abaixo elas aparecem só pelo nome, porque o sistema atende os dois.

Solte aqui qualquer arquivo que você quer que o LeanAI leia uma vez: CSV
de exportação do Google Ads, planilha de vendas, PDF de contrato,
transcrição de reunião, print de relatório.

Skills como `analisar-dados` e `relatorio-ads` leem direto dessa pasta.
Você arrasta o arquivo, chama o comando, recebe o resumo.

Não é arquivo final — é entrada. O que importa do que tá aqui vira
artefato em `_memoria/`, `marketing/` ou `saidas/`.

Quando você tiver MCPs de armazenamento conectados (Google Drive,
Notion), pode pedir ao agente que busque os arquivos direto da fonte — sem
precisar baixar nada pra cá.

---

## Esta pasta não vai para o git

O `.gitignore` mantém `dados/` fora do versionamento — só este README é rastreado. É
proposital: aqui costuma cair export de plataforma, planilha de vendas e PDF de contrato,
material que frequentemente contém dado pessoal de terceiros.

Se você precisar versionar algo daqui, mova primeiro para `marketing/`, `saidas/` ou
`projetos/`, depois de conferir que não há dado sensível.

## O que é este workspace

Esta pasta é a operação de um negócio rodando dentro de {{AGENTE}}. O {{PRODUTO}}
dá a esse negócio memória própria, identidade aplicada em tudo que é gerado, e um
conjunto de skills que executam marketing, SEO, anúncios e operação.

O sistema tem **uma fonte única de verdade**. As skills vivem em `skills/<nome>/SKILL.md`
e as regras em `core/regras/`. Os arquivos que este runtime lê — `{{ARQUIVO_REGRAS}}` e
`{{SKILLS_DIR}}/` — são **gerados** a partir dela. Nunca edite os gerados: a próxima
sincronização sobrescreve.

Para mudar comportamento, edite a fonte canônica e rode:

```
node core/bin/leanai.mjs sync
```

O mesmo núcleo alimenta {{AGENTE}} e {{OUTRO_AGENTE}}. Uma correção feita uma vez
vale para os dois.

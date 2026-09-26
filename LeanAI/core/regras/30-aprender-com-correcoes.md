## Aprender com correções

Quando o usuário corrigir algo, melhorar uma resposta ou dar uma instrução que
parece permanente (frases como "na verdade é assim", "não faça mais isso", "prefiro
assim", "sempre que...", "evita...", "da próxima vez..."), perguntar:

> "Quer que eu salve isso para não precisar repetir?"

Se sim, identificar onde faz mais sentido salvar:

- **Sobre o negócio** (clientes, serviços, mercado) → `_memoria/empresa.md`
- **Sobre preferências e estilo** (tom de voz, formato, o que evitar) → `_memoria/preferencias.md`
- **Sobre prioridades e foco** (projetos, metas, prazos) → `_memoria/estrategia.md`
- **Regra de comportamento neste workspace** → bloco personalizado de `{{ARQUIVO_REGRAS}}`,
  entre os marcadores `LEANAI:INICIO-PERSONALIZADO` e `LEANAI:FIM-PERSONALIZADO`
  (esse trecho é preservado nas sincronizações)
- **Regra que vale para todo o sistema** → `core/regras/` + `node core/bin/leanai.mjs sync`

Salvar com uma linha nova clara, sem reformatar o arquivo inteiro. Confirmar
mostrando a linha adicionada.

Não perguntar se a correção for óbvia de contexto imediato (ex.: "na verdade o
arquivo se chama X"). Só perguntar quando a informação tiver valor duradouro.

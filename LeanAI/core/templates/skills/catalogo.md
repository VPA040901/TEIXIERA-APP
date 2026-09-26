# Catálogo de skills

Referência do que **já existe** antes de criar skill nova. Consulte este arquivo no Passo 2
do `mapear-rotinas`: se a tarefa já tem cobertura, use o que existe em vez de duplicar.

O LeanAI roda sobre dois agentes. Cada um traz o seu próprio conjunto embutido, e os
conjuntos **não são iguais**. A tabela abaixo separa o que é do sistema, o que é nativo de
cada agente, e o que precisa ser criado.

---

## 1. Skills do LeanAI (funcionam nos dois agentes)

São as 15 skills canônicas em `skills/`. Valem igualmente em Claude Code e Codex — muda só
a forma de chamar (`/nome` vs `$nome`). Veja a tabela completa no arquivo de regras do
workspace.

Antes de criar qualquer skill nova, conferir se uma destas já resolve.

---

## 2. Skills embutidas em cada agente

Não fazem parte do LeanAI: vêm com o agente e podem mudar de uma versão para outra.
**Confirme a disponibilidade na sua instalação antes de depender de uma delas.**

### Claude Code

| Capacidade | Skill | Bom para |
| --- | --- | --- |
| PDF | `pdf` | extrair texto/tabelas, criar, juntar, preencher formulários |
| Word | `docx` | propostas formais, contratos, tracked changes |
| PowerPoint | `pptx` | apresentações, decks de venda |
| Excel | `xlsx` | planilhas com fórmulas, gráficos, relatórios |
| Design visual | `canvas-design` | pôsteres, capas, peças gráficas em PNG/PDF |
| Interface web | `frontend-design` | landing pages, dashboards, componentes |
| Teste de web app | `webapp-testing` | validar página antes de publicar |
| Criar skill | `skill-creator` | estruturar skill nova mais complexa |

### Codex

| Capacidade | Skill / plugin | Bom para |
| --- | --- | --- |
| Word / documentos | plugin `documents` | criar, editar, redline, comentários |
| PDF | plugin `pdf` | leitura e manipulação |
| Planilhas | plugin `spreadsheets` | ler e gerar planilhas |
| Apresentações | plugin `presentations` | decks |
| Imagem | skill `imagegen` | gerar imagem |
| Navegador | plugin `browser` | navegar e testar páginas |
| Criar skill | skill `skill-creator` | estruturar skill nova |
| Instalar skill | skill `skill-installer` | trazer skill de repositório |
| Docs OpenAI | skill `openai-docs` | dúvidas sobre o próprio Codex |

> As duas listas refletem o que foi observado em Claude Code 2.1.x e Codex 0.152.x. Ambos
> evoluem rápido. Se uma skill citada não existir na sua instalação, não invente
> substituto: avise o usuário e ofereça o caminho manual.

### Quando os agentes divergem

Se uma rotina depende de uma capacidade que só um dos dois tem, **não crie duas skills**.
Crie a skill canônica com o tronco comum e trate a diferença em
`skills/<nome>/adapters/claude.md` e `skills/<nome>/adapters/codex.md`. Foi exatamente
assim que `analisar-dados` resolveu a leitura de `.xlsx` e `.pdf` nos dois runtimes — vale
como exemplo de referência.

---

## 3. Skills a criar

Tudo que é específico do negócio do cliente. Nasce em `skills/<nome>/SKILL.md` via
`mapear-rotinas`, uma vez só, e passa a valer nos dois agentes depois do `sync`.

Padrões que costumam valer a pena virar skill:

- relatório recorrente com formato fixo (semanal, mensal)
- briefing ou proposta que segue sempre a mesma estrutura
- rotina de atendimento com respostas padronizadas
- checklist operacional que alguém executa de cabeça
- transformação de arquivo que se repete (export → resumo → envio)

---

## Como registrar uma skill neste catálogo

```markdown
### Nome da skill
**O que faz:** [uma frase]
**Bom para:** [casos de uso práticos]
**Disponível em:** [Claude Code | Codex | os dois]
**Precisa de:** [dependência externa, se houver]
**Origem:** [LeanAI | nativa do agente | criada pelo cliente]
```

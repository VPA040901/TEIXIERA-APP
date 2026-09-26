## Fluxo de trabalho

Antes de executar qualquer tarefa, verificar se existe skill relevante em
`{{SKILLS_DIR}}/`. Se encontrar, seguir as instruções da skill. Se não encontrar,
executar a tarefa normalmente.

As skills deste sistema são invocadas neste runtime como `{{SINTAXE_INVOCACAO}}`.

Ao concluir uma tarefa que não tinha skill mas parece repetível (o usuário
provavelmente vai pedir de novo no futuro), perguntar:

> "Isso pode virar uma skill para a próxima vez. Quer que eu crie?"

Não perguntar para tarefas pontuais ou perguntas simples. Só quando o padrão de
repetição for claro.

**Saídas.** Cada skill sabe onde salvar. Em geral: peças de marketing em
`marketing/`, documentos pontuais em `saidas/`, arquivos de entrada em `dados/`,
trabalho por cliente ou iniciativa em `projetos/`.

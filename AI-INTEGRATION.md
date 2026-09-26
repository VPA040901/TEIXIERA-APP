# Integração do assistente por áudio

O navegador transforma a fala em texto em português. Quando um endpoint for configurado em **Preferências → Assistente por áudio e IA**, o app envia a transcrição para esse serviço. A gravação de áudio não é enviada.

## Requisição

O app faz `POST` com `Content-Type: application/json`:

```json
{
  "transcript": "Agende uma consultoria para Mariana amanhã às 14h",
  "language": "pt-BR",
  "today": "2026-09-25",
  "allowedActions": ["pedidos", "agenda", "financeiro", "clientes", "documentos"]
}
```

## Resposta

Retorne JSON com a ação escolhida, os campos do formulário e um resumo curto para a pessoa revisar:

```json
{
  "action": "agenda",
  "summary": "Criar uma consultoria para Mariana Costa amanhã às 14h.",
  "fields": {
    "titulo": "Consultoria",
    "cliente": "Mariana Costa",
    "data": "2026-09-26",
    "hora": "14:00",
    "status": "Confirmado"
  }
}
```

`action` deve ser `pedidos`, `agenda`, `financeiro`, `clientes` ou `documentos`. O app descarta campos que não pertencem ao formulário escolhido. A resposta sempre abre um formulário de revisão; a IA não salva registros diretamente.

O endpoint deve permitir requisições do endereço do app (CORS). Mantenha qualquer chave de provedor exclusivamente no servidor da integração; não a coloque no navegador nem no campo de URL das Preferências.

Sem endpoint configurado, o app usa uma interpretação local simples e deixa a transcrição e os campos editáveis para correção.

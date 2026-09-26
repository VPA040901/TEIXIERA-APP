# Catálogo de ferramentas

APIs, CLIs e conectores que as skills do LeanAI podem usar. Consulte antes de criar skill
nova, para não reimplementar o que já está disponível.

Toda credencial vai para `.env` (ignorado pelo git). A chave correspondente entra em
`.env.example` **sem valor real**.

---

## Renderizar HTML em imagem

### Playwright
**O que faz:** renderiza qualquer HTML em PNG (carrosséis, slides, propostas, cards)
**Precisa de conta:** não, roda local
**Instalar:**
```bash
npm install playwright
npx playwright install chromium
```
**Usar:**
```bash
npx playwright screenshot --viewport-size=1080,1350 "file:///caminho/slide.html" "slide.png"
```
**Tamanhos:** Instagram feed 1080x1350 · story/Reels 1080x1920 · slide 16:9 1920x1080 · quadrado 1080x1080
**Disponível em:** os dois agentes (é um processo local, não uma capacidade do agente)

---

## Buscar conteúdo na web

**Disponível em:** os dois agentes, com nomes diferentes.

- **Claude Code:** ferramentas `WebSearch` (busca) e `WebFetch` (leitura de página)
- **Codex:** busca web nativa e, quando habilitado, o plugin `browser`

Em skill canônica, escreva "busca na web" e "leitura de página". Se precisar nomear a
ferramenta, faça no adapter do runtime, nunca no corpo canônico.

### Jina Reader
**O que faz:** converte URL em markdown limpo — melhor que leitura crua para artigos longos
**Precisa de conta:** não
**Usar:** acessar `https://r.jina.ai/{URL}` com a ferramenta de leitura de página do runtime

---

## Publicar em redes sociais

### Meta Graph API (Instagram + Facebook)
**O que faz:** publica carrossel no Instagram e no Facebook
**Precisa de conta:** sim — Meta Business, Página FB, conta Instagram Business conectada
**Configurar no `.env`:** `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID`, `SITE_URL`
**Usar:** scripts `scripts/postar-instagram.js` e `scripts/postar-facebook.js` (criados sob demanda)
**Usada por:** `aprovar-post`
**Atenção:** a API busca a imagem por URL pública. O site precisa estar no ar antes de postar.

### LinkedIn
Manual por enquanto. A API de página exige aprovação demorada. As skills geram o texto
pronto em `legenda-linkedin.md` para colar.

---

## Gerar imagem com IA

### OpenAI Images
**Precisa de conta:** sim (pago)
**Configurar no `.env`:** `OPENAI_API_KEY`
**Usar:** `node --env-file=.env scripts/gerar-imagem.js "PROMPT" "saida.png"`

### Google Gemini
**Precisa de conta:** sim (Google AI Studio, gratuito até um limite)
**Configurar no `.env`:** `GEMINI_API_KEY`

> No Codex, a skill nativa `imagegen` pode cobrir esse caso sem script próprio. Conferir
> disponibilidade antes de criar o script.

---

## Publicar HTML com link público

### Cloudflare Pages
**O que faz:** publica arquivos HTML com link compartilhável (propostas, landing pages)
**Precisa de conta:** sim, Cloudflare (gratuito)
**Configurar no `.env`:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

---

## Extrair transcrição de vídeo

### yt-dlp
**O que faz:** baixa legendas/transcrições do YouTube
**Precisa de conta:** não
**Instalar:** `brew install yt-dlp` (macOS) · `winget install yt-dlp` (Windows) · gerenciador da distro (Linux)

---

## Conectar plataformas via MCP

MCP é o padrão que os dois agentes usam para falar com sistemas externos. **Os comandos de
instalação são diferentes:**

| Ação | Claude Code | Codex |
| --- | --- | --- |
| Listar | `claude mcp list` | `codex mcp list` |
| Adicionar | `claude mcp add <nome> -- <comando>` | `codex mcp add <nome> -- <comando>` |
| Remover | `claude mcp remove <nome>` | `codex mcp remove <nome>` |

Configure o MCP em cada agente que for usar. O servidor em si é o mesmo — só o registro é
por agente.

Servidores úteis para operação de empresa:

| Servidor | Para quê | Precisa de |
| --- | --- | --- |
| Notion | tarefas, bases de clientes, briefings | API key |
| Gmail | ler e compor email | OAuth Google |
| Google Calendar | agenda, disponibilidade | OAuth Google |
| Google Ads | campanhas e performance | credenciais Google Ads |
| Meta Ads | campanhas Facebook/Instagram | token Meta Business |
| Supabase | banco de dados e backend | projeto Supabase |
| n8n | disparar automações | instância + API key |

> Não versione token de MCP. Se o registro do MCP guardar credencial em arquivo, confirme
> que esse arquivo está no `.gitignore` antes de rodar `salvar`.

---

## Como registrar uma ferramenta nova

```markdown
### Nome da ferramenta
**O que faz:** [uma frase]
**Precisa de conta:** [sim/não]
**Configurar no `.env`:** [chaves, sem valor]
**Usar:** [comando ou instrução]
**Disponível em:** [Claude Code | Codex | os dois]
```

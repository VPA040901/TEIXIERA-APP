#!/usr/bin/env bash
# =====================================================================
#  LeanAI — instalador para macOS e Linux
#
#  Este script:
#    - detecta o sistema e as dependências
#    - pergunta quais agentes ativar
#    - sincroniza as skills para os agentes escolhidos
#    - valida a estrutura
#
#  Ele NÃO:
#    - apaga dados existentes
#    - sobrescreve memória de cliente sem perguntar
#    - grava senha ou token em lugar nenhum
#    - baixa e executa código remoto
#
#  Uso:
#     bash installer/install.sh
#     bash installer/install.sh --agentes ambos --nao-interativo
# =====================================================================

set -euo pipefail

AGENTES="auto"
NAO_INTERATIVO=0
EMPRESA=""

while [ $# -gt 0 ]; do
  case "$1" in
    --agentes)          AGENTES="${2:-auto}"; shift 2 ;;
    --agentes=*)        AGENTES="${1#*=}"; shift ;;
    --nao-interativo)   NAO_INTERATIVO=1; shift ;;
    --empresa)          EMPRESA="${2:-}"; shift 2 ;;
    --empresa=*)        EMPRESA="${1#*=}"; shift ;;
    -h|--help)
      echo "uso: bash installer/install.sh [--agentes claude|codex|ambos|auto] [--nao-interativo] [--empresa \"Nome\"]"
      exit 0 ;;
    *) echo "opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_TIT=$'\033[36m'; C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_AVI=$'\033[33m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_TIT=''; C_OK=''; C_ERR=''; C_AVI=''; C_DIM=''; C_OFF=''
fi

titulo() { printf '\n%s%s%s\n%s%s%s\n' "$C_TIT" "$1" "$C_OFF" "$C_DIM" "$(printf '%.0s-' $(seq 1 $(( ${#1} + 6 ))))" "$C_OFF"; }
ok()     { printf '  %sOK%s    %s\n' "$C_OK" "$C_OFF" "$1"; }
falha()  { printf '  %sFALHA%s %s\n' "$C_ERR" "$C_OFF" "$1"; }
aviso()  { printf '  %s...%s   %s\n' "$C_AVI" "$C_OFF" "$1"; }
info()   { printf '        %s%s%s\n' "$C_DIM" "$1" "$C_OFF"; }

achar() { command -v "$1" 2>/dev/null || true; }

# Claude Code e Codex podem não estar no PATH.
achar_agente() {
  local nome="$1" direto
  direto="$(achar "$nome")"
  if [ -n "$direto" ]; then printf '%s' "$direto"; return; fi
  local bases=()
  case "$nome" in
    claude) bases=("$HOME/.vscode/extensions" "$HOME/.local/share/claude" "$HOME/.claude/bin") ;;
    codex)  bases=("$HOME/.local/share/OpenAI/Codex/bin" "$HOME/.codex/bin" "$HOME/Applications") ;;
  esac
  local b achado
  for b in "${bases[@]}"; do
    [ -d "$b" ] || continue
    achado="$(find "$b" -maxdepth 5 -type f -name "$nome" -perm -u+x 2>/dev/null | head -n 1 || true)"
    if [ -n "$achado" ]; then printf '%s' "$achado"; return; fi
  done
}

printf '\n  LeanAI\n'
printf '  %sSistema operacional inteligente para empresas.%s\n' "$C_DIM" "$C_OFF"
printf '  %sCompatível com Claude Code e Codex.%s\n' "$C_DIM" "$C_OFF"

# ---------------------------------------------------------------------
titulo 'Etapa 1 - Ambiente'

info "Sistema:  $(uname -s) $(uname -m)"
info "Pasta:    $RAIZ"

BLOQUEADO=0

NODE="$(achar node)"
if [ -n "$NODE" ]; then
  VNODE="$("$NODE" --version)"
  MAJOR="$(printf '%s' "$VNODE" | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$MAJOR" -ge 18 ] 2>/dev/null; then
    ok "Node.js $VNODE"
  else
    falha "Node.js $VNODE - o LeanAI precisa da versão 18 ou superior"
    info 'Atualize em https://nodejs.org'
    BLOQUEADO=1
  fi
else
  falha 'Node.js não encontrado (obrigatório)'
  info 'Instale em https://nodejs.org e abra um terminal novo'
  BLOQUEADO=1
fi

GIT="$(achar git)"
if [ -n "$GIT" ]; then ok "$("$GIT" --version)"; else
  falha 'git não encontrado (obrigatório)'
  info 'macOS: xcode-select --install   ·   Linux: use o gerenciador da distro'
  BLOQUEADO=1
fi

info 'GitHub CLI não é necessário - o LeanAI é local-first'

CLAUDE="$(achar_agente claude)"
if [ -n "$CLAUDE" ]; then ok 'Claude Code encontrado'; info "$CLAUDE"; else aviso 'Claude Code não encontrado'; fi

CODEX="$(achar_agente codex)"
if [ -n "$CODEX" ]; then ok 'Codex encontrado'; info "$CODEX"; else aviso 'Codex não encontrado'; fi

if [ "$BLOQUEADO" -eq 1 ]; then
  printf '\n'; falha 'Dependências obrigatórias faltando. Instalação interrompida.'
  info 'Nada foi alterado.'
  exit 1
fi

# ---------------------------------------------------------------------
titulo 'Etapa 2 - Agentes'

ESCOLHA="$AGENTES"
if [ "$ESCOLHA" = "auto" ]; then
  if [ -n "$CLAUDE" ] && [ -n "$CODEX" ]; then SUGESTAO=ambos; SUGNUM=3
  elif [ -n "$CLAUDE" ];                  then SUGESTAO=claude; SUGNUM=1
  elif [ -n "$CODEX" ];                   then SUGESTAO=codex;  SUGNUM=2
  else                                          SUGESTAO=ambos; SUGNUM=3; fi

  if [ "$NAO_INTERATIVO" -eq 1 ]; then
    ESCOLHA="$SUGESTAO"
    info "Modo não interativo: usando '$SUGESTAO'"
  else
    printf '\n  Qual agente você vai usar?\n'
    printf '    1 - Claude Code\n    2 - Codex\n    3 - Claude Code + Codex\n'
    if [ -n "$CLAUDE" ] && [ -n "$CODEX" ]; then
      printf '\n  %sOs dois estão instalados. Sugestão: 3 (as skills, a memória e as%s\n' "$C_AVI" "$C_OFF"
      printf '  %sregras são as mesmas nos dois; muda só como você chama).%s\n' "$C_AVI" "$C_OFF"
    fi
    printf '\n  Escolha [%s]: ' "$SUGNUM"
    read -r RESP || RESP=''
    [ -z "$RESP" ] && RESP="$SUGNUM"
    case "$RESP" in
      1) ESCOLHA=claude ;;
      2) ESCOLHA=codex ;;
      3) ESCOLHA=ambos ;;
      *) aviso "Resposta '$RESP' não reconhecida; usando a sugestão '$SUGESTAO'"; ESCOLHA="$SUGESTAO" ;;
    esac
  fi
fi

ATIVA_CLAUDE=false; ATIVA_CODEX=false
case "$ESCOLHA" in
  claude) ATIVA_CLAUDE=true ;;
  codex)  ATIVA_CODEX=true ;;
  ambos)  ATIVA_CLAUDE=true; ATIVA_CODEX=true ;;
  *) falha "valor inválido para --agentes: $ESCOLHA"; exit 2 ;;
esac

[ "$ATIVA_CLAUDE" = true ] && [ -z "$CLAUDE" ] && aviso 'Claude Code ativado mas não detectado - os arquivos serão gerados assim mesmo'
[ "$ATIVA_CODEX"  = true ] && [ -z "$CODEX" ]  && aviso 'Codex ativado mas não detectado - os arquivos serão gerados assim mesmo'

LISTA_AGENTES=()
[ "$ATIVA_CLAUDE" = true ] && LISTA_AGENTES+=("claude")
[ "$ATIVA_CODEX"  = true ] && LISTA_AGENTES+=("codex")
"$NODE" "$RAIZ/core/bin/leanai.mjs" agentes "${LISTA_AGENTES[@]}" >/dev/null \
  || { falha 'Não foi possível gravar core/leanai.config.json'; exit 1; }

ATIVOS=""
[ "$ATIVA_CLAUDE" = true ] && ATIVOS="Claude Code"
[ "$ATIVA_CODEX" = true ] && { [ -n "$ATIVOS" ] && ATIVOS="$ATIVOS + Codex" || ATIVOS="Codex"; }
ok "Agentes ativos: $ATIVOS"

# ---------------------------------------------------------------------
titulo 'Etapa 3 - Preservação de dados'

# A detecção de placeholder vive no motor: instalador e skill usam a mesma regra.
PREENCHIDOS="$("$NODE" "$RAIZ/core/bin/leanai.mjs" estado --json \
  | "$NODE" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).preenchidos.join("\n")))')"

if [ -n "$PREENCHIDOS" ]; then
  aviso "Já existe contexto preenchido:"
  printf '%s\n' "$PREENCHIDOS" | while IFS= read -r f; do [ -n "$f" ] && info "$f"; done
  info 'O instalador NÃO vai tocar nesses arquivos.'
  info 'Para revisar ou complementar, rode a skill /instalar dentro do agente.'
else
  ok 'Memória em branco - pronta para o onboarding'
fi

# ---------------------------------------------------------------------
titulo 'Etapa 4 - Sincronização das skills'
"$NODE" "$RAIZ/core/bin/leanai.mjs" sync  || { falha 'A sincronização falhou. Instalação interrompida.'; exit 1; }
"$NODE" "$RAIZ/core/bin/leanai.mjs" check || { falha 'Divergência após a sincronização. Instalação interrompida.'; exit 1; }

# ---------------------------------------------------------------------
titulo 'Etapa 5 - Validação'
"$NODE" "$RAIZ/core/bin/leanai.mjs" verify || { falha 'A estrutura do projeto tem problemas. Veja acima.'; exit 1; }
"$NODE" "$RAIZ/core/bin/leanai.mjs" scan   || { falha 'Possíveis segredos no working tree. Resolva antes de seguir.'; exit 1; }

# ---------------------------------------------------------------------
titulo 'Etapa 6 - Instalação local'

if [ -z "$EMPRESA" ] && [ "$NAO_INTERATIVO" -eq 0 ]; then
  printf '\n  Nome da empresa desta instalação (Enter para decidir depois): '
  read -r EMPRESA || EMPRESA=''
fi

if [ -n "$EMPRESA" ]; then
  "$NODE" "$RAIZ/core/bin/leanai.mjs" init "$EMPRESA" \
    || { falha 'Não foi possível marcar a instalação.'; exit 1; }
else
  aviso 'Instalação sem nome de empresa por enquanto'
  info 'Ela já é LOCAL: sem marcador, o guard bloqueia qualquer push.'
  info 'Rode depois: node core/bin/leanai.mjs init "Nome da Empresa"'
  info 'Isso também transforma o clone em somente leitura.'
fi

printf '\n  Tudo desta empresa fica nesta pasta:\n'
info "$RAIZ"
info 'Memória, identidade, projetos, saídas e histórico. Nada sai da máquina.'

# ---------------------------------------------------------------------
titulo 'Pronto'

printf '\n  Próximo passo - abra esta pasta no agente e rode o onboarding:\n\n'
[ "$ATIVA_CLAUDE" = true ] && printf '    %sClaude Code:  /instalar%s\n' "$C_OK" "$C_OFF"
[ "$ATIVA_CODEX"  = true ] && printf '    %sCodex:        $instalar%s\n' "$C_OK" "$C_OFF"
printf '\n  %sDepois disso, /abrir (ou $abrir) no começo de cada sessão de trabalho.%s\n' "$C_DIM" "$C_OFF"
printf '\n  %sAntes de instalar em empresa cliente, leia o NOTICE.md:%s\n' "$C_AVI" "$C_OFF"
printf '  %so uso comercial ainda depende de autorização do projeto de origem.%s\n\n' "$C_AVI" "$C_OFF"

exit 0

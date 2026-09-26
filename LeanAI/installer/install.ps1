# =====================================================================
#  LeanAI — instalador para Windows (PowerShell 5.1+)
#
#  Este script:
#    - detecta o sistema e as dependencias
#    - pergunta quais agentes ativar
#    - sincroniza as skills para os agentes escolhidos
#    - valida a estrutura
#
#  Ele NAO:
#    - apaga dados existentes
#    - sobrescreve memoria de cliente sem perguntar
#    - grava senha ou token em lugar nenhum
#    - baixa e executa codigo remoto
#
#  Uso:
#     .\installer\install.ps1
#     .\installer\install.ps1 -Agentes ambos -NaoInterativo
# =====================================================================

[CmdletBinding()]
param(
    [ValidateSet('claude', 'codex', 'ambos', 'auto')]
    [string]$Agentes = 'auto',

    [switch]$NaoInterativo,

    [string]$Empresa = ''
)

$ErrorActionPreference = 'Stop'

# Raiz do projeto = pasta acima de installer\
$Raiz = Split-Path -Parent $PSScriptRoot

function Write-Titulo($texto) {
    Write-Host ''
    Write-Host $texto -ForegroundColor Cyan
    Write-Host ('-' * [Math]::Min(60, $texto.Length + 6)) -ForegroundColor DarkGray
}

function Write-Ok($texto)    { Write-Host "  OK    $texto" -ForegroundColor Green }
function Write-Falha($texto) { Write-Host "  FALHA $texto" -ForegroundColor Red }
function Write-Aviso($texto) { Write-Host "  ...   $texto" -ForegroundColor Yellow }
function Write-Info($texto)  { Write-Host "        $texto" -ForegroundColor DarkGray }

function Find-Comando($nome) {
    $g = Get-Command $nome -ErrorAction SilentlyContinue
    if ($g) { return $g.Source }
    return $null
}

# Claude Code e Codex costumam nao estar no PATH no Windows.
function Find-Agente($nome) {
    $direto = Find-Comando $nome
    if ($direto) { return $direto }

    $bases = @()
    if ($nome -eq 'claude') {
        $bases += (Join-Path $env:USERPROFILE '.vscode\extensions')
        $bases += (Join-Path $env:LOCALAPPDATA 'Programs')
    }
    if ($nome -eq 'codex') {
        $bases += (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin')
    }

    foreach ($base in $bases) {
        if (-not (Test-Path -LiteralPath $base)) { continue }
        $achado = Get-ChildItem -LiteralPath $base -Recurse -Filter "$nome.exe" -ErrorAction SilentlyContinue |
                  Select-Object -First 1
        if ($achado) { return $achado.FullName }
    }
    return $null
}

# ---------------------------------------------------------------------
Write-Host ''
Write-Host '  LeanAI' -ForegroundColor White
Write-Host '  Sistema operacional inteligente para empresas.' -ForegroundColor DarkGray
Write-Host '  Compativel com Claude Code e Codex.' -ForegroundColor DarkGray

Write-Titulo 'Etapa 1 - Ambiente'

Write-Info "Sistema:  $([System.Environment]::OSVersion.VersionString)"
Write-Info "Pasta:    $Raiz"

$bloqueado = $false

$node = Find-Comando 'node'
if ($node) {
    $versaoNode = (& $node --version).Trim()
    $major = [int]($versaoNode -replace '^v(\d+).*$', '$1')
    if ($major -ge 18) {
        Write-Ok "Node.js $versaoNode"
    } else {
        Write-Falha "Node.js $versaoNode - o LeanAI precisa da versao 18 ou superior"
        Write-Info 'Atualize em https://nodejs.org'
        $bloqueado = $true
    }
} else {
    Write-Falha 'Node.js nao encontrado (obrigatorio)'
    Write-Info 'Instale em https://nodejs.org e abra um terminal novo'
    $bloqueado = $true
}

$git = Find-Comando 'git'
if ($git) {
    Write-Ok ((& $git --version).Trim())
} else {
    Write-Falha 'git nao encontrado (obrigatorio)'
    Write-Info 'Instale em https://git-scm.com/download/win'
    $bloqueado = $true
}

Write-Info 'GitHub CLI nao e necessario - o LeanAI e local-first'

$claude = Find-Agente 'claude'
if ($claude) { Write-Ok "Claude Code encontrado"; Write-Info $claude }
else         { Write-Aviso 'Claude Code nao encontrado' }

$codex = Find-Agente 'codex'
if ($codex) { Write-Ok "Codex encontrado"; Write-Info $codex }
else        { Write-Aviso 'Codex nao encontrado' }

if ($bloqueado) {
    Write-Host ''
    Write-Falha 'Dependencias obrigatorias faltando. Instalacao interrompida.'
    Write-Info 'Nada foi alterado.'
    exit 1
}

# ---------------------------------------------------------------------
Write-Titulo 'Etapa 2 - Agentes'

$escolha = $Agentes

if ($escolha -eq 'auto') {
    if ($claude -and $codex) { $sugestao = 'ambos'; $sugestaoNum = '3' }
    elseif ($claude)         { $sugestao = 'claude'; $sugestaoNum = '1' }
    elseif ($codex)          { $sugestao = 'codex'; $sugestaoNum = '2' }
    else                     { $sugestao = 'ambos'; $sugestaoNum = '3' }

    if ($NaoInterativo) {
        $escolha = $sugestao
        Write-Info "Modo nao interativo: usando '$sugestao'"
    } else {
        Write-Host ''
        Write-Host '  Qual agente voce vai usar?'
        Write-Host '    1 - Claude Code'
        Write-Host '    2 - Codex'
        Write-Host '    3 - Claude Code + Codex'
        if ($claude -and $codex) {
            Write-Host ''
            Write-Host '  Os dois estao instalados. Sugestao: 3 (as skills, a memoria e as' -ForegroundColor Yellow
            Write-Host '  regras sao as mesmas nos dois; muda so como voce chama).' -ForegroundColor Yellow
        }
        Write-Host ''
        $resp = Read-Host "  Escolha [$sugestaoNum]"
        if ([string]::IsNullOrWhiteSpace($resp)) { $resp = $sugestaoNum }
        switch ($resp.Trim()) {
            '1' { $escolha = 'claude' }
            '2' { $escolha = 'codex' }
            '3' { $escolha = 'ambos' }
            default {
                Write-Aviso "Resposta '$resp' nao reconhecida; usando a sugestao '$sugestao'"
                $escolha = $sugestao
            }
        }
    }
}

$ativarClaude = ($escolha -eq 'claude') -or ($escolha -eq 'ambos')
$ativarCodex  = ($escolha -eq 'codex')  -or ($escolha -eq 'ambos')

if ($ativarClaude -and (-not $claude)) {
    Write-Aviso 'Claude Code ativado mas nao detectado - os arquivos serao gerados assim mesmo'
}
if ($ativarCodex -and (-not $codex)) {
    Write-Aviso 'Codex ativado mas nao detectado - os arquivos serao gerados assim mesmo'
}

# A escrita do config passa pelo proprio motor: ConvertTo-Json do PowerShell 5.1
# escapa acentos como \uXXXX e reordena chaves, sujando o diff a cada instalacao.
$listaAgentes = @()
if ($ativarClaude) { $listaAgentes += 'claude' }
if ($ativarCodex)  { $listaAgentes += 'codex' }

& $node (Join-Path $Raiz 'core\bin\leanai.mjs') 'agentes' @listaAgentes | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Falha 'Nao foi possivel gravar core/leanai.config.json'
    exit 1
}

$ativos = @()
if ($ativarClaude) { $ativos += 'Claude Code' }
if ($ativarCodex)  { $ativos += 'Codex' }
Write-Ok ("Agentes ativos: " + ($ativos -join ' + '))

# ---------------------------------------------------------------------
Write-Titulo 'Etapa 3 - Preservacao de dados'

# A deteccao de placeholder vive no motor: instalador e skill usam a mesma regra.
$estadoJson = & $node (Join-Path $Raiz 'core\bin\leanai.mjs') 'estado' '--json' | Out-String
$estado = $estadoJson | ConvertFrom-Json
$preenchidos = @($estado.preenchidos)

if ($preenchidos.Count -gt 0) {
    Write-Aviso "Ja existe contexto preenchido em $($preenchidos.Count) arquivo(s):"
    foreach ($f in $preenchidos) { Write-Info $f }
    Write-Info 'O instalador NAO vai tocar nesses arquivos.'
    Write-Info 'Para revisar ou complementar, rode a skill /instalar dentro do agente.'
} else {
    Write-Ok 'Memoria em branco - pronta para o onboarding'
}

# ---------------------------------------------------------------------
Write-Titulo 'Etapa 4 - Sincronizacao das skills'

& $node (Join-Path $Raiz 'core\bin\leanai.mjs') 'sync'
if ($LASTEXITCODE -ne 0) {
    Write-Falha 'A sincronizacao falhou. Instalacao interrompida.'
    exit 1
}

& $node (Join-Path $Raiz 'core\bin\leanai.mjs') 'check'
if ($LASTEXITCODE -ne 0) {
    Write-Falha 'Divergencia detectada apos a sincronizacao. Instalacao interrompida.'
    exit 1
}

# ---------------------------------------------------------------------
Write-Titulo 'Etapa 5 - Validacao'

& $node (Join-Path $Raiz 'core\bin\leanai.mjs') 'verify'
if ($LASTEXITCODE -ne 0) {
    Write-Falha 'A estrutura do projeto tem problemas. Veja acima.'
    exit 1
}

& $node (Join-Path $Raiz 'core\bin\leanai.mjs') 'scan'
if ($LASTEXITCODE -ne 0) {
    Write-Falha 'Foram encontrados possiveis segredos no working tree. Resolva antes de seguir.'
    exit 1
}

# ---------------------------------------------------------------------
Write-Titulo 'Etapa 6 - Instalacao local'

$nomeEmpresa = $Empresa
if ((-not $nomeEmpresa) -and (-not $NaoInterativo)) {
    Write-Host ''
    $nomeEmpresa = Read-Host '  Nome da empresa desta instalacao (Enter para decidir depois)'
}

if ($nomeEmpresa -and $nomeEmpresa.Trim()) {
    & $node (Join-Path $Raiz 'core\bin\leanai.mjs') 'init' $nomeEmpresa.Trim()
    if ($LASTEXITCODE -ne 0) {
        Write-Falha 'Nao foi possivel marcar a instalacao.'
        exit 1
    }
} else {
    Write-Aviso 'Instalacao sem nome de empresa por enquanto'
    Write-Info 'Ela ja e LOCAL: sem marcador, o guard bloqueia qualquer push.'
    Write-Info 'Rode depois: node core/bin/leanai.mjs init "Nome da Empresa"'
    Write-Info 'Isso tambem transforma o clone em somente leitura.'
}

Write-Host ''
Write-Host '  Tudo desta empresa fica nesta pasta:' -ForegroundColor White
Write-Host "    $Raiz" -ForegroundColor DarkGray
Write-Host '  Memoria, identidade, projetos, saidas e historico. Nada sai da maquina.' -ForegroundColor DarkGray

# ---------------------------------------------------------------------
Write-Titulo 'Pronto'

Write-Host ''
Write-Host '  Proximo passo - abra esta pasta no agente e rode o onboarding:' -ForegroundColor White
Write-Host ''
if ($ativarClaude) { Write-Host '    Claude Code:  /instalar' -ForegroundColor Green }
if ($ativarCodex)  { Write-Host '    Codex:        $instalar' -ForegroundColor Green }
Write-Host ''
Write-Host '  Depois disso, /abrir (ou $abrir) no comeco de cada sessao de trabalho.' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Antes de instalar em empresa cliente, leia o NOTICE.md:' -ForegroundColor Yellow
Write-Host '  o uso comercial ainda depende de autorizacao do projeto de origem.' -ForegroundColor Yellow
Write-Host ''

exit 0

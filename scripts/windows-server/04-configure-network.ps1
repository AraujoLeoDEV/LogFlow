# Passo 4 de 4 - Configura firewall + port-proxy do Windows para o WSL2 e
# registra uma tarefa agendada que reaplica o port-proxy e garante que o
# WSL/Docker subam automaticamente no boot do servidor.
#
# O WSL2 muda o IP interno a cada boot, por isso o port-proxy precisa ser
# reaplicado a cada inicializacao do Windows.
#
# Execute como Administrador (PowerShell), apos concluir 03-docker-bootstrap.sh:
#   .\04-configure-network.ps1 -DistroName Ubuntu-22.04

#Requires -RunAsAdministrator

param(
    [string]$DistroName = "Ubuntu-22.04",
    [int[]]$Ports = @(80, 443, 8443)
)

$ErrorActionPreference = "Stop"
$installDir = "C:\antigravity"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# ---------------------------------------------------------------------------
# 1) Regras de firewall (entrada) para as portas publicadas pelo Caddy
# ---------------------------------------------------------------------------
Write-Host "Criando regras de firewall..." -ForegroundColor Cyan
foreach ($port in $Ports) {
    $ruleName = "Antigravity TCP $port"
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
        Write-Host "    + $ruleName"
    } else {
        Write-Host "    = $ruleName (ja existe)"
    }
}

# ---------------------------------------------------------------------------
# 2) Script auxiliar que reaplica o port-proxy apontando para o IP atual do WSL2
# ---------------------------------------------------------------------------
$updateScript = Join-Path $installDir "update-portproxy.ps1"
$portsList = ($Ports -join ",")

$updateScriptContent = @"
# Gerado por 04-configure-network.ps1 - reaplica netsh portproxy apontando
# para o IP atual do WSL2 (muda a cada boot) e garante que a stack Docker
# esteja de pe.
`$DistroName = '$DistroName'
`$Ports = $portsList -split ','

# Garante que o WSL (e o systemd/Docker dentro dele) esteja iniciado
wsl -d `$DistroName -- true

Start-Sleep -Seconds 10

`$wslIp = (wsl -d `$DistroName -- hostname -I).Trim().Split(' ')[0]
if (-not `$wslIp) {
    Write-Error "Nao foi possivel obter o IP do WSL ('$DistroName')."
    exit 1
}

foreach (`$port in `$Ports) {
    netsh interface portproxy delete v4tov4 listenport=`$port listenaddress=0.0.0.0 | Out-Null
    netsh interface portproxy add v4tov4 listenport=`$port listenaddress=0.0.0.0 connectport=`$port connectaddress=`$wslIp | Out-Null
}

Write-Host "Port-proxy atualizado para WSL IP `$wslIp (portas: `$(`$Ports -join ', '))"
"@

Set-Content -Path $updateScript -Value $updateScriptContent -Encoding UTF8
Write-Host "Script auxiliar criado em $updateScript" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 3) Tarefa agendada: executa o script auxiliar no boot do Windows
# ---------------------------------------------------------------------------
$taskName = "Antigravity-WSL-PortProxy"
Write-Host "Registrando tarefa agendada '$taskName' (executa no boot)..." -ForegroundColor Cyan

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$updateScript`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null

Write-Host ""
Write-Host "Configuracao concluida." -ForegroundColor Green
Write-Host "Executando o port-proxy agora pela primeira vez..." -ForegroundColor Cyan
& $updateScript

Write-Host ""
Write-Host "A partir de agora, a cada boot do Windows o WSL/Docker sera" -ForegroundColor Yellow
Write-Host "iniciado (containers com 'restart: unless-stopped' voltam sozinhos)" -ForegroundColor Yellow
Write-Host "e o port-proxy sera reaplicado para o novo IP do WSL2." -ForegroundColor Yellow

# Passo 2 de 4 - Instala o kernel do WSL2 e a distro Ubuntu 22.04 no
# Windows Server 2019. Execute APOS reiniciar (depois do passo 1).
#
# Execute como Administrador (PowerShell):
#   .\02-install-ubuntu.ps1

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# 1) Tenta o caminho moderno (builds mais recentes do Server 2019 com
#    atualizacoes cumulativas tem 'wsl --install' disponivel).
Write-Host "Tentando 'wsl --install -d Ubuntu-22.04'..." -ForegroundColor Cyan
$modernInstallOk = $true
try {
    wsl --install -d Ubuntu-22.04 --no-launch
} catch {
    $modernInstallOk = $false
}

if (-not $modernInstallOk -or $LASTEXITCODE -ne 0) {
    Write-Host "Caminho moderno indisponivel, aplicando processo manual..." -ForegroundColor Yellow

    # 2) Atualizacao do kernel do WSL2 (necessaria em builds antigos do 17763)
    $kernelUpdate = "$env:TEMP\wsl_update_x64.msi"
    Write-Host "Baixando atualizacao do kernel WSL2..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi" -OutFile $kernelUpdate -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$kernelUpdate`" /quiet /norestart" -Wait

    wsl --set-default-version 2

    # 3) Dependencias do appx (VCLibs e UI.Xaml), exigidas pelo pacote do Ubuntu
    Write-Host "Instalando dependencias (VCLibs / UI.Xaml)..." -ForegroundColor Cyan
    $vclibs = "$env:TEMP\VCLibs.x64.appx"
    Invoke-WebRequest -Uri "https://aka.ms/Microsoft.VCLibs.x64.14.00.Desktop.appx" -OutFile $vclibs -UseBasicParsing
    Add-AppxPackage -Path $vclibs -ErrorAction SilentlyContinue

    $uixaml = "$env:TEMP\Microsoft.UI.Xaml.2.8.x64.appx"
    Invoke-WebRequest -Uri "https://github.com/microsoft/microsoft-ui-xaml/releases/download/v2.8.6/Microsoft.UI.Xaml.2.8.x64.appx" -OutFile $uixaml -UseBasicParsing
    Add-AppxPackage -Path $uixaml -ErrorAction SilentlyContinue

    # 4) Pacote do Ubuntu 22.04 (appx)
    $ubuntuAppx = "$env:TEMP\Ubuntu2204.appx"
    Write-Host "Baixando Ubuntu 22.04 LTS..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://aka.ms/wslubuntu2204" -OutFile $ubuntuAppx -UseBasicParsing
    Add-AppxPackage -Path $ubuntuAppx
}

Write-Host ""
Write-Host "Instalacao concluida." -ForegroundColor Green
Write-Host "Agora rode 'wsl -d Ubuntu-22.04' para finalizar o setup inicial" -ForegroundColor Yellow
Write-Host "(sera pedido para criar um usuario e senha Linux)." -ForegroundColor Yellow
Write-Host ""
Write-Host "Depois, copie a pasta do projeto (codigo + dump) para dentro do" -ForegroundColor Yellow
Write-Host "WSL, por exemplo:" -ForegroundColor Yellow
Write-Host "  wsl -d Ubuntu-22.04" -ForegroundColor White
Write-Host "  mkdir -p ~/migration && cd ~/migration" -ForegroundColor White
Write-Host "  cp /mnt/c/caminho/para/antigravity-app_*.tar.gz ." -ForegroundColor White
Write-Host "  cp /mnt/c/caminho/para/logistica_db_*.dump ." -ForegroundColor White
Write-Host "  mkdir -p ~/antigravity && tar -xzf antigravity-app_*.tar.gz -C ~/antigravity" -ForegroundColor White
Write-Host ""
Write-Host "Em seguida, execute 03-docker-bootstrap.sh dentro do Ubuntu:" -ForegroundColor Yellow
Write-Host "  cd ~/antigravity && bash scripts/windows-server/03-docker-bootstrap.sh" -ForegroundColor White

# Passo 1 de 4 - Habilita os recursos do Windows necessarios para WSL2
# no Windows Server 2019.
#
# Execute como Administrador (PowerShell):
#   .\01-enable-wsl-features.ps1
#
# APOS executar, REINICIE o servidor e continue com 02-install-ubuntu.ps1.

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host "Habilitando 'Windows Subsystem for Linux'..." -ForegroundColor Cyan
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All -NoRestart

Write-Host "Habilitando 'Virtual Machine Platform'..." -ForegroundColor Cyan
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart

Write-Host ""
Write-Host "Recursos habilitados com sucesso." -ForegroundColor Green
Write-Host "REINICIE o servidor agora (Restart-Computer) e, apos o boot," -ForegroundColor Yellow
Write-Host "execute 02-install-ubuntu.ps1 como Administrador." -ForegroundColor Yellow

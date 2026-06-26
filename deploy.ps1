param(
    [ValidateSet("backend", "frontend", "all")]
    [string]$Service = "all"
)

$VM = "logflow@192.168.100.2"
$RemoteDir = "~/antigravity"
$LocalDir = $PSScriptRoot

$DirExcludes = @("node_modules", "dist", ".git", "generated", "coverage")
$FileExcludes = @("*.log")
$StagingRoot = Join-Path $env:TEMP "antigravity-deploy"

function Sync-Service {
    param([string]$Name)

    $source = Join-Path $LocalDir $Name
    $staging = Join-Path $StagingRoot $Name

    if (Test-Path $staging) {
        Remove-Item $staging -Recurse -Force
    }
    New-Item -ItemType Directory -Path $staging -Force | Out-Null

    robocopy $source $staging /E /XD $DirExcludes /XF $FileExcludes /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy falhou ao preparar '$Name' (codigo $LASTEXITCODE)."
    }

    scp -r $staging "${VM}:${RemoteDir}/"
}

Write-Host "Sincronizando arquivos para a VM..." -ForegroundColor Cyan

if ($Service -eq "backend" -or $Service -eq "all") {
    Sync-Service -Name "backend"
}
if ($Service -eq "frontend" -or $Service -eq "all") {
    Sync-Service -Name "frontend"
}

# Sempre sincronizar arquivos de configuracao raiz
scp "$LocalDir\Caddyfile" "${VM}:${RemoteDir}/Caddyfile"
scp "$LocalDir\docker-compose.prod.yml" "${VM}:${RemoteDir}/docker-compose.prod.yml"

Write-Host "Executando deploy do '$Service' na VM..." -ForegroundColor Cyan
ssh $VM "cd $RemoteDir && bash deploy.sh $Service"

Write-Host "Pronto!" -ForegroundColor Green

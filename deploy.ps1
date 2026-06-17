param(
    [ValidateSet("backend", "frontend", "all")]
    [string]$Service = "all"
)

$VM = "logflow@192.168.100.2"
$RemoteDir = "~/antigravity"
$LocalDir = $PSScriptRoot

$Excludes = @("node_modules", "dist", ".git", "generated", "coverage", "*.log")
$ExcludeArgs = $Excludes | ForEach-Object { "--exclude=$_" }

Write-Host "Sincronizando arquivos para a VM..." -ForegroundColor Cyan

if ($Service -eq "backend" -or $Service -eq "all") {
    scp -r "$LocalDir\backend" "${VM}:${RemoteDir}/"
}
if ($Service -eq "frontend" -or $Service -eq "all") {
    scp -r "$LocalDir\frontend" "${VM}:${RemoteDir}/"
}

# Sempre sincronizar arquivos de configuracao raiz
scp "$LocalDir\Caddyfile" "${VM}:${RemoteDir}/Caddyfile"
scp "$LocalDir\docker-compose.prod.yml" "${VM}:${RemoteDir}/docker-compose.prod.yml"

Write-Host "Executando deploy do '$Service' na VM..." -ForegroundColor Cyan
ssh $VM "cd $RemoteDir && bash deploy.sh $Service"

Write-Host "Pronto!" -ForegroundColor Green

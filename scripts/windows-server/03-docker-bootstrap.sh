#!/bin/bash
# Passo 3 de 4 - Instala Docker Engine + Compose dentro do WSL2 (Ubuntu
# 22.04) e habilita o systemd (necessario para o Docker iniciar
# automaticamente no boot do WSL).
#
# Execute dentro do Ubuntu (WSL):
#   bash scripts/windows-server/03-docker-bootstrap.sh
set -euo pipefail

echo "==> Habilitando systemd no WSL (/etc/wsl.conf)..."
if ! grep -q "^systemd=true" /etc/wsl.conf 2>/dev/null; then
  sudo tee -a /etc/wsl.conf > /dev/null <<'EOF'

[boot]
systemd=true
EOF
  echo "    systemd habilitado. Sera necessario 'wsl --shutdown' (no Windows)"
  echo "    e reabrir o Ubuntu para o systemd entrar em vigor."
  RESTART_NEEDED=1
else
  echo "    systemd ja habilitado."
  RESTART_NEEDED=0
fi

echo "==> Instalando Docker Engine + Compose plugin..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
else
  echo "    Docker ja instalado."
fi

echo "==> Adicionando usuario '$USER' ao grupo docker..."
sudo usermod -aG docker "$USER"

if [ "$RESTART_NEEDED" = "1" ]; then
  echo ""
  echo "===================================================================="
  echo " Proximo passo (no PowerShell do Windows, FORA do Ubuntu):"
  echo "   wsl --shutdown"
  echo " Depois reabra o Ubuntu (wsl -d Ubuntu-22.04) e rode este mesmo"
  echo " script novamente para habilitar e iniciar o servico do Docker."
  echo "===================================================================="
  exit 0
fi

echo "==> Habilitando e iniciando o servico do Docker (systemd)..."
sudo systemctl enable docker
sudo systemctl start docker

echo "==> Verificando..."
sudo docker run --rm hello-world

echo ""
echo "Docker instalado e funcionando. Saia e reabra o terminal do Ubuntu"
echo "(ou rode 'newgrp docker') para usar 'docker' sem sudo."
echo ""
echo "Proximo passo: configurar port-proxy/firewall no Windows"
echo "(scripts/windows-server/04-configure-network.ps1) e o deploy"
echo "(scripts/deploy-on-vm.sh)."

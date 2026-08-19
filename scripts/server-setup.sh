#!/bin/bash
set -e

echo "🚀 ChatEmbed — DigitalOcean Droplet Setup"

# Install Docker if missing
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "⚠️  Run 'newgrp docker' or reboot after this script finishes"
fi

# Install doctl CLI
if ! command -v doctl &> /dev/null; then
    echo "📦 Installing doctl..."
    sudo snap install doctl
    echo "⚠️  Run 'doctl auth init' with your DigitalOcean API token"
fi

# Login to DO Container Registry
echo "🔑 Logging into DigitalOcean Container Registry..."
doctl registry login --expiry-seconds 600

# Create app directory
sudo mkdir -p /opt/chatembed
sudo chown $USER:$USER /opt/chatembed

# Clone or pull repo
if [ -d "/opt/chatembed/.git" ]; then
    cd /opt/chatembed
    git pull origin main
else
    read -p "Enter your GitHub repo URL: " REPO_URL
    git clone "$REPO_URL" /opt/chatembed
    cd /opt/chatembed
fi

# Create .env if missing
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "⚠️  Edit /opt/chatembed/.env with your secrets:"
    echo "    nano /opt/chatembed/.env"
    echo ""
    echo "Then re-run this script."
    exit 0
fi

# Build and start
echo "🔨 Building and starting containers..."
docker compose up -d --build

# Wait for DB
echo "⏳ Waiting for database..."
sleep 5

# Run migrations
echo "🗄️  Running database migrations..."
docker compose run --rm backend npx prisma migrate deploy

echo ""
echo "✅ ChatEmbed is running!"
echo "   Frontend: http://$(curl -s ifconfig.me):3000"
echo "   Backend:  http://$(curl -s ifconfig.me):4000"
echo "   Crawler:  http://$(curl -s ifconfig.me):8000"
echo ""
echo "Next steps:"
echo "  1. Set up GitHub secrets (SERVER_HOST, SERVER_USER, SERVER_SSH_KEY, DIGITALOCEAN_TOKEN)"
echo "  2. Push to main branch to trigger auto-deploy"

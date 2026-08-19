#!/bin/bash
set -e

REPO_URL="<YOUR_GITHUB_REPO_URL>"
APP_DIR="/opt/chatembed"

echo "🚀 ChatEmbed — DigitalOcean One-Command Setup"

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

# Install doctl
if ! command -v doctl &> /dev/null; then
    echo "📦 Installing doctl..."
    sudo snap install doctl
    echo "⚠️  Run: doctl auth init"
fi

# Clone or pull
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git pull origin main
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Create .env if missing
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Edit $APP_DIR/.env then re-run this script"
    exit 0
fi

# Build and start
docker compose up -d --build

# Wait for DB
sleep 5

# Run migrations
docker compose run --rm backend npx prisma migrate deploy

# Show status
docker compose ps
echo ""
echo "✅ Done! http://$(curl -s ifconfig.me):3000"

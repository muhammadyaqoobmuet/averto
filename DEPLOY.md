# ChatEmbed — DigitalOcean Deployment Guide

## Prerequisites

- A DigitalOcean Droplet (Ubuntu 22.04+)
- A domain pointed to your droplet IP (optional but recommended)
- SSH access to your droplet

### Recommended Droplet Specs

| Tier | RAM | CPU | Price | Use Case |
|---|---|---|---|---|
| Basic | 2GB | 1 vCPU | $12/mo | Testing / light traffic |
| **Recommended** | **4GB** | **2 vCPU** | **$24/mo** | **Production** |
| Performance | 8GB | 4 vCPU | $48/mo | Heavy crawling |

> Chromium crawling is memory-hungry. Go with 4GB minimum for production.

---

## Step 1: Create a Droplet

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. **Create → Droplets**
3. Choose:
   - **Image:** Ubuntu 22.04 (LTS)
   - **Plan:** Basic or Regular — 4GB / 2 vCPU ($24/mo)
   - **Region:** Closest to your users
   - **Auth:** SSH key (recommended) or password
4. Note your droplet's public IP (e.g., `157.230.xx.xx`)

---

## Step 2: Point Your Domain (Optional)

If you have a domain:

1. Go to **Networking → Domains** in DO dashboard
2. Add your domain
3. Create DNS records:

| Type | Name | Value |
|---|---|---|
| A | `@` | `157.230.xx.xx` |
| A | `api` | `157.230.xx.xx` |
| A | `crawler` | `157.230.xx.xx` |

Or at your registrar, point the domain to your droplet IP.

---

## Step 3: Configure DigitalOcean Cloud Firewall

Go to **Networking → Firewalls → Create Firewall**

Add these inbound rules:

| Type | Protocol | Port | Sources |
|---|---|---|---|
| SSH | TCP | 22 | Your IP / 0.0.0.0/0 |
| HTTP | TCP | 80 | 0.0.0.0/0 |
| HTTPS | TCP | 443 | 0.0.0.0/0 |

Apply the firewall to your droplet.

---

## Step 4: SSH Into Your Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

## Step 5: Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

## Step 6: Clone and Configure

```bash
# Clone repo
git clone <your-repo-url> /opt/chatembed
cd /opt/chatembed

# Create .env
cp .env.example .env
nano .env
```

Fill in your secrets:

```env
DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
REFRESH_SECRET=$(openssl rand -hex 32)

GEMINI_API_KEY=your_key_here
VOYAGEAI_KEY=your_key_here

NEXT_PUBLIC_API_URL=http://YOUR_DROPLET_IP:4000
FRONTEND_URL=http://YOUR_DROPLET_IP:3000
```

## Step 7: Build and Start

```bash
docker compose up -d --build
```

## Step 8: Run Database Migrations

```bash
docker compose run --rm backend npx prisma migrate deploy
```

## Step 9: Verify

```bash
docker compose ps
curl http://localhost:3000    # Frontend
curl http://localhost:4000    # Backend
curl http://localhost:8000/health  # Crawler
```

---

## CI/CD with GitHub Actions

### How It Works

Push to `main` → Build images → Push to GHCR → SSH into DO Droplet → Deploy

### Setup GitHub Secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SERVER_HOST` | `157.230.xx.xx` (your droplet IP) |
| `SERVER_USER` | `root` |
| `SERVER_SSH_KEY` | Contents of your private SSH key |
| `DIGITALOCEAN_TOKEN` | From DO API → [Apps & API](https://cloud.digitalocean.com/account/api/tokens) |

`GITHUB_TOKEN` is provided automatically by GitHub.

### Subsequent Deploys

```bash
git push origin main
```

Auto-deploys in ~2-3 minutes.

---

## Optional: Nginx + SSL with Let's Encrypt

### Install Nginx

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/chatembed
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable and Get SSL

```bash
sudo ln -s /etc/nginx/sites-available/chatembed /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com
```

Auto-renewal is set up by default.

---

## Optional: Use DigitalOcean Managed Database

Instead of running PostgreSQL in Docker, use DO Managed Database:

1. Go to **Databases → Create Database Cluster**
2. Choose PostgreSQL 16
3. Copy the connection string
4. Update `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://doadmin:password@db-your-cluster.db.ondigitalocean.com:25060/chatembed?sslmode=require
```

5. Remove `postgres` service from `docker-compose.yml` or disable it.

---

## Optional: DigitalOcean Container Registry (DOCR)

Instead of GHCR, use DO's own registry:

```bash
# Install doctl CLI
snap install doctl

# Authenticate
doctl auth init

# Create a registry
doctl registry create chatembed

# Login
doctl registry login
```

Update `.github/workflows/deploy.yml`:

```yaml
env:
  REGISTRY: registry.digitalocean.com
  IMAGE_PREFIX: chatembed
```

---

## Common Commands

| Action | Command |
|---|---|
| Start all | `docker compose up -d` |
| Stop all | `docker compose down` |
| Rebuild | `docker compose up -d --build` |
| View logs | `docker compose logs -f [service]` |
| Restart one | `docker compose restart backend` |
| Shell into container | `docker compose exec backend sh` |
| Run migration | `docker compose run --rm backend npx prisma migrate deploy` |
| Wipe DB | `docker compose down -v` |
| Check disk | `df -h` |
| Check memory | `free -h` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| OOM killed | Upgrade droplet or reduce `pageLimit` |
| Can't connect to DB | Check `docker compose logs postgres` |
| Build fails | `docker compose down -v && docker compose up -d --build` |
| Port 3000 unreachable | Check DO Cloud Firewall allows 80/443 |
| Chromium crash | crawler Dockerfile handles deps — rebuild |
| DNS not resolving | Verify A record with `dig yourdomain.com` |

---

## Cost Summary

| Component | Cost |
|---|---|
| Droplet (4GB) | $24/mo |
| Domain (optional) | ~$12/year |
| Managed DB (optional) | $15/mo |
| **Total (self-hosted DB)** | **$24/mo** |
| **Total (managed DB)** | **$39/mo** |

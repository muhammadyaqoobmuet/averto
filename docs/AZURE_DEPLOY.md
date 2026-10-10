# Deploying Averto to Azure

Complete setup for a single Azure VM. Plain `git pull` to update — no CI/CD,
no GitHub Actions.

Everything here assumes you start from nothing. If you are updating a server
that is already running, jump to [§9 Updating](#9-updating).

**No SSL in this document.** It uses `http://` on a subdomain. Certificates
are covered separately in [§11](#11-adding-https-later) once you have the
subdomain pointed at the VM.

---

## What you need first

| Thing | Value |
|---|---|
| Azure VM | Ubuntu 24.04 LTS, **2 vCPU / 4 GB RAM** (8 GB if you crawl large sites) |
| Subdomain | e.g. `app.yourdomain.com` |
| DNS | an **A record** pointing the subdomain at the VM's public IP |
| SSH | key or password |

The crawler runs headless Chromium, which is memory-hungry. 4 GB is the
minimum for crawling anything real.

### 1. Create the VM

Azure portal → **Create resource** → search **Virtual Machine** → Create.

| Setting | Value |
|---|---|
| Resource group | `averto` |
| VM name | `averto-vm` |
| Region | closest to your users |
| Image | Ubuntu Server 24.04 LTS |
| Size | Standard_D2s_v5 (2 vCPU / 4 GB) |
| Authentification | **SSH key** (recommended) or password |
| Inbound ports | 22, 80 |

If you already have a VM, skip this.

### 2. Open the ports

Azure portal → your VM → **Networking** → **Inbound port rules**.

Add if not present:

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | your IP | SSH |
| 80 | TCP | `*` | HTTP traffic |

> **Do not open 4000, 3000, 8000, 5432 or 6379.** Those services are reachable
> only from inside the VM. The Docker Compose file already binds them to
> `127.0.0.1`, and nginx is the only thing that should face the internet.
> Opening the database port to `*` would expose Postgres to the whole internet.

### 3. Point DNS at the VM

Get the public IP from the VM overview page. At your DNS provider add:

```
Type: A     Name: app     Value: <your-vm-public-ip>
```

Check it resolves before continuing:

```bash
nslookup app.yourdomain.com
```

---

## Installing Docker

```bash
ssh <your-user>@<your-vm-ip>

sudo apt update && sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
                    docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker          # or log out and back in
```

Verify:

```bash
docker --version && docker compose version
```

---

## 4. Get the code

```bash
sudo mkdir -p /opt/averto && sudo chown $USER:$USER /opt/averto
git clone <your-repo-url> /opt/averto
cd /opt/averto
```

---

## 5. Create the secrets files

Three `.env` files are needed. All are gitignored, so they exist only on the
server — you create them once and they survive `git pull`.

### 5a. `/opt/averto/.env` — shared settings

```bash
cp .env.example .env
nano .env
```

```ini
# ─── Database ───
DB_PASSWORD=<a long random password>
DB_NAME=postgres

# ─── Auth ───
# Generate each with:  openssl rand -base64 48
JWT_SECRET=<at least 32 characters>
REFRESH_SECRET=<at least 32 characters>

# ─── AI providers ───
VOYAGEAI_KEY=<your voyage key>

ALIBABA_API_KEY=<your alibaba model studio key>
ALIBABA_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

AWS_BEARER_TOKEN_BEDROCK=<optional bedrock token>
BEDROCK_BASE_URL=https://bedrock-mantle.eu-north-1.api.aws/v1

GROQ_API_KEY_1=
GROQ_API_KEY_2=
GROQ_API_KEY_3=

# ─── Internal ───
# Must match the crawler's INTERNAL_API_KEY below.
INTERNAL_API_KEY=<another long random string>

# ─── URLs ───
# Use the subdomain — these are baked into the frontend at BUILD time,
# so changing them later requires a rebuild (see section 9).
NEXT_PUBLIC_API_URL=http://app.yourdomain.com
FRONTEND_URL=http://app.yourdomain.com
```

> **`NEXT_PUBLIC_API_URL` is baked into the frontend image at build time.**
> Changing the domain later means the frontend must be rebuilt, not just
> restarted.

`GEMINI_API_KEY` is no longer used — Gemini was removed as a generation
provider. You can leave the line in place or delete it; it is ignored.

### 5b. `/opt/averto/python-crawlling-backend/.env`

```bash
cd /opt/averto/python-crawlling-backend
cat > .env <<EOF
INTERNAL_API_KEY=<the same value as above>
PORT=8000
EOF
```

The crawler refuses to start without `INTERNAL_API_KEY`, and the Express
backend sends it as the `X-Internal-Key` header on every crawl request. If
these two disagree, crawls fail with a 403 and nothing explains why.

### 5c. `/opt/averto/express-backend/.env`

The backend container reads this file directly via `env_file`.

```bash
cd /opt/averto/express-backend
cat > .env <<EOF
DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@postgres:5432/postgres?schema=public
REDIS_URL=redis://redis:6379
PYTHON_SERVICE_URL=http://crawler:8000
NODE_ENV=production
PORT=4000
JWT_SECRET=<same as root .env>
REFRESH_SECRET=<same as root .env>
VOYAGEAI_KEY=<your voyage key>
ALIBABA_API_KEY=<your alibaba key>
ALIBABA_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
AWS_BEARER_TOKEN_BEDROCK=<optional>
GROQ_API_KEY_1=
GROQ_API_KEY_2=
GROQ_API_KEY_3=
INTERNAL_API_KEY=<same as root .env>
FRONTEND_URL=http://app.yourdomain.com
EOF
```

Use the hostname `postgres` and `redis`, not `localhost` — inside Docker each
service reaches the others by service name.

> ### ⚠️ Do not add AI keys to docker-compose.yml
>
> The backend service lists some variables under `environment:`, and those
> **override** anything coming from `env_file`. Compose turns an unset root
> `.env` variable into an *empty string*, not "leave it alone":
>
> ```
> warning: The "ALIBABA_API_KEY" variable is not set. Defaulting to a blank string.
> ```
>
> An empty `ALIBABA_API_KEY` then beats the real value from
> `express-backend/.env`, and the primary provider throws at startup. This was
> reproduced while writing this guide.
>
> The AI provider keys (`VOYAGEAI_KEY`, `ALIBABA_API_KEY`,
> `AWS_BEARER_TOKEN_BEDROCK`, `GROQ_API_KEY_*`) are deliberately **not** in
> `docker-compose.yml`. They reach the container through `env_file` only.
> Leave it that way — put the keys in `express-backend/.env` and nowhere else.

Lock the files down:

```bash
chmod 600 /opt/averto/.env /opt/averto/express-backend/.env \
          /opt/averto/python-crawlling-backend/.env
```

---

## 6. Build and start

```bash
cd /opt/averto
docker compose build
docker compose up -d
```

Check everything is up:

```bash
docker compose ps
```

All four services should show `Up` (or `healthy` for Postgres and Redis).

---

## 7. Set up the database

```bash
cd /opt/averto
docker compose exec backend npx prisma migrate deploy
```

Expected output:

```
The following migration(s) have been applied:
  └─ 20250501_000000_init/
  └─ 20250612_knowledge_upload/
  └─ 20260614_add_tsvector/
  └─ 20260615_custom_keys/
  └─ 20260616_retrieval_perf/
All migrations have been successfully applied.
```

Verify it worked and that the retrieval indexes exist:

```bash
docker compose exec postgres psql -U postgres -d postgres -c \
  "SELECT indexname FROM pg_indexes WHERE tablename='Chunk' ORDER BY 1;"
```

You should see all five:

```
Chunk_chatbotId_idx             ← critical, without it every chat request
Chunk_chatbotId_pageId_idx        does a sequential scan
Chunk_embedding_hnsw_idx_v2
Chunk_pkey
chunk_content_tsv_idx
```

Confirm the query planner actually uses the index:

```bash
docker compose exec postgres psql -U postgres -d postgres -c \
  "EXPLAIN SELECT id FROM \"Chunk\" WHERE \"chatbotId\"='anything';"
```

Look for `Index Scan using "Chunk_chatbotId_idx"`. A `Seq Scan` means the
index is missing.

---

## 8. Nginx

Nginx is the only thing exposed to the internet. It sends web traffic to the
frontend and API traffic to the backend.

```bash
sudo apt install -y nginx
```

### 8a. Config file

```bash
sudo nano /etc/nginx/sites-available/averto
```

```nginx
# ─── Averto ────────────────────────────────────────────────────────────────
# Rate limiting is deliberately generous: the app itself allows 30 requests
# per minute per (IP, chatbot). This is a coarse outer guard against a
# flood, not the real limiter.
limit_req_zone $binary_remote_addr zone=averto_limit:10m rate=60r/m;

upstream averto_frontend {
    server 127.0.0.1:3000;
    keepalive 16;
}

upstream averto_backend {
    server 127.0.0.1:4000;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name app.yourdomain.com;

    # Certbot will rewrite this block when you add HTTPS. Until then it
    # simply serves over HTTP.

    client_max_body_size 12M;   # PDF document uploads (32 MB cap in code)
    access_log /var/log/nginx/averto.access.log;
    error_log  /var/log/nginx/averto.error.log;

    # ── API ────────────────────────────────────────────────────────────────
    location /api/ {
        limit_req zone=averto_limit burst=20 nodelay;

        proxy_pass http://averto_backend;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";

        # ── SSE support ───────────────────────────────────────────────────
        # /api/chat streams its answer over Server-Sent Events. If nginx
        # buffers the response, the widget shows nothing until the whole
        # answer is finished, which looks exactly like a hang.
        #
        # The backend already sends `X-Accel-Buffering: no` on this endpoint
        # and nginx honours it, which is the primary mechanism. Verified
        # locally: with buffering left at its default, 48 SSE frames still
        # arrived incrementally over ~2 s.
        #
        # proxy_buffering off is kept as explicit defence in depth — it still
        # works if that header is ever stripped by an intermediary proxy, or
        # if a future streaming endpoint forgets to set it. Leaving it out is
        # a latent breakage, not a current one.
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        chunked_transfer_encoding on;
    }

    # ── Widget assets served straight from the API ──────────────────────────
    location = /widget.js {
        proxy_pass http://averto_backend;
        proxy_set_header Host $host;
    }

    location = /api/chat {
        limit_req zone=averto_limit burst=20 nodelay;
        proxy_pass http://averto_backend;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header Connection        "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # ── Frontend ───────────────────────────────────────────────────────────
    location / {
        proxy_pass http://averto_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }

    # ── Health endpoint, not rate limited ──────────────────────────────────
    location = /health {
        proxy_pass http://averto_backend;
        access_log off;
    }
}
```

The `/api/` block carries the streaming settings. Note that the backend also
sends `X-Accel-Buffering: no`, which nginx honours on its own — the explicit
`proxy_buffering off` is there so the behaviour survives an intermediary proxy
or a future endpoint that forgets the header.

### 8b. Enable it

```bash
sudo ln -s /etc/nginx/sites-available/averto /etc/nginx/sites-enabled/averto
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # must say "syntax is ok" and "test is successful"
sudo systemctl enable nginx
sudo systemctl restart nginx
sudo ufw allow 'Nginx Full' 2>/dev/null || true
```

### 8c. Check it works

```bash
curl http://app.yourdomain.com/health
# {"status":"ok","timestamp":"..."}
```

Open `http://app.yourdomain.com` in a browser — you should see the Averto
landing page.

---

## 9. Updating

The normal loop. No CI needed.

```bash
cd /opt/averto
git pull

# Rebuild only if code changed
docker compose build
docker compose up -d

# Always run migrations — they are idempotent when there is nothing to do
docker compose exec backend npx prisma migrate deploy

docker image prune -f
```

### Changing the domain later

`NEXT_PUBLIC_API_URL` is compiled into the frontend bundle, so a changed
domain needs a rebuild:

```bash
cd /opt/averto
sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://new.domain.com|' .env
docker compose build frontend && docker compose up -d frontend
```

### Rolling back a bad deploy

```bash
cd /opt/averto
git log --oneline -5
git checkout <previous-good-sha>
docker compose build && docker compose up -d
```

Database migrations are **not** rolled back automatically — Prisma has no
down migrations. If a migration broke something, restore from backup (§10).

---

## 10. Backups

The database is the only thing here that cannot be regenerated. The crawler
re-crawls, the code comes from git, but conversations, users and missed
queries are only in Postgres.

### Create a backup script

```bash
sudo tee /usr/local/bin/averto-backup > /dev/null <<'SCRIPT'
#!/bin/bash
# Nightly Averto database backup, 14 days of history.
set -euo pipefail

DEST=/var/backups/averto
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d_%H%M%S)

cd /opt/averto
docker compose exec -T postgres pg_dump -U postgres -d postgres --clean \
  | gzip > "$DEST/averto_$STAMP.sql.gz"

find "$DEST" -name 'averto_*.sql.gz' -mtime +14 -delete
SCRIPT

sudo chmod +x /usr/local/bin/averto-backup
```

### Test it before you need it

```bash
sudo /usr/local/bin/averto-backup
sudo -u postgres gunzip -c /var/backups/averto/averto_*.sql.gz | head -5
```

### Schedule it

```bash
sudo crontab -e
```

```cron
# 03:17 every night (not :00, to avoid the shared-cron stampede)
17 3 * * * /usr/local/bin/averto-backup >> /var/log/averto-backup.log 2>&1
```

### Restore

```bash
cd /opt/averto
docker compose exec -T postgres psql -U postgres -d postgres < \
  <(gunzip -c /var/backups/averto/averto_YYYYMMDD_HHMMSS.sql.gz)
docker compose restart backend
```

---

## 11. Adding HTTPS later

Once DNS is confirmed and you have the subdomain pointed here. Certbot is not
configured in this document on purpose — do it once, once, when you're ready.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com
```

Certbot rewrites the nginx config and adds a redirect. Verify renewal:

```bash
sudo certbot renew --dry-run
```

Then update `.env` so the app emits `https://` URLs:

```bash
cd /opt/averto
sed -i 's|http://app.yourdomain.com|https://app.yourdomain.com|g' .env
docker compose build frontend && docker compose up -d
```

---

## Troubleshooting

### Page loads but API calls fail with CORS errors

`FRONTEND_URL` must match the domain exactly, scheme included:

```bash
grep FRONTEND_URL /opt/averto/.env
```

`http://app.yourdomain.com` and `https://app.yourdomain.com` are different
values to the app.

### Answers arrive all at once instead of streaming

Something between the browser and the backend is buffering. Check in order:

```bash
# 1. is the nginx config right?
sudo nginx -T | grep -A3 "location /api/"

# 2. does the backend send the no-buffering header?
curl -sI -X POST http://localhost:4000/api/chat \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"hi\",\"apiKey\":\"$KEY\"}" | grep -i x-accel

# 3. bypass nginx entirely — if this streams, the problem is nginx or DNS
curl -N -X POST http://127.0.0.1:4000/api/chat \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"hi\",\"apiKey\":\"$KEY\",\"stream\":true}"
```

### Crawls fail immediately, no error in the logs

The two `INTERNAL_API_KEY` values disagree.

```bash
grep INTERNAL_API_KEY /opt/averto/.env
grep INTERNAL_API_KEY /opt/averto/python-crawlling-backend/.env
docker compose logs crawler | tail -30
```

### Chat works but answers are nonsense / low quality

The vector store may be corrupt. Check:

```bash
cd /opt/averto/express-backend
docker compose exec backend npm run check:vectors
```

Healthy output is a uniqueness ratio of `1.000`. Anything lower means chunks
are sharing embeddings and dense retrieval is returning unrelated content.
Fix by re-crawling every chatbot:

```
POST /api/chatbots/:id/recrawl
```

### Containers restart in a loop

```bash
docker compose logs --tail=50 backend
docker compose logs --tail=50 crawler
```

Usually a missing or malformed environment variable.

### Out of memory during a crawl

The crawler runs Chromium. Either add swap or move to a larger VM:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Everything is slow

Check whether the database index is being used:

```bash
docker compose exec postgres psql -U postgres -d postgres -c \
  "EXPLAIN ANALYZE SELECT c.id FROM \"Chunk\" c
   WHERE c.\"chatbotId\"='<a-real-id>' LIMIT 25;"
```

`Seq Scan` means `Chunk_chatbotId_idx` is missing — re-run section 7.

---

## Quick reference

```bash
# logs
docker compose logs -f backend
docker compose logs -f crawler

# restart everything
docker compose restart

# stop (keeps data)
docker compose down

# stop and DELETE the database
docker compose down -v          # ⚠ destroys all data

# shell into the database
docker compose exec postgres psql -U postgres -d postgres

# rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

| Path | What |
|---|---|
| `/opt/averto` | the code |
| `/opt/averto/.env` | shared secrets |
| `/opt/averto/express-backend/.env` | backend secrets |
| `/opt/averto/python-crawlling-backend/.env` | crawler secrets |
| `/etc/nginx/sites-available/averto` | nginx config |
| `/var/backups/averto/` | database backups |
| `/var/log/nginx/averto.*.log` | nginx logs |

# Averto

AI-powered chatbot platform that crawls your website, understands your content, and delivers intelligent conversations.

![Averto Landing Page](nextjs-frontend/public/newlandingimage.png)

## Features

- **Smart Crawling** — Automatically crawls and indexes your website content
- **RAG-Powered Chat** — Semantic search + LLM for accurate, context-aware answers
- **Embeddable Widget** — Drop a chat widget on any site with one script tag
- **Analytics Dashboard** — Track conversations, missed queries, and gaps
- **Multi-Tenant** — Manage multiple chatbots per organization
- **Custom Branding** — Colors, welcome messages, and appearance control

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Backend | Express, TypeScript, Prisma |
| Crawler | FastAPI, Python, crawl4ai |
| Database | PostgreSQL + pgvector |
| Queue | Redis, BullMQ |
| AI | Google Gemini, Voyage AI |

## Getting Started

### Prerequisites

- Docker and Docker Compose
- 4GB+ RAM recommended

### Quick Start

```bash
git clone <your-repo-url> averto
cd averto
cp .env.example .env
nano .env  # fill in your secrets
docker compose up -d --build
docker compose run --rm backend npx prisma migrate deploy
```

App available at:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Crawler: `http://localhost:8000`

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for DigitalOcean deployment with GitHub Actions CI/CD.

## License

MIT

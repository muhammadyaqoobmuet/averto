# Project Status & Tasks

## Track Yourself (Agent Handover)
This project is ChatEmbed, a SaaS for RAG-powered chatbots.
- **Python Backend**: FastAPI + Crawl4AI (Scraping)
- **Express Backend**: Node.js + TS + pgvector + BullMQ + Gemini (Orchestration & RAG)
- **Frontend**: Next.js 14 App Router

---

## 📋 Task List

### 1. Foundation & Setup
- [/] Initialize `python-crawlling-backend` (FastAPI) [x]
- [/] Initialize `express-backend` (Node.js, TS, Prisma) [x]
- [/] Initialize `nextjs-frontend` (Next.js 14, Tailwind) [/]
- [ ] Setup Shared Types/Interfaces [ ]

### 2. Python Crawling Backend
- [x] Refactor existing scraper into FastAPI service [x]
- [x] Implement `/crawl` endpoint (returns markdown) [x]
- [x] Implement internal API key authentication [x]

### 3. Express Backend (Core)
- [x] Setup PostgreSQL with `pgvector` [x]
- [x] Implement Authentication (JWT + Refresh Tokens) [x]
- [x] Implement Zod Schemas for Validation [x]
- [x] Implement Global Error Handler [x]
- [ ] Setup BullMQ + Redis for background crawling [ ]
- [x] Implement Chatbot CRUD [x]
- [x] Implement RAG Pipeline:
    - [x] Markdown Chunking Utility [x]
    - [x] Gemini Embedding Service [x]
    - [x] Hybrid Search (Semantic + BM25) with RRF [x]
    - [x] Gemini LLM Completion Service [x]
- [x] Implement Widget API (API Key Auth) [x]

### 4. Next.js Frontend
- [x] Setup Dashboard Layout [x]
- [x] Implement Auth Pages (Login/Signup) [x]
- [ ] Implement Chatbot Management UI [ ]
- [/] Implement Playground UI [/]
- [ ] Implement Embed Widget Integration UI [ ]

### 5. Deployment & Integration
- [ ] Ensure Python and Express servers communicate securely [ ]
- [ ] Create Embed Widget JS (to be hosted on CDN) [ ]

---

## 🛠 Progress Log
- **2026-06-12 19:40**: Initialized folder structure and task list.
- **2026-06-12 19:45**: Converted Python script to FastAPI, structured Express backend, and initialized Next.js. Auth controllers and Prisma schema added.
- **2026-06-12 19:50**: Implemented full RAG pipeline in Express (Chunking, Embedding, Hybrid Search with RRF, and LLM answering). Freed 831MB by deleting .venv to manage disk space.
- **2026-06-12 19:55**: Built Next.js Landing Page, Login Page, and Dashboard skeleton with premium Tailwind styling.

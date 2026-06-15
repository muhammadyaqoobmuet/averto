#!/bin/bash

# ChatEmbed Unified Startup Script 🚀
echo "🛑 Cleaning up previous instances..."
fuser -k 3000/tcp 4000/tcp 8000/tcp 2>/dev/null
sleep 2

# Trap SIGINT (Ctrl+C) to kill background processes
trap "echo '🛑 Stopping services...'; fuser -k 3000/tcp 4000/tcp 8000/tcp; exit" SIGINT

export WATCHPACK_POLLING=true
export CHOKIDAR_USEPOLLING=true

echo "🚀 Starting ChatEmbed Platform..."

# 1. Start Python Crawler
echo "🐍 Starting Python Crawler (8000)..."
cd python-crawlling-backend
.venv/bin/python main.py > crawler.log 2>&1 &
cd ..

# 2. Start Express Backend
echo "📦 Starting Express Backend (4000)..."
cd express-backend
npm run dev > backend.log 2>&1 &
cd ..

# 3. Start Next.js Frontend
echo "💻 Starting Next.js Frontend (3000)..."
echo "-------------------------------------------------------"
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:4000"
echo "Crawler:  http://localhost:8000"
echo "-------------------------------------------------------"
echo "Keep this terminal open! Press CTRL+C to stop all."
echo "-------------------------------------------------------"

cd nextjs-frontend
npm run dev

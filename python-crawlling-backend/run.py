#!/usr/bin/env python3
"""
run.py — API Server Starter
============================
Starts the FastAPI server. Express backend calls this service via HTTP.
Run: python run.py
"""

import os
import sys
from pathlib import Path

# Ensure the scraper package is importable
sys.path.insert(0, str(Path(__file__).parent))

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)


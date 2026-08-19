FROM python:3.12-slim AS base

# Install system deps for Chromium in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libatspi2.0-0 libwayland-client0 \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium
RUN pip install --no-cache-dir playwright==1.49.1 \
    && playwright install chromium \
    && rm -rf /root/.cache/pip

WORKDIR /app

# Install Python deps first (cached layer)
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

# Copy only what's needed
COPY main.py ./
COPY scraper/ ./scraper/

EXPOSE 8000
CMD ["python", "main.py"]

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  wget gnupg curl \
  libglib2.0-0 libnss3 libnspr4 libdbus-1-3 \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
  libasound2 libatspi2.0-0 libwayland-client0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
q
RUN playwright install chromium

COPY main.py ./
COPY scraper/ ./scraper/

EXPOSE 8000
CMD ["python", "main.py"]

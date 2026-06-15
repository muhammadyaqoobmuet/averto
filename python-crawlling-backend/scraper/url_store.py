"""
url_store.py — URL Deduplication & Crawl State (SQLite)
=========================================================
Persists URL crawl state across runs. Prevents re-crawling within the same
session and records outcomes so future batches can skip known-blocked pages.

Status values:
  pending   — queued, not yet attempted
  success   — crawled, markdown saved
  blocked   — 403 / CAPTCHA / WAF — skip this cycle
  failed    — transient error (network, timeout) — may retry
"""

from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from threading import Lock
from typing import Optional
from urllib.parse import urldefrag, urlparse


class URLStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    BLOCKED = "blocked"
    FAILED = "failed"


@dataclass
class URLRecord:
    url: str
    status: URLStatus
    tier: str
    method: str          # http | browser | fallback | none
    char_count: int
    error: str
    crawled_at: float    # unix timestamp
    output_path: str


_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS urls (
    url         TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'pending',
    tier        TEXT NOT NULL DEFAULT 'A',
    method      TEXT NOT NULL DEFAULT 'none',
    char_count  INTEGER NOT NULL DEFAULT 0,
    error       TEXT NOT NULL DEFAULT '',
    crawled_at  REAL NOT NULL DEFAULT 0,
    output_path TEXT NOT NULL DEFAULT ''
);
"""

_INDEX = "CREATE INDEX IF NOT EXISTS idx_status ON urls(status);"


class URLStore:
    """Thread-safe SQLite-backed URL store."""

    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._path = str(db_path)
        self._lock = Lock()
        self._connect()

    # ── Setup ────────────────────────────────────────────────────────────────

    def _connect(self) -> None:
        conn = sqlite3.connect(self._path, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(_CREATE_TABLE)
        conn.execute(_INDEX)
        conn.commit()
        self._conn = conn

    # ── Public API ───────────────────────────────────────────────────────────

    def normalise(self, url: str) -> str:
        """Strip fragment, lowercase scheme+host, remove trailing slash."""
        url, _ = urldefrag(url)
        p = urlparse(url)
        normalised = p._replace(
            scheme=p.scheme.lower(),
            netloc=p.netloc.lower(),
        ).geturl()
        return normalised.rstrip("/")

    def is_seen(self, url: str) -> bool:
        """Return True if URL already has a record (any status)."""
        url = self.normalise(url)
        with self._lock:
            cur = self._conn.execute(
                "SELECT 1 FROM urls WHERE url = ?", (url,)
            )
            return cur.fetchone() is not None

    def add_pending(self, url: str, tier: str = "A") -> bool:
        """
        Add URL with status=pending if not already tracked.
        Returns True if inserted, False if already exists.
        """
        url = self.normalise(url)
        with self._lock:
            try:
                self._conn.execute(
                    "INSERT OR IGNORE INTO urls (url, status, tier) VALUES (?, ?, ?)",
                    (url, URLStatus.PENDING, tier),
                )
                self._conn.commit()
                return self._conn.total_changes > 0
            except sqlite3.Error:
                return False

    def mark_success(
        self,
        url: str,
        method: str,
        char_count: int,
        output_path: str,
    ) -> None:
        url = self.normalise(url)
        with self._lock:
            self._conn.execute(
                """INSERT OR REPLACE INTO urls
                   (url, status, method, char_count, output_path, crawled_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (url, URLStatus.SUCCESS, method, char_count, output_path, time.time()),
            )
            self._conn.commit()

    def mark_blocked(self, url: str, reason: str = "") -> None:
        url = self.normalise(url)
        with self._lock:
            self._conn.execute(
                """INSERT OR REPLACE INTO urls
                   (url, status, error, crawled_at)
                   VALUES (?, ?, ?, ?)""",
                (url, URLStatus.BLOCKED, reason, time.time()),
            )
            self._conn.commit()

    def mark_failed(self, url: str, reason: str = "") -> None:
        url = self.normalise(url)
        with self._lock:
            self._conn.execute(
                """INSERT OR REPLACE INTO urls
                   (url, status, error, crawled_at)
                   VALUES (?, ?, ?, ?)""",
                (url, URLStatus.FAILED, reason, time.time()),
            )
            self._conn.commit()

    def get_pending(self) -> list[str]:
        with self._lock:
            cur = self._conn.execute(
                "SELECT url FROM urls WHERE status = ? ORDER BY rowid",
                (URLStatus.PENDING,),
            )
            return [row[0] for row in cur.fetchall()]

    def get_record(self, url: str) -> Optional[URLRecord]:
        url = self.normalise(url)
        with self._lock:
            cur = self._conn.execute("SELECT * FROM urls WHERE url = ?", (url,))
            row = cur.fetchone()
            if not row:
                return None
            return URLRecord(
                url=row[0],
                status=URLStatus(row[1]),
                tier=row[2],
                method=row[3],
                char_count=row[4],
                error=row[5],
                crawled_at=row[6],
                output_path=row[7],
            )

    def stats(self) -> dict[str, int]:
        with self._lock:
            cur = self._conn.execute(
                "SELECT status, COUNT(*) FROM urls GROUP BY status"
            )
            return {row[0]: row[1] for row in cur.fetchall()}

    def close(self) -> None:
        with self._lock:
            self._conn.close()

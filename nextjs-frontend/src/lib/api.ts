const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  orgId?: string;
  avatarUrl?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

// ── Cookie helpers (client-side only) ─────────────────────────────────────

function setAuthCookie(): void {
  if (typeof window === "undefined") return;
  document.cookie = "auth_check=1; path=/; max-age=604800; SameSite=Lax";
}

function clearAuthCookie(): void {
  if (typeof window === "undefined") return;
  document.cookie = "auth_check=; path=/; max-age=0; SameSite=Lax";
}

// ── Auth state helpers ─────────────────────────────────────────────────────

function storeAuthData(data: LoginResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  if (data.user.orgId) {
    localStorage.setItem("orgId", data.user.orgId);
  }
  setAuthCookie();
}

function clearAuthState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  localStorage.removeItem("orgId");
  clearAuthCookie();
}

// ── Core fetch with auto-refresh ───────────────────────────────────────────

/**
 * Drop-in replacement for `fetch` that:
 * 1. Attaches `Authorization: Bearer <token>` from localStorage.
 * 2. On 401, silently attempts POST /api/auth/refresh (httpOnly cookie).
 * 3. If refresh succeeds, retries the original request with the new token.
 * 4. If refresh fails, clears auth state and redirects to /login.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status !== 401) return response;

  // ── Silent token refresh ──────────────────────────────────────────────────
  try {
    const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      const refreshData = (await refreshRes.json()) as { accessToken: string };
      if (typeof window !== "undefined") {
        localStorage.setItem("accessToken", refreshData.accessToken);
      }

      const retryHeaders = new Headers(
        options.headers as HeadersInit | undefined,
      );
      retryHeaders.set("Authorization", `Bearer ${refreshData.accessToken}`);
      if (
        !retryHeaders.has("Content-Type") &&
        !(options.body instanceof FormData)
      ) {
        retryHeaders.set("Content-Type", "application/json");
      }

      return fetch(`${API_URL}${path}`, {
        ...options,
        headers: retryHeaders,
        credentials: "include",
      });
    }
  } catch {
    // Refresh request itself failed — fall through to logout
  }

  // ── Refresh failed: clear state and redirect ───────────────────────────────
  clearAuthState();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
  // Page is navigating away; return the original 401 to satisfy the return type.
  return response;
}

// ── Auth actions ───────────────────────────────────────────────────────────

export async function apiLogin(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as LoginResponse & { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? "Login failed");
  }

  storeAuthData(data);
  return data;
}

export async function apiLogout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Best effort — always clear local state
  }
  clearAuthState();
}

// ── State readers (SSR-safe) ───────────────────────────────────────────────

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("accessToken"));
}

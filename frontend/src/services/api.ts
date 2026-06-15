let accessToken: string | null = null;
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setTokens(access: string): void {
  accessToken = access;
}

export function clearTokens(): void {
  accessToken = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

async function request<T>(method: HttpMethod, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const timeout = options?.timeout ?? REQUEST_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const onParentAbort = options?.signal
    ? () => controller.abort()
    : null;

  if (options?.signal && onParentAbort) {
    options.signal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    const url = new URL(`${BASE_URL}${path}`, window.location.origin);
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const headers: Record<string, string> = {
      ...options?.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
      credentials: 'include',
    };

    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      fetchOptions.body = body;
    }

    let res: Response;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (body instanceof FormData && attempt > 0) {
        throw lastError ?? new Error('Error de conexión. Verifica tu internet e intenta de nuevo.');
      }
      if (attempt > 0) {
        await delay(Math.min(1000 * Math.pow(2, attempt - 1), 4000));
      }

      try {
        res = await fetch(url.toString(), fetchOptions);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
        }
        if (attempt < MAX_RETRIES) {
          lastError = new Error('Error de conexión. Reintentando...');
          continue;
        }
        throw new Error('Error de conexión. Verifica tu internet e intenta de nuevo.');
      }

      if (res.status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${accessToken}`;
          const retryInit: RequestInit = {
            method,
            headers: { ...headers },
            signal: controller.signal,
            credentials: 'include',
            body: fetchOptions.body,
          };
          try {
            res = await fetch(url.toString(), retryInit);
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
            }
            throw new Error('Error de conexión. Verifica tu internet e intenta de nuevo.');
          }
        } else {
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          throw new Error('Sesión expirada. Serás redirigido al inicio de sesión.');
        }
      }

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new Error(`Error del servidor (${res.status}). Reintentando...`);
        continue;
      }

      if (!res.ok) {
        let errorMsg = `Error ${res.status}`;
        try {
          const err = await res.json();
          errorMsg = err.message ?? err.error ?? errorMsg;
        } catch {
          if (import.meta.env.DEV) console.warn('[API] Error parsing error response body');
        }
        throw new Error(errorMsg);
      }

      refreshAttempts = 0;
      if (refreshCooldownTimer) {
        clearTimeout(refreshCooldownTimer);
        refreshCooldownTimer = null;
      }

      if (res.status === 204) {
        return undefined as T;
      }

      return res.json();
    }

    throw lastError ?? new Error('Error de conexión. Verifica tu internet e intenta de nuevo.');
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal && onParentAbort) {
      options.signal.removeEventListener('abort', onParentAbort);
    }
  }
}

let refreshPromise: Promise<boolean> | null = null;
let refreshAttempts = 0;
let refreshCooldownTimer: ReturnType<typeof setTimeout> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshAttempts >= 3) {
    return false;
  }
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        refreshAttempts++;
        if (refreshCooldownTimer) clearTimeout(refreshCooldownTimer);
        refreshCooldownTimer = setTimeout(() => { refreshAttempts = 0; }, 30000);
        return false;
      }

      refreshAttempts = 0;
      if (refreshCooldownTimer) {
        clearTimeout(refreshCooldownTimer);
        refreshCooldownTimer = null;
      }
      const data = await res.json();
      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, options);
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', path, body, options);
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, body, options);
  },
  del<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, body, options);
  },
};

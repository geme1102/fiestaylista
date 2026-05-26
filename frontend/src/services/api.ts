let accessToken: string | null = null;
const REQUEST_TIMEOUT = 30000;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens(): void {
  accessToken = null;
  localStorage.removeItem('refreshToken');
}

export function getAccessToken(): string | null {
  return accessToken;
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  timeout?: number;
}

async function request<T>(method: HttpMethod, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const timeout = options?.timeout ?? REQUEST_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

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
    };

    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      fetchOptions.body = body;
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), fetchOptions);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
      }
      throw new Error('Error de conexión. Verifica tu internet e intenta de nuevo.');
    }

    if (res.status === 401 && getRefreshToken()) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        try {
          res = await fetch(url.toString(), { ...fetchOptions, headers, signal: controller.signal });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
          }
          throw new Error('Error de conexión. Verifica tu internet e intenta de nuevo.');
        }
      } else {
        clearTokens();
        window.location.href = '/login';
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
      }
    }

    if (!res.ok) {
      let errorMsg = `Error ${res.status}`;
      try {
        const err = await res.json();
        errorMsg = err.message ?? err.error ?? errorMsg;
      } catch {
        // ignore parse error
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

let refreshPromise: Promise<boolean> | null = null;
let refreshRetries = 0;
const MAX_REFRESH_RETRIES = 2;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        refreshRetries++;
        if (refreshRetries >= MAX_REFRESH_RETRIES) {
          return false;
        }
        return false;
      }

      refreshRetries = 0;
      const data = await res.json();
      accessToken = data.accessToken;
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
      refreshRetries = 0;
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
  del<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, options);
  },
};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
let apiClient: typeof import('../services/api').apiClient;
let setTokens: typeof import('../services/api').setTokens;
let clearTokens: typeof import('../services/api').clearTokens;
let getAccessToken: typeof import('../services/api').getAccessToken;
let tryRefreshToken: typeof import('../services/api').tryRefreshToken;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', 'https://api.test');
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  const mod = await import('../services/api');
  apiClient = mod.apiClient;
  setTokens = mod.setTokens;
  clearTokens = mod.clearTokens;
  getAccessToken = mod.getAccessToken;
  tryRefreshToken = mod.tryRefreshToken;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function mockFetchOnce(status: number, body?: unknown, headers?: Record<string, string>) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => body !== undefined ? Promise.resolve(body) : Promise.reject(new Error('No body')),
    headers: new Headers(headers ?? { 'content-type': 'application/json' }),
    text: () => body !== undefined ? Promise.resolve(JSON.stringify(body)) : Promise.resolve(''),
    clone: function () { return this; },
  } as Response);
}

function mockFetchAbort() {
  const abortError = new DOMException('The operation was aborted', 'AbortError');
  mockFetch.mockRejectedValueOnce(abortError);
}

function mockFetchNetworkError() {
  mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
}

describe('token management', () => {
  it('starts with null token', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('stores and retrieves token via setTokens', () => {
    setTokens('abc123');
    expect(getAccessToken()).toBe('abc123');
  });

  it('clears token via clearTokens', () => {
    setTokens('abc123');
    clearTokens();
    expect(getAccessToken()).toBeNull();
  });
});

describe('request basic HTTP', () => {
  it('sends GET request', async () => {
    mockFetchOnce(200, { data: 'ok' });
    setTokens('tok1');

    const result = await apiClient.get('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/api/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tok1' }),
        credentials: 'include',
      })
    );
    expect(result).toEqual({ data: 'ok' });
  });

  it('sends POST with JSON body', async () => {
    mockFetchOnce(200, { id: 1 });
    setTokens('tok1');

    const result = await apiClient.post('/api/data', { name: 'test' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/api/data',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok1',
        }),
        body: JSON.stringify({ name: 'test' }),
      })
    );
    expect(result).toEqual({ id: 1 });
  });

  it('sends body as FormData without Content-Type header', async () => {
    mockFetchOnce(200, { success: true });
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.txt');

    await apiClient.post('/api/upload', form);

    const call = mockFetch.mock.calls[0][1];
    expect(call.headers).not.toHaveProperty('Content-Type');
    expect(call.body).toBe(form);
  });

  it('includes query params', async () => {
    mockFetchOnce(200, {});

    await apiClient.get('/api/items', { params: { page: '2', limit: '10' } });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });

  it('handles 204 No Content as undefined', async () => {
    mockFetchOnce(204);

    const result = await apiClient.del('/api/item/1');

    expect(result).toBeUndefined();
  });
});

describe('request timeout and abort', () => {
  it('aborts on timeout and throws connection error', async () => {
    mockFetchAbort();

    await expect(apiClient.get('/api/slow')).rejects.toThrow(
      'La solicitud tardó demasiado. Intenta de nuevo.'
    );
  });

  it('propagates external abort signal', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      await new Promise((_, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      return null as unknown as Response;
    });

    setTimeout(() => controller.abort(), 5);
    await expect(apiClient.get('/api/data', { signal: controller.signal })).rejects.toThrow(
      'La solicitud tardó demasiado. Intenta de nuevo.'
    );
  }, 500);
});

describe('request retry and error handling', () => {
  it('retries on 5xx and succeeds on retry', async () => {
    mockFetchOnce(503);
    mockFetchOnce(200, { ok: true });

    const result = await apiClient.get('/api/flaky');

    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx and fails after exhausting retries', async () => {
    mockFetchOnce(503);
    mockFetchOnce(502);

    await expect(apiClient.get('/api/flaky')).rejects.toThrow('Error 502');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx', async () => {
    mockFetchOnce(400, { message: 'Bad request' });

    await expect(apiClient.get('/api/bad')).rejects.toThrow('Bad request');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('extracts error message from response body', async () => {
    mockFetchOnce(422, { error: 'Validation failed' });

    await expect(apiClient.get('/api/validate')).rejects.toThrow('Validation failed');
  });

  it('falls back to status code when error body has no message', async () => {
    mockFetchOnce(418, {});

    await expect(apiClient.get('/api/teapot')).rejects.toThrow('Error 418');
  });

  it('retries on network error and shows final connection error', async () => {
    mockFetchNetworkError();
    mockFetchNetworkError();

    await expect(apiClient.get('/api/offline')).rejects.toThrow(
      'Error de conexión. Verifica tu internet e intenta de nuevo.'
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // Fase 6: POST no es idempotente — un 500 puede haber commiteado parcialmente
  // en el server (ej: usuario creado, emisión de tokens falló). Reintentar
  // produce 409 "ya existe" y cascadas de estados corruptos.
  it('does not retry on 5xx for POST (non-idempotent)', async () => {
    mockFetchOnce(500, { error: 'Server error' });

    await expect(apiClient.post('/api/crear', { foo: 1 })).rejects.toThrow('Server error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry on network error for POST (non-idempotent)', async () => {
    mockFetchNetworkError();

    await expect(apiClient.post('/api/crear', { foo: 1 })).rejects.toThrow(
      'Error de conexión. Verifica tu internet e intenta de nuevo.'
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 5xx for PUT (non-idempotent path)', async () => {
    mockFetchOnce(500, { error: 'Server error' });

    await expect(apiClient.put('/api/actualizar', { foo: 1 })).rejects.toThrow('Server error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('401 refresh token flow', () => {
  it('refreshes token on 401 and retries request', async () => {
    document.cookie = 'hasRefresh=1';
    mockFetchOnce(401);
    mockFetchOnce(200, { accessToken: 'new-token' });
    mockFetchOnce(200, { data: 'success' });

    setTokens('expired-token');
    const result = await apiClient.get('/api/protected');

    expect(result).toEqual({ data: 'success' });
    expect(getAccessToken()).toBe('new-token');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('clears tokens and dispatches session-expired when refresh fails', async () => {
    mockFetchOnce(401);
    mockFetchOnce(401);

    const events: string[] = [];
    const handler = (e: Event) => events.push(e.type);
    window.addEventListener('auth:session-expired', handler);

    setTokens('expired-token');
    await expect(apiClient.get('/api/protected')).rejects.toThrow(
      'Sesión expirada'
    );
    expect(getAccessToken()).toBeNull();
    expect(events).toContain('auth:session-expired');

    window.removeEventListener('auth:session-expired', handler);
  });
});

describe('tryRefreshToken', () => {
  it('returns true on success and stores token', async () => {
    document.cookie = 'hasRefresh=1';
    mockFetchOnce(200, { accessToken: 'fresh-token' });

    const result = await tryRefreshToken();

    expect(result).toBe(true);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('returns false on failure', async () => {
    document.cookie = 'hasRefresh=1';
    mockFetchOnce(401);

    const result = await tryRefreshToken();

    expect(result).toBe(false);
  });
});

describe('uploadWithProgress (XHR)', () => {
  function mockXhr() {
    const xhr = {
      upload: { onprogress: null as ((e: ProgressEvent) => void) | null },
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      timeout: 0,
      status: 200,
      responseText: '',
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
    };
    vi.spyOn(globalThis, 'XMLHttpRequest').mockImplementation(() => xhr as unknown as XMLHttpRequest);
    return xhr;
  }

  it('sends FormData via XHR and returns parsed JSON', async () => {
    const xhr = mockXhr();
    xhr.responseText = JSON.stringify({ url: 'https://cdn.test/photo.jpg' });
    xhr.status = 200;
    setTokens('tok1');

    const form = new FormData();
    form.append('image', new Blob(['x']), 'img.jpg');
    const promise = apiClient.uploadWithProgress('/api/upload', form, vi.fn());

    expect(xhr.open).toHaveBeenCalledWith('POST', 'https://api.test/api/upload');
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer tok1');
    xhr.onload!();

    const result = await promise;
    expect(result).toEqual({ url: 'https://cdn.test/photo.jpg' });
  });

  it('rejects on XHR error after retrying', async () => {
    vi.useFakeTimers();
    const xhr = mockXhr();
    xhr.status = 0;
    xhr.responseText = '';
    const promise = apiClient.uploadWithProgress('/api/upload', new FormData(), vi.fn());

    // First attempt fails → triggers async retry
    xhr.onerror!();

    // Advance past the retry delay so doUpload(token, 0) runs
    await vi.advanceTimersByTimeAsync(2000);

    // Second attempt (retriesLeft=0) also fails → rejects
    xhr.onerror!();

    await expect(promise).rejects.toThrow('Error de conexión');
    vi.useRealTimers();
  });

  // Fase 6: upload es POST no idempotente — no reintentar en 5xx (el server
  // pudo haber creado la foto y fallado en la respuesta).
  it('does not retry on 5xx for upload (non-idempotent POST)', async () => {
    const xhr = mockXhr();
    xhr.status = 500;
    xhr.responseText = JSON.stringify({ error: 'Fallo interno' });

    const promise = apiClient.uploadWithProgress('/api/upload', new FormData(), vi.fn());
    xhr.onload!();

    await expect(promise).rejects.toThrow('Fallo interno');
  });

  it('calls onprogress callback', async () => {
    const xhr = mockXhr();
    xhr.responseText = JSON.stringify({ ok: true });
    xhr.status = 200;
    setTokens('tok1');

    const onProgress = vi.fn();
    const promise = apiClient.uploadWithProgress('/api/upload', new FormData(), onProgress);

    const event = { lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent;
    xhr.upload.onprogress!(event);
    xhr.onload!();
    await promise;

    expect(onProgress).toHaveBeenCalledWith(50);
  });

  it('rejects on XHR abort', async () => {
    const xhr = mockXhr();
    xhr.responseText = '';
    const promise = apiClient.uploadWithProgress('/api/upload', new FormData(), vi.fn());

    xhr.onabort!();

    await expect(promise).rejects.toThrow('La solicitud tardó demasiado');
  });
});

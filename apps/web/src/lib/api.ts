/**
 * INS Solar API Client
 * Automatically handles HttpOnly cookie credentials, CSRF token attachment,
 * and standardized JSON envelope parsing.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2] || '') : null;
}

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details: any[];

  constructor(statusCode: number, code: string, message: string, details: any[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export async function apiClient<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (method !== 'GET' && method !== 'HEAD') {
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Attach CSRF token from XSRF-TOKEN cookie if available
    const csrfToken = getCookie('XSRF-TOKEN');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include' // Always transmit and accept HttpOnly session cookies
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorData = body?.error || {};
    throw new ApiError(
      response.status,
      errorData.code || 'UNKNOWN_ERROR',
      errorData.message || response.statusText || 'Request failed',
      errorData.details || []
    );
  }

  return (body?.data ?? body) as T;
}

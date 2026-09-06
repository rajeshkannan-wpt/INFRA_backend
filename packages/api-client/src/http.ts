import { API_VERSION } from "@wpt/shared";

export interface ApiClientConfig {
  baseUrl: string; // e.g. https://api.wpt.app
  getAuthToken?: () => string | null | Promise<string | null>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

/**
 * Thin fetch wrapper. Deliberately framework-agnostic — `fetch` is
 * available natively on Next.js (web) and via React Native's polyfill
 * (mobile) and Node 20+ (backend, for service-to-service calls), so this
 * one implementation covers all three without a platform adapter.
 */
export function createHttpClient(config: ApiClientConfig) {
  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await config.getAuthToken?.();
    const res = await fetch(`${config.baseUrl}/api/${API_VERSION}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new HttpError(res.status, body);
    }

    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  return {
    get: <T>(path: string) => request<T>(path, { method: "GET" }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    put: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
    del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}

import type { ApiErrorBody } from "@ta-coach/shared";

/** The server's `{ error }` message, or `fallback` when the body isn't that. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const { error } = (await res.json()) as Partial<ApiErrorBody>;
    if (error) return error;
  } catch {
    // Not JSON; use the fallback.
  }
  return fallback;
}

/** Sends the request and parses the JSON response, throwing a user-facing Error on a non-2xx. */
export async function requestJson<T>(url: string, init: RequestInit, fallbackError: string): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await errorMessage(res, fallbackError));
  return (await res.json()) as T;
}

export function postJson<T>(url: string, body: unknown, fallbackError: string, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal },
    fallbackError,
  );
}

export class ApiClientError extends Error {
  status: number;
  payload: Record<string, unknown> | null;

  constructor(message: string, status: number, payload: Record<string, unknown> | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(isForm ? {} : { "content-type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new ApiClientError(
      typeof payload?.error === "string" ? payload.error : "Có lỗi xảy ra. Vui lòng thử lại.",
      response.status,
      payload,
    );
  }
  return payload as T;
}

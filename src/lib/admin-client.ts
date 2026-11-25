import { ApiClientError, apiFetch } from "./client";

// Admin screens share one fetch helper: an expired session always leads back
// to the login page instead of leaving a broken UI behind.
export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(url, init);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401 && typeof window !== "undefined") {
      window.location.replace("/admin/login");
    }
    throw error;
  }
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

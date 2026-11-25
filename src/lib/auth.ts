import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_SESSION_HOURS } from "./config";

function secret(name: string, devFallback: string) {
  const value = process.env[name];
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Thiếu biến môi trường ${name} (tối thiểu 16 ký tự).`);
  }
  return devFallback;
}

export function adminSecret() {
  return secret("ADMIN_SESSION_SECRET", "local-dev-admin-session-secret-change-me");
}
export function staffSecret() {
  return secret("STAFF_ACTION_SECRET", "local-dev-staff-action-secret-change-me");
}
export function sheetsSecret() {
  return secret("SHEETS_WEBHOOK_SECRET", "local-dev-sheets-secret-change-me");
}
export function zaloWebhookSecret() {
  return secret("ZALO_WEBHOOK_SECRET", "local-dev-zalo-webhook-secret-change-me");
}

function digest(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

export function safeCompare(a: string, b: string) {
  return crypto.timingSafeEqual(digest(a), digest(b));
}

function sign(payload: string, key: string) {
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSignedToken(subject: string, key: string, ttlMs: number) {
  const expiresAt = Date.now() + ttlMs;
  return `${expiresAt}.${sign(`${subject}.${expiresAt}`, key)}`;
}

export function verifySignedToken(subject: string, token: string | null | undefined, key: string) {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!expiresAt || !signature || Number.isNaN(expiresAt) || Date.now() > expiresAt) return false;
  return safeCompare(sign(`${subject}.${expiresAt}`, key), signature);
}

export function createAdminSession() {
  return createSignedToken("admin", adminSecret(), ADMIN_SESSION_HOURS * 3600_000);
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  return verifySignedToken("admin", store.get(ADMIN_COOKIE)?.value, adminSecret());
}

export function checkAdminPassword(password: string) {
  const expected =
    process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "admin123" : "");
  if (!expected) return false;
  return safeCompare(expected, password);
}

export function adminCookieOptions() {
  return {
    name: ADMIN_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_HOURS * 3600,
  };
}

export function createStaffToken(orderId: string) {
  return createSignedToken(orderId, staffSecret(), 30 * 24 * 3600_000);
}

export function verifyStaffToken(orderId: string, token: string) {
  return verifySignedToken(orderId, token, staffSecret());
}

export function baseUrlFromRequest(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured && !configured.includes("localhost")) return configured;
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

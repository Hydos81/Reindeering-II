import crypto from "node:crypto";

export function newId() {
  return crypto.randomUUID();
}

export function newToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function nowIso() {
  return new Date().toISOString();
}

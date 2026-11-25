import type { OrderStatus } from "./types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidCode(code: string) {
  return /^[A-Z0-9][A-Z0-9._-]{2,31}$/.test(normalizeCode(code));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Chưa làm món",
  done: "Đã xong món",
  delivered: "Đã giao món",
};

export const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-amber-50 text-amber-700 ring-amber-200",
  done: "bg-sky-50 text-sky-700 ring-sky-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const STATUS_DOT: Record<OrderStatus, string> = {
  new: "bg-amber-500",
  done: "bg-sky-500",
  delivered: "bg-emerald-500",
};

export const INVALID_REASON_LABEL: Record<string, string> = {
  NOT_FOUND: "Mã vé không tồn tại",
  NOT_CHECKED_IN: "Mã vé chưa được check-in",
  ALREADY_ORDERED: "Mã vé đã được đặt nước",
  RESERVED: "Mã vé đang được người khác đặt",
};

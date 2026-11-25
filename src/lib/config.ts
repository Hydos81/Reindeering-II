export const EVENT_NAME =
  process.env.NEXT_PUBLIC_EVENT_NAME || "Đêm Nhạc Thiện Nguyện";

export const EVENT_TAGLINE =
  process.env.NEXT_PUBLIC_EVENT_TAGLINE ||
  "Một đêm nhạc, một ly nước, một tấm lòng";

export const EVENT_VENUE =
  process.env.NEXT_PUBLIC_EVENT_VENUE || "Sân khấu chính · Quán cà phê";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  process.env.APP_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

export const ADMIN_COOKIE = "anh_den_admin";
export const ADMIN_SESSION_HOURS = 12;
export const RESERVATION_MINUTES = 15;

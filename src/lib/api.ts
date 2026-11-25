import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "./auth";

export async function adminOnly() {
  if (await isAdminAuthenticated()) return null;
  return NextResponse.json(
    { error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." },
    { status: 401 },
  );
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (process.env.NODE_ENV !== "production") console.error("[api]", error);

  if (message === "TICKET_EXISTS") {
    return NextResponse.json({ error: "Mã vé này đã tồn tại." }, { status: 409 });
  }
  if (message === "TICKET_ALREADY_ORDERED") {
    return NextResponse.json(
      { error: "Vé đã đặt nước nên không thể bỏ check-in. Hãy hoàn tác đơn trước." },
      { status: 409 },
    );
  }
  if (message === "INVALID_TRANSITION") {
    return NextResponse.json(
      { error: "Không thể chuyển trạng thái đơn theo cách này." },
      { status: 409 },
    );
  }
  if (message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }
  return NextResponse.json({ error: "Có lỗi xảy ra. Vui lòng thử lại." }, { status: 500 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfter} giây.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

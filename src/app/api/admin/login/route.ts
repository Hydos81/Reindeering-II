import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { badRequest, tooMany } from "@/lib/api";
import {
  adminCookieOptions,
  checkAdminPassword,
  createAdminSession,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const gate = rateLimit(`login:${clientIp(request)}`, 10, 60_000);
  if (!gate.ok) return tooMany(gate.retryAfter);

  const payload = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const password = typeof payload?.password === "string" ? payload.password : "";
  if (!password) return badRequest("Vui lòng nhập mật khẩu.");

  if (!checkAdminPassword(password)) {
    return NextResponse.json(
      { error: "Mật khẩu không đúng. Vui lòng thử lại." },
      { status: 401 },
    );
  }

  const jar = await cookies();
  jar.set({ ...adminCookieOptions(), value: createAdminSession() });
  return NextResponse.json({ ok: true });
}

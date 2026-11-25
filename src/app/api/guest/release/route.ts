import { NextResponse } from "next/server";
import { apiError, tooMany } from "@/lib/api";
import { repo } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const gate = rateLimit(`release:${clientIp(request)}`, 20, 60_000);
    if (!gate.ok) return tooMany(gate.retryAfter);

    const payload = (await request.json().catch(() => null)) as {
      token?: unknown;
    } | null;
    const token = typeof payload?.token === "string" ? payload.token.trim() : "";
    if (token) await repo.releaseReservation(token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

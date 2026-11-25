import { NextResponse } from "next/server";
import { apiError, tooMany } from "@/lib/api";
import { repo } from "@/lib/db";
import { toPublicOrder } from "@/lib/public-order";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const gate = rateLimit(`guest-order:${clientIp(request)}`, 90, 60_000);
    if (!gate.ok) return tooMany(gate.retryAfter);

    const { token } = await params;
    const order = await repo.getOrderByGuestToken(token);
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn nước." }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, order: toPublicOrder(order) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

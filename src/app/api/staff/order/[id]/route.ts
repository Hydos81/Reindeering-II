import { NextResponse } from "next/server";
import { apiError, tooMany } from "@/lib/api";
import { verifyStaffToken } from "@/lib/auth";
import { repo } from "@/lib/db";
import { toPublicOrder } from "@/lib/public-order";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = rateLimit(`staff-get:${clientIp(request)}`, 180, 60_000);
    if (!gate.ok) return tooMany(gate.retryAfter);

    const { id } = await params;
    const token = new URL(request.url).searchParams.get("t") || "";
    if (!verifyStaffToken(id, token)) {
      return NextResponse.json(
        { error: "Liên kết không hợp lệ hoặc đã hết hạn." },
        { status: 401 },
      );
    }

    const order = await repo.getOrder(id);
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn." }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, order: toPublicOrder(order) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

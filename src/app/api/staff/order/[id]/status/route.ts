import { NextResponse } from "next/server";
import { apiError, badRequest, tooMany } from "@/lib/api";
import { baseUrlFromRequest, verifyStaffToken } from "@/lib/auth";
import { repo } from "@/lib/db";
import { toPublicOrder } from "@/lib/public-order";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { OrderStatus } from "@/lib/types";
import { notifyOrderStatus } from "@/lib/zalo";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = rateLimit(`staff-action:${clientIp(request)}`, 60, 60_000);
    if (!gate.ok) return tooMany(gate.retryAfter);

    const { id } = await params;
    const payload = (await request.json().catch(() => null)) as {
      token?: unknown;
      status?: unknown;
    } | null;
    const token = typeof payload?.token === "string" ? payload.token : "";
    if (!verifyStaffToken(id, token)) {
      return NextResponse.json(
        { error: "Liên kết không hợp lệ hoặc đã hết hạn." },
        { status: 401 },
      );
    }

    const status = payload?.status as OrderStatus;
    if (status !== "done" && status !== "delivered") {
      return badRequest("Trạng thái không hợp lệ.");
    }

    const order = await repo.updateOrderStatus(id, status);
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn." }, { status: 404 });
    }

    try {
      await notifyOrderStatus(order, baseUrlFromRequest(request));
    } catch (notificationError) {
      console.error("[staff] Không gửi được thông báo Zalo", notificationError);
    }

    return NextResponse.json({ ok: true, order: toPublicOrder(order) });
  } catch (error) {
    return apiError(error);
  }
}

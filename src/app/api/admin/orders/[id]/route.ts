import { NextResponse } from "next/server";
import { adminOnly, apiError, badRequest } from "@/lib/api";
import { baseUrlFromRequest } from "@/lib/auth";
import { repo } from "@/lib/db";
import type { OrderStatus } from "@/lib/types";
import { notifyOrderStatus } from "@/lib/zalo";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => null)) as {
      status?: unknown;
    } | null;
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
      console.error("[admin] Không gửi được thông báo Zalo", notificationError);
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return apiError(error);
  }
}

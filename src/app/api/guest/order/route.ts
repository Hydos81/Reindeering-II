import { NextResponse } from "next/server";
import { apiError, badRequest, tooMany } from "@/lib/api";
import { baseUrlFromRequest } from "@/lib/auth";
import { RESERVATION_MINUTES } from "@/lib/config";
import { repo } from "@/lib/db";
import { normalizeCode } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/zalo";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrderPayload = {
  token?: unknown;
  guestName?: unknown;
  seat?: unknown;
  items?: unknown;
};

type RawOrderItem = { code?: unknown; menuItemId?: unknown };

export async function POST(request: Request) {
  try {
    const gate = rateLimit(`order:${clientIp(request)}`, 10, 60_000);
    if (!gate.ok) return tooMany(gate.retryAfter);

    const payload = (await request.json().catch(() => null)) as OrderPayload | null;
    if (!payload || typeof payload !== "object") {
      return badRequest("Dữ liệu gửi lên không hợp lệ.");
    }

    const reservationToken =
      typeof payload.token === "string" ? payload.token.trim() : "";
    const guestName =
      typeof payload.guestName === "string" ? payload.guestName.trim() : "";
    const seat = typeof payload.seat === "string" ? payload.seat.trim() : "";

    if (!reservationToken) return badRequest("Phiên đặt nước không hợp lệ.");
    if (guestName.length < 2 || guestName.length > 80) {
      return badRequest("Vui lòng nhập tên khách (2–80 ký tự).");
    }
    if (!seat || seat.length > 40) return badRequest("Vui lòng nhập chỗ ngồi.");

    const submitted = Array.isArray(payload.items)
      ? (payload.items as RawOrderItem[])
      : [];
    if (submitted.length < 1 || submitted.length > 10) {
      return badRequest("Đơn nước cần từ 1 đến 10 món.");
    }

    const items = submitted.map((entry) => ({
      code: normalizeCode(
        typeof entry?.code === "string" ? entry.code : String(entry?.code ?? ""),
      ),
      menuItemId:
        typeof entry?.menuItemId === "string" ? entry.menuItemId.trim() : "",
    }));
    if (items.some((item) => !item.code || !UUID_PATTERN.test(item.menuItemId))) {
      return badRequest("Thông tin món nước không hợp lệ.");
    }

    const placed = await repo.placeOrder({
      guestName,
      seat,
      reservationToken,
      items,
      ttlMinutes: RESERVATION_MINUTES,
    });

    if (!placed.ok) {
      return NextResponse.json(
        { error: placed.message, code: placed.error },
        { status: placed.error === "RESERVATION_EXPIRED" ? 410 : 409 },
      );
    }

    try {
      await notifyNewOrder(placed.order, baseUrlFromRequest(request));
    } catch (notificationError) {
      console.error("[order] Không gửi được thông báo Zalo", notificationError);
    }

    const order = placed.order;
    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        guestToken: order.guestToken,
        guestName: order.guestName,
        seat: order.seat,
        status: order.status,
        createdAt: order.createdAt,
        items: order.items.map((line) => ({
          itemName: line.itemName,
          ticketCode: line.ticketCode,
          quantity: line.quantity,
        })),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

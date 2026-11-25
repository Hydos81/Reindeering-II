import { NextResponse } from "next/server";
import { apiError, badRequest, tooMany } from "@/lib/api";
import { RESERVATION_MINUTES } from "@/lib/config";
import { repo } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const gate = rateLimit(`reservation:${clientIp(request)}`, 60, 60_000);
    if (!gate.ok) return tooMany(gate.retryAfter);

    const token = new URL(request.url).searchParams.get("token")?.trim() || "";
    if (!token) return badRequest("Thiếu mã phiên đặt nước.");

    const tickets = await repo.getReservation(token, RESERVATION_MINUTES);
    if (tickets.length === 0) {
      return NextResponse.json(
        {
          error:
            "Phiên đặt nước đã hết hạn hoặc mã vé vừa được thay đổi. Vui lòng nhập lại mã vé.",
        },
        { status: 410 },
      );
    }

    const categories = await repo.listCategoriesWithItems(false);
    const menu = categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => item.isAvailable),
      }))
      .filter((category) => category.items.length > 0);

    const earliestReservation = tickets.reduce((min, ticket) => {
      const reservedAt = new Date(ticket.reservedAt || Date.now()).getTime();
      return Math.min(min, reservedAt);
    }, Number.POSITIVE_INFINITY);

    return NextResponse.json({
      ok: true,
      token,
      tickets: tickets.map((ticket) => ({
        code: ticket.code,
        guestName: ticket.guestName,
      })),
      menu,
      expiresAt: new Date(
        earliestReservation + RESERVATION_MINUTES * 60_000,
      ).toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}

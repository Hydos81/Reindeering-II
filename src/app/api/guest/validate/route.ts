import { NextResponse } from "next/server";
import { apiError, badRequest, tooMany } from "@/lib/api";
import { RESERVATION_MINUTES } from "@/lib/config";
import { repo } from "@/lib/db";
import { normalizeCode } from "@/lib/format";
import { newToken } from "@/lib/ids";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type ValidatePayload = {
  name?: unknown;
  seat?: unknown;
  codes?: unknown;
};

export async function POST(request: Request) {
  try {
    const gate = rateLimit(`validate:${clientIp(request)}`, 15, 60_000);
    if (!gate.ok) return tooMany(gate.retryAfter);

    const payload = (await request.json().catch(() => null)) as ValidatePayload | null;
    if (!payload || typeof payload !== "object") {
      return badRequest("Dữ liệu gửi lên không hợp lệ.");
    }

    const guestName = typeof payload.name === "string" ? payload.name.trim() : "";
    if (guestName.length < 2 || guestName.length > 80) {
      return badRequest("Vui lòng nhập tên khách (2–80 ký tự).");
    }

    const seat = typeof payload.seat === "string" ? payload.seat.trim() : "";
    if (!seat || seat.length > 40) {
      return badRequest("Vui lòng nhập chỗ ngồi.");
    }

    const submitted = Array.isArray(payload.codes) ? payload.codes : [];
    const codes = submitted
      .map((entry) =>
        normalizeCode(typeof entry === "string" ? entry : String(entry ?? "")),
      )
      .filter((code) => code.length > 0);

    if (codes.length === 0) return badRequest("Vui lòng nhập ít nhất một mã vé.");
    if (codes.length > 10) return badRequest("Mỗi lần chỉ đặt được tối đa 10 mã vé.");
    if (new Set(codes).size !== codes.length) {
      return badRequest("Các mã vé không được trùng nhau.");
    }

    const reservationToken = newToken(24);
    const reserved = await repo.reserveTickets(
      codes,
      reservationToken,
      RESERVATION_MINUTES,
    );

    if (!reserved.ok) {
      return NextResponse.json(
        { error: "Một số mã vé không thể sử dụng.", invalid: reserved.invalid },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      token: reservationToken,
      expiresInMinutes: RESERVATION_MINUTES,
      tickets: reserved.tickets.map((ticket) => ({
        code: ticket.code,
        guestName: ticket.guestName,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

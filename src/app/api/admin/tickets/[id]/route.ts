import { NextResponse } from "next/server";
import { adminOnly, apiError, badRequest } from "@/lib/api";
import { repo } from "@/lib/db";
import { isValidCode, normalizeCode } from "@/lib/format";

type TicketUpdatePayload = {
  action?: unknown;
  code?: unknown;
  guestName?: unknown;
  phone?: unknown;
  note?: unknown;
  checkedIn?: unknown;
};

function trimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => null)) as
      | TicketUpdatePayload
      | null;
    if (!payload || typeof payload !== "object") {
      return badRequest("Dữ liệu không hợp lệ.");
    }

    if (payload.action === "check_in") {
      if (typeof payload.checkedIn !== "boolean") {
        return badRequest("Thiếu trạng thái check-in.");
      }
      const ticket = await repo.setTicketCheckIn(id, payload.checkedIn);
      if (!ticket) {
        return NextResponse.json({ error: "Không tìm thấy vé." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, ticket });
    }

    if (payload.action === "reset") {
      const result = await repo.resetTicketOrder(id);
      return NextResponse.json({ ok: true, ...result });
    }

    const code = normalizeCode(trimmed(payload.code));
    const guestName = trimmed(payload.guestName);
    if (!isValidCode(code)) return badRequest("Mã vé không hợp lệ.");
    if (!guestName) return badRequest("Vui lòng nhập tên khách.");

    const ticket = await repo.updateTicket(id, {
      code,
      guestName,
      phone: trimmed(payload.phone) || null,
      note: trimmed(payload.note) || null,
    });
    if (!ticket) {
      return NextResponse.json({ error: "Không tìm thấy vé." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const { id } = await params;
    const ticket = await repo.getTicketById(id);
    if (!ticket) {
      return NextResponse.json({ error: "Không tìm thấy vé." }, { status: 404 });
    }
    if (ticket.orderedAt) {
      return NextResponse.json(
        {
          error:
            "Vé đã đặt nước. Hãy hoàn tác đơn nước trước khi xoá vé để tránh đơn bị mồ côi.",
        },
        { status: 409 },
      );
    }
    await repo.deleteTicket(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

import { NextResponse } from "next/server";
import { adminOnly, apiError, badRequest } from "@/lib/api";
import { repo } from "@/lib/db";
import { isValidCode, normalizeCode } from "@/lib/format";
import type { TicketListFilter } from "@/lib/types";

const SUPPORTED_FILTERS: readonly TicketListFilter[] = [
  "all",
  "checked_in",
  "not_checked_in",
  "ordered",
  "not_ordered",
];

function readFilter(value: string | null): TicketListFilter {
  return SUPPORTED_FILTERS.includes(value as TicketListFilter)
    ? (value as TicketListFilter)
    : "all";
}

function readPositiveNumber(value: string | null, fallback: number) {
  if (!value || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const query = new URL(request.url).searchParams;
    const listing = await repo.listTickets({
      search: query.get("search") || "",
      filter: readFilter(query.get("filter")),
      page: readPositiveNumber(query.get("page"), 1),
      pageSize: readPositiveNumber(query.get("pageSize"), 50),
    });
    return NextResponse.json({ ok: true, ...listing });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const payload = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!payload || typeof payload !== "object") {
      return badRequest("Dữ liệu không hợp lệ.");
    }

    const field = (key: string) =>
      typeof payload[key] === "string" ? (payload[key] as string).trim() : "";
    const code = normalizeCode(field("code"));
    const guestName = field("guestName");

    if (!isValidCode(code)) {
      return badRequest(
        "Mã vé không hợp lệ. Dùng 3–32 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.",
      );
    }
    if (!guestName) return badRequest("Vui lòng nhập tên khách.");

    const ticket = await repo.createTicket({
      code,
      guestName,
      phone: field("phone") || null,
      note: field("note") || null,
    });
    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    return apiError(error);
  }
}

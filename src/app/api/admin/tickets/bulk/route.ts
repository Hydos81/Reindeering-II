import { NextResponse } from "next/server";
import { adminOnly, apiError, badRequest } from "@/lib/api";
import { prepareTicketImport } from "@/lib/bulk-import";
import { repo } from "@/lib/db";

export async function POST(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const payload = (await request.json().catch(() => null)) as
      | { text?: string; rows?: unknown[] }
      | null;
    if (!payload || typeof payload !== "object") {
      return badRequest("Dữ liệu không hợp lệ.");
    }

    const prepared = prepareTicketImport(payload);
    if (!prepared.ok) return badRequest(prepared.error);
    if (prepared.rows.length === 0) {
      return NextResponse.json(
        { error: "Không có dòng hợp lệ để nhập.", errors: prepared.errors },
        { status: 400 },
      );
    }

    const counts = await repo.bulkUpsertTickets(prepared.rows);
    return NextResponse.json({ ok: true, ...counts, errors: prepared.errors });
  } catch (error) {
    return apiError(error);
  }
}

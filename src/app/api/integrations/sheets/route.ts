import { NextResponse } from "next/server";
import { apiError, badRequest, tooMany } from "@/lib/api";
import { safeCompare, sheetsSecret } from "@/lib/auth";
import { prepareTicketImport } from "@/lib/bulk-import";
import { repo } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const gate = rateLimit(`sheets:${clientIp(request)}`, 30, 60_000);
    if (!gate.ok) return tooMany(gate.retryAfter);

    const payload = (await request.json().catch(() => null)) as {
      secret?: unknown;
      text?: unknown;
      rows?: unknown;
    } | null;
    const supplied =
      request.headers.get("x-sheets-secret") ||
      (typeof payload?.secret === "string" ? payload.secret : "");
    if (!supplied || !safeCompare(sheetsSecret(), supplied)) {
      return NextResponse.json({ error: "Sai mã bí mật." }, { status: 401 });
    }
    if (!payload || typeof payload !== "object") {
      return badRequest("Dữ liệu không hợp lệ.");
    }

    const prepared = prepareTicketImport({
      text: typeof payload.text === "string" ? payload.text : undefined,
      rows: Array.isArray(payload.rows) ? payload.rows : undefined,
    });
    if (!prepared.ok) return badRequest(prepared.error);
    if (prepared.rows.length === 0) {
      return NextResponse.json(
        { error: "Không có dòng hợp lệ.", errors: prepared.errors },
        { status: 400 },
      );
    }

    const counts = await repo.bulkUpsertTickets(prepared.rows);
    return NextResponse.json({ ok: true, ...counts, errors: prepared.errors });
  } catch (error) {
    return apiError(error);
  }
}

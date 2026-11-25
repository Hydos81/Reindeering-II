import { isValidCode, normalizeCode } from "./format";
import { parseTicketSheet } from "./parser";
import type { BulkTicketResult, TicketInput } from "./types";

export type ImportPayload = { text?: string; rows?: unknown[] };

// Shared by the admin "paste" dialog and the Sheets webhook. Returns every
// valid row plus human-readable errors; callers decide how strict to be.
export function prepareTicketImport(payload: ImportPayload) {
  const errors: string[] = [];
  const rows: TicketInput[] = [];
  const seen = new Set<string>();

  const add = (row: TicketInput, label: string) => {
    const code = normalizeCode(row.code);
    if (!code || !row.guestName?.trim()) {
      errors.push(`${label}: thiếu mã vé hoặc tên khách.`);
      return;
    }
    if (!isValidCode(code)) {
      errors.push(`${label}: mã vé "${code}" không hợp lệ.`);
      return;
    }
    if (seen.has(code)) {
      errors.push(`${label}: mã vé "${code}" bị trùng.`);
      return;
    }
    seen.add(code);
    rows.push({ ...row, code, guestName: row.guestName.trim() });
  };

  if (typeof payload.text === "string" && payload.text.trim()) {
    const parsed = parseTicketSheet(payload.text);
    errors.push(...parsed.errors);
    parsed.rows.forEach((row) => add(row, `Dòng ${rows.length + 1}`));
  } else if (Array.isArray(payload.rows)) {
    payload.rows.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") {
        errors.push(`Dòng ${index + 1}: dữ liệu không hợp lệ.`);
        return;
      }
      const item = raw as Record<string, unknown>;
      add(
        {
          code: String(item.code ?? ""),
          guestName: String(item.guestName ?? ""),
          phone: String(item.phone ?? "").trim() || null,
          note: String(item.note ?? "").trim() || null,
        },
        `Dòng ${index + 1}`,
      );
    });
  }

  if (rows.length > 2000) {
    return { ok: false as const, error: "Mỗi lần chỉ nhập tối đa 2.000 vé.", rows: [], errors };
  }
  return { ok: true as const, rows, errors };
}

export type PreparedImport = ReturnType<typeof prepareTicketImport>;
export type TicketImportResult = BulkTicketResult;

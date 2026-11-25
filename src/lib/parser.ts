import { isValidCode, normalizeCode } from "./format";
import type { TicketInput } from "./types";

export type ParsedTicketSheet = { rows: TicketInput[]; errors: string[] };

const ALIASES: Record<string, string[]> = {
  code: ["mave", "ma", "code", "ticket", "ticketcode", "sove"],
  guestName: ["tenkhach", "ten", "name", "guest", "guestname", "hoten", "khach", "khachhang"],
  phone: ["sdt", "phone", "dienthoai", "sodienthoai", "tel", "mobile"],
  note: ["ghichu", "note", "notes"],
};

function splitLine(line: string, delimiter: string) {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      fields.push(current.trim());
      current = "";
    } else current += char;
  }
  fields.push(current.trim());
  return fields;
}

function deaccent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function detectHeader(cells: string[]) {
  const normalized = cells.map(deaccent);
  const positions: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const index = normalized.findIndex((cell) => aliases.includes(cell));
    if (index >= 0) positions[field] = index;
  }
  return positions.code !== undefined && positions.guestName !== undefined ? positions : null;
}

// Accepts TSV (pasted from Sheets), CSV, semicolon-separated data, with or
// without a header row. Quoted fields and doubled quotes are supported.
export function parseTicketSheet(text: string): ParsedTicketSheet {
  const errors: string[] = [];
  const rows: TicketInput[] = [];
  const seen = new Set<string>();
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"));

  if (lines.length === 0) return { rows, errors: ["Chưa có dữ liệu để nhập."] };

  const first = lines[0];
  const delimiter = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const header = detectHeader(splitLine(first, delimiter));

  for (let index = header ? 1 : 0; index < lines.length; index += 1) {
    const cells = splitLine(lines[index], delimiter);
    if (cells.every((cell) => !cell.trim())) continue;
    const cell = (key: string, fallback: number) =>
      header?.[key] !== undefined ? cells[header[key]] || "" : cells[fallback] || "";

    const code = normalizeCode(cell("code", 0));
    const guestName = cell("guestName", 1).trim();
    const lineNumber = index + 1;

    if (!code) {
      errors.push(`Dòng ${lineNumber}: thiếu mã vé.`);
    } else if (!guestName) {
      errors.push(`Dòng ${lineNumber}: thiếu tên khách.`);
    } else if (!isValidCode(code)) {
      errors.push(`Dòng ${lineNumber}: mã vé "${code}" không hợp lệ.`);
    } else if (seen.has(code)) {
      errors.push(`Dòng ${lineNumber}: mã vé "${code}" bị trùng.`);
    } else {
      seen.add(code);
      rows.push({
        code,
        guestName,
        phone: cell("phone", 2).trim() || null,
        note: cell("note", 3).trim() || null,
      });
    }
  }

  if (rows.length === 0 && errors.length === 0) errors.push("Không tìm thấy dòng dữ liệu hợp lệ.");
  return { rows, errors };
}

export const SAMPLE_SHEET = `Mã vé\tTên khách\tSĐT\tGhi chú
VE-A1B2\tNguyễn Minh Anh\t0901234567\tKhách mời
VE-C3D4\tTrần Thu Hà\t\tBàn gần sân khấu`;

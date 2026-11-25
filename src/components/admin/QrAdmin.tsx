/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Music2,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Ticket as TicketIcon,
  TriangleAlert,
} from "lucide-react";
import { Toast } from "@/components/Toast";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  SectionTitle,
  fieldClass,
} from "@/components/admin/AdminUi";
import { adminFetch, errorMessage } from "@/lib/admin-client";
import { APP_URL, EVENT_NAME } from "@/lib/config";
import { cn, formatTime } from "@/lib/format";
import type { Ticket, TicketListFilter } from "@/lib/types";

type TicketListResponse = {
  ok: true;
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
};

type Notice = { message: string; tone: "success" | "error" | "info" };

const PAGE_SIZE = 200;

const FILTERS: Array<{ value: TicketListFilter; label: string }> = [
  { value: "not_ordered", label: "Chưa đặt nước" },
  { value: "not_checked_in", label: "Chưa check-in" },
  { value: "all", label: "Tất cả vé" },
  { value: "ordered", label: "Đã đặt nước" },
];

export function QrAdmin() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState<TicketListFilter>("not_ordered");
  const [showGuestName, setShowGuestName] = useState(true);
  const [baseOverride, setBaseOverride] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const initialised = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const first = await adminFetch<TicketListResponse>(
        `/api/admin/tickets?page=1&pageSize=${PAGE_SIZE}&filter=all`,
      );
      const rows = [...first.items];
      const pages = Math.max(1, Math.ceil(first.total / first.pageSize));
      for (let page = 2; page <= pages; page += 1) {
        const next = await adminFetch<TicketListResponse>(
          `/api/admin/tickets?page=${page}&pageSize=${PAGE_SIZE}&filter=all`,
        );
        rows.push(...next.items);
      }
      setTickets(rows);
      if (!initialised.current) {
        initialised.current = true;
        setSelected(new Set(rows.filter((ticket) => !ticket.orderedAt).map((ticket) => ticket.id)));
      }
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không tải được danh sách vé."),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount-time and refresh-triggered fetches; state settles asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, revision]);

  const baseUrl = (baseOverride ?? APP_URL).trim().replace(/\/+$/, "");
  const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl);

  const visible = useMemo(() => {
    const needle = searchInput.trim().toLocaleLowerCase("vi");
    return tickets.filter((ticket) => {
      if (filter === "not_ordered" && ticket.orderedAt) return false;
      if (filter === "ordered" && !ticket.orderedAt) return false;
      if (filter === "not_checked_in" && ticket.checkedInAt) return false;
      if (!needle) return true;
      return `${ticket.code} ${ticket.guestName}`
        .toLocaleLowerCase("vi")
        .includes(needle);
    });
  }, [tickets, filter, searchInput]);

  useEffect(() => {
    let active = true;
    if (visible.length === 0 || !baseUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrCodes({});
      setGenerating(false);
      return () => {
        active = false;
      };
    }
    setGenerating(true);
    void (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const entries = await Promise.all(
          visible.map(async (ticket) => {
            const url = `${baseUrl}/?code=${encodeURIComponent(ticket.code)}`;
            const dataUrl = await QRCode.toDataURL(url, {
              width: 240,
              margin: 1,
              errorCorrectionLevel: "M",
              color: { dark: "#2a1c15", light: "#fffdf8" },
            });
            return [ticket.id, dataUrl] as const;
          }),
        );
        if (active) setQrCodes(Object.fromEntries(entries));
      } catch {
        if (active) {
          setNotice({
            message: "Không tạo được mã QR. Vui lòng thử tải lại trang.",
            tone: "error",
          });
        }
      } finally {
        if (active) setGenerating(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, baseUrl]);

  const selectedVisible = visible.filter((ticket) => selected.has(ticket.id));
  const allSelected = visible.length > 0 && selectedVisible.length === visible.length;

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) visible.forEach((ticket) => next.delete(ticket.id));
      else visible.forEach((ticket) => next.add(ticket.id));
      return next;
    });
  }

  return (
    <div>
      <div className="no-print">
        <SectionTitle
          eyebrow="Công cụ · Mã QR"
          title="Mã QR từng vé"
          description="Mỗi mã mở trang đặt nước với mã vé điền sẵn. Chọn vé rồi in thành từng thẻ dán tại bàn."
          actions={
            <>
              <Button onClick={() => setRevision((value) => value + 1)} loading={loading}>
                <RefreshCw className="size-4" />
                Tải lại
              </Button>
              <Button
                variant="primary"
                onClick={() => window.print()}
                disabled={generating || selectedVisible.length === 0}
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Printer className="size-4" />
                )}
                In {selectedVisible.length > 0 ? `${selectedVisible.length} thẻ` : "thẻ"}
              </Button>
            </>
          }
        />

        <div className="mb-4 overflow-hidden rounded-3xl border border-line/80 bg-paper/90">
          <div className="grid gap-3 border-b border-line/70 p-4 sm:grid-cols-2 sm:p-5">
            <Field
              label="Tên miền ghi trong mã QR"
              htmlFor="qr-base-url"
              hint="Dùng tên miền công khai để điện thoại quét được. Mặc định lấy từ NEXT_PUBLIC_APP_URL."
            >
              <input
                id="qr-base-url"
                value={baseUrl}
                onChange={(event) => setBaseOverride(event.target.value)}
                placeholder="https://ten-mien-cua-ban.com"
                className={fieldClass}
              />
            </Field>
            <div>
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-coffee">
                Tuỳ chọn hiển thị
              </span>
              <label className="flex h-11 cursor-pointer items-center justify-between rounded-xl border border-line bg-paper px-3.5 text-sm">
                <span className="font-semibold text-coffee">Ẩn tên khách khi in</span>
                <input
                  type="checkbox"
                  checked={!showGuestName}
                  onChange={(event) => setShowGuestName(!event.target.checked)}
                  className="size-4 accent-[var(--color-terracotta)]"
                />
              </label>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                Bật nếu dán thẻ QR ở khu vực công cộng.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 bg-cream/35 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted/60" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm mã vé hoặc tên khách…"
                className="h-10 w-full rounded-xl border border-line bg-paper pl-10 pr-10 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc vé"
                value={filter}
                onChange={(event) => setFilter(event.target.value as TicketListFilter)}
                className={`${fieldClass} h-10 w-full text-xs sm:w-44`}
              >
                {FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={toggleAll} disabled={visible.length === 0}>
                <Check className="size-3.5" />
                {allSelected ? "Bỏ chọn" : "Chọn tất cả"}
              </Button>
            </div>
          </div>
        </div>

        {isLocal && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Mã QR đang trỏ về localhost. Điện thoại ngoài mạng này sẽ không quét
            được — hãy đặt <code className="font-mono">NEXT_PUBLIC_APP_URL</code>{" "}
            thành tên miền công khai trước khi in.
          </div>
        )}
      </div>

      {loading && tickets.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-line bg-paper/80 py-20 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Đang tải tất cả vé…
        </div>
      ) : visible.length === 0 ? (
        <div className="no-print">
          <EmptyState
            icon={QrCode}
            title="Không có vé để in"
            description="Đổi bộ lọc, bỏ tìm kiếm hoặc nhập danh sách vé trong mục Khách & vé."
          />
        </div>
      ) : (
        <>
          <div className="qr-print-area">
            <div className="qr-print-grid grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {visible.map((ticket) => {
                const picked = selected.has(ticket.id);
                return (
                  <div
                    key={ticket.id}
                    className={cn(
                      "qr-card group relative overflow-hidden rounded-2xl border border-dashed border-line bg-paper p-3.5 text-center",
                      !picked && "no-print",
                    )}
                  >
                    <label className="no-print absolute left-2 top-2 flex cursor-pointer items-center gap-1 rounded-full bg-cream/90 px-2 py-1 text-[9px] font-bold text-coffee shadow-sm">
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() => toggleOne(ticket.id)}
                        className="size-3.5 accent-[var(--color-terracotta)]"
                      />
                      Chọn
                    </label>
                    <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-terracotta">
                      <Music2 className="size-3" />
                      {EVENT_NAME}
                    </p>
                    <div className="mx-auto mt-2.5 size-40 max-w-full rounded-xl border border-line/70 bg-white p-2 shadow-sm">
                      {qrCodes[ticket.id] ? (
                        <img
                          src={qrCodes[ticket.id]}
                          alt={`Mã QR vé ${ticket.code}`}
                          className="size-full object-contain"
                        />
                      ) : (
                        <div className="grid size-full place-items-center">
                          {generating ? (
                            <Loader2 className="size-5 animate-spin text-terracotta" />
                          ) : (
                            <QrCode className="size-8 text-line" />
                          )}
                        </div>
                      )}
                    </div>
                    <p className="mt-2.5 font-mono text-base font-bold tracking-[0.12em] text-ink">
                      {ticket.code}
                    </p>
                    {showGuestName && (
                      <p className="mt-0.5 truncate text-xs font-semibold text-coffee">
                        {ticket.guestName}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted">Quét mã để chọn nước</p>
                    <p className="mt-1 text-[8px] text-muted/60">
                      {ticket.checkedInAt
                        ? `Check-in ${formatTime(ticket.checkedInAt)}`
                        : "Chưa check-in"}
                    </p>
                    {qrCodes[ticket.id] && (
                      <a
                        href={qrCodes[ticket.id]}
                        download={`qr-${ticket.code}.png`}
                        className="no-print absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-cream/90 text-muted opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-terracotta"
                        title="Tải ảnh QR"
                      >
                        <Download className="size-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="no-print mt-4 flex flex-col gap-3 rounded-2xl border border-line/80 bg-paper/80 px-4 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-2">
              <TicketIcon className="size-3.5 text-terracotta" />
              {tickets.length} vé đã tải · {visible.length} vé theo bộ lọc ·{" "}
              {selectedVisible.length} vé được chọn
            </p>
            <Badge tone={allSelected ? "sage" : "neutral"}>
              {allSelected ? "Đã chọn toàn bộ" : "Đang chọn một phần"}
            </Badge>
          </div>
        </>
      )}

      <Toast message={notice?.message ?? null} tone={notice?.tone} onClose={() => setNotice(null)} />
    </div>
  );
}

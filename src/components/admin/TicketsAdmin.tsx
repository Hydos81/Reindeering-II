"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Coffee,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Ticket as TicketIcon,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { Toast } from "@/components/Toast";
import {
  Button,
  Card,
  EmptyState,
  Field,
  SectionTitle,
  StatCard,
  fieldClass,
  textareaClass,
} from "@/components/admin/AdminUi";
import { adminFetch, errorMessage } from "@/lib/admin-client";
import type { OverviewData } from "@/lib/admin-types";
import { ApiClientError } from "@/lib/client";
import { cn, formatDateTime, formatTime } from "@/lib/format";
import { SAMPLE_SHEET, parseTicketSheet } from "@/lib/parser";
import type {
  BulkTicketResult,
  Ticket,
  TicketListFilter,
} from "@/lib/types";

type TicketListResponse = {
  ok: true;
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
};

type BulkResponse = BulkTicketResult & { ok: true; errors?: string[] };

type EditorState = { mode: "create" } | { mode: "edit"; ticket: Ticket } | null;

type Notice = { message: string; tone: "success" | "error" | "info" };

const FILTERS: Array<{ value: TicketListFilter; label: string }> = [
  { value: "all", label: "Tất cả vé" },
  { value: "not_checked_in", label: "Chưa check-in" },
  { value: "checked_in", label: "Đã check-in" },
  { value: "not_ordered", label: "Chưa đặt nước" },
  { value: "ordered", label: "Đã đặt nước" },
];

const PAGE_SIZE = 50;

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function TicketsAdmin() {
  const [list, setList] = useState<TicketListResponse | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TicketListFilter>("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Ticket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await adminFetch<OverviewData>("/api/admin/overview"));
    } catch {
      // The ticket table stays usable even if the summary is unavailable.
    }
  }, []);

  useEffect(() => {
    // Mount-time fetch; the async loader updates state after the effect returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        filter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      try {
        const result = await adminFetch<TicketListResponse>(
          `/api/admin/tickets?${params.toString()}`,
        );
        if (!active) return;
        if (result.total > 0 && result.items.length === 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(result.total / result.pageSize)));
          return;
        }
        setList(result);
      } catch (error) {
        if (!active) return;
        setNotice({
          message: errorMessage(error, "Không tải được danh sách vé."),
          tone: "error",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [search, filter, page, revision]);

  function refresh() {
    setRevision((value) => value + 1);
    void loadOverview();
  }

  async function toggleCheckIn(ticket: Ticket) {
    const key = `checkin:${ticket.id}`;
    setWorking(key);
    try {
      await adminFetch(`/api/admin/tickets/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "check_in",
          checkedIn: !ticket.checkedInAt,
        }),
      });
      setNotice({
        message: ticket.checkedInAt
          ? `Đã bỏ check-in vé ${ticket.code}.`
          : `Đã check-in vé ${ticket.code}.`,
        tone: "success",
      });
      refresh();
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không cập nhật được check-in."),
        tone: "error",
      });
    } finally {
      setWorking(null);
    }
  }

  async function confirmReset() {
    if (!resetTarget) return;
    setWorking(`reset:${resetTarget.id}`);
    try {
      await adminFetch(`/api/admin/tickets/${resetTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reset" }),
      });
      setNotice({
        message: `Đã hoàn tác đơn của vé ${resetTarget.code}.`,
        tone: "success",
      });
      setResetTarget(null);
      refresh();
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không hoàn tác được đơn nước."),
        tone: "error",
      });
    } finally {
      setWorking(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setWorking(`delete:${deleteTarget.id}`);
    try {
      await adminFetch(`/api/admin/tickets/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setNotice({ message: `Đã xoá vé ${deleteTarget.code}.`, tone: "success" });
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      setNotice({ message: errorMessage(error, "Không xoá được vé."), tone: "error" });
    } finally {
      setWorking(null);
    }
  }

  const totalPages = Math.max(
    1,
    Math.ceil((list?.total ?? 0) / (list?.pageSize ?? PAGE_SIZE)),
  );
  const stats = overview?.stats;

  return (
    <div>
      <SectionTitle
        eyebrow="Vận hành · Khách & vé"
        title="Check-in & danh sách vé"
        description="Nhập danh sách khách, xác nhận check-in tại cửa và theo dõi vé đã đặt nước."
        actions={
          <>
            <Button onClick={refresh} loading={loading}>
              <RefreshCw className="size-4" />
              <span className="hidden sm:inline">Tải lại</span>
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Nhập danh sách
            </Button>
            <Button variant="primary" onClick={() => setEditor({ mode: "create" })}>
              <Plus className="size-4" />
              Thêm vé
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Tổng số vé"
          value={stats?.totalTickets ?? "—"}
          hint="Mã vé đã nhập"
          icon={TicketIcon}
          tone="coffee"
        />
        <StatCard
          label="Đã check-in"
          value={stats?.checkedIn ?? "—"}
          hint={stats ? `${percent(stats.checkedIn, stats.totalTickets)}% tổng vé` : undefined}
          icon={BadgeCheck}
          tone="sage"
        />
        <StatCard
          label="Đã đặt nước"
          value={stats?.ordered ?? "—"}
          hint={stats ? `${percent(stats.ordered, stats.totalTickets)}% tổng vé` : undefined}
          icon={Coffee}
          tone="terracotta"
        />
        <StatCard
          label="Đơn chờ làm"
          value={stats?.pendingOrders ?? "—"}
          hint={
            stats ? `${stats.doneOrders} xong · ${stats.deliveredOrders} đã giao` : undefined
          }
          icon={Clock3}
          tone="gold"
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line/70 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted/60" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm mã vé, tên khách, số điện thoại…"
              className="h-11 w-full rounded-xl border border-line bg-cream/40 pl-10 pr-10 text-sm outline-none transition placeholder:text-muted/50 focus:border-terracotta focus:bg-paper focus:ring-4 focus:ring-terracotta/10"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-cream-deep"
                aria-label="Xoá tìm kiếm"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="ticket-filter" className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Lọc
            </label>
            <select
              id="ticket-filter"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as TicketListFilter);
                setPage(1);
              }}
              className={`${fieldClass} w-full min-w-0 sm:w-52`}
            >
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && !list ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            Đang tải danh sách vé…
          </div>
        ) : (list?.items.length ?? 0) === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={TicketIcon}
              title={search ? "Không tìm thấy vé phù hợp" : "Chưa có vé nào"}
              description={
                search
                  ? "Thử từ khoá khác hoặc đổi bộ lọc."
                  : "Nhập danh sách từ Google Sheets hoặc thêm từng vé để bắt đầu."
              }
              action={
                <Button variant="primary" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet className="size-4" />
                  Nhập danh sách vé
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-line/60 bg-cream/50 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="px-5 py-2.5">Khách & mã vé</th>
                    <th className="px-4 py-2.5">Liên hệ / ghi chú</th>
                    <th className="px-4 py-2.5">Check-in</th>
                    <th className="px-4 py-2.5">Nước</th>
                    <th className="px-5 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y divide-line/60", loading && "opacity-60")}>
                  {list?.items.map((ticket) => (
                    <tr key={ticket.id} className="transition hover:bg-cream/30">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-xl",
                              ticket.orderedAt
                                ? "bg-sage-soft text-sage"
                                : ticket.checkedInAt
                                  ? "bg-gold-soft text-coffee"
                                  : "bg-cream text-muted",
                            )}
                          >
                            {ticket.orderedAt ? (
                              <Coffee className="size-4" />
                            ) : (
                              <TicketIcon className="size-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate font-bold text-ink">
                                {ticket.guestName}
                              </p>
                              {ticket.orderedAt && (
                                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[9px] font-bold uppercase text-sage">
                                  Đã dùng
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 font-mono text-[11px] font-bold tracking-wide text-terracotta">
                              {ticket.code}
                            </p>
                            <p className="mt-1 text-[10px] text-muted">
                              {formatDateTime(ticket.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-semibold text-coffee">
                          {ticket.phone || "Chưa có SĐT"}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
                          {ticket.note || "Không có ghi chú"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <CheckInButton
                          ticket={ticket}
                          working={working}
                          onToggle={() => void toggleCheckIn(ticket)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <OrderState ticket={ticket} />
                      </td>
                      <td className="px-5 py-3.5">
                        <RowActions
                          ticket={ticket}
                          working={working}
                          onReset={() => setResetTarget(ticket)}
                          onEdit={() => setEditor({ mode: "edit", ticket })}
                          onDelete={() => setDeleteTarget(ticket)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={cn("divide-y divide-line/60 lg:hidden", loading && "opacity-60")}>
              {list?.items.map((ticket) => (
                <div key={ticket.id} className="px-4 py-4 sm:px-5">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
                        ticket.orderedAt
                          ? "bg-sage-soft text-sage"
                          : "bg-cream text-muted",
                      )}
                    >
                      <TicketIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {ticket.guestName}
                      </p>
                      <p className="font-mono text-[11px] font-bold text-terracotta">
                        {ticket.code}
                      </p>
                      <p className="mt-1 text-[10px] text-muted">
                        {ticket.phone || "Chưa có SĐT"}
                        {ticket.note ? ` · ${ticket.note}` : ""}
                      </p>
                    </div>
                    <RowActions
                      ticket={ticket}
                      working={working}
                      onReset={() => setResetTarget(ticket)}
                      onEdit={() => setEditor({ mode: "edit", ticket })}
                      onDelete={() => setDeleteTarget(ticket)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 pl-12">
                    <CheckInButton
                      ticket={ticket}
                      working={working}
                      onToggle={() => void toggleCheckIn(ticket)}
                    />
                    <OrderState ticket={ticket} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-line/70 bg-cream/35 px-4 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="flex items-center gap-2">
            {loading && list && <Loader2 className="size-3.5 animate-spin" />}
            {list
              ? `${list.total.toLocaleString("vi-VN")} vé · Trang ${list.page}/${totalPages}`
              : "Đang tải…"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="size-3.5" />
              Trước
            </Button>
            <Button
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Sau
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <TicketDialog
        key={editor ? `${editor.mode}:${editor.mode === "edit" ? editor.ticket.id : "new"}` : "closed"}
        state={editor}
        onClose={() => setEditor(null)}
        onSaved={(message) => {
          setEditor(null);
          setNotice({ message, tone: "success" });
          refresh();
        }}
      />

      <ImportDialog
        key={importOpen ? "open" : "closed"}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => refresh()}
      />

      <ConfirmModal
        open={Boolean(resetTarget)}
        title="Hoàn tác đặt nước?"
        description={resetTarget ? `${resetTarget.guestName} · ${resetTarget.code}` : undefined}
        tone="warning"
        confirmLabel="Hoàn tác"
        busy={working !== null}
        onConfirm={() => void confirmReset()}
        onClose={() => {
          if (!working) setResetTarget(null);
        }}
      >
        <div className="space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Món của vé này sẽ được gỡ khỏi đơn hiện tại để khách có thể đặt lại.
            Nếu đơn chỉ còn món này, toàn bộ đơn sẽ bị xoá.
          </p>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Chỉ dùng khi thao tác nhầm. Khách có thể đã thấy đơn này.
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xoá vé này?"
        description={deleteTarget ? `${deleteTarget.guestName} · ${deleteTarget.code}` : undefined}
        tone="danger"
        confirmLabel="Xoá vé"
        busy={working !== null}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!working) setDeleteTarget(null);
        }}
      >
        <p className="text-sm leading-relaxed text-muted">
          Thông tin vé sẽ bị xoá vĩnh viễn. Đơn nước đã ghi nhận trước đó vẫn giữ
          lại trong lịch sử.
        </p>
      </ConfirmModal>

      <Toast message={notice?.message ?? null} tone={notice?.tone} onClose={() => setNotice(null)} />
    </div>
  );
}

function CheckInButton({
  ticket,
  working,
  onToggle,
}: {
  ticket: Ticket;
  working: string | null;
  onToggle: () => void;
}) {
  const busy = working === `checkin:${ticket.id}`;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        disabled={working !== null}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset transition disabled:opacity-60",
          ticket.checkedInAt
            ? "bg-sage-soft text-sage ring-sage/20 hover:bg-sage/15"
            : "bg-cream text-muted ring-line hover:bg-gold-soft hover:text-coffee",
        )}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : ticket.checkedInAt ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <Circle className="size-3.5" />
        )}
        {ticket.checkedInAt ? "Đã check-in" : "Check-in"}
      </button>
      <p className="mt-1 text-[10px] text-muted">
        {ticket.checkedInAt ? formatTime(ticket.checkedInAt) : "Chưa xác nhận"}
      </p>
    </div>
  );
}

function OrderState({ ticket }: { ticket: Ticket }) {
  if (!ticket.orderedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold uppercase text-muted ring-1 ring-inset ring-line">
        <Circle className="size-3" />
        Chưa đặt
      </span>
    );
  }
  return (
    <div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-bold uppercase text-sage ring-1 ring-inset ring-sage/20">
        <Coffee className="size-3" />
        Đã đặt
      </span>
      <p className="mt-1 text-[10px] text-muted">{formatTime(ticket.orderedAt)}</p>
    </div>
  );
}

function RowActions({
  ticket,
  working,
  onReset,
  onEdit,
  onDelete,
}: {
  ticket: Ticket;
  working: string | null;
  onReset: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const iconButton =
    "grid size-8 place-items-center rounded-lg border border-line bg-paper text-muted transition hover:border-coffee/20 hover:text-coffee disabled:opacity-50";
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={onEdit} disabled={working !== null} className={iconButton} title="Sửa thông tin vé">
        <Pencil className="size-3.5" />
      </button>
      {ticket.orderedAt && (
        <button
          type="button"
          onClick={onReset}
          disabled={working !== null}
          className={cn(iconButton, "text-amber-700 hover:border-amber-300 hover:bg-amber-50")}
          title="Hoàn tác đặt nước"
        >
          {working === `reset:${ticket.id}` ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RotateCcw className="size-3.5" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={working !== null || Boolean(ticket.orderedAt)}
        className={cn(iconButton, "hover:border-red-200 hover:bg-red-50 hover:text-red-600")}
        title={
          ticket.orderedAt
            ? "Hoàn tác đơn nước trước khi xoá vé"
            : "Xoá vé"
        }
      >
        {working === `delete:${ticket.id}` ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  children,
  tone,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  tone: "warning" | "danger";
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      {children}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onClose} disabled={busy}>
          Giữ nguyên
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={busy}
          className={tone === "warning" ? "bg-amber-600 hover:bg-amber-700" : undefined}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

function TicketDialog({
  state,
  onClose,
  onSaved,
}: {
  state: EditorState;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const ticket = state?.mode === "edit" ? state.ticket : null;
  const [code, setCode] = useState(ticket?.code ?? "");
  const [guestName, setGuestName] = useState(ticket?.guestName ?? "");
  const [phone, setPhone] = useState(ticket?.phone ?? "");
  const [note, setNote] = useState(ticket?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (ticket) {
        await adminFetch(`/api/admin/tickets/${ticket.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "update", code, guestName, phone, note }),
        });
        onSaved(`Đã cập nhật vé ${code.trim().toUpperCase()}.`);
      } else {
        await adminFetch("/api/admin/tickets", {
          method: "POST",
          body: JSON.stringify({ code, guestName, phone, note }),
        });
        onSaved(`Đã thêm vé ${code.trim().toUpperCase()}.`);
      }
    } catch (saveError) {
      setError(errorMessage(saveError, "Không lưu được thông tin vé."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={state !== null}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={ticket ? "Sửa thông tin vé" : "Thêm vé mới"}
      description={
        ticket
          ? "Có thể chỉnh thông tin khách kể cả khi vé đã được dùng."
          : "Tạo mã vé để khách dùng khi đặt nước."
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="ticket-editor-form"
            disabled={saving || !code.trim() || !guestName.trim()}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {ticket ? "Lưu thay đổi" : "Thêm vé"}
          </Button>
        </div>
      }
    >
      <form id="ticket-editor-form" onSubmit={(event) => void submit(event)} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}
        <Field
          label="Mã vé"
          htmlFor="ticket-editor-code"
          hint="3–32 ký tự: chữ, số, dấu chấm, gạch ngang hoặc gạch dưới."
        >
          <input
            id="ticket-editor-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="VE-A1B2"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            className={cn(fieldClass, "font-mono font-bold tracking-wider")}
            required
          />
        </Field>
        <Field label="Tên khách" htmlFor="ticket-editor-name">
          <input
            id="ticket-editor-name"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="Nguyễn Minh Anh"
            maxLength={80}
            className={fieldClass}
            required
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số điện thoại" htmlFor="ticket-editor-phone">
            <input
              id="ticket-editor-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0901 234 567"
              maxLength={30}
              className={fieldClass}
            />
          </Field>
          <Field label="Ghi chú" htmlFor="ticket-editor-note">
            <input
              id="ticket-editor-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Khách mời, bàn VIP…"
              maxLength={160}
              className={fieldClass}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResponse | null>(null);

  const preview = useMemo(() => (text.trim() ? parseTicketSheet(text) : null), [text]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const data = await adminFetch<BulkResponse>("/api/admin/tickets/bulk", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setResult(data);
      setText("");
      onImported();
    } catch (importError) {
      const payload =
        importError instanceof ApiClientError ? importError.payload : null;
      const warnings =
        payload && Array.isArray(payload.errors)
          ? (payload.errors as string[]).slice(0, 5)
          : [];
      setError(
        [errorMessage(importError, "Không nhập được danh sách vé."), ...warnings].join(
          " · ",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function downloadSample() {
    const csv = SAMPLE_SHEET.replace(/\t/g, ",");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mau-danh-sach-ve.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Nhập danh sách vé"
      description="Dán trực tiếp từ Google Sheets hoặc dùng dữ liệu CSV / TSV."
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={downloadSample}>
            <Download className="size-4" />
            Tải tệp mẫu
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button onClick={onClose} disabled={saving}>
              {result ? "Đóng" : "Huỷ"}
            </Button>
            {!result && (
              <Button
                variant="primary"
                onClick={() => void submit()}
                disabled={saving || !text.trim() || !preview?.rows.length}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Nhập {preview?.rows.length ?? ""} vé
              </Button>
            )}
          </div>
        </div>
      }
    >
      {result ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="flex items-start gap-2 text-sm font-bold">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            Đã nhập danh sách vé
          </p>
          <p className="mt-2 text-xs leading-relaxed">
            Thêm mới <strong>{result.inserted}</strong> vé · Cập nhật{" "}
            <strong>{result.updated}</strong> vé · Bỏ qua{" "}
            <strong>{result.skipped}</strong> dòng.
          </p>
          {result.errors && result.errors.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-xl bg-paper/60 p-3 text-[11px]">
              {result.errors.slice(0, 6).map((message, index) => (
                <li key={index} className="list-inside list-disc">
                  {message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-2xl border border-line bg-cream/50 p-3.5 text-xs leading-relaxed text-coffee">
            <Info className="mt-0.5 size-4 shrink-0 text-terracotta" />
            <div>
              <p className="font-bold">Cách dán từ Google Sheets</p>
              <p className="mt-1 text-muted">
                Chọn 4 cột <strong>Mã vé, Tên khách, SĐT, Ghi chú</strong>, sao chép
                rồi dán bên dưới. Dòng tiêu đề có thể có hoặc không. Mã vé đã tồn
                tại sẽ được cập nhật, không mất trạng thái check-in hay đơn nước.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="bulk-text" className="mb-0 text-[11px] font-bold uppercase tracking-[0.08em] text-coffee">
                Dữ liệu dán vào
              </label>
              <button
                type="button"
                onClick={() => setText(SAMPLE_SHEET)}
                className="text-[10px] font-bold text-terracotta hover:underline"
              >
                Dùng dữ liệu mẫu
              </button>
            </div>
            <textarea
              id="bulk-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={SAMPLE_SHEET}
              rows={9}
              spellCheck={false}
              className={cn(textareaClass, "font-mono text-xs placeholder:font-sans")}
            />
          </div>

          {preview && (
            <div className="rounded-xl border border-line bg-cream/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-coffee">
                  {preview.rows.length} dòng hợp lệ
                </span>
                {preview.errors.length > 0 && (
                  <span className="text-amber-700">
                    {preview.errors.length} cảnh báo
                  </span>
                )}
              </div>
              {preview.errors.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {preview.errors.slice(0, 4).map((message, index) => (
                    <li key={index}>• {message}</li>
                  ))}
                  {preview.errors.length > 4 && (
                    <li>• …và {preview.errors.length - 4} cảnh báo khác</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Armchair,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coffee,
  Copy,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast } from "@/components/Toast";
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatCard,
} from "@/components/admin/AdminUi";
import { adminFetch, errorMessage } from "@/lib/admin-client";
import type { OverviewData } from "@/lib/admin-types";
import { cn, formatDateTime, formatTime, shortId, STATUS_LABEL } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

type OrdersResponse = { ok: true; orders: Order[] };
type Filter = "all" | OrderStatus;
type Notice = { message: string; tone: "success" | "error" | "info" };

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "new", label: "Chờ làm" },
  { value: "done", label: "Đã xong" },
  { value: "delivered", label: "Đã giao" },
];

const REFRESH_MS = 15_000;

export function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await adminFetch<OrdersResponse>("/api/admin/orders");
      setOrders(data.orders);
      setLastUpdated(new Date());
    } catch (error) {
      if (!quiet) {
        setNotice({
          message: errorMessage(error, "Không tải được danh sách đơn."),
          tone: "error",
        });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await adminFetch<OverviewData>("/api/admin/overview"));
      setOverviewFailed(false);
    } catch {
      setOverviewFailed(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([load(), loadOverview()]);
    })();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, loadOverview, revision]);

  async function updateStatus(order: Order, status: "done" | "delivered") {
    setWorking(order.id);
    try {
      const data = await adminFetch<{ ok: true; order: Order }>(
        `/api/admin/orders/${order.id}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setOrders((current) =>
        current.map((row) => (row.id === data.order.id ? data.order : row)),
      );
      setNotice({
        message:
          status === "done"
            ? `Đơn #${shortId(order.id)} đã xong món.`
            : `Đơn #${shortId(order.id)} đã được giao.`,
        tone: "success",
      });
      window.setTimeout(() => void load(true), 1200);
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không cập nhật được trạng thái đơn."),
        tone: "error",
      });
      void load(true);
    } finally {
      setWorking(null);
    }
  }

  async function copyGuestLink(order: Order) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/order/${order.guestToken}`,
      );
      setCopiedId(order.id);
      setNotice({
        message: `Đã sao chép link theo dõi của ${order.guestName}.`,
        tone: "success",
      });
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setNotice({
        message: "Trình duyệt không cho phép sao chép.",
        tone: "error",
      });
    }
  }

  const counts = useMemo(
    () => ({
      all: orders.length,
      new: orders.filter((order) => order.status === "new").length,
      done: orders.filter((order) => order.status === "done").length,
      delivered: orders.filter((order) => order.status === "delivered").length,
    }),
    [orders],
  );

  const visible = useMemo(() => {
    const needle = search.toLocaleLowerCase("vi");
    return orders
      .filter((order) => filter === "all" || order.status === filter)
      .filter((order) => {
        if (!needle) return true;
        return [
          order.guestName,
          order.seat,
          shortId(order.id),
          ...order.items.map((item) => `${item.itemName} ${item.ticketCode}`),
        ]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(needle);
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, filter, search]);

  const zaloReady = Boolean(
    overview?.integrations.zalo.tokenConfigured && overview.integrations.zalo.chatId,
  );
  const zaloChecked = Boolean(overview) || overviewFailed;

  return (
    <div>
      <SectionTitle
        eyebrow="Vận hành · Pha chế & giao nước"
        title="Đơn nước"
        description="Đơn mới nhất hiện trước. Đánh dấu xong món rồi mới giao. Trang tự làm mới mỗi 15 giây."
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-2 text-[10px] font-semibold text-muted sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-sage" />
              {lastUpdated
                ? `Cập nhật ${formatTime(lastUpdated.toISOString())}`
                : "Đang kết nối…"}
            </span>
            <Button onClick={() => setRevision((value) => value + 1)} loading={loading}>
              <RefreshCw className="size-4" />
              Tải lại
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Tổng đơn" value={counts.all} hint="Toàn bộ đêm nhạc" icon={ClipboardList} tone="coffee" />
        <StatCard label="Chờ làm món" value={counts.new} hint="Cần pha chế" icon={Clock3} tone="gold" />
        <StatCard label="Đã xong món" value={counts.done} hint="Chờ giao" icon={Coffee} tone="terracotta" />
        <StatCard label="Đã giao" value={counts.delivered} hint="Hoàn tất" icon={Truck} tone="sage" />
      </div>

      {overviewFailed ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <MessageCircle className="mt-0.5 size-4 shrink-0" />
          Không kiểm tra được kết nối Zalo. Đơn mới vẫn hoạt động bình thường.
        </div>
      ) : !zaloChecked ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line/70 bg-paper/60 px-4 py-3 text-xs text-muted">
          <Loader2 className="size-4 animate-spin text-terracotta" />
          Đang kiểm tra kết nối Zalo…
        </div>
      ) : !zaloReady ? (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 leading-relaxed">
            <MessageCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Zalo chưa kết nối.</strong> Đơn vẫn hoạt động nhưng nhóm nhân
              sự sẽ không nhận tin nhắn tự động.
            </span>
          </p>
          <Link
            href="/admin/connect"
            className="shrink-0 self-start rounded-full bg-amber-900 px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-coffee sm:self-auto"
          >
            Kết nối Zalo
          </Link>
        </div>
      ) : null}

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line/70 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted/60" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm tên khách, chỗ ngồi, món, mã đơn…"
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
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                  filter === option.value
                    ? "bg-coffee text-cream"
                    : "bg-cream/80 text-muted hover:bg-cream-deep hover:text-ink",
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[9px]",
                    filter === option.value
                      ? "bg-white/15 text-cream/80"
                      : "bg-paper text-muted/70",
                  )}
                >
                  {counts[option.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading && orders.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" />
              Đang tải đơn nước…
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={orders.length === 0 ? "Chưa có đơn nước nào" : "Không có đơn phù hợp"}
              description={
                orders.length === 0
                  ? "Khi khách gửi đơn, nội dung sẽ xuất hiện tại đây và trong nhóm Zalo nhân sự."
                  : "Thử từ khoá hoặc trạng thái khác."
              }
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              {visible.map((order) => {
                const isDone = order.status !== "new";
                const isDelivered = order.status === "delivered";
                const busy = working === order.id;
                return (
                  <article
                    key={order.id}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border bg-paper transition",
                      order.status === "new" && "border-amber-200/80 shadow-[0_18px_42px_-36px_rgba(180,83,9,0.55)]",
                      order.status === "done" && "border-sky-200/80",
                      order.status === "delivered" && "border-line/80 opacity-80",
                    )}
                  >
                    <div
                      className={cn(
                        "h-1",
                        order.status === "new" && "bg-amber-400",
                        order.status === "done" && "bg-sky-400",
                        order.status === "delivered" && "bg-sage",
                      )}
                    />
                    <div className="p-3.5 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-ink">
                            #{shortId(order.id)}
                          </span>
                          <span className="text-[10px] text-muted">
                            {formatTime(order.createdAt)}
                          </span>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h2 className="min-w-0 truncate font-display text-xl font-semibold leading-tight text-ink">
                          {order.guestName}
                        </h2>
                        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-coffee ring-1 ring-line">
                          <Armchair className="size-3 text-terracotta" />
                          {order.seat}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                          <UserRound className="size-3" />
                          {order.items.length} vé
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5 rounded-xl border border-line/70 bg-cream/40 p-2.5">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <p className="min-w-0 truncate font-semibold text-ink">
                              {item.quantity > 1 ? `${item.quantity}× ` : ""}
                              {item.itemName}
                            </p>
                            <span className="shrink-0 font-mono text-[9px] text-muted">
                              {item.ticketCode}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void updateStatus(order, "done")}
                          disabled={isDone || busy}
                          title={STATUS_LABEL.done}
                          className={cn(
                            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition",
                            !isDone
                              ? "bg-ink text-cream hover:bg-coffee"
                              : "bg-sky-50 text-sky-700",
                          )}
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          {isDone ? "Đã xong món" : "Xong món"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateStatus(order, "delivered")}
                          disabled={!isDone || isDelivered || busy}
                          className={cn(
                            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition",
                            isDone && !isDelivered
                              ? "bg-sage text-white hover:bg-sage/90"
                              : isDelivered
                                ? "bg-sage-soft text-sage"
                                : "cursor-not-allowed bg-cream text-muted/60",
                          )}
                        >
                          <Truck className="size-3.5" />
                          {isDelivered ? "Đã giao" : "Giao món"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyGuestLink(order)}
                          className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-terracotta/30 hover:text-terracotta"
                          title="Sao chép link theo dõi của khách"
                        >
                          {copiedId === order.id ? (
                            <CheckCircle2 className="size-3.5 text-sage" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>

                      <p className="mt-2 text-[9px] text-muted">
                        Tạo lúc {formatDateTime(order.createdAt)}
                        {order.doneAt ? ` · Xong ${formatTime(order.doneAt)}` : ""}
                        {order.deliveredAt ? ` · Giao ${formatTime(order.deliveredAt)}` : ""}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Toast message={notice?.message ?? null} tone={notice?.tone} onClose={() => setNotice(null)} />
    </div>
  );
}

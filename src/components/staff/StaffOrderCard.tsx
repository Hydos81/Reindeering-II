"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast } from "@/components/Toast";
import type { NoticeTone } from "@/components/Toast";
import { ApiClientError, apiFetch } from "@/lib/client";
import { cn, formatTime, shortId } from "@/lib/format";
import type { PublicOrder } from "@/lib/public-order";
import type { OrderStatus } from "@/lib/types";

type StaffAction = Extract<OrderStatus, "done" | "delivered">;
type Notice = { message: string; tone: NoticeTone };

export function StaffOrderCard({
  token,
  orderId,
  initialOrder,
}: {
  token: string;
  orderId: string;
  initialOrder?: PublicOrder;
}) {
  const [order, setOrder] = useState<PublicOrder | null>(initialOrder ?? null);
  const [loading, setLoading] = useState(!initialOrder);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [working, setWorking] = useState<StaffAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const busy = useRef(false);
  const autoDone = useRef(false);
  const urlAction = useRef<StaffAction | null>(null);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      else setLoadingFresh(true);
      try {
        const data = await apiFetch<{ ok: true; order: PublicOrder }>(
          `/api/staff/order/${encodeURIComponent(orderId)}?t=${encodeURIComponent(token)}`,
        );
        setOrder(data.order);
        setLoadError(null);
      } catch (error) {
        setLoadError(
          error instanceof ApiClientError
            ? error.message
            : "Không tải được đơn nước. Vui lòng thử lại.",
        );
      } finally {
        setLoading(false);
        setLoadingFresh(false);
      }
    },
    [orderId, token],
  );

  useEffect(() => {
    // Mount-time fetch; the async loader updates state after the effect returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!initialOrder) void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [initialOrder, refresh]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("action");
    if (requested === "done" || requested === "delivered") {
      urlAction.current = requested;
    }
  }, []);

  const updateStatus = useCallback(
    async (status: StaffAction) => {
      if (busy.current) return false;
      busy.current = true;
      setWorking(status);
      setActionError(null);
      try {
        const data = await apiFetch<{ ok: true; order: PublicOrder }>(
          `/api/staff/order/${encodeURIComponent(orderId)}/status`,
          {
            method: "POST",
            body: JSON.stringify({ token, status }),
          },
        );
        setOrder(data.order);
        setHint(null);
        setNotice({
          message:
            status === "done"
              ? "Đã xong món. Giờ có thể giao cho khách."
              : "Đã giao món. Đơn đã hoàn tất!",
          tone: "success",
        });
        return true;
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : "Không cập nhật được trạng thái. Vui lòng thử lại.";
        setActionError(message);
        setNotice({ message, tone: "error" });
        return false;
      } finally {
        busy.current = false;
        setWorking(null);
      }
    },
    [orderId, token],
  );

  // A link from a notification can carry ?action=done|delivered: perform it
  // once, only if the order's current status actually allows it.
  useEffect(() => {
    if (autoDone.current || !order || loading) return;
    const requested = urlAction.current;
    if (!requested) return;

    const allowed =
      requested === "done" ? order.status === "new" : order.status === "done";
    autoDone.current = true;

    if (allowed) {
      void updateStatus(requested);
    } else if (requested === "delivered" && order.status === "new") {
      setHint("Đơn này chưa được đánh dấu xong món. Bạn xong món trước rồi giao nhé.");
    }
  }, [order, loading, updateStatus]);

  if (loading && !order) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="flex flex-col items-center gap-4 text-muted">
          <span className="grid size-14 place-items-center rounded-full border border-line bg-paper shadow-sm">
            <Loader2 className="size-6 animate-spin text-terracotta" />
          </span>
          <p className="text-sm font-medium">Đang tải thẻ đơn nước…</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
        <div className="card-warm rounded-[2rem] p-7 text-center">
          <div className="flex justify-center">
            <Brand compact />
          </div>
          <h1 className="mt-8 font-display text-3xl font-semibold text-ink">
            Không tải được đơn
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {loadError ?? "Đơn có thể đã bị xoá hoặc liên kết đã hết hạn."}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-cream"
          >
            <RefreshCw className="size-4" />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const finished = order.status !== "new";
  const delivered = order.status === "delivered";

  return (
    <div className="min-h-dvh pb-10">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Brand compact />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/20 bg-sage-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-sage">
          <ShieldCheck className="size-3.5" />
          Trang nhân sự
        </span>
      </header>

      <main className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="fade-up mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-terracotta">
              Thẻ đơn nước
            </p>
            <h1 className="mt-1 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              #{shortId(order.id)}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Nhận lúc {formatTime(order.createdAt)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="fade-up fade-up-delay-1 card-warm overflow-hidden rounded-[2rem]">
          <div className="grid gap-5 p-5 sm:grid-cols-[1.15fr_0.85fr] sm:p-7">
            <div>
              <div className="rounded-2xl bg-cream/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                  Khách & chỗ ngồi
                </p>
                <p className="mt-1.5 font-display text-2xl font-semibold leading-tight text-ink">
                  {order.guestName}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 font-semibold text-coffee ring-1 ring-line">
                    <UtensilsCrossed className="size-3.5 text-terracotta" />
                    {order.seat}
                  </span>
                  <span>
                    {order.items.length} món · {order.items.length} vé
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  <Coffee className="size-3.5 text-terracotta" />
                  Đồ uống cần làm
                </div>
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-2xl border border-line/80 bg-paper p-3"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-coffee text-[11px] font-bold text-cream">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-tight text-ink">
                          {item.itemName}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted">
                          Vé {item.ticketCode}
                        </p>
                      </div>
                      <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-line">
                        ×{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-line/80 bg-cream/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                  Tiến độ
                </p>
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sage text-white">
                      <Check className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-ink">Đã nhận đơn</p>
                      <p className="text-[10px] text-muted">{formatTime(order.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full",
                        finished ? "bg-sage text-white" : "bg-line text-muted",
                      )}
                    >
                      {finished ? <Check className="size-3.5" /> : <Clock3 className="size-3.5" />}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-ink">Xong món</p>
                      <p className="text-[10px] text-muted">
                        {order.doneAt ? formatTime(order.doneAt) : "Chưa đánh dấu"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full",
                        delivered ? "bg-sage text-white" : "bg-line text-muted",
                      )}
                    >
                      {delivered ? <Truck className="size-3.5" /> : <Clock3 className="size-3.5" />}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-ink">Đã giao món</p>
                      <p className="text-[10px] text-muted">
                        {order.deliveredAt ? formatTime(order.deliveredAt) : "Chưa giao"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {(hint || actionError) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  {actionError || hint}
                </div>
              )}

              {delivered && (
                <div className="flex items-start gap-2 rounded-xl border border-sage/25 bg-sage-soft px-3 py-2 text-xs text-sage">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  Đơn đã hoàn tất. Cảm ơn bạn đã phục vụ!
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void updateStatus("done")}
                  disabled={finished || Boolean(working)}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition",
                    !finished
                      ? "bg-ink text-cream hover:bg-coffee"
                      : "cursor-not-allowed bg-sage-soft text-sage",
                  )}
                >
                  {working === "done" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : finished ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Coffee className="size-4" />
                  )}
                  Đã xong món
                </button>
                <button
                  type="button"
                  onClick={() => void updateStatus("delivered")}
                  disabled={!finished || delivered || Boolean(working)}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition",
                    finished && !delivered
                      ? "bg-sage text-white hover:bg-sage/90"
                      : "cursor-not-allowed bg-line text-muted",
                  )}
                >
                  {working === "delivered" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : delivered ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Truck className="size-4" />
                  )}
                  Đã giao món
                </button>
                {!finished && (
                  <p className="px-1 text-[10px] leading-relaxed text-muted">
                    Cần đánh dấu “Đã xong món” trước khi giao cho khách.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line/70 bg-cream/40 px-5 py-3 text-[10px] leading-relaxed text-muted sm:px-7">
            <span>Chỉ chia sẻ liên kết này trong nhóm nhân sự. Tự cập nhật mỗi 6 giây.</span>
            <button
              type="button"
              onClick={() => void refresh(true)}
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-coffee hover:text-terracotta"
            >
              <RefreshCw className={cn("size-3", loadingFresh && "animate-spin")} />
              Làm mới
            </button>
          </div>
        </div>
      </main>

      <Toast
        message={notice?.message ?? null}
        tone={notice?.tone}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}

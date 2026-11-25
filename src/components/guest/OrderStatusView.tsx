"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  Coffee,
  Loader2,
  RefreshCw,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/Brand";
import { DrinkArt } from "@/components/DrinkArt";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/client";
import { STATUS_DOT, STATUS_LABEL, cn, formatDateTime, formatTime, shortId } from "@/lib/format";
import type { PublicOrder } from "@/lib/public-order";
import type { OrderStatus } from "@/lib/types";

const STEPS: Array<{ status: OrderStatus; note: string; icon: LucideIcon }> = [
  { status: "new", note: "Đơn đã tới quầy", icon: Clock3 },
  { status: "done", note: "Nước đã sẵn sàng", icon: Coffee },
  { status: "delivered", note: "Đã tới bàn của bạn", icon: Truck },
];

export function OrderStatusView({ token }: { token: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await apiFetch<{ ok: true; order: PublicOrder }>(
          `/api/guest/orders/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        setOrder(data.order);
        setError(null);
        setUpdatedAt(new Date());
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Không tải được trạng thái đơn.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    // Mount-time fetch; the async loader updates state after the effect returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 8000);
    return () => window.clearInterval(poll);
  }, [load]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="flex flex-col items-center gap-4 text-muted">
          <span className="grid size-14 place-items-center rounded-full border border-line bg-paper shadow-sm">
            <Loader2 className="size-6 animate-spin text-terracotta" />
          </span>
          <p className="text-sm font-medium">Đang tải đơn nước của bạn…</p>
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
          <div className="mx-auto mt-8 grid size-14 place-items-center rounded-full bg-red-50 text-red-600">
            <Coffee className="size-6" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
            Không tìm thấy đơn
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {error || "Liên kết theo dõi không hợp lệ hoặc đơn đã bị xoá."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-cream"
          >
            <ArrowLeft className="size-4" />
            Về trang đặt nước
          </Link>
        </div>
      </div>
    );
  }

  const stage = Math.max(
    0,
    STEPS.findIndex((step) => step.status === order.status),
  );

  return (
    <div className="min-h-dvh pb-12">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Brand compact />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Trang đặt nước
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-5 sm:px-8">
        <div className="fade-up mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-terracotta">
              Theo dõi đơn nước
            </p>
            <h1 className="mt-1.5 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Đơn #{shortId(order.id)}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {order.guestName} · {order.seat} · {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            <button
              type="button"
              onClick={() => void load(true)}
              aria-label="Làm mới trạng thái"
              className="grid size-9 place-items-center rounded-full border border-line bg-paper text-muted transition hover:text-ink"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            {error} · Trang sẽ tự thử lại.
          </div>
        )}

        <div className="fade-up fade-up-delay-1 card-warm overflow-hidden rounded-[2rem]">
          <div className="border-b border-line/70 bg-cream/40 px-5 py-7 sm:px-7">
            <div className="relative">
              <div className="absolute left-5 right-5 top-5 h-1 rounded-full bg-line sm:left-9 sm:right-9" />
              <div
                className="absolute left-5 top-5 h-1 rounded-full bg-sage transition-all duration-500 sm:left-9"
                style={{
                  width: `calc((100% - 2.5rem) * ${stage / (STEPS.length - 1)})`,
                }}
              />
              <ol className="relative grid grid-cols-3 gap-2">
                {STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const done = index < stage;
                  const current = index === stage;
                  return (
                    <li
                      key={step.status}
                      className="flex flex-col items-center text-center"
                      aria-current={current ? "step" : undefined}
                    >
                      <span
                        className={cn(
                          "grid size-11 place-items-center rounded-full border-2 bg-paper transition",
                          done && "border-sage bg-sage text-white",
                          current &&
                            "border-terracotta text-terracotta ring-4 ring-terracotta/10",
                          !done && !current && "border-line text-muted/50",
                        )}
                      >
                        {done ? <Check className="size-5" /> : <StepIcon className="size-5" />}
                      </span>
                      <span
                        className={cn(
                          "mt-2 text-[11px] font-bold leading-tight sm:text-xs",
                          current || done ? "text-ink" : "text-muted",
                        )}
                      >
                        {STATUS_LABEL[step.status]}
                      </span>
                      <span className="mt-0.5 hidden text-[10px] leading-tight text-muted sm:block">
                        {step.note}
                      </span>
                      <span
                        className={cn(
                          "mt-1 size-1.5 rounded-full sm:hidden",
                          current ? STATUS_DOT[step.status] : "bg-transparent",
                        )}
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:grid-cols-[1.1fr_0.9fr] sm:p-7">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                <UtensilsCrossed className="size-3.5 text-terracotta" />
                Món đã đặt
              </div>
              <div className="mt-3 space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-line/80 bg-paper p-3"
                  >
                    <DrinkArt
                      name={item.itemName}
                      compact
                      className="size-14 shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{item.itemName}</p>
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

            <div className="space-y-3">
              <div className="rounded-2xl border border-line/80 bg-cream/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                  Thông tin nhận nước
                </p>
                <dl className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Khách</dt>
                    <dd className="font-semibold text-ink">{order.guestName}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Chỗ ngồi</dt>
                    <dd className="font-semibold text-ink">{order.seat}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Tạo lúc</dt>
                    <dd className="font-semibold text-ink">{formatTime(order.createdAt)}</dd>
                  </div>
                  {order.doneAt && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted">Xong món</dt>
                      <dd className="font-semibold text-ink">{formatTime(order.doneAt)}</dd>
                    </div>
                  )}
                  {order.deliveredAt && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted">Đã giao</dt>
                      <dd className="font-semibold text-sage">
                        {formatTime(order.deliveredAt)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-2xl border border-sage/20 bg-sage-soft/70 px-3.5 py-3 text-xs leading-relaxed text-sage">
                <p className="font-semibold">Bạn không cần làm gì thêm.</p>
                <p className="mt-1 text-sage/80">
                  Nhân sự sẽ mang nước tận bàn. Trang này tự cập nhật trạng thái.
                </p>
              </div>

              <p className="text-center text-[10px] text-muted">
                Cập nhật lúc {updatedAt ? formatTime(updatedAt.toISOString()) : "—"}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

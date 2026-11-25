"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coffee,
  Database,
  FileSpreadsheet,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  QrCode,
  RefreshCw,
  Ticket as TicketIcon,
  Truck,
} from "lucide-react";
import { Toast } from "@/components/Toast";
import {
  Badge,
  Button,
  Card,
  SectionTitle,
  StatCard,
} from "@/components/admin/AdminUi";
import { adminFetch, errorMessage } from "@/lib/admin-client";
import type { OverviewData } from "@/lib/admin-types";
import { cn } from "@/lib/format";

const SHORTCUTS = [
  {
    href: "/admin/tickets",
    label: "Khách & vé",
    detail: "Check-in và nhập danh sách khách",
    icon: TicketIcon,
  },
  {
    href: "/admin/orders",
    label: "Đơn nước",
    detail: "Xem đơn mới, xong món, giao món",
    icon: ClipboardList,
  },
  {
    href: "/admin/menu",
    label: "Thực đơn",
    detail: "Chỉnh món, ảnh và trạng thái bán",
    icon: Coffee,
  },
  {
    href: "/admin/qr",
    label: "Mã QR",
    detail: "Tạo và in mã QR cho từng vé",
    icon: QrCode,
  },
] as const;

function Meter({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "terracotta" | "sage";
}) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-coffee">
          {value}/{total} · {percent}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-deep">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            tone === "terracotta" ? "bg-terracotta" : "bg-sage",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminIndexPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminFetch<OverviewData>("/api/admin/overview");
      setData(result);
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không tải được dữ liệu tổng quan."),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount-time fetch: the async loader settles after this effect returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const stats = data?.stats;
  const integrations = data?.integrations;
  const zaloReady = Boolean(
    integrations?.zalo.tokenConfigured && integrations.zalo.chatId,
  );

  return (
    <div>
      <SectionTitle
        eyebrow="Bảng điều khiển · Tổng quan"
        title="Đêm nhạc đang diễn ra"
        description={data?.event.tagline ?? "Tổng hợp nhanh tình hình vé và đơn nước."}
        actions={
          <Button onClick={() => void load()} loading={loading}>
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Tổng vé"
          value={stats?.totalTickets ?? "—"}
          hint="Đã nhập vào hệ thống"
          icon={TicketIcon}
          tone="coffee"
        />
        <StatCard
          label="Đã check-in"
          value={stats?.checkedIn ?? "—"}
          hint="Khách đã đến cửa"
          icon={BadgeCheck}
          tone="sage"
        />
        <StatCard
          label="Đã đặt nước"
          value={stats?.ordered ?? "—"}
          hint="Vé đã dùng để đặt"
          icon={Coffee}
          tone="terracotta"
        />
        <StatCard
          label="Đơn chờ làm"
          value={stats?.pendingOrders ?? "—"}
          icon={ClipboardList}
          tone="gold"
        />
        <StatCard
          label="Đơn đã xong"
          value={stats?.doneOrders ?? "—"}
          hint="Chờ giao cho khách"
          icon={CheckCircle2}
          tone="coffee"
        />
        <StatCard
          label="Đơn đã giao"
          value={stats?.deliveredOrders ?? "—"}
          hint="Hoàn tất"
          icon={Truck}
          tone="sage"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-start gap-3 border-b border-line/70 pb-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-terracotta/10 text-terracotta">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-terracotta">
                Sự kiện
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">
                {loading && !data ? "Đang tải…" : data?.event.name}
              </h2>
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                {data?.event.venue}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <Meter
              label="Vé đã check-in"
              value={stats?.checkedIn ?? 0}
              total={stats?.totalTickets ?? 0}
              tone="sage"
            />
            <Meter
              label="Vé đã đặt nước"
              value={stats?.ordered ?? 0}
              total={stats?.totalTickets ?? 0}
              tone="terracotta"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-line/70 pt-4">
            <Link
              href="/admin/tickets"
              className="inline-flex items-center gap-1.5 rounded-full bg-coffee px-3.5 py-2 text-[11px] font-bold text-cream transition hover:bg-ink"
            >
              Quản lý vé
              <ArrowUpRight className="size-3.5" />
            </Link>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-[11px] font-bold text-coffee transition hover:border-terracotta/30 hover:text-terracotta"
            >
              Xem đơn nước
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3 border-b border-line/70 pb-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-coffee">
              <Link2 className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-terracotta">
                Kết nối
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">
                Trạng thái tích hợp
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-cream/40 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-coffee">
                <MessageCircle className="size-4 text-terracotta" />
                Zalo Bot
              </span>
              <Badge tone={zaloReady ? "sage" : "gold"}>
                {zaloReady ? "Sẵn sàng" : "Chưa kết nối"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-cream/40 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-coffee">
                <FileSpreadsheet className="size-4 text-sage" />
                Google Sheets
              </span>
              <Badge tone={integrations?.sheets.secretConfigured ? "sage" : "gold"}>
                {integrations?.sheets.secretConfigured ? "Sẵn sàng" : "Chưa cấu hình"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-cream/40 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-coffee">
                <Database className="size-4 text-gold" />
                Lưu trữ ảnh
              </span>
              <Badge tone={integrations?.storage.supabaseConfigured ? "sage" : "neutral"}>
                {integrations?.storage.supabaseConfigured
                  ? "Supabase"
                  : "Máy chủ"}
              </Badge>
            </div>
          </div>

          <Link
            href="/admin/connect"
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-terracotta hover:underline"
          >
            Xem chi tiết kết nối
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Card>
      </div>

      <Card className="mt-4" padded={false}>
        <div className="border-b border-line/70 px-4 py-4 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-terracotta">
            Truy cập nhanh
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
            Công việc hằng ngày
          </h2>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
          {SHORTCUTS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-2xl border border-line/80 bg-cream/30 p-3.5 transition hover:-translate-y-0.5 hover:border-terracotta/30 hover:bg-paper"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-terracotta ring-1 ring-line transition group-hover:bg-terracotta group-hover:text-cream">
                <item.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{item.label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-muted">
                  {item.detail}
                </span>
              </span>
              <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted transition group-hover:text-terracotta" />
            </Link>
          ))}
        </div>
      </Card>

      {loading && !data && (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
          <Loader2 className="size-4 animate-spin" />
          Đang cập nhật số liệu…
        </p>
      )}

      <Toast
        message={notice?.message ?? null}
        tone={notice?.tone}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}

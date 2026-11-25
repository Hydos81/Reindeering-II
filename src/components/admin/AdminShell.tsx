"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Coffee,
  ExternalLink,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Menu,
  QrCode,
  Ticket,
  X,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { apiFetch } from "@/lib/client";
import { EVENT_NAME } from "@/lib/config";
import { cn } from "@/lib/format";

const NAV = [
  {
    href: "/admin",
    label: "Tổng quan",
    description: "Tình hình đêm nhạc",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/tickets",
    label: "Khách & vé",
    description: "Check-in, nhập vé",
    icon: Ticket,
  },
  {
    href: "/admin/menu",
    label: "Thực đơn",
    description: "Món và nhóm món",
    icon: Coffee,
  },
  {
    href: "/admin/orders",
    label: "Đơn nước",
    description: "Theo dõi pha chế",
    icon: ClipboardList,
  },
  {
    href: "/admin/qr",
    label: "Mã QR",
    description: "Tạo và in mã vé",
    icon: QrCode,
  },
  {
    href: "/admin/connect",
    label: "Kết nối",
    description: "Zalo & Google Sheets",
    icon: Link2,
  },
] as const;

type SideContentProps = {
  pathname: string;
  loggingOut: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
  drawer?: boolean;
};

function SideContent({
  pathname,
  loggingOut,
  onLogout,
  onNavigate,
  drawer = false,
}: SideContentProps) {
  const close = () => onNavigate?.();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <Link href="/admin" onClick={close} className="min-w-0">
          <Brand light compact />
          <span className="mt-2 block truncate text-[10px] font-bold uppercase tracking-[0.2em] text-gold/75">
            Bảng điều khiển
          </span>
        </Link>
        {drawer && (
          <button
            type="button"
            onClick={close}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-cream"
            aria-label="Đóng menu"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mx-5 mt-6 h-px bg-white/10" />

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition",
                active
                  ? "bg-white/[0.12] text-cream shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)]"
                  : "text-cream/60 hover:bg-white/5 hover:text-cream",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl transition",
                  active
                    ? "bg-gold text-coffee"
                    : "bg-white/5 text-cream/55 group-hover:text-gold",
                )}
              >
                <item.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span
                  className={cn(
                    "block text-[10px]",
                    active ? "text-cream/55" : "text-cream/30",
                  )}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold/70">
          Đang mở
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-cream/80">
          {EVENT_NAME}
        </p>
        <Link
          href="/"
          target="_blank"
          className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-cream/50 transition hover:text-gold"
        >
          Trang khách
          <ExternalLink className="size-3" />
        </Link>
      </div>

      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="mx-3 mb-4 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-cream/55 transition hover:border-white/20 hover:bg-white/5 hover:text-cream disabled:opacity-60"
      >
        {loggingOut ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <LogOut className="size-3.5" />
        )}
        {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await apiFetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    window.location.replace("/admin/login");
  }

  const current = NAV.find((item) => item.href === pathname);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)] print:block">
      <aside className="no-print sticky top-0 hidden h-dvh overflow-hidden bg-coffee lg:block">
        <div className="pointer-events-none absolute -left-20 top-24 size-64 rounded-full border border-gold/10" />
        <div className="pointer-events-none absolute -right-16 bottom-12 size-56 rounded-full bg-terracotta/15 blur-3xl" />
        <div className="relative h-full">
          <SideContent
            pathname={pathname}
            loggingOut={loggingOut}
            onLogout={() => void logout()}
          />
        </div>
      </aside>

      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line/80 bg-cream/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/admin">
          <Brand compact />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-bold text-muted sm:inline">
            {current?.label ?? "Quản trị"}
          </span>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-xs font-bold text-coffee"
          >
            <Menu className="size-4" />
            Menu
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-coffee/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="pop-in relative h-full w-[84%] max-w-[310px] overflow-hidden bg-coffee shadow-2xl">
            <div className="pointer-events-none absolute -left-20 top-24 size-64 rounded-full border border-gold/10" />
            <div className="pointer-events-none absolute -right-16 bottom-12 size-56 rounded-full bg-terracotta/15 blur-3xl" />
            <div className="relative h-full">
              <SideContent
                pathname={pathname}
                loggingOut={loggingOut}
                drawer
                onNavigate={() => setDrawerOpen(false)}
                onLogout={() => void logout()}
              />
            </div>
          </aside>
        </div>
      )}

      <div className="min-w-0 print:block">
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

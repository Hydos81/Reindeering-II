"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Music2,
} from "lucide-react";
import { apiFetch } from "@/lib/client";
import { EVENT_NAME, EVENT_TAGLINE } from "@/lib/config";
import { errorMessage } from "@/lib/admin-client";
import { fieldClass } from "@/components/admin/AdminUi";

export function LoginForm({ showHint }: { showHint: boolean }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      router.replace("/admin");
    } catch (loginError) {
      setError(errorMessage(loginError, "Không đăng nhập được. Vui lòng thử lại."));
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-coffee p-10 text-cream lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 top-20 size-72 rounded-full border border-gold/15" />
        <div className="absolute -right-20 bottom-10 size-96 rounded-full bg-terracotta/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/10 text-gold">
            <Music2 className="size-5" />
          </span>
          <div>
            <p className="font-display text-xl font-semibold">{EVENT_NAME}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-cream/50">
              Trang quản trị
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold/80">
            Ban tổ chức
          </p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.02]">
            Mọi ly nước,
            <br />
            <em className="text-gold">đến đúng người.</em>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/60">
            {EVENT_TAGLINE}. Quản lý vé, check-in, menu và đơn nước của đêm nhạc
            trong một màn hình.
          </p>
        </div>

        <p className="relative text-[11px] text-cream/35">
          Dữ liệu khách hàng được bảo vệ. Vui lòng không chia sẻ mật khẩu quản trị.
        </p>
      </div>

      <div className="relative flex items-center justify-center px-5 py-10">
        <div className="absolute inset-0 paper-grain opacity-40" />
        <form
          onSubmit={(event) => void submit(event)}
          className="fade-up card-warm relative w-full max-w-md rounded-[2rem] p-6 sm:p-8"
        >
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-full bg-terracotta/10 text-terracotta">
              <Music2 className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-tight text-ink">
                {EVENT_NAME}
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Trang quản trị
              </p>
            </div>
          </div>

          <span className="mt-8 grid size-12 place-items-center rounded-2xl bg-coffee text-cream lg:mt-0">
            <LockKeyhole className="size-5" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold text-ink">
            Đăng nhập quản trị
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Nhập mật khẩu để vào bảng điều khiển.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-800">
              {error}
            </div>
          )}

          <div className="mt-5">
            <label htmlFor="admin-password" className="mb-1.5 block text-xs font-bold text-coffee">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={visible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                placeholder="••••••••"
                className={`${fieldClass} h-12 pr-12`}
              />
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-cream hover:text-ink"
                aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-sm font-bold text-cream transition hover:bg-coffee disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Đang đăng nhập…
              </>
            ) : (
              <>
                Vào bảng điều khiển
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          {showHint && (
            <p className="mt-4 rounded-xl bg-gold-soft/60 px-3 py-2 text-[11px] leading-relaxed text-coffee">
              Môi trường phát triển: mật khẩu mặc định là{" "}
              <code className="rounded bg-paper px-1 py-0.5 font-mono font-bold">
                admin123
              </code>
              . Hãy đổi trong <code className="font-mono">.env.local</code>.
            </p>
          )}
          <p className="mt-5 text-center text-[10px] text-muted">
            Chỉ dành cho ban tổ chức và nhân sự được phân quyền.
          </p>
        </form>
      </div>
    </div>
  );
}

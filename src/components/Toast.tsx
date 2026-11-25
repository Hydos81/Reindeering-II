"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/format";

export type NoticeTone = "success" | "error" | "info";

export function Toast({
  message,
  tone = "info",
  onClose,
}: {
  message: string | null;
  tone?: NoticeTone;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message) return;
    // Depend on the message only: parent polling re-renders must not keep
    // resetting the dismiss timer forever.
    const timer = window.setTimeout(() => closeRef.current(), 4800);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
      <div
        role={tone === "error" ? "alert" : "status"}
        className={cn(
          "pop-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md",
          tone === "success" && "border-emerald-200 bg-emerald-50/95 text-emerald-900",
          tone === "error" && "border-red-200 bg-red-50/95 text-red-900",
          tone === "info" && "border-line bg-paper/95 text-ink",
        )}
      >
        <Icon className="mt-0.5 size-4 shrink-0" />
        <p className="flex-1 leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-0.5 opacity-60 transition hover:opacity-100"
          aria-label="Đóng thông báo"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

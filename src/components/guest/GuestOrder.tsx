/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Armchair,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Heart,
  Info,
  Loader2,
  MapPin,
  Minus,
  Music2,
  Plus,
  Sparkles,
  Ticket,
  User,
  X,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { DrinkArt } from "@/components/DrinkArt";
import { Modal } from "@/components/Modal";
import { Toast } from "@/components/Toast";
import type { NoticeTone } from "@/components/Toast";
import { ApiClientError, apiFetch } from "@/lib/client";
import { EVENT_TAGLINE, EVENT_VENUE, RESERVATION_MINUTES } from "@/lib/config";
import { INVALID_REASON_LABEL, cn, formatTime, normalizeCode, shortId } from "@/lib/format";
import type {
  CategoryWithItems,
  InvalidTicket,
  InvalidTicketReason,
  MenuItem,
  OrderStatus,
} from "@/lib/types";

type Screen = "form" | "menu" | "success";
type TicketRow = { code: string; guestName: string };

type Reservation = {
  ok: true;
  token: string;
  tickets: TicketRow[];
  menu: CategoryWithItems[];
  expiresAt: string;
};

type PlacedOrder = {
  id: string;
  guestToken: string;
  guestName: string;
  seat: string;
  status: OrderStatus;
  createdAt: string;
  items: Array<{ itemName: string; ticketCode: string; quantity: number }>;
};

type SavedSession = { token: string; name: string; seat: string };
type Notice = { message: string; tone: NoticeTone };

const SESSION_KEY = "guest-water-order-session-v2";
const REASON_HELP: Record<InvalidTicketReason, string> = {
  NOT_FOUND: "Mã này không có trong danh sách vé của sự kiện.",
  NOT_CHECKED_IN: "Bạn gặp nhân sự check-in ở cửa trước khi đặt nước nhé.",
  ALREADY_ORDERED: "Mã này đã được dùng để đặt nước rồi.",
  RESERVED: "Mã đang được giữ cho người khác. Bạn thử lại sau vài phút.",
};

function readSession(): SavedSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    return parsed.token && parsed.name && parsed.seat
      ? { token: parsed.token, name: parsed.name, seat: parsed.seat }
      : null;
  } catch {
    return null;
  }
}

function writeSession(value: SavedSession) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    // storage may be disabled – the flow still works for this page view
  }
}

function eraseSession() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function findDish(menu: CategoryWithItems[], id: string | undefined): MenuItem | null {
  if (!id) return null;
  for (const category of menu) {
    const match = category.items.find((item) => item.id === id);
    if (match) return match;
  }
  return null;
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function GuestOrder() {
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<Screen>("form");

  const [guestName, setGuestName] = useState("");
  const [seat, setSeat] = useState("");
  const [codes, setCodes] = useState<string[]>([""]);
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<InvalidTicket[]>([]);

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [activeCode, setActiveCode] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [clock, setClock] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const initialized = useRef(false);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  const enterReservation = useCallback(
    async (token: string, name: string, guestSeat: string) => {
      const data = await apiFetch<Reservation>(
        `/api/guest/reservation?token=${encodeURIComponent(token)}`,
      );
      setReservation(data);
      setChoices({});
      setActiveCode(data.tickets[0]?.code ?? "");
      setGuestName(name);
      setSeat(guestSeat);
      setPlaced(null);
      setScreen("menu");
      writeSession({ token, name, seat: guestSeat });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [],
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    void (async () => {
      const query = new URLSearchParams(window.location.search);
      const seatFromUrl = query.get("seat");
      const singleCode = normalizeCode(query.get("code") ?? "");
      const manyCodes = query.get("codes") ?? "";

      if (seatFromUrl) setSeat(seatFromUrl);
      if (singleCode) {
        setCodes([singleCode]);
      } else if (manyCodes) {
        const rows = manyCodes
          .split(",")
          .map((value) => normalizeCode(value))
          .filter(Boolean)
          .slice(0, 10);
        if (rows.length) setCodes(rows);
      }

      const saved = readSession();
      if (!saved) {
        setBooting(false);
        return;
      }
      try {
        await enterReservation(saved.token, saved.name, saved.seat);
      } catch (error) {
        eraseSession();
        setFormError(
          error instanceof ApiClientError && error.status === 410
            ? "Phiên đặt nước trước đã hết hạn. Bạn nhập lại mã vé để tiếp tục nhé."
            : "Không khôi phục được phiên trước. Bạn vui lòng nhập lại mã vé.",
        );
      } finally {
        setBooting(false);
      }
    })();
  }, [enterReservation]);

  useEffect(() => {
    if (screen !== "menu") return;
    const ticker = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, [screen]);

  const tickets = useMemo(() => reservation?.tickets ?? [], [reservation]);
  const menu = useMemo(() => reservation?.menu ?? [], [reservation]);
  const activeTicket = tickets.find((ticket) => ticket.code === activeCode) ?? tickets[0];
  const pickedCount = tickets.filter((ticket) => Boolean(choices[ticket.code])).length;
  const everyTicketPicked = tickets.length > 0 && pickedCount === tickets.length;
  const activeDish = findDish(menu, activeTicket ? choices[activeTicket.code] : undefined);

  const remainingMs = reservation
    ? Math.max(0, new Date(reservation.expiresAt).getTime() - clock)
    : 0;
  const expired = Boolean(reservation) && remainingMs <= 0;
  const minutesLeft = Math.floor(remainingMs / 60_000);
  const secondsLeft = Math.floor((remainingMs % 60_000) / 1000);
  const timeWidth = Math.max(
    0,
    Math.min(100, (remainingMs / (RESERVATION_MINUTES * 60_000)) * 100),
  );

  const reasonsByCode = useMemo(() => {
    const map = new Map<string, InvalidTicketReason>();
    invalid.forEach((row) => map.set(row.code, row.reason));
    return map;
  }, [invalid]);

  function changeCode(index: number, value: string) {
    setCodes((current) => current.map((code, i) => (i === index ? value : code)));
  }

  function appendCode() {
    if (codes.length >= 10) {
      setNotice({ message: "Mỗi lần đặt tối đa 10 mã vé.", tone: "info" });
      return;
    }
    const nextIndex = codes.length;
    setCodes((current) => [...current, ""]);
    window.setTimeout(() => codeInputs.current[nextIndex]?.focus(), 40);
  }

  function dropCode(index: number) {
    setCodes((current) => current.filter((_, i) => i !== index));
  }

  async function checkTickets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setInvalid([]);

    const cleanCodes = codes.map(normalizeCode).filter(Boolean);
    if (guestName.trim().length < 2) {
      setFormError("Bạn nhập giúp mình tên (ít nhất 2 ký tự) nhé.");
      return;
    }
    if (!seat.trim()) {
      setFormError("Bạn nhập giúp mình chỗ ngồi nhé.");
      return;
    }
    if (cleanCodes.length === 0) {
      setFormError("Bạn cần nhập ít nhất một mã vé.");
      return;
    }
    if (new Set(cleanCodes).size !== cleanCodes.length) {
      setFormError("Các mã vé không được trùng nhau.");
      return;
    }

    setChecking(true);
    try {
      const result = await apiFetch<{
        ok: true;
        token: string;
        tickets: TicketRow[];
      }>("/api/guest/validate", {
        method: "POST",
        body: JSON.stringify({
          name: guestName.trim(),
          seat: seat.trim(),
          codes: cleanCodes,
        }),
      });
      await enterReservation(result.token, guestName.trim(), seat.trim());
    } catch (error) {
      if (error instanceof ApiClientError) {
        const rows = Array.isArray(error.payload?.invalid)
          ? (error.payload.invalid as InvalidTicket[])
          : [];
        if (error.status === 409 && rows.length > 0) {
          setInvalid(rows);
          setFormError("Có mã vé chưa thể dùng. Bạn xem chi tiết từng mã bên dưới nhé.");
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Không kiểm tra được mã vé lúc này. Bạn thử lại giúp mình nhé.");
      }
    } finally {
      setChecking(false);
    }
  }

  function pickDish(item: MenuItem) {
    if (!activeTicket || expired) return;
    const previous = choices[activeTicket.code];
    const next = { ...choices };
    if (previous === item.id) {
      delete next[activeTicket.code];
    } else {
      next[activeTicket.code] = item.id;
    }
    setChoices(next);

    if (previous !== item.id) {
      const waiting = tickets.find((ticket) => !next[ticket.code]);
      if (waiting) setActiveCode(waiting.code);
    }
  }

  const backToForm = useCallback(async () => {
    if (reservation?.token) {
      await apiFetch("/api/guest/release", {
        method: "POST",
        body: JSON.stringify({ token: reservation.token }),
      }).catch(() => null);
    }
    eraseSession();
    setReservation(null);
    setChoices({});
    setPlaced(null);
    setInvalid([]);
    setFormError(null);
    setOrderError(null);
    setConfirmOpen(false);
    setCodes([""]);
    setScreen("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [reservation]);

  async function sendOrder() {
    if (!reservation || expired || !everyTicketPicked) {
      setOrderError("Bạn chọn đủ một món cho mỗi vé trước khi gửi nhé.");
      return;
    }
    setPlacing(true);
    setOrderError(null);
    try {
      const result = await apiFetch<{ ok: true; order: PlacedOrder }>(
        "/api/guest/order",
        {
          method: "POST",
          body: JSON.stringify({
            token: reservation.token,
            guestName: guestName.trim(),
            seat: seat.trim(),
            items: tickets.map((ticket) => ({
              code: ticket.code,
              menuItemId: choices[ticket.code],
            })),
          }),
        },
      );
      eraseSession();
      setPlaced(result.order);
      setConfirmOpen(false);
      setScreen("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 410) {
          setConfirmOpen(false);
          setNotice({
            message: "Phiên đặt nước đã hết hạn. Bạn nhập lại mã vé để tiếp tục nhé.",
            tone: "error",
          });
          await backToForm();
          return;
        }
        setOrderError(error.message);
        try {
          const fresh = await apiFetch<Reservation>(
            `/api/guest/reservation?token=${encodeURIComponent(reservation.token)}`,
          );
          setReservation(fresh);
        } catch {
          // keep the current menu; the error message is already visible
        }
      } else {
        setOrderError("Không gửi được đơn. Bạn thử lại giúp mình nhé.");
      }
    } finally {
      setPlacing(false);
    }
  }

  const toastNode = (
    <Toast
      message={notice?.message ?? null}
      tone={notice?.tone}
      onClose={() => setNotice(null)}
    />
  );

  if (booting) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="flex flex-col items-center gap-4 text-muted">
          <span className="grid size-14 place-items-center rounded-full border border-line bg-paper shadow-sm">
            <Loader2 className="size-6 animate-spin text-terracotta" />
          </span>
          <p className="text-sm font-medium">Đang mở phiên đặt nước của bạn…</p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ *
   * MENU
   * ------------------------------------------------------------------ */
  if (screen === "menu" && reservation) {
    return (
      <div className="min-h-dvh pb-32">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Brand compact />
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-coffee sm:inline-flex">
                <Armchair className="size-3.5 text-terracotta" />
                {seat}
              </span>
              <button
                type="button"
                onClick={() => void backToForm()}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-terracotta/40 hover:text-terracotta"
              >
                Đổi vé
              </button>
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
            <div className="flex items-center justify-between gap-3 text-xs">
              <p className="truncate text-muted">
                <span className="font-semibold text-ink">{guestName}</span>
                <span className="mx-1.5 text-line">·</span>
                {tickets.length} vé
              </p>
              <p
                className={cn(
                  "flex shrink-0 items-center gap-1.5 font-semibold tabular-nums",
                  expired ? "text-red-600" : minutesLeft < 3 ? "text-amber-700" : "text-sage",
                )}
              >
                <Clock3 className="size-3.5" />
                {expired
                  ? "Phiên đã hết hạn"
                  : `Còn ${twoDigits(minutesLeft)}:${twoDigits(secondsLeft)}`}
              </p>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line/70">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-1000 ease-linear",
                  expired ? "bg-red-500" : minutesLeft < 3 ? "bg-amber-500" : "bg-sage",
                )}
                style={{ width: `${timeWidth}%` }}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {expired && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0" />
                Phiên đã hết hạn để nhường chỗ cho khách khác. Bạn nhập lại mã vé để tiếp tục.
              </p>
              <button
                type="button"
                onClick={() => void backToForm()}
                className="shrink-0 rounded-full bg-red-700 px-4 py-2 text-xs font-bold text-white"
              >
                Nhập lại mã vé
              </button>
            </div>
          )}

          <div className="fade-up max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-terracotta">
              Chọn món nước · Bước 2/2
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl">
              Hôm nay bạn uống gì?
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Chạm vào vé bạn đang chọn, sau đó chạm vào món muốn uống. Mỗi vé
              được một món — bạn có thể đổi món bất cứ lúc nào.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tickets.map((ticket, index) => {
              const dish = findDish(menu, choices[ticket.code]);
              const active = ticket.code === activeTicket?.code;
              return (
                <button
                  key={ticket.code}
                  type="button"
                  onClick={() => setActiveCode(ticket.code)}
                  className={cn(
                    "group rounded-2xl border p-3.5 text-left transition",
                    active
                      ? "border-terracotta bg-paper shadow-[0_16px_40px_-26px_rgba(197,107,69,0.9)] ring-2 ring-terracotta/15"
                      : "border-line bg-paper/60 hover:border-terracotta/30 hover:bg-paper",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                      <Ticket className="size-3.5" />
                      Vé {index + 1}
                    </span>
                    <span
                      className={cn(
                        "size-2 rounded-full transition",
                        dish ? "bg-sage pulse-soft" : "bg-line",
                      )}
                    />
                  </div>
                  <p className="mt-1.5 truncate font-mono text-sm font-bold text-ink">
                    {ticket.code}
                  </p>
                  <p
                    className={cn(
                      "mt-1 truncate text-xs",
                      dish ? "font-semibold text-sage" : "text-muted",
                    )}
                  >
                    {dish ? dish.name : "Chưa chọn món"}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="no-scrollbar sticky top-[112px] z-20 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-cream/85 px-4 py-3 backdrop-blur-lg sm:top-[116px] sm:mx-0 sm:rounded-2xl sm:px-3">
            {menu.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  document
                    .getElementById(`menu-${category.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="shrink-0 rounded-full border border-line bg-paper px-4 py-2 text-xs font-semibold text-coffee transition hover:border-terracotta/40 hover:text-terracotta"
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-12">
            {menu.map((category) => (
              <section
                key={category.id}
                id={`menu-${category.id}`}
                className="scroll-mt-44"
              >
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-terracotta/80">
                      Thực đơn
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
                      {category.name}
                    </h2>
                  </div>
                  <span className="text-xs text-muted">{category.items.length} món</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items.map((item) => {
                    const selectedHere = activeTicket
                      ? choices[activeTicket.code] === item.id
                      : false;
                    const claimedBy = tickets.filter(
                      (ticket) => choices[ticket.code] === item.id,
                    );
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={expired}
                        onClick={() => pickDish(item)}
                        className={cn(
                          "group overflow-hidden rounded-3xl border bg-paper text-left transition duration-200",
                          selectedHere
                            ? "border-terracotta shadow-[0_24px_60px_-32px_rgba(197,107,69,0.75)] ring-2 ring-terracotta/20"
                            : "border-line hover:-translate-y-0.5 hover:border-terracotta/30 hover:shadow-[0_24px_50px_-36px_rgba(74,52,40,0.45)]",
                          expired && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              loading="lazy"
                              className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                            />
                          ) : (
                            <DrinkArt name={item.name} className="size-full" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-coffee/25 via-transparent to-transparent" />
                          <span
                            className={cn(
                              "absolute right-3 top-3 grid size-8 place-items-center rounded-full border text-white shadow-sm transition",
                              selectedHere
                                ? "border-terracotta bg-terracotta"
                                : "border-white/40 bg-coffee/25 backdrop-blur",
                            )}
                          >
                            {selectedHere ? <Check className="size-4" /> : <Plus className="size-4" />}
                          </span>
                          {claimedBy.length > 0 && (
                            <div className="absolute bottom-3 left-3 flex max-w-[80%] flex-wrap gap-1">
                              {claimedBy.map((ticket) => (
                                <span
                                  key={ticket.code}
                                  className="rounded-full bg-paper/95 px-2 py-0.5 font-mono text-[9px] font-bold text-coffee shadow-sm"
                                >
                                  {ticket.code}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-display text-xl font-semibold leading-tight text-ink">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                              {item.description}
                            </p>
                          )}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-muted">
                              {selectedHere ? "Đang chọn cho vé này" : "Chạm để chọn"}
                            </span>
                            <span
                              className={cn(
                                "grid size-6 place-items-center rounded-full border transition",
                                selectedHere
                                  ? "border-sage bg-sage text-white"
                                  : "border-line text-muted group-hover:border-terracotta group-hover:text-terracotta",
                              )}
                            >
                              <ChevronRight className="size-3.5" />
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-paper/95 shadow-[0_-18px_50px_-30px_rgba(74,52,40,0.45)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white",
                    everyTicketPicked ? "bg-sage" : "bg-terracotta",
                  )}
                >
                  {everyTicketPicked ? <Check className="size-3" /> : pickedCount}
                </span>
                <p className="truncate text-sm font-bold text-ink">
                  {everyTicketPicked
                    ? "Đã chọn đủ món cho mọi vé"
                    : `${pickedCount}/${tickets.length} vé đã chọn món`}
                </p>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {activeTicket && !everyTicketPicked
                  ? `Đang chọn cho vé ${activeTicket.code}`
                  : activeDish
                    ? `${activeDish.name} · ${activeTicket?.code}`
                    : "Mỗi vé một món nước"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!everyTicketPicked) {
                  setNotice({
                    message: "Bạn chọn đủ món cho mỗi vé rồi xác nhận nhé.",
                    tone: "info",
                  });
                  return;
                }
                setOrderError(null);
                setConfirmOpen(true);
              }}
              disabled={expired}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-lg transition",
                everyTicketPicked && !expired
                  ? "bg-ink text-cream hover:bg-coffee active:scale-[0.99]"
                  : "cursor-not-allowed bg-line text-muted shadow-none",
              )}
            >
              Xác nhận
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Xác nhận đơn nước"
          description={`${tickets.length} vé · ${seat} · ${guestName}`}
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-muted transition hover:text-ink"
              >
                Xem lại
              </button>
              <button
                type="button"
                onClick={() => void sendOrder()}
                disabled={placing}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-cream transition hover:bg-coffee disabled:opacity-60"
              >
                {placing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Coffee className="size-4" />
                )}
                Gửi đơn nước
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            {orderError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {orderError}
              </div>
            )}
            {tickets.map((ticket, index) => {
              const dish = findDish(menu, choices[ticket.code]);
              return (
                <div
                  key={ticket.code}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-cream/50 p-3"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-coffee text-xs font-bold text-cream">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-bold text-muted">
                      {ticket.code}
                    </p>
                    <p className="truncate text-sm font-semibold text-ink">
                      {dish?.name ?? "Chưa chọn món"}
                    </p>
                  </div>
                  {dish ? (
                    <CheckCircle2 className="size-5 shrink-0 text-sage" />
                  ) : (
                    <Minus className="size-5 shrink-0 text-line" />
                  )}
                </div>
              );
            })}
            <p className="flex items-start gap-2 rounded-xl bg-gold-soft/60 px-3 py-2 text-xs leading-relaxed text-coffee">
              <Info className="mt-0.5 size-3.5 shrink-0 text-terracotta" />
              Sau khi gửi, mã vé không dùng lại được. Nếu cần đổi món, bạn gọi nhân sự giúp nhé.
            </p>
          </div>
        </Modal>

        {toastNode}
      </div>
    );
  }

  /* ------------------------------------------------------------------ *
   * SUCCESS
   * ------------------------------------------------------------------ */
  if (screen === "success" && placed) {
    return (
      <div className="relative min-h-dvh overflow-hidden">
        {Array.from({ length: 26 }).map((_, index) => (
          <span
            key={index}
            className="confetti-piece"
            style={{
              left: `${(index * 37 + 9) % 100}%`,
              animationDelay: `${(index % 10) * 0.17}s`,
              backgroundColor: ["#c56b45", "#e5b45a", "#617f66", "#f3eadc"][index % 4],
              transform: `rotate(${(index * 47) % 180}deg)`,
            }}
          />
        ))}
        <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-12">
          <div className="fade-up card-warm relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-sage-soft blur-2xl" />
            <div className="relative">
              <Brand compact />
              <div className="mt-8 grid size-16 place-items-center rounded-full bg-sage-soft text-sage">
                <CheckCircle2 className="size-8" />
              </div>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-sage">
                Đơn nước đã được gửi
              </p>
              <h1 className="mt-2 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
                Cảm ơn bạn rất nhiều!
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                Nhân sự đã nhận đơn. Bạn cứ ngồi yên tại{" "}
                <strong className="text-ink">{placed.seat}</strong>, nước sẽ được
                mang tới tận bàn.
              </p>

              <div className="mt-6 rounded-2xl border border-line bg-cream/60 p-4">
                <div className="flex items-center justify-between gap-4 border-b border-line/70 pb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Mã đơn
                    </p>
                    <p className="font-mono text-lg font-bold text-ink">
                      #{shortId(placed.id)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Thời gian
                    </p>
                    <p className="text-sm font-semibold text-ink">
                      {formatTime(placed.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {placed.items.map((item) => (
                    <div
                      key={item.ticketCode}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{item.itemName}</p>
                        <p className="font-mono text-[10px] text-muted">{item.ticketCode}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-line">
                        ×{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/order/${placed.guestToken}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-cream transition hover:bg-coffee"
                >
                  Theo dõi trạng thái
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-paper px-5 py-3 text-sm font-semibold text-muted transition hover:text-ink"
                >
                  Về trang đầu
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <Heart className="size-3.5 text-terracotta" />
            Mỗi ly nước góp thêm một chút ấm áp cho đêm nhạc.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ *
   * LANDING
   * ------------------------------------------------------------------ */
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Brand />
        <span className="hidden items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5 text-[11px] font-semibold text-muted sm:inline-flex">
          <Sparkles className="size-3.5 text-gold" />
          {EVENT_TAGLINE}
        </span>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pt-8">
        <section className="fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/20 bg-terracotta/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-terracotta">
            <Music2 className="size-3.5" />
            Đêm nhạc thiện nguyện
          </div>
          <h1 className="mt-5 max-w-xl font-display text-[3.35rem] font-semibold leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-[4.4rem]">
            Một tấm vé,
            <br />
            <em className="text-terracotta">một ly nước,</em>
            <br />
            một tấm lòng.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            Chào mừng bạn đến với đêm nhạc. Nhập mã vé để chọn món nước —
            phần nước đã nằm trong vé của bạn.
          </p>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-terracotta" />
              {EVENT_VENUE}
            </span>
            <span className="flex items-center gap-1.5">
              <Coffee className="size-3.5 text-terracotta" />
              Mỗi vé · một món
            </span>
          </div>

          <div className="relative mt-10 hidden max-w-md lg:block">
            <div className="absolute -left-4 -top-6 size-24 rounded-full border border-gold/30" />
            <div className="float-slow absolute -right-2 top-2 grid size-16 place-items-center rounded-2xl border border-line bg-paper text-3xl shadow-lg">
              🎶
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-line bg-coffee p-5 text-cream shadow-[0_30px_80px_-44px_rgba(42,28,21,0.9)]">
              <div className="absolute -right-10 -top-10 size-36 rounded-full bg-terracotta/30 blur-2xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-soft/70">
                    Tấm vé của bạn
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold leading-tight">
                    Có mã vé trong tay?
                  </p>
                  <p className="mt-2 max-w-[15rem] text-xs leading-relaxed text-cream/60">
                    Mỗi mã chỉ dùng được một lần và cần được check-in tại cửa.
                  </p>
                </div>
                <Ticket className="size-8 shrink-0 text-gold" strokeWidth={1.4} />
              </div>
              <div className="relative mt-5 flex items-center gap-2 border-t border-dashed border-cream/20 pt-4 text-[11px] text-cream/55">
                <Heart className="size-3.5 text-terracotta" />
                Nước được phục vụ tại chỗ ngồi
              </div>
            </div>
          </div>
        </section>

        <section className="fade-up fade-up-delay-1">
          <form onSubmit={checkTickets} className="card-warm relative overflow-hidden rounded-[2rem] p-5 sm:p-7">
            <div className="paper-grain pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-terracotta">
                    Bước 1 · Xác nhận vé
                  </p>
                  <h2 className="mt-1.5 font-display text-2xl font-semibold text-ink">
                    Nhập thông tin của bạn
                  </h2>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream-deep text-terracotta">
                  <Ticket className="size-5" />
                </span>
              </div>

              {formError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <p className="flex items-start gap-2 font-medium">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    {formError}
                  </p>
                  {invalid.length > 0 && (
                    <ul className="mt-2 space-y-1.5 pl-6 text-xs leading-relaxed">
                      {invalid.map((row) => (
                        <li key={row.code} className="list-disc">
                          <span className="font-mono font-bold">{row.code}</span>:{" "}
                          <strong>{INVALID_REASON_LABEL[row.reason] ?? "Không hợp lệ"}.</strong>{" "}
                          {REASON_HELP[row.reason]}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-5 space-y-5">
                <div>
                  <label
                    htmlFor="visitor-name"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-coffee"
                  >
                    <User className="size-3.5 text-terracotta" />
                    Tên khách
                  </label>
                  <input
                    id="visitor-name"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    placeholder="Tên bạn hoặc tên nhóm"
                    autoComplete="name"
                    maxLength={80}
                    className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-terracotta focus:ring-4 focus:ring-terracotta/10"
                  />
                </div>

                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-coffee">
                    <Ticket className="size-3.5 text-terracotta" />
                    Mã vé
                  </span>
                  <div className="space-y-2">
                    {codes.map((code, index) => {
                      const reason = reasonsByCode.get(normalizeCode(code));
                      return (
                        <div key={index}>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Ticket className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted/50" />
                              <input
                                ref={(node) => {
                                  codeInputs.current[index] = node;
                                }}
                                value={code}
                                onChange={(event) => changeCode(index, event.target.value)}
                                placeholder={index === 0 ? "VE-XXXX" : "Thêm mã vé"}
                                autoCapitalize="characters"
                                spellCheck={false}
                                maxLength={40}
                                className={cn(
                                  "h-12 w-full rounded-2xl border bg-paper pl-10 pr-4 font-mono text-sm font-semibold uppercase tracking-wider text-ink outline-none transition placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-muted/50",
                                  reason
                                    ? "border-red-400 ring-4 ring-red-100"
                                    : "border-line focus:border-terracotta focus:ring-4 focus:ring-terracotta/10",
                                )}
                              />
                            </div>
                            {codes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => dropCode(index)}
                                aria-label={`Xóa mã vé ${index + 1}`}
                                className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              >
                                <X className="size-4" />
                              </button>
                            )}
                          </div>
                          {reason && (
                            <p className="mt-1.5 pl-1 text-[11px] font-medium leading-relaxed text-red-700">
                              {INVALID_REASON_LABEL[reason]}: {REASON_HELP[reason]}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={appendCode}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-dashed border-terracotta/35 px-3 py-1.5 text-xs font-semibold text-terracotta transition hover:border-terracotta hover:bg-terracotta/5"
                  >
                    <Plus className="size-3.5" />
                    Đặt nước cho mọi người
                  </button>
                  <p className="mt-1 pl-0.5 text-[10px] leading-relaxed text-muted">
                    Thêm mã vé nếu đặt cho nhiều người cùng lúc. Tối đa 10 vé, mỗi vé một món.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="visitor-seat"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-coffee"
                  >
                    <Armchair className="size-3.5 text-terracotta" />
                    Chỗ ngồi
                  </label>
                  <input
                    id="visitor-seat"
                    value={seat}
                    onChange={(event) => setSeat(event.target.value)}
                    placeholder="VD: Bàn 05"
                    maxLength={40}
                    className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-terracotta focus:ring-4 focus:ring-terracotta/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={checking}
                className="mt-6 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-sm font-bold text-cream shadow-[0_18px_40px_-20px_rgba(42,28,21,0.8)] transition hover:bg-coffee active:scale-[0.995] disabled:opacity-60"
              >
                {checking ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang kiểm tra mã vé…
                  </>
                ) : (
                  <>
                    Kiểm tra vé & xem menu
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <div className="mt-4 flex items-start gap-2 rounded-xl bg-cream/80 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-sage" />
                Vé cần được nhân sự check-in tại cửa trước khi đặt nước. Mỗi mã chỉ dùng một lần.
              </div>
            </div>
          </form>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Ticket, label: "Nhập mã vé" },
              { icon: Coffee, label: "Chọn một món" },
              { icon: Heart, label: "Nhận tại bàn" },
            ].map((item, index) => (
              <div
                key={item.label}
                className="rounded-2xl border border-line/80 bg-paper/55 px-3 py-2.5 text-center"
              >
                <item.icon className="mx-auto size-4 text-terracotta/80" />
                <p className="mt-1.5 text-[10px] font-semibold leading-tight text-muted">
                  {item.label}
                </p>
                <p className="mt-0.5 font-mono text-[9px] font-bold text-terracotta/70">
                  0{index + 1}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line/60 bg-cream/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="flex items-center gap-1.5">
            <Heart className="size-3.5 text-terracotta" />
            {EVENT_TAGLINE}
          </p>
          <p>Nếu cần hỗ trợ, bạn vui lòng liên hệ nhân sự tại quán.</p>
        </div>
      </footer>

      {toastNode}
    </div>
  );
}

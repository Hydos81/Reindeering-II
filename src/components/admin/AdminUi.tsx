import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";

/* Small, typed building blocks shared by every admin screen. */

export const fieldClass =
  "h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-terracotta focus:ring-4 focus:ring-terracotta/10";

export const labelClass =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-coffee";

export const textareaClass =
  "w-full resize-y rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-terracotta focus:ring-4 focus:ring-terracotta/10";

type Tone = "neutral" | "coffee" | "terracotta" | "gold" | "sage" | "danger";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-cream text-muted ring-line",
  coffee: "bg-coffee/10 text-coffee ring-coffee/15",
  terracotta: "bg-terracotta/10 text-terracotta ring-terracotta/20",
  gold: "bg-gold-soft text-coffee ring-gold/30",
  sage: "bg-sage-soft text-sage ring-sage/20",
  danger: "bg-red-50 text-red-700 ring-red-200",
};

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "fade-up overflow-hidden rounded-3xl border border-line/80 bg-paper/90 shadow-[0_28px_65px_-52px_rgba(74,52,40,0.55)]",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="fade-up mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-terracotta">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 font-display text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "coffee",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "coffee" | "terracotta" | "sage" | "gold";
}) {
  const tones = {
    coffee: "bg-coffee text-cream",
    terracotta: "bg-terracotta/10 text-terracotta",
    sage: "bg-sage-soft text-sage",
    gold: "bg-gold-soft text-coffee",
  } as const;

  return (
    <div className="rounded-2xl border border-line/80 bg-paper/85 p-3.5 shadow-[0_18px_40px_-34px_rgba(74,52,40,0.5)] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {label}
          </p>
          <p className="mt-1.5 font-display text-3xl font-semibold leading-none text-ink">
            {value}
          </p>
          {hint && <p className="mt-1.5 text-[10px] text-muted">{hint}</p>}
        </div>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            tones[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
};

const buttonVariants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-ink text-cream hover:bg-coffee",
  secondary:
    "border border-line bg-paper text-coffee hover:border-terracotta/30 hover:text-terracotta",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-muted hover:bg-cream hover:text-ink",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-2 text-[11px]" : "px-4 py-2.5 text-sm",
        buttonVariants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-cream/40 px-5 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-paper text-terracotta ring-1 ring-line">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-3 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

import { Coffee, Music2 } from "lucide-react";
import { EVENT_NAME } from "@/lib/config";
import { cn } from "@/lib/format";

/**
 * The little "note in a cup" stamp used across guest and staff screens.
 */
export function Brand({
  compact = false,
  light = false,
  className,
}: {
  compact?: boolean;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "relative grid size-11 shrink-0 place-items-center rounded-2xl border shadow-sm",
          light
            ? "border-white/20 bg-white/10 text-gold-soft"
            : "border-terracotta/20 bg-gradient-to-br from-cream-deep to-gold-soft/60 text-terracotta",
        )}
      >
        <span
          className={cn(
            "absolute inset-1 rounded-xl border",
            light ? "border-white/10" : "border-white/70",
          )}
        />
        <Music2 className="relative size-5" strokeWidth={1.8} />
        <span
          className={cn(
            "absolute -bottom-1.5 -right-1.5 grid size-6 place-items-center rounded-full border shadow-sm",
            light
              ? "border-white/20 bg-coffee text-gold-soft"
              : "border-line bg-paper text-coffee",
          )}
        >
          <Coffee className="size-3.5" strokeWidth={2} />
        </span>
      </span>

      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-display text-lg font-semibold leading-tight tracking-tight",
            light ? "text-cream" : "text-ink",
          )}
        >
          {EVENT_NAME}
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-0.5 block text-[10px] font-bold uppercase tracking-[0.2em]",
              light ? "text-cream/60" : "text-muted",
            )}
          >
            Âm nhạc · Cà phê · Thiện nguyện
          </span>
        )}
      </span>
    </div>
  );
}

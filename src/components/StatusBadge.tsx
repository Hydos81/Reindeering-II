import { STATUS_DOT, STATUS_LABEL, STATUS_STYLES, cn } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export function StatusBadge({
  status,
  dot = true,
  className,
}: {
  status: OrderStatus;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />}
      {STATUS_LABEL[status]}
    </span>
  );
}

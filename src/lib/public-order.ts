import type { Order } from "./types";

export type PublicOrder = Omit<Order, "guestToken" | "zaloMessageId">;

// Never expose guest/staff tokens to browsers that only need to view a status.
export function toPublicOrder(order: Order): PublicOrder {
  return {
    id: order.id,
    guestName: order.guestName,
    seat: order.seat,
    status: order.status,
    createdAt: order.createdAt,
    doneAt: order.doneAt,
    deliveredAt: order.deliveredAt,
    items: order.items,
  };
}

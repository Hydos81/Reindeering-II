// Shared domain types. The same shapes are used by the SQLite and Supabase
// repositories, by API routes and by the client components.

export type OrderStatus = "new" | "done" | "delivered";

export type Ticket = {
  id: string;
  code: string;
  guestName: string;
  phone: string | null;
  note: string | null;
  checkedInAt: string | null;
  orderedAt: string | null;
  orderId: string | null;
  reservedAt: string | null;
  reservationToken: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
};

export type CategoryWithItems = Category & { items: MenuItem[] };

export type OrderItem = {
  id: string;
  orderId: string;
  ticketId: string;
  ticketCode: string;
  menuItemId: string | null;
  itemName: string;
  itemImageUrl: string | null;
  quantity: number;
};

export type Order = {
  id: string;
  guestName: string;
  seat: string;
  status: OrderStatus;
  guestToken: string;
  zaloMessageId: string | null;
  createdAt: string;
  doneAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
};

export type TicketInput = {
  code: string;
  guestName: string;
  phone?: string | null;
  note?: string | null;
};

export type TicketListFilter =
  | "all"
  | "checked_in"
  | "not_checked_in"
  | "ordered"
  | "not_ordered";

export type TicketListParams = {
  search?: string;
  filter?: TicketListFilter;
  page?: number;
  pageSize?: number;
};

export type TicketListResult = {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
};

export type InvalidTicketReason =
  | "NOT_FOUND"
  | "NOT_CHECKED_IN"
  | "ALREADY_ORDERED"
  | "RESERVED";

export type InvalidTicket = { code: string; reason: InvalidTicketReason };

export type ReserveResult =
  | { ok: true; tickets: Ticket[] }
  | { ok: false; invalid: InvalidTicket[] };

export type PlaceOrderInput = {
  guestName: string;
  seat: string;
  reservationToken: string;
  items: Array<{ code: string; menuItemId: string }>;
  ttlMinutes?: number;
};

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      error:
        | "RESERVATION_EXPIRED"
        | "ITEM_UNAVAILABLE"
        | "INVALID_ITEMS"
        | "ALREADY_ORDERED";
      message: string;
    };

export type Stats = {
  totalTickets: number;
  checkedIn: number;
  ordered: number;
  pendingOrders: number;
  doneOrders: number;
  deliveredOrders: number;
};

export type BulkTicketResult = {
  inserted: number;
  updated: number;
  skipped: number;
};

export type ZaloSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

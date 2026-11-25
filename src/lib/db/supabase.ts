import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeCode } from "../format";
import { newId, newToken, nowIso } from "../ids";
import type {
  BulkTicketResult,
  Category,
  InvalidTicketReason,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  PlaceOrderInput,
  PlaceOrderResult,
  ReserveResult,
  Stats,
  Ticket,
  TicketInput,
  TicketListParams,
  TicketListResult,
} from "../types";
import type { Repo } from "./interface";

type TicketRow = {
  id: string; code: string; guest_name: string; phone: string | null; note: string | null;
  checked_in_at: string | null; ordered_at: string | null; order_id: string | null;
  reserved_at: string | null; reservation_token: string | null;
  created_at: string; updated_at: string;
};
type CategoryRow = { id: string; name: string; sort_order: number; created_at: string };
type MenuRow = {
  id: string; category_id: string; name: string; description: string | null;
  image_url: string | null; is_available: boolean; sort_order: number; created_at: string;
};
type OrderRow = {
  id: string; guest_name: string; seat: string; status: OrderStatus; guest_token: string;
  zalo_message_id: string | null; created_at: string; done_at: string | null;
  delivered_at: string | null;
};
type ItemRow = {
  id: string; order_id: string; ticket_id: string; ticket_code: string;
  menu_item_id: string | null; item_name: string; item_image_url: string | null; quantity: number;
};

let client: SupabaseClient | null = null;

export function supabaseAdmin() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase chưa được cấu hình.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

const toTicket = (row: TicketRow): Ticket => ({
  id: row.id, code: row.code, guestName: row.guest_name, phone: row.phone, note: row.note,
  checkedInAt: row.checked_in_at, orderedAt: row.ordered_at, orderId: row.order_id,
  reservedAt: row.reserved_at, reservationToken: row.reservation_token,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
const toCategory = (row: CategoryRow): Category => ({
  id: row.id, name: row.name, sortOrder: row.sort_order, createdAt: row.created_at,
});
const toMenuItem = (row: MenuRow): MenuItem => ({
  id: row.id, categoryId: row.category_id, name: row.name, description: row.description,
  imageUrl: row.image_url, isAvailable: Boolean(row.is_available),
  sortOrder: row.sort_order, createdAt: row.created_at,
});
const toOrderItem = (row: ItemRow): OrderItem => ({
  id: row.id, orderId: row.order_id, ticketId: row.ticket_id, ticketCode: row.ticket_code,
  menuItemId: row.menu_item_id, itemName: row.item_name,
  itemImageUrl: row.item_image_url, quantity: row.quantity,
});
const toOrder = (row: OrderRow, items: ItemRow[]): Order => ({
  id: row.id, guestName: row.guest_name, seat: row.seat, status: row.status,
  guestToken: row.guest_token, zaloMessageId: row.zalo_message_id,
  createdAt: row.created_at, doneAt: row.done_at, deliveredAt: row.delivered_at,
  items: items.map(toOrderItem),
});

function fail(message: string): never {
  throw new Error(message);
}
function ticketError(message: string) {
  return new Error(
    message.includes("duplicate key") || message.includes("tickets_code_key")
      ? "TICKET_EXISTS"
      : message,
  );
}

// PostgREST caps a single select at 1000 rows — page through everything.
async function allRows<T>(table: string, order?: { column: string; ascending?: boolean }) {
  const rows: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let query = supabaseAdmin().from(table).select("*").range(from, from + size - 1);
    if (order) {
      // A stable tiebreaker keeps PostgREST range pagination from duplicating
      // or skipping rows when many records share the same timestamp/order.
      query = query
        .order(order.column, { ascending: order.ascending ?? true })
        .order("id", { ascending: true });
    }
    const { data, error } = await query;
    if (error) fail(error.message);
    const chunk = (data || []) as T[];
    rows.push(...chunk);
    if (chunk.length < size) break;
  }
  return rows;
}

async function itemsFor(orderId: string) {
  const { data, error } = await supabaseAdmin()
    .from("order_items").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
  if (error) fail(error.message);
  return (data || []) as ItemRow[];
}
async function loadOrderBy(column: "id" | "guest_token", value: string) {
  const { data, error } = await supabaseAdmin().from("orders").select("*").eq(column, value).maybeSingle();
  if (error) fail(error.message);
  if (!data) return null;
  return toOrder(data as OrderRow, await itemsFor((data as OrderRow).id));
}
async function ticketsByCodes(codes: string[]) {
  if (codes.length === 0) return [];
  const rows: TicketRow[] = [];
  for (let i = 0; i < codes.length; i += 200) {
    const { data, error } = await supabaseAdmin().from("tickets").select("*").in("code", codes.slice(i, i + 200));
    if (error) fail(error.message);
    rows.push(...((data || []) as TicketRow[]));
  }
  return rows.map(toTicket);
}

export const supabaseRepo: Repo = {
  async listTickets(params: TicketListParams): Promise<TicketListResult> {
    const page = Math.max(1, Math.floor(params.page || 1));
    const pageSize = Math.min(200, Math.max(1, Math.floor(params.pageSize || 50)));
    const search = params.search?.trim().toLocaleLowerCase("vi") || "";
    let tickets = (await allRows<TicketRow>("tickets", { column: "created_at", ascending: false })).map(toTicket);
    if (search) {
      tickets = tickets.filter((ticket) =>
        [ticket.code, ticket.guestName, ticket.phone || ""].join(" ").toLocaleLowerCase("vi").includes(search),
      );
    }
    switch (params.filter) {
      case "checked_in": tickets = tickets.filter((t) => t.checkedInAt); break;
      case "not_checked_in": tickets = tickets.filter((t) => !t.checkedInAt); break;
      case "ordered": tickets = tickets.filter((t) => t.orderedAt); break;
      case "not_ordered": tickets = tickets.filter((t) => !t.orderedAt); break;
    }
    return {
      items: tickets.slice((page - 1) * pageSize, page * pageSize),
      total: tickets.length, page, pageSize,
    };
  },

  async getTicketById(id) {
    const { data, error } = await supabaseAdmin().from("tickets").select("*").eq("id", id).maybeSingle();
    if (error) fail(error.message);
    return data ? toTicket(data as TicketRow) : null;
  },

  async getTicketsByCodes(codes) {
    return ticketsByCodes([...new Set(codes.map(normalizeCode))]);
  },

  async createTicket(input: TicketInput) {
    const { data, error } = await supabaseAdmin().from("tickets").insert({
      code: normalizeCode(input.code), guest_name: input.guestName.trim(),
      phone: input.phone?.trim() || null, note: input.note?.trim() || null,
      updated_at: nowIso(),
    }).select("*").single();
    if (error) throw ticketError(error.message);
    return toTicket(data as TicketRow);
  },

  async updateTicket(id, input) {
    const { data, error } = await supabaseAdmin().from("tickets").update({
      code: normalizeCode(input.code), guest_name: input.guestName.trim(),
      phone: input.phone?.trim() || null, note: input.note?.trim() || null,
      updated_at: nowIso(),
    }).eq("id", id).select("*").maybeSingle();
    if (error) throw ticketError(error.message);
    return data ? toTicket(data as TicketRow) : null;
  },

  async deleteTicket(id) {
    const { data, error } = await supabaseAdmin().from("tickets").delete().eq("id", id).select("id");
    if (error) fail(error.message);
    return (data || []).length > 0;
  },

  async bulkUpsertTickets(rows: TicketInput[]): Promise<BulkTicketResult> {
    const unique = new Map<string, TicketInput>();
    let skipped = 0;
    for (const row of rows) {
      const code = normalizeCode(row.code);
      if (!code || !row.guestName?.trim() || unique.has(code)) {
        skipped += 1;
        continue;
      }
      unique.set(code, { ...row, code });
    }
    const list = [...unique.values()];
    const existing = new Set<string>();
    for (let i = 0; i < list.length; i += 200) {
      const chunk = list.slice(i, i + 200).map((row) => row.code);
      const { data, error } = await supabaseAdmin().from("tickets").select("code").in("code", chunk);
      if (error) fail(error.message);
      (data || []).forEach((row) => existing.add(String(row.code).toUpperCase()));
    }
    const now = nowIso();
    const payload = list.map((row) => ({
      code: row.code, guest_name: row.guestName.trim(), phone: row.phone?.trim() || null,
      note: row.note?.trim() || null, updated_at: now,
    }));
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabaseAdmin().from("tickets").upsert(payload.slice(i, i + 500), {
        onConflict: "code",
      });
      if (error) fail(error.message);
    }
    const updated = list.filter((row) => existing.has(row.code)).length;
    return { inserted: list.length - updated, updated, skipped };
  },

  async setTicketCheckIn(id, checkedIn) {
    const existing = await this.getTicketById(id);
    if (!existing) return null;
    if (!checkedIn && existing.orderedAt) throw new Error("TICKET_ALREADY_ORDERED");
    const { data, error } = await supabaseAdmin().from("tickets").update({
      checked_in_at: checkedIn ? existing.checkedInAt || nowIso() : null,
      updated_at: nowIso(),
    }).eq("id", id).select("*").maybeSingle();
    if (error) fail(error.message);
    return data ? toTicket(data as TicketRow) : null;
  },

  async resetTicketOrder(id) {
    const { data, error } = await supabaseAdmin().rpc("reset_ticket_order", { p_ticket_id: id });
    if (error) fail(error.message);
    const result = (data || {}) as { orderId?: string | null; orderDeleted?: boolean };
    return { orderId: result.orderId || null, orderDeleted: Boolean(result.orderDeleted) };
  },

  async listCategoriesWithItems(includeUnavailable) {
    const categories = (await allRows<CategoryRow>("categories", { column: "sort_order" })).map(toCategory);
    const raw: MenuRow[] = [];
    const size = 1000;
    for (let from = 0; ; from += size) {
      let query = supabaseAdmin().from("menu_items").select("*").order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + size - 1);
      if (!includeUnavailable) query = query.eq("is_available", true);
      const { data, error } = await query;
      if (error) fail(error.message);
      const chunk = (data || []) as MenuRow[];
      raw.push(...chunk);
      if (chunk.length < size) break;
    }
    const items = raw.map(toMenuItem);
    return categories.map((category) => ({
      ...category,
      items: items.filter((item) => item.categoryId === category.id),
    }));
  },

  async createCategory(input) {
    const { data: last } = await supabaseAdmin().from("categories").select("sort_order")
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabaseAdmin().from("categories").insert({
      name: input.name.trim(), sort_order: input.sortOrder ?? ((last?.sort_order || 0) + 1),
    }).select("*").single();
    if (error) fail(error.message);
    return toCategory(data as CategoryRow);
  },

  async updateCategory(id, input) {
    const { data, error } = await supabaseAdmin().from("categories").update({
      name: input.name.trim(),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    }).eq("id", id).select("*").maybeSingle();
    if (error) fail(error.message);
    return data ? toCategory(data as CategoryRow) : null;
  },

  async deleteCategory(id) {
    const { data, error } = await supabaseAdmin().from("categories").delete().eq("id", id).select("id");
    if (error) fail(error.message);
    return (data || []).length > 0;
  },

  async createMenuItem(input) {
    const { data: last } = await supabaseAdmin().from("menu_items").select("sort_order")
      .eq("category_id", input.categoryId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabaseAdmin().from("menu_items").insert({
      category_id: input.categoryId, name: input.name.trim(),
      description: input.description?.trim() || null, image_url: input.imageUrl?.trim() || null,
      is_available: input.isAvailable !== false,
      sort_order: input.sortOrder ?? ((last?.sort_order || 0) + 1),
    }).select("*").single();
    if (error) fail(error.message);
    return toMenuItem(data as MenuRow);
  },

  async updateMenuItem(id, input) {
    const { data: existing, error: findError } = await supabaseAdmin().from("menu_items")
      .select("*").eq("id", id).maybeSingle();
    if (findError) fail(findError.message);
    if (!existing) return null;
    const row = existing as MenuRow;
    const { data, error } = await supabaseAdmin().from("menu_items").update({
      category_id: input.categoryId ?? row.category_id,
      name: input.name?.trim() ?? row.name,
      description: input.description !== undefined ? input.description?.trim() || null : row.description,
      image_url: input.imageUrl !== undefined ? input.imageUrl?.trim() || null : row.image_url,
      is_available: input.isAvailable === undefined ? row.is_available : input.isAvailable,
      sort_order: input.sortOrder ?? row.sort_order,
    }).eq("id", id).select("*").single();
    if (error) fail(error.message);
    return toMenuItem(data as MenuRow);
  },

  async deleteMenuItem(id) {
    const { data, error } = await supabaseAdmin().from("menu_items").delete().eq("id", id).select("id");
    if (error) fail(error.message);
    return (data || []).length > 0;
  },

  async reserveTickets(codes, token, ttlMinutes): Promise<ReserveResult> {
    const normalized = codes.map(normalizeCode);
    const { data, error } = await supabaseAdmin().rpc("reserve_tickets", {
      p_codes: normalized, p_token: token, p_ttl_minutes: ttlMinutes,
    });
    if (error) fail(error.message);
    const result = data as {
      ok: boolean;
      tickets?: TicketRow[];
      invalid?: Array<{ code: string; reason: InvalidTicketReason }>;
    };
    if (!result?.ok) {
      return { ok: false, invalid: result?.invalid?.length ? result.invalid : normalized.map((code) => ({ code, reason: "RESERVED" as const })) };
    }
    return { ok: true, tickets: (result.tickets || []).map(toTicket) };
  },

  async getReservation(token, ttlMinutes) {
    const cutoff = new Date(Date.now() - ttlMinutes * 60_000).toISOString();
    const { data, error } = await supabaseAdmin().from("tickets").select("*")
      .eq("reservation_token", token).gte("reserved_at", cutoff)
      .is("ordered_at", null).order("code", { ascending: true });
    if (error) fail(error.message);
    return ((data || []) as TicketRow[]).map(toTicket);
  },

  async releaseReservation(token) {
    const { error } = await supabaseAdmin().from("tickets").update({
      reserved_at: null, reservation_token: null, updated_at: nowIso(),
    }).eq("reservation_token", token).is("ordered_at", null);
    if (error) fail(error.message);
  },

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const orderId = newId();
    const { data, error } = await supabaseAdmin().rpc("place_order", {
      p_guest_name: input.guestName,
      p_seat: input.seat,
      p_token: input.reservationToken,
      p_items: input.items.map((item) => ({ code: normalizeCode(item.code), menuItemId: item.menuItemId })),
      p_guest_token: newToken(24),
      p_order_id: orderId,
      p_ttl_minutes: input.ttlMinutes ?? 15,
    });
    if (error) fail(error.message);
    const result = data as {
      ok: boolean;
      orderId?: string;
      error?: "RESERVATION_EXPIRED" | "ITEM_UNAVAILABLE" | "INVALID_ITEMS" | "ALREADY_ORDERED";
      message?: string;
    };
    if (!result?.ok) {
      return {
        ok: false,
        error: result?.error || "INVALID_ITEMS",
        message: result?.message || "Không thể tạo đơn. Vui lòng thử lại.",
      };
    }
    const order = await this.getOrder(result.orderId || orderId);
    if (!order) {
      return { ok: false, error: "INVALID_ITEMS", message: "Không tìm thấy đơn vừa tạo. Vui lòng thử lại." };
    }
    return { ok: true, order };
  },

  async listOrders() {
    const orders = await allRows<OrderRow>("orders", { column: "created_at", ascending: false });
    if (orders.length === 0) return [];
    const items: ItemRow[] = [];
    const ids = orders.map((order) => order.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabaseAdmin().from("order_items").select("*")
        .in("order_id", ids.slice(i, i + 200)).order("created_at", { ascending: true });
      if (error) fail(error.message);
      items.push(...((data || []) as ItemRow[]));
    }
    return orders.map((order) => toOrder(order, items.filter((item) => item.order_id === order.id)));
  },

  async getOrder(id) {
    return loadOrderBy("id", id);
  },

  async getOrderByGuestToken(token) {
    return loadOrderBy("guest_token", token);
  },

  async updateOrderStatus(id, status: OrderStatus) {
    const existing = await this.getOrder(id);
    if (!existing) return null;
    if (existing.status === status) return existing;
    const now = nowIso();
    let query;
    if (status === "done") {
      if (existing.status !== "new") throw new Error("INVALID_TRANSITION");
      query = supabaseAdmin().from("orders").update({ status: "done", done_at: now })
        .eq("id", id).eq("status", "new");
    } else if (status === "delivered") {
      if (existing.status !== "done") throw new Error("INVALID_TRANSITION");
      query = supabaseAdmin().from("orders").update({ status: "delivered", delivered_at: now })
        .eq("id", id).eq("status", "done");
    } else throw new Error("INVALID_TRANSITION");

    const { data, error } = await query.select("id").maybeSingle();
    if (error) fail(error.message);
    if (!data) {
      const latest = await this.getOrder(id);
      if (latest?.status === status) return latest;
      throw new Error("INVALID_TRANSITION");
    }
    return this.getOrder(id);
  },

  async setOrderZaloMessageId(id, messageId) {
    const { error } = await supabaseAdmin().from("orders").update({ zalo_message_id: messageId }).eq("id", id);
    if (error) fail(error.message);
  },

  async getStats(): Promise<Stats> {
    const db = supabaseAdmin();
    const [totalRes, checkedRes, orderedRes, pendingRes, doneRes, deliveredRes] = await Promise.all([
      db.from("tickets").select("*", { count: "exact", head: true }),
      db.from("tickets").select("*", { count: "exact", head: true }).not("checked_in_at", "is", null),
      db.from("tickets").select("*", { count: "exact", head: true }).not("ordered_at", "is", null),
      db.from("orders").select("*", { count: "exact", head: true }).eq("status", "new"),
      db.from("orders").select("*", { count: "exact", head: true }).eq("status", "done"),
      db.from("orders").select("*", { count: "exact", head: true }).eq("status", "delivered"),
    ]);
    for (const result of [totalRes, checkedRes, orderedRes, pendingRes, doneRes, deliveredRes]) {
      if (result.error) fail(result.error.message);
    }
    return {
      totalTickets: totalRes.count || 0,
      checkedIn: checkedRes.count || 0,
      ordered: orderedRes.count || 0,
      pendingOrders: pendingRes.count || 0,
      doneOrders: doneRes.count || 0,
      deliveredOrders: deliveredRes.count || 0,
    };
  },

  async getSetting(key) {
    const { data, error } = await supabaseAdmin().from("settings").select("value").eq("key", key).maybeSingle();
    if (error) fail(error.message);
    return (data as { value: string } | null)?.value || null;
  },

  async setSetting(key, value) {
    const { error } = await supabaseAdmin().from("settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) fail(error.message);
  },
};

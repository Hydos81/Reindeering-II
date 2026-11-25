import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeCode } from "../format";
import { newId, newToken, nowIso } from "../ids";
import type {
  BulkTicketResult,
  Category,
  InvalidTicket,
  MenuItem,
  Order,
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
  image_url: string | null; is_available: number; sort_order: number; created_at: string;
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

let connection: DatabaseSync | null = null;

function databasePath() {
  const configured = process.env.SQLITE_PATH || "data/app.db";
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured.replace(/^\.\//, ""));
}

function db() {
  if (connection) return connection;
  const file = databasePath();
  mkdirSync(path.dirname(file), { recursive: true });
  connection = new DatabaseSync(file);
  connection.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  connection.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL, description TEXT, image_url TEXT,
      is_available INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      guest_name TEXT NOT NULL, phone TEXT, note TEXT,
      checked_in_at TEXT, ordered_at TEXT, order_id TEXT, reserved_at TEXT, reservation_token TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, guest_name TEXT NOT NULL, seat TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', guest_token TEXT NOT NULL UNIQUE,
      zalo_message_id TEXT, created_at TEXT NOT NULL, done_at TEXT, delivered_at TEXT);
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      ticket_id TEXT NOT NULL UNIQUE, ticket_code TEXT NOT NULL, menu_item_id TEXT,
      item_name TEXT NOT NULL, item_image_url TEXT, quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(code);
    CREATE INDEX IF NOT EXISTS idx_tickets_reservation ON tickets(reservation_token);
    CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);
  return connection;
}

type Param = string | number | null;
const all = <T>(sql: string, ...args: Param[]) => db().prepare(sql).all(...args) as T[];
const one = <T>(sql: string, ...args: Param[]) => db().prepare(sql).get(...args) as T | undefined;
const run = (sql: string, ...args: Param[]) => db().prepare(sql).run(...args);

function transaction<T>(fn: () => T): T {
  db().exec("BEGIN IMMEDIATE;");
  try {
    const result = fn();
    db().exec("COMMIT;");
    return result;
  } catch (error) {
    db().exec("ROLLBACK;");
    throw error;
  }
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

function orderItems(orderId: string) {
  return all<ItemRow>("SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC", orderId).map(
    (row) => ({
      id: row.id, orderId: row.order_id, ticketId: row.ticket_id, ticketCode: row.ticket_code,
      menuItemId: row.menu_item_id, itemName: row.item_name,
      itemImageUrl: row.item_image_url, quantity: row.quantity,
    }),
  );
}
function hydrateOrder(row: OrderRow): Order {
  return {
    id: row.id, guestName: row.guest_name, seat: row.seat, status: row.status,
    guestToken: row.guest_token, zaloMessageId: row.zalo_message_id,
    createdAt: row.created_at, doneAt: row.done_at, deliveredAt: row.delivered_at,
    items: orderItems(row.id),
  };
}
function getOrderSync(id: string) {
  const row = one<OrderRow>("SELECT * FROM orders WHERE id = ?", id);
  return row ? hydrateOrder(row) : null;
}
function ticketByCode(code: string) {
  return one<TicketRow>("SELECT * FROM tickets WHERE code = ? COLLATE NOCASE", normalizeCode(code));
}
function reservedTickets(token: string, ttlMinutes: number) {
  const cutoff = new Date(Date.now() - ttlMinutes * 60_000).toISOString();
  return all<TicketRow>(
    `SELECT * FROM tickets WHERE reservation_token = ? AND reserved_at IS NOT NULL
       AND reserved_at >= ? AND ordered_at IS NULL ORDER BY code ASC`,
    token, cutoff,
  );
}

export const sqliteRepo: Repo = {
  async listTickets(params: TicketListParams): Promise<TicketListResult> {
    const page = Math.max(1, Math.floor(params.page || 1));
    const pageSize = Math.min(200, Math.max(1, Math.floor(params.pageSize || 50)));
    const search = params.search?.trim().toLocaleLowerCase("vi") || "";
    let tickets = all<TicketRow>("SELECT * FROM tickets ORDER BY created_at DESC").map(toTicket);
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
    const row = one<TicketRow>("SELECT * FROM tickets WHERE id = ?", id);
    return row ? toTicket(row) : null;
  },

  async getTicketsByCodes(codes) {
    const normalized = [...new Set(codes.map(normalizeCode))];
    if (normalized.length === 0) return [];
    const placeholders = normalized.map(() => "?").join(",");
    return all<TicketRow>(`SELECT * FROM tickets WHERE code IN (${placeholders})`, ...normalized).map(toTicket);
  },

  async createTicket(input: TicketInput) {
    const code = normalizeCode(input.code);
    if (ticketByCode(code)) throw new Error("TICKET_EXISTS");
    const id = newId();
    const now = nowIso();
    run(
      `INSERT INTO tickets (id, code, guest_name, phone, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, code, input.guestName.trim(), input.phone?.trim() || null,
      input.note?.trim() || null, now, now,
    );
    return (await this.getTicketById(id))!;
  },

  async updateTicket(id, input) {
    const existing = one<TicketRow>("SELECT * FROM tickets WHERE id = ?", id);
    if (!existing) return null;
    const code = normalizeCode(input.code);
    const duplicate = ticketByCode(code);
    if (duplicate && duplicate.id !== id) throw new Error("TICKET_EXISTS");
    run(
      `UPDATE tickets SET code = ?, guest_name = ?, phone = ?, note = ?, updated_at = ? WHERE id = ?`,
      code, input.guestName.trim(), input.phone?.trim() || null,
      input.note?.trim() || null, nowIso(), id,
    );
    return this.getTicketById(id);
  },

  async deleteTicket(id) {
    return Number(run("DELETE FROM tickets WHERE id = ?", id).changes) > 0;
  },

  async bulkUpsertTickets(rows: TicketInput[]): Promise<BulkTicketResult> {
    return transaction(() => {
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
      const codes = [...unique.keys()];
      const existing = new Set<string>();
      for (let i = 0; i < codes.length; i += 500) {
        const chunk = codes.slice(i, i + 500);
        if (!chunk.length) continue;
        const placeholders = chunk.map(() => "?").join(",");
        all<{ code: string }>(`SELECT code FROM tickets WHERE code IN (${placeholders})`, ...chunk)
          .forEach((row) => existing.add(row.code.toUpperCase()));
      }
      let inserted = 0;
      let updated = 0;
      const now = nowIso();
      const statement = db().prepare(
        `INSERT INTO tickets (id, code, guest_name, phone, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET guest_name = excluded.guest_name, phone = excluded.phone,
           note = excluded.note, updated_at = excluded.updated_at`,
      );
      for (const row of unique.values()) {
        const exists = existing.has(row.code.toUpperCase());
        statement.run(newId(), row.code, row.guestName.trim(), row.phone?.trim() || null,
          row.note?.trim() || null, now, now);
        if (exists) updated += 1;
        else inserted += 1;
      }
      return { inserted, updated, skipped };
    });
  },

  async setTicketCheckIn(id, checkedIn) {
    const ticket = one<TicketRow>("SELECT * FROM tickets WHERE id = ?", id);
    if (!ticket) return null;
    if (!checkedIn && ticket.ordered_at) throw new Error("TICKET_ALREADY_ORDERED");
    run(
      "UPDATE tickets SET checked_in_at = ?, updated_at = ? WHERE id = ?",
      checkedIn ? ticket.checked_in_at || nowIso() : null, nowIso(), id,
    );
    return this.getTicketById(id);
  },

  async resetTicketOrder(id) {
    return transaction(() => {
      const ticket = one<TicketRow>("SELECT * FROM tickets WHERE id = ?", id);
      if (!ticket) return { orderId: null, orderDeleted: false };
      const orderId = ticket.order_id;
      run("DELETE FROM order_items WHERE ticket_id = ?", id);
      run(
        `UPDATE tickets SET ordered_at = NULL, order_id = NULL, reserved_at = NULL,
           reservation_token = NULL, updated_at = ? WHERE id = ?`,
        nowIso(), id,
      );
      let orderDeleted = false;
      if (orderId) {
        const remaining = one<{ count: number }>(
          "SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?", orderId,
        );
        if (!remaining || remaining.count === 0) {
          run("DELETE FROM orders WHERE id = ?", orderId);
          orderDeleted = true;
        }
      }
      return { orderId, orderDeleted };
    });
  },

  async listCategoriesWithItems(includeUnavailable) {
    const categories = all<CategoryRow>("SELECT * FROM categories ORDER BY sort_order ASC, created_at ASC").map(toCategory);
    const items = all<MenuRow>(
      `SELECT * FROM menu_items ${includeUnavailable ? "" : "WHERE is_available = 1"}
       ORDER BY sort_order ASC, created_at ASC`,
    ).map(toMenuItem);
    return categories.map((category) => ({
      ...category,
      items: items.filter((item) => item.categoryId === category.id),
    }));
  },

  async createCategory(input) {
    const max = one<{ value: number }>("SELECT COALESCE(MAX(sort_order), 0) AS value FROM categories");
    const id = newId();
    run("INSERT INTO categories (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)",
      id, input.name.trim(), input.sortOrder ?? (max?.value || 0) + 1, nowIso());
    return toCategory(one<CategoryRow>("SELECT * FROM categories WHERE id = ?", id)!);
  },

  async updateCategory(id, input) {
    const existing = one<CategoryRow>("SELECT * FROM categories WHERE id = ?", id);
    if (!existing) return null;
    run("UPDATE categories SET name = ?, sort_order = ? WHERE id = ?",
      input.name.trim(), input.sortOrder ?? existing.sort_order, id);
    return toCategory(one<CategoryRow>("SELECT * FROM categories WHERE id = ?", id)!);
  },

  async deleteCategory(id) {
    return Number(run("DELETE FROM categories WHERE id = ?", id).changes) > 0;
  },

  async createMenuItem(input) {
    const max = one<{ value: number }>(
      "SELECT COALESCE(MAX(sort_order), 0) AS value FROM menu_items WHERE category_id = ?",
      input.categoryId,
    );
    const id = newId();
    run(
      `INSERT INTO menu_items
        (id, category_id, name, description, image_url, is_available, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, input.categoryId, input.name.trim(), input.description?.trim() || null,
      input.imageUrl?.trim() || null, input.isAvailable === false ? 0 : 1,
      input.sortOrder ?? (max?.value || 0) + 1, nowIso(),
    );
    return toMenuItem(one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", id)!);
  },

  async updateMenuItem(id, input) {
    const existing = one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", id);
    if (!existing) return null;
    run(
      `UPDATE menu_items SET category_id = ?, name = ?, description = ?, image_url = ?,
         is_available = ?, sort_order = ? WHERE id = ?`,
      input.categoryId ?? existing.category_id, input.name?.trim() ?? existing.name,
      input.description !== undefined ? input.description?.trim() || null : existing.description,
      input.imageUrl !== undefined ? input.imageUrl?.trim() || null : existing.image_url,
      input.isAvailable === undefined ? existing.is_available : input.isAvailable ? 1 : 0,
      input.sortOrder ?? existing.sort_order, id,
    );
    return toMenuItem(one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", id)!);
  },

  async deleteMenuItem(id) {
    return Number(run("DELETE FROM menu_items WHERE id = ?", id).changes) > 0;
  },

  async reserveTickets(codes, token, ttlMinutes): Promise<ReserveResult> {
    return transaction(() => {
      const cutoff = new Date(Date.now() - ttlMinutes * 60_000).toISOString();
      const normalized = codes.map(normalizeCode);
      const rows = new Map<string, TicketRow>();
      for (const code of normalized) {
        const row = ticketByCode(code);
        if (row) rows.set(code, row);
      }
      const invalid: InvalidTicket[] = [];
      for (const code of normalized) {
        const ticket = rows.get(code);
        if (!ticket) invalid.push({ code, reason: "NOT_FOUND" });
        else if (ticket.ordered_at) invalid.push({ code, reason: "ALREADY_ORDERED" });
        else if (!ticket.checked_in_at) invalid.push({ code, reason: "NOT_CHECKED_IN" });
        else if (ticket.reserved_at && ticket.reserved_at >= cutoff && ticket.reservation_token !== token) {
          invalid.push({ code, reason: "RESERVED" });
        }
      }
      if (invalid.length > 0) return { ok: false as const, invalid };

      const now = nowIso();
      for (const code of normalized) {
        run("UPDATE tickets SET reserved_at = ?, reservation_token = ?, updated_at = ? WHERE id = ?",
          now, token, now, rows.get(code)!.id);
      }
      return {
        ok: true as const,
        tickets: all<TicketRow>(
          "SELECT * FROM tickets WHERE reservation_token = ? ORDER BY code ASC", token,
        ).map(toTicket),
      };
    });
  },

  async getReservation(token, ttlMinutes) {
    return reservedTickets(token, ttlMinutes).map(toTicket);
  },

  async releaseReservation(token) {
    run(
      `UPDATE tickets SET reserved_at = NULL, reservation_token = NULL, updated_at = ?
       WHERE reservation_token = ? AND ordered_at IS NULL`,
      nowIso(), token,
    );
  },

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    return transaction(() => {
      const tickets = reservedTickets(input.reservationToken, input.ttlMinutes ?? 15);
      if (tickets.length === 0) {
        return {
          ok: false as const, error: "RESERVATION_EXPIRED" as const,
          message: "Phiên đặt nước đã hết hạn. Vui lòng tải lại trang và nhập lại mã vé.",
        };
      }

      const itemByCode = new Map<string, string>();
      for (const item of input.items) {
        const code = normalizeCode(item.code);
        if (itemByCode.has(code)) {
          return { ok: false as const, error: "INVALID_ITEMS" as const, message: "Mỗi mã vé chỉ được chọn một món." };
        }
        itemByCode.set(code, item.menuItemId);
      }
      if (itemByCode.size !== tickets.length || tickets.some((ticket) => !itemByCode.has(ticket.code))) {
        return {
          ok: false as const, error: "INVALID_ITEMS" as const,
          message: "Vui lòng chọn đúng một món nước cho mỗi mã vé.",
        };
      }

      const selected = new Map<string, MenuRow>();
      for (const menuItemId of itemByCode.values()) {
        const row = one<MenuRow>("SELECT * FROM menu_items WHERE id = ? AND is_available = 1", menuItemId);
        if (!row) {
          return {
            ok: false as const, error: "ITEM_UNAVAILABLE" as const,
            message: "Có món vừa được cập nhật hoặc tạm hết. Vui lòng chọn món khác.",
          };
        }
        selected.set(menuItemId, row);
      }

      const orderId = newId();
      const now = nowIso();
      run(
        `INSERT INTO orders (id, guest_name, seat, status, guest_token, created_at)
         VALUES (?, ?, ?, 'new', ?, ?)`,
        orderId, input.guestName.trim(), input.seat.trim(), newToken(24), now,
      );

      for (const ticket of tickets) {
        const menuRow = selected.get(itemByCode.get(ticket.code)!)!;
        run(
          `INSERT INTO order_items
            (id, order_id, ticket_id, ticket_code, menu_item_id, item_name, item_image_url,
             quantity, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          newId(), orderId, ticket.id, ticket.code, menuRow.id, menuRow.name, menuRow.image_url, now,
        );
        const updated = run(
          `UPDATE tickets SET ordered_at = ?, order_id = ?, reserved_at = NULL,
             reservation_token = NULL, updated_at = ?
           WHERE id = ? AND ordered_at IS NULL AND reservation_token = ?`,
          now, orderId, now, ticket.id, input.reservationToken,
        );
        if (Number(updated.changes) !== 1) throw new Error("TICKET_CHANGED");
      }

      return { ok: true as const, order: getOrderSync(orderId)! };
    });
  },

  async listOrders() {
    return all<OrderRow>("SELECT * FROM orders ORDER BY created_at DESC").map(hydrateOrder);
  },

  async getOrder(id) {
    return getOrderSync(id);
  },

  async getOrderByGuestToken(token) {
    const row = one<OrderRow>("SELECT * FROM orders WHERE guest_token = ?", token);
    return row ? hydrateOrder(row) : null;
  },

  async updateOrderStatus(id, status: OrderStatus) {
    const existing = one<OrderRow>("SELECT * FROM orders WHERE id = ?", id);
    if (!existing) return null;
    if (existing.status === status) return getOrderSync(id);
    if (existing.status === "delivered") throw new Error("INVALID_TRANSITION");
    if (status === "done" && existing.status !== "new") throw new Error("INVALID_TRANSITION");
    if (status === "delivered" && existing.status !== "done") throw new Error("INVALID_TRANSITION");

    const now = nowIso();
    if (status === "done") {
      run("UPDATE orders SET status = 'done', done_at = ? WHERE id = ?", now, id);
    } else {
      run("UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?", now, id);
    }
    return getOrderSync(id);
  },

  async setOrderZaloMessageId(id, messageId) {
    run("UPDATE orders SET zalo_message_id = ? WHERE id = ?", messageId, id);
  },

  async getStats(): Promise<Stats> {
    const tickets = one<{ total: number; checked: number; ordered: number }>(
      `SELECT COUNT(*) AS total,
         SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS checked,
         SUM(CASE WHEN ordered_at IS NOT NULL THEN 1 ELSE 0 END) AS ordered
       FROM tickets`,
    );
    const orders = one<{ pending: number; done: number; delivered: number }>(
      `SELECT
         SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
         SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered
       FROM orders`,
    );
    return {
      totalTickets: tickets?.total || 0,
      checkedIn: tickets?.checked || 0,
      ordered: tickets?.ordered || 0,
      pendingOrders: orders?.pending || 0,
      doneOrders: orders?.done || 0,
      deliveredOrders: orders?.delivered || 0,
    };
  },

  async getSetting(key) {
    return one<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)?.value || null;
  },

  async setSetting(key, value) {
    run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key, value,
    );
  },
};

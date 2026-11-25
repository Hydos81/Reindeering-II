import "server-only";
import { createStaffToken } from "./auth";
import { STATUS_LABEL, shortId } from "./format";
import { repo } from "./db";
import type { Order, ZaloSendResult } from "./types";

const BOT_API = "https://bot-api.zaloplatforms.com";
const token = () => process.env.ZALO_BOT_TOKEN?.trim() || "";
export const isZaloTokenConfigured = () => Boolean(token());

export async function getZaloChatId() {
  try {
    const stored = await repo.getSetting("zalo_chat_id");
    return stored || process.env.ZALO_CHAT_ID?.trim() || null;
  } catch {
    return process.env.ZALO_CHAT_ID?.trim() || null;
  }
}
export async function setZaloChatId(chatId: string) {
  await repo.setSetting("zalo_chat_id", chatId.trim());
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function staffOrderUrl(baseUrl: string, orderId: string, action?: "done" | "delivered") {
  const signed = createStaffToken(orderId);
  const url = `${baseUrl}/staff/order/${orderId}?t=${encodeURIComponent(signed)}`;
  return action ? `${url}&action=${action}` : url;
}

export function buildOrderMessage(order: Order, baseUrl: string) {
  const drinks = order.items
    .map((item, i) => `${i + 1}. <b>${escapeHtml(item.itemName)}</b> <i>(vé ${escapeHtml(item.ticketCode)})</i>`)
    .join("\n");
  return [
    `🎶 <b>ĐƠN NƯỚC MỚI</b> · #${shortId(order.id)}`,
    `👤 Khách: <b>${escapeHtml(order.guestName)}</b>`,
    `🪑 Chỗ ngồi: <b>${escapeHtml(order.seat)}</b>`,
    `🎟️ Vé: ${order.items.map((item) => escapeHtml(item.ticketCode)).join(", ")}`,
    "",
    "<b>Đồ uống</b>",
    drinks,
    "",
    `<b>Trạng thái:</b> ${STATUS_LABEL[order.status]}`,
    "",
    "<b>Cập nhật trạng thái</b>",
    `✅ Đã xong món: ${staffOrderUrl(baseUrl, order.id, "done")}`,
    `🚚 Đã giao món: ${staffOrderUrl(baseUrl, order.id, "delivered")}`,
    "",
    `<i>Mở thẻ đơn: ${staffOrderUrl(baseUrl, order.id)}</i>`,
    `<i>"Đã giao món" chỉ hoạt động sau khi đã xong món.</i>`,
  ].join("\n");
}

export function buildOrderStatusMessage(order: Order, baseUrl: string) {
  return [
    `🔄 <b>CẬP NHẬT ĐƠN #${shortId(order.id)}</b>`,
    `Trạng thái mới: <b>${STATUS_LABEL[order.status]}</b>`,
    `Khách: <b>${escapeHtml(order.guestName)}</b> · Chỗ ngồi: <b>${escapeHtml(order.seat)}</b>`,
    `Đồ uống: ${order.items.map((item) => escapeHtml(item.itemName)).join(", ")}`,
    "",
    `👉 Mở thẻ đơn: ${staffOrderUrl(baseUrl, order.id)}`,
  ].join("\n");
}

async function callBot(method: string, payload: Record<string, unknown>) {
  const botToken = token();
  if (!botToken) return { ok: false as const, error: "Chưa cấu hình ZALO_BOT_TOKEN." };
  try {
    const response = await fetch(`${BOT_API}/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      // Never let a slow Zalo API hold a guest order or staff action open.
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      result?: unknown;
      error?: string;
      message?: string;
    } | null;
    if (!response.ok || !result?.ok) {
      return {
        ok: false as const,
        error: result?.message || result?.error || `Zalo Bot API trả về lỗi ${response.status}.`,
      };
    }
    return { ok: true as const, result: result.result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Không gọi được Zalo." };
  }
}

export async function sendZaloMessage(chatId: string, text: string): Promise<ZaloSendResult> {
  const response = await callBot("sendMessage", { chat_id: chatId, text, parse_mode: "html" });
  if (!response.ok) return { ok: false, error: response.error };
  return { ok: true, messageId: (response.result as { message_id?: string } | undefined)?.message_id };
}

export async function notifyNewOrder(order: Order, baseUrl: string) {
  const chatId = await getZaloChatId();
  if (!chatId) {
    return { ok: false as const, error: "Chưa có Zalo chat ID. Hãy thêm bot vào nhóm hoặc nhập chat ID." };
  }
  const result = await sendZaloMessage(chatId, buildOrderMessage(order, baseUrl));
  if (result.ok && result.messageId) {
    await repo.setOrderZaloMessageId(order.id, result.messageId).catch((error) => {
      console.error("[zalo] Không lưu được message id", error);
    });
  }
  if (!result.ok) console.error("[zalo] Gửi đơn thất bại:", result.error);
  return result;
}

export async function notifyOrderStatus(order: Order, baseUrl: string) {
  const chatId = await getZaloChatId();
  if (!chatId) return { ok: false as const, error: "Chưa có Zalo chat ID." };
  const result = await sendZaloMessage(chatId, buildOrderStatusMessage(order, baseUrl));
  if (!result.ok) console.error("[zalo] Gửi cập nhật thất bại:", result.error);
  return result;
}

export async function sendZaloTest(baseUrl: string) {
  const chatId = await getZaloChatId();
  if (!chatId) return { ok: false as const, error: "Chưa có chat ID. Hãy thêm bot vào nhóm trước." };
  return sendZaloMessage(
    chatId,
    [
      "✅ <b>Kết nối thành công</b>",
      "Đây là tin nhắn thử từ hệ thống đặt nước.",
      `Thẻ đơn mẫu: ${baseUrl}/staff/order/...`,
    ].join("\n"),
  );
}

export async function setupZaloWebhook(baseUrl: string) {
  const webhookSecret = process.env.ZALO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { ok: false as const, error: "Chưa cấu hình ZALO_WEBHOOK_SECRET." };
  }
  const result = await callBot("setWebhook", {
    url: `${baseUrl}/api/zalo/webhook`,
    secret_token: webhookSecret,
  });
  return result.ok ? { ok: true as const, result: result.result } : { ok: false as const, error: result.error };
}

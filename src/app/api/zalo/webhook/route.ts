import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { safeCompare, zaloWebhookSecret } from "@/lib/auth";
import { repo } from "@/lib/db";
import { sendZaloMessage } from "@/lib/zalo";

type ZaloEvent = {
  event_name?: string;
  message?: {
    text?: string;
    chat?: { id?: string; chat_type?: string };
    from?: { id?: string; display_name?: string };
  };
};

export async function POST(request: Request) {
  try {
    const supplied = request.headers.get("x-bot-api-secret-token") || "";
    if (!supplied || !safeCompare(zaloWebhookSecret(), supplied)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = (await request.json().catch(() => null)) as ZaloEvent | null;
    const chat = event?.message?.chat;
    const chatId = chat?.id;

    // The first GROUP message teaches the bot which conversation to post to.
    if (chatId && chat?.chat_type === "GROUP") {
      const saved = await repo.getSetting("zalo_chat_id").catch(() => null);
      if (!saved && !process.env.ZALO_CHAT_ID) {
        await repo.setSetting("zalo_chat_id", chatId);
      }
    }

    const text = event?.message?.text || "";
    if (chatId && /(^|\s)\/id(\s|$)/i.test(text)) {
      await sendZaloMessage(
        chatId,
        [
          `🆔 Chat ID: <b>${chatId}</b>`,
          `Loại hội thoại: ${chat?.chat_type || "UNKNOWN"}`,
          "Hãy dán ID này vào trang Kết nối của admin nếu cần.",
        ].join("\n"),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[zalo-webhook] Lỗi xử lý sự kiện", error);
    return apiError(error);
  }
}

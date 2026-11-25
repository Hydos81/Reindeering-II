import { NextResponse } from "next/server";
import { adminOnly, apiError, badRequest } from "@/lib/api";
import { baseUrlFromRequest } from "@/lib/auth";
import { EVENT_NAME, EVENT_TAGLINE, EVENT_VENUE } from "@/lib/config";
import { isSupabaseEnabled, repo } from "@/lib/db";
import {
  getZaloChatId,
  isZaloTokenConfigured,
  setZaloChatId,
} from "@/lib/zalo";

export async function GET(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const origin = baseUrlFromRequest(request);
    const [stats, chatId] = await Promise.all([repo.getStats(), getZaloChatId()]);

    return NextResponse.json({
      ok: true,
      stats,
      event: {
        name: EVENT_NAME,
        tagline: EVENT_TAGLINE,
        venue: EVENT_VENUE,
      },
      integrations: {
        zalo: {
          tokenConfigured: isZaloTokenConfigured(),
          webhookSecretConfigured: Boolean(process.env.ZALO_WEBHOOK_SECRET),
          chatId,
          webhookUrl: `${origin}/api/zalo/webhook`,
        },
        sheets: {
          url: `${origin}/api/integrations/sheets`,
          secretConfigured: Boolean(process.env.SHEETS_WEBHOOK_SECRET),
        },
        storage: {
          supabaseConfigured: isSupabaseEnabled,
          bucket:
            process.env.SUPABASE_STORAGE_BUCKET ||
            (process.env.NEXT_PUBLIC_SUPABASE_URL ? "menu-images" : null),
        },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const payload = (await request.json().catch(() => null)) as {
      zaloChatId?: unknown;
    } | null;
    if (typeof payload?.zaloChatId !== "string") {
      return badRequest("Thiếu chat ID.");
    }
    await setZaloChatId(payload.zaloChatId.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

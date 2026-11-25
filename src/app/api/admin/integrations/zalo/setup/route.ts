import { NextResponse } from "next/server";
import { adminOnly, apiError } from "@/lib/api";
import { baseUrlFromRequest } from "@/lib/auth";
import { setupZaloWebhook } from "@/lib/zalo";

export async function POST(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const result = await setupZaloWebhook(baseUrlFromRequest(request));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result: result.result });
  } catch (error) {
    return apiError(error);
  }
}

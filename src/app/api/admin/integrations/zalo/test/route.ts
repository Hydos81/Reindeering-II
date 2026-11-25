import { NextResponse } from "next/server";
import { adminOnly, apiError } from "@/lib/api";
import { baseUrlFromRequest } from "@/lib/auth";
import { sendZaloTest } from "@/lib/zalo";

export async function POST(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const result = await sendZaloTest(baseUrlFromRequest(request));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

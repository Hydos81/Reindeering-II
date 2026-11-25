import { NextResponse } from "next/server";
import { adminOnly, apiError } from "@/lib/api";
import { repo } from "@/lib/db";

export async function GET() {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const orders = await repo.listOrders();
    return NextResponse.json(
      { ok: true, orders },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

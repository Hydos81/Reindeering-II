import { NextResponse } from "next/server";
import { adminOnly, apiError, badRequest } from "@/lib/api";
import { repo } from "@/lib/db";

export async function GET() {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const categories = await repo.listCategoriesWithItems(true);
    return NextResponse.json({ ok: true, categories });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const payload = (await request.json().catch(() => null)) as {
      name?: unknown;
      sortOrder?: unknown;
    } | null;
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) return badRequest("Vui lòng nhập tên nhóm món.");

    const category = await repo.createCategory({
      name,
      sortOrder:
        typeof payload?.sortOrder === "number" && Number.isFinite(payload.sortOrder)
          ? payload.sortOrder
          : undefined,
    });
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    return apiError(error);
  }
}

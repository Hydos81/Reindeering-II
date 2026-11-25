import { NextResponse } from "next/server";
import { adminOnly, apiError, badRequest } from "@/lib/api";
import { repo } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => null)) as {
      name?: unknown;
      sortOrder?: unknown;
    } | null;
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) return badRequest("Vui lòng nhập tên nhóm món.");

    const category = await repo.updateCategory(id, {
      name,
      sortOrder:
        typeof payload?.sortOrder === "number" && Number.isFinite(payload.sortOrder)
          ? payload.sortOrder
          : undefined,
    });
    if (!category) {
      return NextResponse.json({ error: "Không tìm thấy nhóm món." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const { id } = await params;
    const removed = await repo.deleteCategory(id);
    if (!removed) {
      return NextResponse.json({ error: "Không tìm thấy nhóm món." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

import { NextResponse } from "next/server";
import { adminOnly, apiError, badRequest } from "@/lib/api";
import { repo } from "@/lib/db";

type ImageCheck =
  | { accepted: true; value: string | null }
  | { accepted: false };

function checkImageUrl(value: unknown): ImageCheck {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { accepted: true, value: null };
  if (raw.startsWith("/") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return { accepted: true, value: raw };
  }
  return { accepted: false };
}

type MenuItemPatch = {
  categoryId?: unknown;
  name?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  isAvailable?: unknown;
  sortOrder?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => null)) as
      | MenuItemPatch
      | null;
    if (!payload || typeof payload !== "object") {
      return badRequest("Dữ liệu không hợp lệ.");
    }

    let imageUrl: string | null | undefined;
    if (payload.imageUrl !== undefined) {
      const image = checkImageUrl(payload.imageUrl);
      if (!image.accepted) return badRequest("Đường dẫn ảnh không hợp lệ.");
      imageUrl = image.value;
    }

    const item = await repo.updateMenuItem(id, {
      categoryId:
        typeof payload.categoryId === "string" && payload.categoryId.trim()
          ? payload.categoryId.trim()
          : undefined,
      name:
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : undefined,
      description:
        payload.description === undefined
          ? undefined
          : typeof payload.description === "string"
            ? payload.description.trim() || null
            : null,
      imageUrl,
      isAvailable:
        typeof payload.isAvailable === "boolean" ? payload.isAvailable : undefined,
      sortOrder:
        typeof payload.sortOrder === "number" && Number.isFinite(payload.sortOrder)
          ? payload.sortOrder
          : undefined,
    });
    if (!item) return NextResponse.json({ error: "Không tìm thấy món." }, { status: 404 });
    return NextResponse.json({ ok: true, item });
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
    const removed = await repo.deleteMenuItem(id);
    if (!removed) return NextResponse.json({ error: "Không tìm thấy món." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

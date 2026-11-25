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

export async function POST(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const payload = (await request.json().catch(() => null)) as {
      categoryId?: unknown;
      name?: unknown;
      description?: unknown;
      imageUrl?: unknown;
      isAvailable?: unknown;
      sortOrder?: unknown;
    } | null;

    const categoryId =
      typeof payload?.categoryId === "string" ? payload.categoryId.trim() : "";
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!categoryId) return badRequest("Vui lòng chọn nhóm món.");
    if (!name) return badRequest("Vui lòng nhập tên món.");

    const image = checkImageUrl(payload?.imageUrl);
    if (!image.accepted) return badRequest("Đường dẫn ảnh không hợp lệ.");

    const item = await repo.createMenuItem({
      categoryId,
      name,
      description:
        typeof payload?.description === "string"
          ? payload.description.trim() || null
          : null,
      imageUrl: image.value,
      isAvailable: payload?.isAvailable !== false,
      sortOrder:
        typeof payload?.sortOrder === "number" && Number.isFinite(payload.sortOrder)
          ? payload.sortOrder
          : undefined,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return apiError(error);
  }
}

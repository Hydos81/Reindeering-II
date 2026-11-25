import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/api";
import { saveMenuImage } from "@/lib/storage";

// Image processing uses Node APIs (Buffer, node:fs), so this route must not
// run on the Edge runtime.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await adminOnly();
  if (guard) return guard;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chưa chọn tệp ảnh." }, { status: 400 });
    }

    const url = await saveMenuImage(file);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải ảnh lên. Vui lòng thử lại.",
      },
      { status: 400 },
    );
  }
}

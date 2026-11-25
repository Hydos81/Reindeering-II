import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const MAX_BYTES = 6 * 1024 * 1024;

export async function saveMenuImage(file: File) {
  const ext = MIME_EXT[file.type];
  if (!ext) throw new Error("Chỉ hỗ trợ ảnh JPG, PNG, WEBP, GIF hoặc AVIF.");
  if (file.size > MAX_BYTES) throw new Error("Ảnh quá lớn. Vui lòng chọn ảnh dưới 6MB.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "menu-images";

  if (url && key) {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const objectPath = `menu/${fileName}`;
    const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(`Không tải ảnh lên được (bucket "${bucket}"): ${error.message}`);
    return supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
  }

  if (process.env.VERCEL) {
    throw new Error("Production cần cấu hình Supabase Storage để lưu ảnh menu.");
  }
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), bytes);
  return `/uploads/${fileName}`;
}

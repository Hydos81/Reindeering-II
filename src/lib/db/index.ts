import "server-only";
import type { Repo } from "./interface";
import { sqliteRepo } from "./sqlite";
import { supabaseRepo } from "./supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseEnabled = Boolean(supabaseUrl && serviceRoleKey);

if (supabaseUrl && !serviceRoleKey) {
  console.warn("[db] Có Supabase URL nhưng thiếu service role key — dùng SQLite cục bộ.");
}

// With both values present the app switches to Postgres automatically.
export const repo: Repo = isSupabaseEnabled ? supabaseRepo : sqliteRepo;
export type { Repo };

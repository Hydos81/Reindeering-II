import type { Stats } from "./types";

export type OverviewData = {
  ok: true;
  stats: Stats;
  event: { name: string; tagline: string; venue: string };
  integrations: {
    zalo: {
      tokenConfigured: boolean;
      webhookSecretConfigured: boolean;
      chatId: string | null;
      webhookUrl: string;
    };
    sheets: { url: string; secretConfigured: boolean };
    storage: { supabaseConfigured: boolean; bucket: string | null };
  };
};

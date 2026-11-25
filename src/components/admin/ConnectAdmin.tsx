"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  Send,
  Settings2,
  TriangleAlert,
  Webhook,
  XCircle,
} from "lucide-react";
import { Toast } from "@/components/Toast";
import { Badge, Button, Card, SectionTitle, fieldClass } from "@/components/admin/AdminUi";
import { adminFetch, errorMessage } from "@/lib/admin-client";
import type { OverviewData } from "@/lib/admin-types";
import { cn } from "@/lib/format";

type Notice = { message: string; tone: "success" | "error" | "info" };

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge tone={ok ? "sage" : "gold"}>
      {ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
      {label}
    </Badge>
  );
}

function CopyButton({
  value,
  label,
  onCopied,
}: {
  value: string;
  label?: string;
  onCopied: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied("Đã sao chép vào bộ nhớ tạm.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onCopied("Trình duyệt không cho phép sao chép.");
    }
  }

  return (
    <Button size="sm" onClick={() => void copy()}>
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Đã chép" : (label ?? "Sao chép")}
    </Button>
  );
}

function Panel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card padded={false}>
      <div className="flex items-start gap-3 border-b border-line/70 bg-cream/40 px-4 py-4 sm:px-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-coffee text-cream">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold leading-tight text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-2 space-y-2.5 text-xs leading-relaxed text-muted">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-cream text-[10px] font-bold text-coffee">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function ConnectAdmin() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState("");
  const [savingChatId, setSavingChatId] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await adminFetch<OverviewData>("/api/admin/overview");
      setOverview(data);
      setChatId(data.integrations.zalo.chatId ?? "");
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không tải được thông tin kết nối."),
        tone: "error",
      });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount-time fetch; the async loader updates state after the effect returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function saveChatId() {
    setSavingChatId(true);
    try {
      await adminFetch("/api/admin/overview", {
        method: "PATCH",
        body: JSON.stringify({ zaloChatId: chatId }),
      });
      setNotice({ message: "Đã lưu Zalo chat ID.", tone: "success" });
      await load(true);
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không lưu được chat ID."),
        tone: "error",
      });
    } finally {
      setSavingChatId(false);
    }
  }

  async function setupWebhook() {
    setSettingWebhook(true);
    try {
      await adminFetch("/api/admin/integrations/zalo/setup", { method: "POST" });
      setNotice({
        message: "Đã đặt webhook Zalo. Nhắn /id trong nhóm để lấy chat ID.",
        tone: "success",
      });
      await load(true);
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không đặt được webhook. Kiểm tra token và secret."),
        tone: "error",
      });
    } finally {
      setSettingWebhook(false);
    }
  }

  async function testZalo() {
    setTesting(true);
    try {
      await adminFetch("/api/admin/integrations/zalo/test", { method: "POST" });
      setNotice({ message: "Đã gửi tin nhắn thử vào nhóm Zalo.", tone: "success" });
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không gửi được tin nhắn thử."),
        tone: "error",
      });
    } finally {
      setTesting(false);
    }
  }

  const zalo = overview?.integrations.zalo;
  const sheets = overview?.integrations.sheets;
  const storage = overview?.integrations.storage;
  const isLocal = (value: string | undefined) =>
    Boolean(value?.includes("localhost") || value?.includes("127.0.0.1"));

  return (
    <div>
      <SectionTitle
        eyebrow="Hệ thống · Kết nối"
        title="Kết nối & tích hợp"
        description="Báo đơn vào nhóm Zalo nhân sự và đồng bộ vé tự động từ Google Sheets."
        actions={
          <Button onClick={() => void load()} loading={loading}>
            <Settings2 className="size-4" />
            Làm mới
          </Button>
        }
      />

      {loading && !overview ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-line bg-paper/80 py-20 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Đang tải thông tin kết nối…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl!" padded>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <MessageCircle className="size-3.5 text-terracotta" />
                Zalo Bot
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-ink">
                {zalo?.tokenConfigured ? "Đã có token" : "Chưa cấu hình"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill ok={Boolean(zalo?.tokenConfigured)} label="Token" />
                <StatusPill ok={Boolean(zalo?.chatId)} label="Chat ID" />
              </div>
            </Card>
            <Card className="rounded-2xl!" padded>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <FileSpreadsheet className="size-3.5 text-sage" />
                Google Sheets
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-ink">
                {sheets?.secretConfigured ? "Sẵn sàng" : "Chưa có mã bí mật"}
              </p>
              <div className="mt-2">
                <StatusPill ok={Boolean(sheets?.secretConfigured)} label="Webhook secret" />
              </div>
            </Card>
            <Card className="rounded-2xl!" padded>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <Cloud className="size-3.5 text-gold" />
                Lưu trữ ảnh
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-ink">
                {storage?.supabaseConfigured ? "Supabase Storage" : "Máy chủ nội bộ"}
              </p>
              <p className="mt-1 truncate text-[10px] text-muted">
                {storage?.bucket ? `Bucket: ${storage.bucket}` : "Chưa cấu hình bucket"}
              </p>
            </Card>
          </div>

          {isLocal(zalo?.webhookUrl) && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Webhook đang trỏ về localhost nên Zalo và Google Sheets không gọi
              tới được. Hãy đặt{" "}
              <code className="rounded bg-white/60 px-1 font-mono">
                NEXT_PUBLIC_APP_URL
              </code>{" "}
              thành tên miền công khai khi triển khai.
            </div>
          )}

          <Panel
            icon={MessageCircle}
            title="Zalo Bot cho nhóm nhân sự"
            description="Gửi thẻ đơn nước kèm liên kết cập nhật trạng thái vào nhóm pha chế."
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta">
                  Cách kết nối
                </p>
                <Steps
                  items={[
                    <>
                      Tạo bot trên Zalo Bot Platform và thêm{" "}
                      <code className="font-mono text-coffee">ZALO_BOT_TOKEN</code>{" "}
                      vào biến môi trường.
                    </>,
                    <>
                      Thêm bot vào nhóm nhân sự (tính năng nhóm đang ở giai đoạn
                      Beta).
                    </>,
                    <>
                      Bấm <strong>Đặt webhook</strong>, rồi nhắn{" "}
                      <code className="rounded bg-cream px-1 font-mono text-coffee">
                        /id
                      </code>{" "}
                      trong nhóm để lấy chat ID.
                    </>,
                    <>
                      Dán chat ID vào ô bên cạnh, lưu lại rồi bấm{" "}
                      <strong>Gửi thử</strong> để xác nhận.
                    </>,
                  ]}
                />
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-line/80 bg-cream/40 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                      Webhook URL
                    </p>
                    {zalo?.webhookUrl && (
                      <CopyButton
                        value={zalo.webhookUrl}
                        label="Chép URL"
                        onCopied={(message) => setNotice({ message, tone: "success" })}
                      />
                    )}
                  </div>
                  <code className="mt-1.5 block break-all font-mono text-[10px] leading-relaxed text-coffee">
                    {zalo?.webhookUrl ?? "Đang tải…"}
                  </code>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <StatusPill
                      ok={Boolean(zalo?.webhookSecretConfigured)}
                      label="Webhook secret"
                    />
                    <StatusPill
                      ok={Boolean(zalo?.chatId)}
                      label={zalo?.chatId ? "Đã có chat ID" : "Chưa có chat ID"}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="zalo-chat-id" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-coffee">
                    Zalo chat ID của nhóm
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="zalo-chat-id"
                      value={chatId}
                      onChange={(event) => setChatId(event.target.value)}
                      placeholder="VD: 123456789012345678"
                      className={cn(fieldClass, "min-w-0 flex-1")}
                    />
                    <Button
                      variant="primary"
                      onClick={() => void saveChatId()}
                      disabled={savingChatId || chatId === (zalo?.chatId ?? "")}
                    >
                      {savingChatId && <Loader2 className="size-4 animate-spin" />}
                      Lưu
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => void setupWebhook()}
                    disabled={
                      settingWebhook ||
                      !zalo?.tokenConfigured ||
                      !zalo?.webhookSecretConfigured
                    }
                    className="flex-1"
                  >
                    {settingWebhook ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Webhook className="size-4" />
                    )}
                    Đặt webhook
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void testZalo()}
                    disabled={testing || !zalo?.tokenConfigured || !zalo?.chatId}
                    className="flex-1"
                  >
                    {testing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Gửi thử
                  </Button>
                </div>
                {!zalo?.tokenConfigured && (
                  <p className="text-[10px] leading-relaxed text-amber-700">
                    Cần thêm <code>ZALO_BOT_TOKEN</code> rồi khởi động lại ứng dụng.
                  </p>
                )}
              </div>
            </div>
          </Panel>

          <Panel
            icon={FileSpreadsheet}
            title="Đồng bộ vé từ Google Sheets"
            description="Dán trực tiếp hoặc dùng Apps Script để tự đẩy danh sách vé về web."
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta">
                  Cách đồng bộ
                </p>
                <Steps
                  items={[
                    <>
                      Tạo Sheet có các cột{" "}
                      <strong>Mã vé, Tên khách, SĐT, Ghi chú</strong>. Dòng tiêu
                      đề không bắt buộc.
                    </>,
                    <>
                      Mở <strong>Tiện ích mở rộng → Apps Script</strong>, dán{" "}
                      <a
                        href="/google-apps-script/Code.gs"
                        target="_blank"
                        className="font-semibold text-terracotta underline decoration-terracotta/30 underline-offset-2"
                      >
                        Code.gs
                      </a>
                      .
                    </>,
                    <>
                      Trong <strong>Thuộc tính tập lệnh</strong>, thêm{" "}
                      <code className="font-mono text-coffee">WEBHOOK_URL</code> và{" "}
                      <code className="font-mono text-coffee">WEBHOOK_SECRET</code>{" "}
                      (bằng <code>SHEETS_WEBHOOK_SECRET</code> trên máy chủ).
                    </>,
                    <>
                      Bấm <strong>Đồng bộ vé</strong> trong menu Sheet. Có thể cài
                      trigger để tự chạy khi sửa Sheet.
                    </>,
                  ]}
                />
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-cream/50 px-3 py-2.5 text-[10px] leading-relaxed text-muted">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-terracotta" />
                  Mã vé đã có sẽ được cập nhật thông tin khách, không làm mất
                  check-in hay đơn đã đặt.
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-line/80 bg-cream/40 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                      Sheets webhook URL
                    </p>
                    {sheets?.url && (
                      <CopyButton
                        value={sheets.url}
                        label="Chép URL"
                        onCopied={(message) => setNotice({ message, tone: "success" })}
                      />
                    )}
                  </div>
                  <code className="mt-1.5 block break-all font-mono text-[10px] leading-relaxed text-coffee">
                    {sheets?.url ?? "Đang tải…"}
                  </code>
                  <div className="mt-2.5">
                    <StatusPill ok={Boolean(sheets?.secretConfigured)} label="Webhook secret" />
                  </div>
                </div>

                <a href="/google-apps-script/Code.gs" download className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-coffee transition hover:border-terracotta/30 hover:text-terracotta",
                )}>
                  <FileSpreadsheet className="size-4" />
                  Tải Code.gs
                </a>

                <div className="rounded-xl border border-line/70 bg-paper px-3 py-2.5 text-[10px] leading-relaxed text-muted">
                  <p className="flex items-center gap-1.5 font-bold text-coffee">
                    <Link2 className="size-3.5 text-terracotta" />
                    Hoặc dán thủ công
                  </p>
                  <p className="mt-1">
                    Vào{" "}
                    <Link href="/admin/tickets" className="font-semibold text-terracotta">
                      Khách & vé → Nhập danh sách
                    </Link>{" "}
                    rồi dán vùng dữ liệu từ Sheets.
                  </p>
                </div>

                {!sheets?.secretConfigured && (
                  <p className="text-[10px] leading-relaxed text-amber-700">
                    Cần đặt <code>SHEETS_WEBHOOK_SECRET</code> trên máy chủ trước khi
                    dùng Apps Script.
                  </p>
                )}
                {isLocal(sheets?.url) && (
                  <p className="text-[10px] leading-relaxed text-amber-700">
                    URL đang là localhost; Google Apps Script sẽ không gọi được. Hãy
                    dùng tên miền công khai.
                  </p>
                )}
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              icon={Cloud}
              title="Lưu trữ ảnh menu"
              description="Ảnh tải lên được lưu ở Supabase Storage hoặc trên máy chủ khi chạy local."
            >
              <div className="space-y-3 text-xs leading-relaxed text-muted">
                <div className="flex items-start gap-2.5 rounded-xl border border-line bg-cream/40 p-3">
                  <Database className="mt-0.5 size-4 shrink-0 text-terracotta" />
                  <div>
                    <p className="font-bold text-coffee">
                      {storage?.supabaseConfigured
                        ? "Đang dùng Supabase Storage"
                        : "Đang lưu trên máy chủ"}
                    </p>
                    <p className="mt-0.5">
                      Bucket:{" "}
                      <code className="font-mono">
                        {storage?.bucket ?? "chưa cấu hình"}
                      </code>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ImageIcon className="mt-0.5 size-4 shrink-0 text-sage" />
                  <p>
                    Trên Vercel cần{" "}
                    <code className="font-mono text-coffee">NEXT_PUBLIC_SUPABASE_URL</code>
                    ,{" "}
                    <code className="font-mono text-coffee">
                      SUPABASE_SERVICE_ROLE_KEY
                    </code>{" "}
                    và bucket công khai{" "}
                    <code className="font-mono text-coffee">menu-images</code>.
                  </p>
                </div>
              </div>
            </Panel>

            <Panel
              icon={ExternalLink}
              title="Trang khách & thông tin đêm nhạc"
              description="Kiểm tra nhanh trang khách trước khi phát vé cho khán giả."
            >
              <div className="space-y-3 text-xs leading-relaxed text-muted">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                    Đêm nhạc
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold leading-tight text-ink">
                    {overview?.event.name}
                  </p>
                  <p className="mt-0.5 italic">{overview?.event.tagline}</p>
                  <p className="mt-0.5">{overview?.event.venue}</p>
                </div>
                <a href="/" target="_blank" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-coffee transition hover:border-terracotta/30 hover:text-terracotta">
                  <ExternalLink className="size-4" />
                  Mở trang đặt nước của khách
                </a>
                <p className="text-[10px]">
                  Tên, tagline và địa điểm đổi qua biến{" "}
                  <code>NEXT_PUBLIC_EVENT_*</code>.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      )}

      <Toast message={notice?.message ?? null} tone={notice?.tone} onClose={() => setNotice(null)} />
    </div>
  );
}

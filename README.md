# Đêm Nhạc Thiện Nguyện · Đặt nước theo vé

Ứng dụng web dành cho đêm nhạc thiện nguyện: khách nhập mã vé để chọn một món nước, nhân sự check-in tại cửa, quầy pha chế nhận đơn qua nhóm Zalo và cập nhật trạng thái giao nước. Mỗi mã vé chỉ được dùng một lần.

## Tính năng

- **Khách**: nhập tên, chỗ ngồi và một hoặc nhiều mã vé; xem menu theo nhóm; bắt buộc chọn đủ món cho từng vé; theo dõi trạng thái đơn.
- **Check-in**: vé phải được nhân sự check-in trước khi đặt nước; mỗi vé một món; sau khi đặt, vé không dùng lại.
- **Nhân sự / Zalo**: tin nhắn thẻ đơn nước gửi vào nhóm Zalo, kèm liên kết mở trang cập nhật trạng thái `Chưa làm món → Đã xong món → Đã giao món`.
- **Quản trị** tại `/admin`: thống kê, danh sách khách & vé, check-in, nhập hàng loạt từ Google Sheets, CRUD menu kèm tải ảnh, danh sách đơn nước, in mã QR vé, cấu hình kết nối.
- **Google Sheets**: dán trực tiếp hoặc tự đồng bộ bằng Apps Script.
- **Hai chế độ dữ liệu**: SQLite cục bộ khi phát triển; Supabase Postgres + Storage khi chạy production.

## Công nghệ

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4
- Supabase Postgres (production) / `node:sqlite` (local)
- Zalo Bot Platform API
- `qrcode` cho mã QR

## Chạy cục bộ

Yêu cầu Node.js 22.5 trở lên (khuyến nghị 24/26) vì dùng `node:sqlite`.

```bash
npm install
npm run seed
npm run dev
```

Mở:

- Trang khách: http://localhost:3000
- Quản trị: http://localhost:3000/admin

File `.env.local` đã được tạo sẵn cho môi trường phát triển. Mật khẩu quản trị mặc định là `admin123`; hãy đổi trước khi dùng thật. Nếu muốn tạo lại từ mẫu:

```bash
copy .env.example .env.local
```

Lệnh `npm run seed` tạo menu mẫu và 10 vé demo (`DEMO-001`…`DEMO-010`), tất cả đều đã được check-in và sẵn sàng đặt nước. Chạy lại lệnh này sẽ reset đơn của các vé demo (xóa đơn đã đặt, giải phóng chỗ giữ và đảm bảo check-in) để bạn có thể thử nghiệm nhiều lần. Script bỏ qua bước tạo menu nếu đã có dữ liệu.

### Dữ liệu cục bộ

- SQLite: `data/app.db`
- Ảnh menu tải lên: `public/uploads/`
- Để sao lưu, dừng server rồi sao chép `data/app.db` (và thư mục `public/uploads` nếu dùng ảnh cục bộ).

## Sử dụng nhanh

1. Đăng nhập `/admin` → **Khách & vé** → nhập danh sách hoặc tạo vé.
2. Khi khách đến, bấm **Check-in** trên vé tương ứng.
3. Khách quét QR vé hoặc mở trang chủ, nhập tên, chỗ ngồi, mã vé và chọn món.
4. Đơn mới xuất hiện trong **Đơn nước** và nhóm Zalo nhân sự (nếu đã kết nối).
5. Quầy bấm **Xong món**, sau đó mới có thể bấm **Giao món**.

Mã QR của từng vé mở liên kết dạng `/?code=MA-VE` và tự điền mã vé. Khách vẫn cần nhập tên và chỗ ngồi.

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Production | URL công khai, dùng tạo link trong Zalo và webhook. |
| `ADMIN_PASSWORD` | Production | Mật khẩu `/admin`. Production không cho đăng nhập nếu thiếu. |
| `ADMIN_SESSION_SECRET` | Production | Chuỗi bí mật ký cookie đăng nhập, tối thiểu 16 ký tự. |
| `STAFF_ACTION_SECRET` | Production | Chuỗi bí mật ký link cập nhật đơn trong Zalo. |
| `SHEETS_WEBHOOK_SECRET` | Production (khi dùng Sheets) | Mã bí mật Apps Script gửi kèm. Bắt buộc trong production — không có giá trị mặc định. |
| `ZALO_BOT_TOKEN` | Khi dùng Zalo | Token bot từ Zalo Bot Platform. |
| `ZALO_CHAT_ID` | Không | Chat ID dự phòng; thường lưu trong admin. |
| `ZALO_WEBHOOK_SECRET` | Production (khi dùng Zalo) | Secret token xác thực webhook Zalo. Bắt buộc trong production — không có giá trị mặc định. |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | URL project Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Service role key — chỉ đặt trên server. |
| `SUPABASE_STORAGE_BUCKET` | Không | Mặc định `menu-images`. |
| `SQLITE_PATH` | Không | Mặc định `data/app.db`. |
| `NEXT_PUBLIC_EVENT_NAME` | Không | Tên đêm nhạc. |
| `NEXT_PUBLIC_EVENT_TAGLINE` | Không | Dòng giới thiệu. |
| `NEXT_PUBLIC_EVENT_VENUE` | Không | Địa điểm. |

> Đặt biến trên Vercel/dashboard máy chủ, không commit file `.env.local` hoặc service role key.

## Supabase (production)

1. Tạo project tại [supabase.com](https://supabase.com).
2. Mở **SQL Editor**, dán và chạy toàn bộ `supabase/schema.sql`. File này tạo bảng, index, RLS, bucket `menu-images` và các hàm RPC nguyên tử.
3. Thêm vào môi trường:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET=menu-images` (nếu dùng tên khác, sửa cả bucket trong SQL)
4. Khởi động lại ứng dụng. Khi có đủ URL và service role key, ứng dụng tự chuyển từ SQLite sang Supabase.

Toàn bộ truy cập dữ liệu diễn ra ở server bằng service role key. RLS được bật và không tạo policy công khai. Không bao giờ để lộ service role key ra client.

## Zalo Bot

1. Tạo bot trên Zalo Bot Platform và lấy token.
2. Thêm `ZALO_BOT_TOKEN` và `ZALO_WEBHOOK_SECRET` vào môi trường.
3. Thêm bot vào nhóm nhân sự (tính năng nhóm đang Beta).
4. Vào `/admin/connect`, bấm **Đặt webhook** rồi gửi `/id` trong nhóm để nhận chat ID.
5. Dán chat ID, lưu và bấm **Gửi thử**.

Nếu chưa cấu hình Zalo, đơn vẫn hoạt động bình thường; chỉ thiếu thông báo tự động. Zalo Bot API không hỗ trợ nút inline hoặc sửa tin nhắn, nên tin nhắn chứa liên kết tới thẻ đơn có nút cập nhật trạng thái.

## Google Sheets

### Cách 1 — Dán trực tiếp

Vào **Khách & vé → Nhập danh sách**, sao chép vùng dữ liệu từ Google Sheets và dán. Cột mặc định:

```text
Mã vé | Tên khách | SĐT | Ghi chú
```

Hỗ trợ TSV, CSV, dấu `;`, dòng tiêu đề hoặc không. Mã vé đã tồn tại sẽ cập nhật tên/SĐT/ghi chú, không làm mất check-in hay đơn đã đặt.

### Cách 2 — Apps Script tự đồng bộ

File mẫu: `public/google-apps-script/Code.gs` (tải tại `/google-apps-script/Code.gs`).

1. Mở Google Sheet → **Tiện ích mở rộng → Apps Script**.
2. Dán nội dung `Code.gs`.
3. Vào **Cài đặt dự án → Thuộc tính tập lệnh**, thêm:
   - `WEBHOOK_URL`: URL lấy ở `/admin/connect`
   - `WEBHOOK_SECRET`: trùng với `SHEETS_WEBHOOK_SECRET`
   - `SHEET_NAME` (không bắt buộc): tên tab cần đồng bộ
4. Lưu, chạy hàm `syncTickets` một lần để cấp quyền.
5. Tải lại Sheet và dùng menu **Vé đêm nhạc** để đồng bộ hoặc cài trigger mỗi 5 phút.

Google Apps Script phải gọi được URL công khai; `localhost` không hoạt động.

## Mã QR vé

Trang **Mã QR vé** tạo QR theo từng vé với URL `{tên miền}/?code={mã vé}`.

- Kiểm tra tên miền trước khi in; không dùng `localhost` cho khách quét.
- Lọc vé chưa đặt nước, tìm kiếm, chọn in hoặc ẩn tên khách.
- Nút **In trang này** chỉ in lưới QR. Nên in thử và quét bằng điện thoại trước.

## API chính

| Route | Mục đích |
| --- | --- |
| `POST /api/guest/validate` | Giữ chỗ vé và kiểm tra điều kiện đặt nước. |
| `POST /api/guest/order` | Tạo đơn nước nguyên tử. |
| `GET /api/guest/orders/[token]` | Trạng thái đơn cho khách. |
| `/api/admin/*` | Quản trị vé, menu, đơn, kết nối. Yêu cầu cookie admin. |
| `/api/staff/order/[id]` | Thẻ đơn cho nhân sự; yêu cầu token ký trong link. |
| `POST /api/integrations/sheets` | Webhook Google Sheets, xác thực bằng secret. |
| `POST /api/zalo/webhook` | Nhận cập nhật từ Zalo Bot Platform. |

## Kiểm tra & triển khai

```bash
npm run lint
npm run build
npm start
```

Production cần Supabase vì filesystem trên Vercel không bền vững. Đặt `NEXT_PUBLIC_APP_URL` thành tên miền thật trước khi đặt webhook Zalo hoặc cấu hình Apps Script. Sau khi deploy, kiểm tra lại:

- Đăng nhập admin bằng `ADMIN_PASSWORD` mạnh.
- Ảnh menu tải lên thành công vào Supabase Storage.
- Gửi thử Zalo và đồng bộ thử Sheets.
- Quét thử QR, check-in, đặt nước, cập nhật xong món và giao món.

## Cấu trúc chính

```text
src/app/                 Trang khách, admin, staff, API routes
src/components/          UI khách, admin, nhân sự
src/lib/db/              SQLite + Supabase repository
src/lib/zalo.ts          Tin nhắn và Zalo Bot API
supabase/schema.sql      Schema, RLS, RPC, bucket
scripts/seed.ts          Menu và vé demo
public/google-apps-script/Code.gs
```

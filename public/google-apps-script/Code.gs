/**
 * Google Apps Script — đồng bộ danh sách vé từ Google Sheet về website.
 *
 * Cài đặt:
 * 1. Mở Sheet → Tiện ích mở rộng → Apps Script, dán toàn bộ file này.
 * 2. Cài đặt dự án → Thuộc tính tập lệnh, thêm:
 *      WEBHOOK_URL    = URL lấy trong trang /admin/connect
 *      WEBHOOK_SECRET = trùng SHEETS_WEBHOOK_SECRET trên máy chủ
 *      SHEET_NAME     = (tuỳ chọn) tên tab cần đồng bộ
 * 3. Lưu, chạy hàm syncTickets một lần để cấp quyền.
 * 4. Tải lại Sheet, dùng menu "Vé đêm nhạc" để đồng bộ hoặc cài trigger 5 phút.
 *
 * Định dạng mặc định: Mã vé | Tên khách | SĐT | Ghi chú.
 * Có thể có hoặc không có dòng tiêu đề.
 */

var HEADER_ALIASES = {
  code: ["mave", "ma", "code", "ticket", "ticketcode", "sove"],
  guestName: ["tenkhach", "ten", "name", "guest", "guestname", "hoten", "khach", "khachhang"],
  phone: ["sdt", "phone", "dienthoai", "sodienthoai", "tel", "mobile"],
  note: ["ghichu", "note", "notes"]
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Vé đêm nhạc")
    .addItem("Đồng bộ vé ngay", "syncTickets")
    .addItem("Cài tự động đồng bộ mỗi 5 phút", "installSyncTrigger")
    .addItem("Xoá lịch tự động đồng bộ", "removeSyncTriggers")
    .addToUi();
}

function config_() {
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty("WEBHOOK_URL") || "").trim();
  var secret = (props.getProperty("WEBHOOK_SECRET") || "").trim();
  var sheetName = (props.getProperty("SHEET_NAME") || "").trim();

  if (!url) throw new Error("Chưa cấu hình WEBHOOK_URL trong Thuộc tính tập lệnh.");
  if (!secret) throw new Error("Chưa cấu hình WEBHOOK_SECRET trong Thuộc tính tập lệnh.");

  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = sheetName ? book.getSheetByName(sheetName) : book.getSheets()[0];
  if (!sheet) throw new Error('Không tìm thấy tab "' + sheetName + '".');

  return { url: url, secret: secret, sheet: sheet };
}

function deaccent_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function headerPositions_(row) {
  var normalized = row.map(deaccent_);
  var positions = {};
  Object.keys(HEADER_ALIASES).forEach(function (field) {
    for (var i = 0; i < normalized.length; i += 1) {
      if (HEADER_ALIASES[field].indexOf(normalized[i]) !== -1) {
        positions[field] = i;
        break;
      }
    }
  });
  return positions.code !== undefined && positions.guestName !== undefined ? positions : null;
}

function readTickets_() {
  var config = config_();
  var values = config.sheet.getDataRange().getValues();
  if (!values.length) return [];

  var header = headerPositions_(values[0] || []);
  var rows = [];
  var seen = {};

  for (var i = header ? 1 : 0; i < values.length; i += 1) {
    var row = values[i] || [];
    if (row.join("").trim() === "") continue;

    var code = String(header ? row[header.code] : row[0] || "")
      .trim().toUpperCase().replace(/\s+/g, "");
    var guestName = String(header ? row[header.guestName] : row[1] || "").trim();
    if (!code || !guestName || seen[code]) continue;
    seen[code] = true;

    rows.push({
      code: code,
      guestName: guestName,
      phone: String((header && header.phone !== undefined ? row[header.phone] : row[2]) || "").trim(),
      note: String((header && header.note !== undefined ? row[header.note] : row[3]) || "").trim()
    });
  }
  return rows;
}

function postChunk_(config, rows) {
  var response = UrlFetchApp.fetch(config.url, {
    method: "post",
    contentType: "application/json",
    headers: { "x-sheets-secret": config.secret },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var body = response.getContentText();
  var data;
  try { data = JSON.parse(body); } catch (error) { data = { error: body }; }

  if (status < 200 || status >= 300) {
    throw new Error("Webhook trả về lỗi " + status + ": " + (data.error || body || "không rõ"));
  }
  return data;
}

function syncTickets() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error("Đang có một lần đồng bộ khác chạy. Vui lòng thử lại sau.");
  }

  try {
    var config = config_();
    var rows = readTickets_();
    if (rows.length === 0) {
      throw new Error("Không tìm thấy dòng hợp lệ. Cần ít nhất cột Mã vé và Tên khách.");
    }
    if (rows.length > 2000) throw new Error("Mỗi lần chỉ đồng bộ tối đa 2.000 vé.");

    var inserted = 0, updated = 0, skipped = 0, warnings = [];
    var chunkSize = 400;
    for (var start = 0; start < rows.length; start += chunkSize) {
      var result = postChunk_(config, rows.slice(start, start + chunkSize));
      inserted += Number(result.inserted || 0);
      updated += Number(result.updated || 0);
      skipped += Number(result.skipped || 0);
      if (Array.isArray(result.errors)) warnings = warnings.concat(result.errors);
      Utilities.sleep(250);
    }

    var message =
      "Đồng bộ xong " + rows.length + " vé.\n" +
      "Thêm mới: " + inserted + "\n" +
      "Cập nhật: " + updated + "\n" +
      "Bỏ qua: " + skipped;
    if (warnings.length) message += "\n\nCảnh báo:\n" + warnings.slice(0, 10).join("\n");

    try {
      SpreadsheetApp.getUi().alert(message);
    } catch (uiError) {
      Logger.log(message);
    }
  } finally {
    lock.releaseLock();
  }
}

function installSyncTrigger() {
  removeSyncTriggers();
  ScriptApp.newTrigger("syncTickets").timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert("Đã cài tự động đồng bộ mỗi 5 phút.");
}

function removeSyncTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "syncTickets") ScriptApp.deleteTrigger(trigger);
  });
}

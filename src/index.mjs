// src/index.mjs
// Viet Radio MCP – Web player + API + MCP health endpoint

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// === Chuẩn hoá __dirname cho ES module ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Khởi tạo app ===
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON cho các API thường (không ảnh hưởng /mcp)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Nạp danh sách kênh radio từ channels.json ===
const CHANNELS_FILE = path.join(__dirname, "../channels.json");

let CHANNELS = [];
try {
  const raw = fs.readFileSync(CHANNELS_FILE, "utf8");
  CHANNELS = JSON.parse(raw);
  console.log(`✅ Đã nạp ${CHANNELS.length} kênh radio từ channels.json`);
} catch (err) {
  console.error("❌ Lỗi đọc channels.json:", err);
  CHANNELS = [];
}

// === Serve file tĩnh (player.html, favicon, v.v.) ===
app.use(express.static(path.join(__dirname, "../")));

// === Trang root đơn giản ===
app.get("/", (req, res) => {
  res.send(
    'Viet Radio MCP đang chạy.<br>• Mở <a href="/player.html">/player.html</a> để test web radio.<br>• MCP endpoint: <code>/mcp</code>.'
  );
});

// === API: trả danh sách kênh ===
app.get("/radio/channels", (req, res) => {
  res.json(CHANNELS);
});

// === API: phát kênh (redirect tới stream thực tế) ===
app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  const ch = CHANNELS.find((c) => String(c.id) === String(id));

  if (!ch) {
    return res.status(404).send("Không tìm thấy kênh");
  }

  const src = ch.streamSrc;
  console.log("▶️ Yêu cầu phát kênh:", ch.name, "=>", src);

  // MP3 / AAC / HLS: cứ redirect cho client tự play
  if (
    typeof src === "string" &&
    (src.endsWith(".mp3") || src.endsWith(".aac") || src.endsWith(".m3u8"))
  ) {
    return res.redirect(src);
  }

  return res.status(400).send("Không nhận diện được định dạng stream");
});

// ===================================================================
// MCP HTTP endpoint – ở mức hiện tại: health check + stub JSON-RPC
// ===================================================================

// GET /mcp: discovery + health cho IMCPro / client MCP
app.get("/mcp", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json({
    mcpVersion: "2024-11-05",
    name: "vn-radio-mcp",
    capabilities: ["streamable-http"],
    status: "ok",
    info: "MCP server Radio Việt Nam chạy bình thường (health check).",
  });
});

// POST /mcp: stub JSON-RPC (chỉ để báo là server nhận được request)
// Sau này nếu mình gắn SDK @modelcontextprotocol thì chỉ cần
// thay thân hàm này bằng gọi McpServer + StreamableHTTPServerTransport.
app.post("/mcp", (req, res) => {
  console.log("📥 Nhận POST /mcp – body:", JSON.stringify(req.body));

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const rpcId =
    req.body && Object.prototype.hasOwnProperty.call(req.body, "id")
      ? req.body.id
      : null;

  // Trả đúng format JSON-RPC 2.0 để client không bị 500 vì parse lỗi
  res.json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message:
        "vn-radio-mcp mới cấu hình health check. Tool MCP chi tiết (list_channels, v.v.) chưa được implement.",
    },
    id: rpcId,
  });
});

// === Khởi động server ===
app.listen(PORT, () => {
  console.log("/////////////////////////////////////////////");
  console.log("✅ Viet Radio MCP đang chạy!");
  console.log(`🌐 Web server:        http://localhost:${PORT}`);
  console.log("▶ Web player:        /player.html");
  console.log("▶ API danh sách kênh: /radio/channels");
  console.log("▶ API play:          /radio/play?id=<id>");
  console.log("▶ MCP endpoint:      /mcp (GET health, POST JSON-RPC stub)");
  console.log("/////////////////////////////////////////////");
});

// src/index.mjs
// Server phát Radio Việt Nam + API cho player.html

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Đường dẫn tới channels.json (đặt ở thư mục gốc repo)
const CHANNELS_FILE = path.join(__dirname, "../channels.json");

// 🔹 Đọc danh sách kênh radio từ channels.json
let CHANNELS = [];
try {
  const raw = fs.readFileSync(CHANNELS_FILE, "utf8");
  CHANNELS = JSON.parse(raw);
  console.log(`✅ Đã nạp ${CHANNELS.length} kênh radio từ channels.json`);
} catch (err) {
  console.error("❌ Lỗi đọc channels.json:", err.message);
  CHANNELS = [];
}

// Cho phép gọi từ imcp / web khác domain nếu cần
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// 🔹 Serve file tĩnh (player.html, ...)
// player.html nằm ở thư mục gốc repo => ../
app.use(express.static(path.join(__dirname, "../")));

// 🔹 Trang chủ: mở luôn player.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../player.html"));
});

// 🔹 Endpoint health check cho Render
app.get("/healthz", (req, res) => {
  res.send("OK");
});

// 🔹 API trả danh sách kênh cho player.html
app.get("/radio/channels", (req, res) => {
  res.json(CHANNELS);
});

// 🔹 Route phát trực tiếp: redirect sang stream thật
app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  if (!id) {
    return res.status(400).send("Thiếu tham số id");
  }

  const ch = CHANNELS.find((c) => c.id === id);
  if (!ch) {
    return res.status(404).send("Không tìm thấy kênh");
  }

  const src = ch.streamSrc;
  if (!src) {
    return res.status(500).send("Kênh chưa cấu hình streamSrc");
  }

  console.log("▶️ Phát kênh:", id, "→", src);

  // Với MP3 / AAC / HLS (.m3u8) đều redirect được,
  // phía browser sẽ dùng <audio> hoặc hls.js để phát.
  if (
    src.endsWith(".mp3") ||
    src.endsWith(".aac") ||
    src.endsWith(".m3u8")
  ) {
    return res.redirect(src);
  }

  // Nếu format khác thì báo lỗi để mình còn biết mà chỉnh
  return res
    .status(400)
    .send("Không nhận diện được định dạng stream cho kênh này");
});

// 🔹 Khởi động server
app.listen(PORT, () => {
  console.log(
    `🚀 VN Radio MCP web server đang chạy tại http://localhost:${PORT}`
  );
});

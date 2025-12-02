// src/index.mjs
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Dùng port Render cấp hoặc 3000 khi chạy cục bộ
const PORT = process.env.PORT || 3000;

// ✅ Đường dẫn tới file channels.json
const CHANNELS_FILE = path.join(__dirname, "../channels.json");

// ✅ Đọc danh sách kênh từ file JSON
let CHANNELS = [];
try {
  if (fs.existsSync(CHANNELS_FILE)) {
    CHANNELS = JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
    console.log(`📻 Đã nạp ${CHANNELS.length} kênh radio từ channels.json`);
  } else {
    console.warn("⚠️ Không tìm thấy file channels.json — vui lòng tạo file này ở thư mục gốc.");
  }
} catch (err) {
  console.error("❌ Lỗi đọc channels.json:", err);
}

// ✅ Trả file tĩnh (như player.html)
app.use(express.static(path.join(__dirname, "../")));

// ✅ API trả danh sách kênh radio
app.get("/radio/channels", (req, res) => {
  res.json(CHANNELS);
});

// ✅ API phát trực tiếp radio
app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  const ch = CHANNELS.find(c => c.id === id);

  if (!ch) {
    return res.status(404).send("❌ Không tìm thấy kênh radio.");
  }

  const src = ch.streamSrc;
  console.log(`▶️ Đang phát: ${ch.name} - ${src}`);

  // Nếu là định dạng MP3 / AAC
  if (src.endsWith(".mp3") || src.endsWith(".aac")) {
    return res.redirect(src);
  }

  // Nếu là định dạng HLS (.m3u8)
  if (src.endsWith(".m3u8")) {
    return res.redirect(src);
  }

  // Nếu format khác
  return res.status(400).send("⚠️ Định dạng stream không hỗ trợ.");
});

// ✅ Khởi động server
app.listen(PORT, () => {
  console.log(`✅ MCP Radio Việt Nam đang chạy tại http://localhost:${PORT}`);
  console.log("🌐 Đường dẫn API:");
  console.log(`   - /radio/channels`);
  console.log(`   - /radio/play?id=<mã_kênh>`);
});

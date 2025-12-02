import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 🟢 Đường dẫn tới channels.json
const CHANNELS_FILE = path.join(__dirname, "../channels.json");

// 🟢 Đọc danh sách kênh
let CHANNELS = [];
try {
  CHANNELS = JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
  console.log(`Đã nạp ${CHANNELS.length} kênh radio từ channels.json`);
} catch (err) {
  console.error("Lỗi đọc channels.json:", err);
}

// 🟢 Trả file tĩnh (player.html)
app.use(express.static(path.join(__dirname, "../")));

// 🟢 API trả danh sách kênh
app.get("/radio/channels", (req, res) => {
  res.json(CHANNELS);
});

// 🟢 Route phát trực tiếp
app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  const ch = CHANNELS.find(c => c.id === id);

  if (!ch) {
    return res.status(404).send("Không tìm thấy kênh");
  }

  const src = ch.streamSrc;
  console.log("▶️ Phát:", src);

  // Với MP3 hoặc AAC thì trả thẳng URL cho frontend
  if (src.endsWith(".mp3") || src.endsWith(".aac")) {
    res.redirect(src);
  }
  // Với HLS thì trả về link để hls.js phát
  else if (src.endsWith(".m3u8")) {
    res.redirect(src);
  }
  // Nếu format khác
  else {
    res.status(400).send("Không nhận diện được định dạng stream");
  }
});

// 🟢 Khởi động server
app.listen(PORT, () => {
  console.log(`✅ MCP Radio Việt Nam đang chạy tại http://localhost:${PORT}`);
});

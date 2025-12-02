// src/index.mjs
// MCP Radio Việt Nam – Chuẩn hóa cho Render + IMCP.pro

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 10000;
const app = express();
app.use(express.json());

// === Đọc danh sách kênh ===
const CHANNELS_FILE = path.join(__dirname, "../channels.json");
let CHANNELS = [];
try {
  const raw = fs.readFileSync(CHANNELS_FILE, "utf8");
  const data = JSON.parse(raw);
  CHANNELS = Array.isArray(data) ? data : data.channels || [];
  console.log(`✅ Đã nạp ${CHANNELS.length} kênh từ channels.json`);
} catch (err) {
  console.error("❌ Lỗi đọc channels.json:", err);
}

// === Web static ===
app.use(express.static(path.join(__dirname, "..")));
app.get("/", (_req, res) => res.redirect("/player.html"));

// === API: danh sách kênh ===
app.get("/radio/channels", (_req, res) => res.json(CHANNELS));

// === API: phát kênh ===
app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  const ch = CHANNELS.find((c) => String(c.id) === String(id));
  if (!ch) return res.status(404).send("Không tìm thấy kênh");

  const stream = ch.streamUrl || ch.streamSrc || ch.url || ch.hls || ch.mp3;
  if (!stream) return res.status(400).send("Kênh này chưa có stream URL");
  console.log(`▶️ Phát: ${ch.name} → ${stream}`);
  res.redirect(stream);
});

// === MCP SERVER ===
const mcpServer = new McpServer({
  name: "vn-radio-mcp",
  version: "1.0.0",
});

// Tool 1: Danh sách kênh
mcpServer.registerTool(
  "list_channels",
  {
    title: "Liệt kê danh sách kênh Radio Việt Nam",
    description: "Trả về danh sách kênh từ channels.json",
    inputSchema: z.object({}),
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(CHANNELS, null, 2) }],
  })
);

// Tool 2: Lấy stream theo ID
mcpServer.registerTool(
  "get_stream_url",
  {
    title: "Lấy URL stream theo ID",
    description: "Trả về URL phát trực tiếp của kênh có ID tương ứng",
    inputSchema: z.object({
      id: z.string().describe("ID của kênh radio (ví dụ: voh-fm-99-9)"),
    }),
  },
  async ({ id }) => {
    const ch = CHANNELS.find((c) => String(c.id) === String(id));
    if (!ch) {
      return {
        content: [{ type: "text", text: `Không tìm thấy kênh ${id}` }],
        isError: true,
      };
    }
    const stream = ch.streamUrl || ch.streamSrc || ch.url || ch.hls || ch.mp3;
    if (!stream) {
      return {
        content: [
          { type: "text", text: `Kênh ${id} chưa có stream URL hợp lệ.` },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: stream }],
      isError: false,
    };
  }
);

// === MCP handshake ===
// IMCP.pro sẽ gửi 1 POST rỗng => cần trả JSON chuẩn MCP handshake
app.post("/mcp", async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.json({
      mcpVersion: "2024-01",
      name: "vn-radio-mcp",
      capabilities: [],
    });
  }

  try {
    const transport = new StreamableHTTPServerTransport(app, "/mcp", {
      mcpServer,
    });
    await mcpServer.connect(transport);
  } catch (err) {
    console.error("❌ MCP error:", err);
    res.status(500).send("MCP internal error");
  }
});

// === Khởi động ===
app.listen(PORT, "0.0.0.0", () => {
  console.log("=========================================");
  console.log(`✅ MCP Radio Việt Nam đang chạy tại: http://localhost:${PORT}`);
  console.log(" - Web player:      /player.html");
  console.log(" - API danh sách:   /radio/channels");
  console.log(" - MCP endpoint:    /mcp");
  console.log("=========================================");
});

// src/index.mjs
// MCP Radio Việt Nam: Web + API + MCP server

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ==== Thiết lập đường dẫn gốc ====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==== Cổng chạy server (Render dùng PORT) ====
const PORT = process.env.PORT || 10000;

// ==== Đọc danh sách kênh từ channels.json ====
const CHANNELS_FILE = path.join(__dirname, "../channels.json");
let CHANNELS = [];

try {
  const raw = fs.readFileSync(CHANNELS_FILE, "utf8");
  const data = JSON.parse(raw);

  // Hỗ trợ cả 2 kiểu:
  //  - [ { id, name, streamUrl, ... } ]
  //  - { channels: [ ... ] }
  CHANNELS = Array.isArray(data) ? data : data.channels || [];

  console.log(`✅ Đã nạp ${CHANNELS.length} kênh radio từ channels.json`);
} catch (err) {
  console.error("❌ Lỗi đọc channels.json:", err);
  CHANNELS = [];
}

// ==== Khởi tạo Express ====
const app = express();
app.use(express.json());

// ==== Static web player (/player.html, CSS, JS, ...) ====
app.use(express.static(path.join(__dirname, "..")));

app.get("/", (_req, res) => {
  // Mặc định mở player.html
  res.redirect("/player.html");
});

// ==== API: trả danh sách kênh cho web player ====
app.get("/radio/channels", (_req, res) => {
  res.json(CHANNELS);
});

// ==== API: phát 1 kênh (redirect tới stream URL thật) ====
app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  const ch = CHANNELS.find((c) => String(c.id) === String(id));

  if (!ch) {
    return res.status(404).send("Không tìm thấy kênh radio");
  }

  // Hỗ trợ nhiều field tên khác nhau trong JSON
  const stream =
    ch.streamUrl || ch.streamSrc || ch.url || ch.hls || ch.mp3;

  if (!stream) {
    return res
      .status(400)
      .send("Kênh này chưa cấu hình streamUrl/streamSrc/url");
  }

  console.log(`▶️ Phát kênh: ${ch.name || ch.id} -> ${stream}`);
  res.redirect(stream);
});

// ====================================================================
//                          MCP SERVER
// ====================================================================

const mcpServer = new McpServer({
  name: "vn-radio-mcp",
  version: "1.0.0",
});

// Tool 1: Liệt kê toàn bộ kênh radio
mcpServer.registerTool(
  "list_channels",
  {
    title: "Liệt kê các kênh radio Việt Nam",
    description:
      "Trả về danh sách các kênh radio đang cấu hình trong channels.json",
    inputSchema: z.object({}), // không cần tham số
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(CHANNELS, null, 2),
        },
      ],
      isError: false,
    };
  }
);

// Tool 2: Lấy URL stream của 1 kênh theo id
mcpServer.registerTool(
  "get_stream_url",
  {
    title: "Lấy URL stream của một kênh radio",
    description:
      "Truyền id kênh (trùng với field 'id' trong channels.json) để lấy URL stream.",
    inputSchema: z.object({
      id: z
        .string()
        .describe("ID của kênh radio (ví dụ: 'voh-fm-99-9' hoặc 'test-mp3')"),
    }),
  },
  async ({ id }) => {
    const ch = CHANNELS.find((c) => String(c.id) === String(id));

    if (!ch) {
      return {
        content: [
          {
            type: "text",
            text: `Không tìm thấy kênh với id = ${id}`,
          },
        ],
        isError: true,
      };
    }

    const stream =
      ch.streamUrl || ch.streamSrc || ch.url || ch.hls || ch.mp3;

    if (!stream) {
      return {
        content: [
          {
            type: "text",
            text: `Kênh ${id} không có streamUrl/streamSrc/url`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: stream,
        },
      ],
      isError: false,
    };
  }
);

// ==== Endpoint /mcp dùng StreamableHTTPServerTransport ====
app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("❌ Lỗi xử lý MCP /mcp:", err);
    if (!res.headersSent) {
      res.status(500).send("MCP server error");
    }
  }
});

// ====================================================================
//                      KHỞI ĐỘNG SERVER
// ====================================================================

app
  .listen(PORT, "0.0.0.0", () => {
    console.log("=========================================");
    console.log(`✅ MCP Radio Việt Nam đang chạy tại: http://localhost:${PORT}`);
    console.log(" - Web player:      /player.html");
    console.log(" - API danh sách:   /radio/channels");
    console.log(" - MCP endpoint:    /mcp");
    console.log("=========================================");
  })
  .on("error", (err) => {
    console.error("❌ Không thể khởi động server:", err);
    process.exit(1);
  });

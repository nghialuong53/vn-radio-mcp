// src/index.mjs
// Viet Radio MCP: Web player + REST API + MCP (Streamable HTTP)

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================
// 1. NẠP DANH SÁCH KÊNH
// ==========================
const CHANNELS_FILE = path.join(__dirname, "../channels.json");

let CHANNELS = [];
try {
  CHANNELS = JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
  console.log(`✅ Đã nạp ${CHANNELS.length} kênh radio từ channels.json`);
} catch (err) {
  console.error("❌ Lỗi đọc channels.json:", err);
}

// ==========================
// 2. WEB PLAYER + REST API
// ==========================

// Trả file tĩnh (player.html, channels.json, v.v.)
app.use(express.static(path.join(__dirname, "../")));

// API: trả danh sách kênh cho web player
app.get("/radio/channels", (req, res) => {
  res.json(CHANNELS);
});

// API: phát 1 kênh (redirect tới streamSrc)
app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  const ch = CHANNELS.find((c) => c.id === id);

  if (!ch) {
    return res.status(404).send("Không tìm thấy kênh");
  }

  console.log("▶️ Phát kênh:", ch.id, ch.name, "→", ch.streamSrc);
  res.redirect(ch.streamSrc);
});

// ==========================
// 3. MCP HEALTH (GET /mcp)
// ==========================

app.get("/mcp", (req, res) => {
  res.json({
    mcpVersion: "2024-01",
    name: "vn-radio-mcp",
    capabilities: ["streamable-http"],
    status: "ok",
    info: "MCP server Radio Việt Nam hoạt động bình thường",
  });
});

// HEAD /mcp cho một số host check nhanh
app.head("/mcp", (req, res) => {
  res.status(200).end();
});

app.use(express.json());

// ==========================
// 4. MCP SERVER (TOOLS)
// ==========================

// Tạo server MCP mới cho mỗi session
function createMcpServer() {
  const server = new McpServer({
    name: "vn-radio-mcp",
    version: "1.0.0",
  });

  // Tool 1: liệt kê kênh
  server.registerTool(
    "list_channels",
    {
      description: "Liệt kê các kênh Radio Việt Nam đang có trên hệ thống.",
      inputSchema: z.object({}), // không cần input
    },
    async () => {
      if (!CHANNELS.length) {
        return {
          content: [
            {
              type: "text",
              text: "Hiện chưa có kênh nào trong channels.json.",
            },
          ],
        };
      }

      const lines = CHANNELS.map(
        (c) => `• id: ${c.id} – tên: ${c.name} – mô tả: ${c.description || ""}`
      );

      return {
        content: [
          {
            type: "text",
            text:
              "Danh sách kênh Radio Việt Nam:\n\n" +
              lines.join("\n"),
          },
        ],
      };
    }
  );

  // Tool 2: lấy URL stream của 1 kênh
  server.registerTool(
    "get_stream_url",
    {
      description: "Lấy URL stream (MP3 / HLS) của một kênh radio theo id.",
      inputSchema: z.object({
        id: z.string().describe("Mã id của kênh radio (ví dụ: voh-fm-99-9)"),
      }),
    },
    async ({ id }) => {
      const ch = CHANNELS.find((c) => c.id === id);

      if (!ch) {
        return {
          content: [
            {
              type: "text",
              text: `Không tìm thấy kênh với id: ${id}`,
            },
          ],
          isError: true,
        };
      }

      const text =
        `Thông tin kênh:\n` +
        `- ID: ${ch.id}\n` +
        `- Tên: ${ch.name}\n` +
        (ch.description ? `- Mô tả: ${ch.description}\n` : "") +
        `- URL stream trực tiếp: ${ch.streamSrc}\n\n` +
        `Anh có thể dùng URL này cho robot / app để phát trực tiếp.`;

      return {
        content: [
          {
            type: "text",
            text,
          },
        ],
      };
    }
  );

  return server;
}

// ==========================
// 5. STREAMABLE HTTP TRANSPORT (/mcp – POST)
// ==========================

// Lưu transport theo sessionId
const transports = {};

/**
 * POST /mcp
 *  - Lần đầu: request initialize → tạo session + server mới
 *  - Các lần sau: dùng lại transport theo header "mcp-session-id"
 */
app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];

    let transport;

    if (sessionId && transports[sessionId]) {
      // Đã có session → dùng lại transport cũ
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Request initialize mới → tạo transport + server mới
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
          console.log("🔗 MCP session initialized:", sid);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId && transports[transport.sessionId]) {
          console.log("❌ MCP session closed:", transport.sessionId);
          delete transports[transport.sessionId];
        }
      };

      // Tạo MCP server & connect vào transport
      const server = createMcpServer();
      await server.connect(transport);
    } else {
      // Không có sessionId hợp lệ
      return res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: Thiếu hoặc sai MCP-Session-Id",
        },
        id: null,
      });
    }

    // Giao cho transport xử lý JSON-RPC
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("❌ Lỗi xử lý /mcp:", err);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Internal error tại MCP server",
      },
      id: null,
    });
  }
});

// ==========================
// 6. KHỞI ĐỘNG SERVER
// ==========================

app.listen(PORT, () => {
  console.log("/////////////////////////////////////////////");
  console.log("✅ MCP Radio Việt Nam đang chạy tại http://localhost:" + PORT);
  console.log("🔊 Web player:   /player.html");
  console.log("📡 API kênh:     /radio/channels");
  console.log("🧠 MCP endpoint: /mcp (GET health + POST Streamable HTTP)");
  console.log("/////////////////////////////////////////////");
});

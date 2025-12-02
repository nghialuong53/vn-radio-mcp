// src/index.mjs
// Web radio + MCP server (Streamable HTTP)

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ================== Đường dẫn & load channels.json ==================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHANNELS_FILE = path.join(__dirname, "../channels.json");

let CHANNELS = [];
try {
  CHANNELS = JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
  console.log(`Đã nạp ${CHANNELS.length} kênh radio từ channels.json`);
} catch (err) {
  console.error("Lỗi đọc channels.json:", err);
}

// ================== EXPRESS APP (WEB + API RADIO) ==================
const app = express();
const PORT = process.env.PORT || 3000;

// Để nhận JSON (cho /mcp POST)
app.use(express.json());

// Serve file tĩnh: player.html ở root
app.use(express.static(path.join(__dirname, "..")));

// API: trả danh sách kênh
app.get("/radio/channels", (req, res) => {
  res.json(CHANNELS);
});

// API: phát kênh (redirect tới URL stream)
app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  const ch = CHANNELS.find((c) => c.id === id);

  if (!ch) {
    return res.status(404).send("Không tìm thấy kênh");
  }

  const src = ch.streamSrc;
  console.log("▶️ Phát:", ch.name, "->", src);

  // MP3 / AAC / HLS đều redirect cho player xử lý
  res.redirect(src);
});

// ================== MCP SERVER (Streamable HTTP) ==================
const mcpServer = new McpServer({
  name: "vn-radio-mcp",
  version: "1.0.0",
});

// Tool 1: list_channels – liệt kê kênh
mcpServer.registerTool(
  "list_channels",
  {
    title: "Liệt kê kênh radio Việt Nam",
    description: "Trả về danh sách các kênh radio có trong channels.json",
    inputSchema: z.object({}), // không cần tham số
  },
  async () => {
    const textList = CHANNELS.map((ch) => `${ch.id} - ${ch.name}`).join("\n");

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: textList || "Chưa có kênh nào trong channels.json",
        },
      ],
      structuredContent: {
        channels: CHANNELS,
      },
    };
  }
);

// Tool 2: get_stream_url – lấy URL phát của 1 kênh
mcpServer.registerTool(
  "get_stream_url",
  {
    title: "Lấy URL stream của kênh",
    description:
      "Trả về URL stream (mp3/m3u8) của một kênh radio theo id trong channels.json",
    inputSchema: z.object({
      id: z.string().describe("ID kênh radio (ví dụ: voh-fm99, voh-fm95, ...)"),
    }),
  },
  async ({ id }) => {
    const ch = CHANNELS.find((c) => c.id === id);

    if (!ch) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Không tìm thấy kênh với id = ${id}`,
          },
        ],
      };
    }

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: `URL phát của ${ch.name}: ${ch.streamSrc}`,
        },
      ],
      structuredContent: {
        id: ch.id,
        name: ch.name,
        url: ch.streamSrc,
      },
    };
  }
);

// Endpoint Streamable HTTP: /mcp
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// ================== START SERVER ==================
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `✅ Web + MCP Radio Việt Nam đang chạy tại http://localhost:${PORT}`
  );
  console.log("   - Web player:        /player.html");
  console.log("   - API danh sách:     /radio/channels");
  console.log("   - MCP (HTTP stream): /mcp");
});

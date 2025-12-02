// src/index.mjs
// MCP Radio Việt Nam – bản ổn định cho Render + IMCP

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================================================
// 1. Load danh sách kênh
// ==================================================
const CHANNELS_FILE = path.join(__dirname, "../channels.json");

let CHANNELS = [];
try {
  CHANNELS = JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
  console.log(`📻 Đã nạp ${CHANNELS.length} kênh radio từ channels.json`);
} catch (err) {
  console.error("⚠️ Lỗi đọc channels.json:", err);
}

// ==================================================
// 2. Web Radio API
// ==================================================
app.use(express.static(path.join(__dirname, "..")));

app.get("/radio/channels", (req, res) => {
  res.json(CHANNELS);
});

app.get("/radio/play", (req, res) => {
  const id = req.query.id;
  const ch = CHANNELS.find((c) => c.id === id);

  if (!ch) return res.status(404).send("Không tìm thấy kênh");

  console.log("▶️ Phát:", ch.name);
  res.redirect(ch.streamSrc);
});

// ==================================================
// 3. MCP Server – Streamable HTTP Endpoint (/mcp)
// ==================================================
const mcpServer = new McpServer({
  name: "vn-radio-mcp",
  version: "1.0.1",
});

// Tool 1: list_channels
mcpServer.registerTool(
  "list_channels",
  {
    title: "Danh sách kênh radio Việt Nam",
    description: "Trả về danh sách kênh có trong channels.json",
    inputSchema: z.object({}),
  },
  async () => ({
    isError: false,
    content: [
      {
        type: "text",
        text: CHANNELS.map((c) => `${c.id} - ${c.name}`).join("\n"),
      },
    ],
    structuredContent: { channels: CHANNELS },
  })
);

// Tool 2: get_stream_url
mcpServer.registerTool(
  "get_stream_url",
  {
    title: "Lấy URL stream của kênh radio",
    description: "Nhập id kênh để lấy link phát trực tiếp",
    inputSchema: z.object({
      id: z.string(),
    }),
  },
  async ({ id }) => {
    const ch = CHANNELS.find((c) => c.id === id);
    if (!ch)
      return {
        isError: true,
        content: [{ type: "text", text: "Không tìm thấy kênh radio này." }],
      };
    return {
      isError: false,
      content: [
        {
          type: "text",
          text: `Kênh ${ch.name}: ${ch.streamSrc}`,
        },
      ],
      structuredContent: ch,
    };
  }
);

// Endpoint MCP
app.post("/mcp", async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("❌ Lỗi MCP:", err);
    res.status(500).json({ error: "MCP internal error" });
  }
});

// ==================================================
// 4. Start Server
// ==================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Radio MCP server đang chạy tại http://localhost:${PORT}`);
  console.log("   - /player.html");
  console.log("   - /radio/channels");
  console.log("   - /mcp (IMCP endpoint)");
});

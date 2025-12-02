# viet-radio-mcp

MCP server + HTTP proxy đơn giản để phát Radio Việt Nam cho web / imcp / (có thể thử cho robot sau).

## 1. Yêu cầu môi trường

- Node.js >= 18 (khuyến nghị)
- Máy local hoặc VPS (Linux càng tốt)
- Đã cài `git` (nếu anh clone từ repo) – không bắt buộc nếu tải file .zip

## 2. Cài đặt

1. Giải nén thư mục `viet-radio-mcp` (nếu anh tải file .zip).
2. Mở terminal / cmd trong thư mục đó.
3. Chạy lệnh:

   ```bash
   npm install
   ```

3. Sau khi cài xong, chạy server:

   ```bash
   npm start
   ```

4. Mặc định server chạy ở port `3000`. Anh có thể đổi bằng cách set biến môi trường:

   ```bash
   PORT=8080 npm start
   ```

## 3. Test nhanh trên trình duyệt (web)

1. Sau khi `npm start`, mở trình duyệt và vào:

   - `http://localhost:3000/` → kiểm tra server sống
   - `http://localhost:3000/radio/channels` → xem danh sách kênh (JSON)
   - `http://localhost:3000/player.html` → giao diện test nghe radio

2. Chọn 1 kênh, bấm **Nghe**, nếu anh đã cấu hình đúng `streamSrc` trong `channels.json` thì sẽ nghe được.

> Lưu ý: Trong bản mẫu này, `streamSrc` đang là URL giả (placeholder). Anh cần sửa lại thành URL stream thật của kênh radio mà anh muốn phát (định dạng mp3 / aac).

## 4. Cấu hình kênh radio (channels.json)

File `channels.json` chứa danh sách kênh:

```json
[
  {
    "id": "vov1",
    "name": "VOV1 - Thời sự Chính trị Tổng hợp",
    "description": "Kênh thời sự, chính trị, tổng hợp của Đài Tiếng nói Việt Nam.",
    "website": "https://vov1.vov.gov.vn/",
    "streamSrc": "https://your-stream-server.example.com/vov1.mp3"
  }
]
```

Anh chỉ cần:

- Giữ nguyên `id`, `name`, `description` (tùy chỉnh theo ý anh).
- Sửa `streamSrc` thành link stream thật (HTTP/HTTPS) dạng `.mp3` hoặc stream trực tiếp.

Sau khi sửa, **restart server**:

```bash
npm start
```

và test lại ở `player.html`.

## 5. Dùng như MCP server (cho imcp / client hỗ trợ MCP)

File `mcp.config.json` đã được cấu hình sẵn:

```json
{
  "mcpServers": {
    "viet-radio-mcp": {
      "command": "node",
      "args": ["src/index.mjs"],
      "env": {}
    }
  }
}
```

- Trong client hỗ trợ MCP (ví dụ Claude Desktop / ứng dụng tích hợp MCP), anh thêm server này vào cấu hình.
- Server cung cấp 2 tool:

  1. `list_channels`  
     → trả về JSON danh sách kênh (id, name, description, website, proxyUrl, streamSrc).

  2. `get_stream` (tham số `id`)  
     → trả về 1 object JSON chứa thông tin kênh + URL proxy để phát.

Ví dụ, tool `get_stream` trả về:

```json
{
  "id": "vov1",
  "name": "VOV1 - Thời sự Chính trị Tổng hợp",
  "proxyUrl": "/radio/play?id=vov1",
  "streamSrc": "https://..."
}
```

Trong client, anh có thể lấy `proxyUrl` (kèm domain server, ví dụ `https://api.anhrobot.vn/radio/play?id=vov1`) để cho trình phát audio dùng.

## 6. Dùng cho robot (ý tưởng bước 2)

Khi đã nghe ngon trên web, anh có thể:

- Deploy server này lên domain của anh (ví dụ `https://api.anhrobot.vn`).
- Cho robot gọi trực tiếp:

  ```
  https://api.anhrobot.vn/radio/play?id=vov1
  ```

- Nếu robot hỗ trợ phát audio từ URL HTTP/HTTPS, nó sẽ nghe được y như trình duyệt.

Nếu cần, anh có thể:

- Thêm endpoint rút gọn, ví dụ `/radio/vov1` → nội bộ redirect sang `/radio/play?id=vov1`.

## 7. Ghi chú quan trọng

- Bản mẫu này tập trung vào **khung MCP + HTTP proxy ổn định**.
- Link radio Việt Nam thực tế có thể thay đổi theo thời gian, nên em để `streamSrc` là placeholder để anh tự cập nhật theo nguồn anh tin tưởng.
- Nếu cần em hỗ trợ tìm và điền một vài URL radio cụ thể, anh có thể gửi danh sách kênh anh muốn ưu tiên, em sẽ gợi ý định dạng URL phù hợp.

---

Mọi thắc mắc trong quá trình cài:
- Anh có thể chụp màn hình lỗi terminal hoặc trình duyệt gửi lại,
- Em sẽ đọc log và chỉ anh chỉnh từng bước.

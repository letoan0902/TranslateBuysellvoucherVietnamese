# Auto Translate BuySellVouchers - Chrome Extension

Extension Chrome để tự động dịch tin nhắn trên buysellvouchers.com

## Cài đặt

### 1. Chuẩn bị file

Đảm bảo bạn có các file sau:
- `manifest.json`
- `content.js`
- `popup.html`
- `popup.js`
- `icon16.png`, `icon48.png`, `icon128.png` (tạo icon hoặc tải từ internet)

### 2. Tạo icon (tùy chọn)

Nếu chưa có icon, bạn có thể:
- Tạo icon đơn giản bằng Paint hoặc công cụ khác
- Hoặc tải icon từ internet
- Kích thước: 16x16, 48x48, 128x128 pixels

### 3. Cài đặt Extension

1. Mở Chrome và vào `chrome://extensions/`
2. Bật **"Developer mode"** (góc trên bên phải)
3. Click **"Load unpacked"**
4. Chọn thư mục chứa các file extension
5. Extension sẽ được cài đặt

### 4. Cấu hình API Key

1. Click vào icon extension trên thanh công cụ
2. Nhập Groq API Key của bạn
3. Click "Lưu"
4. Xong!

## Sử dụng

### Dịch tin nhắn hiện có:
1. Hover vào bất kỳ tin nhắn nào
2. Click button "Dịch" xuất hiện
3. Tin nhắn sẽ được dịch
4. Click "←" để quay về bản gốc

### Dịch tin nhắn đang gõ:
1. Nhập tin nhắn tiếng Việt vào ô input
2. Click button "Dịch" bên cạnh ô input
3. Text sẽ được dịch sang tiếng Anh
4. Click "←" để quay về bản gốc

## Lấy Groq API Key

1. Truy cập [Groq Console](https://console.groq.com/)
2. Đăng ký/Đăng nhập
3. Vào phần "API Keys"
4. Tạo API key mới
5. Copy và dán vào extension

## Troubleshooting

### Extension không hoạt động:
- Kiểm tra xem đã cấu hình API key chưa
- Mở Console (F12) để xem lỗi
- Đảm bảo bạn đang ở trang buysellvouchers.com

### Button "Dịch" không xuất hiện:
- Đảm bảo đã vào trang chat/messages
- Refresh trang
- Kiểm tra console có lỗi không

## Cấu trúc file

```
extension/
├── manifest.json      # Cấu hình extension
├── content.js         # Script chính
├── popup.html         # UI cấu hình API key
├── popup.js           # Logic popup
├── icon16.png         # Icon 16x16
├── icon48.png         # Icon 48x48
└── icon128.png        # Icon 128x128
```

## License

MIT


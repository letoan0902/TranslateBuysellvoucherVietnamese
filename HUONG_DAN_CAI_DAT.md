# Hướng dẫn cài đặt Chrome Extension

## Bước 1: Tạo Icon (nếu chưa có)

Bạn có thể tạo icon đơn giản bằng cách:

### Option 1: Sử dụng icon online
1. Tải icon từ: https://www.flaticon.com/ hoặc https://icons8.com/
2. Tải 3 kích thước: 16x16, 48x48, 128x128 pixels
3. Đặt tên: `icon16.png`, `icon48.png`, `icon128.png`

### Option 2: Tạo icon đơn giản
1. Mở Paint hoặc công cụ chỉnh sửa ảnh
2. Tạo ảnh 128x128 pixels với nền màu cam (#ff9800)
3. Viết chữ "AT" (Auto Translate) màu trắng
4. Resize về 3 kích thước: 16x16, 48x48, 128x128
5. Lưu với tên: `icon16.png`, `icon48.png`, `icon128.png`

### Option 3: Tạm thời bỏ qua icon
Nếu chưa có icon, bạn có thể sửa `manifest.json`:
- Xóa hoặc comment các dòng `"default_icon"` và `"icons"`

## Bước 2: Cài đặt Extension

1. **Mở Chrome Extensions:**
   - Vào `chrome://extensions/`
   - Hoặc: Menu (3 chấm) → More tools → Extensions

2. **Bật Developer mode:**
   - Toggle "Developer mode" ở góc trên bên phải

3. **Load extension:**
   - Click "Load unpacked"
   - Chọn thư mục chứa các file:
     - manifest.json
     - content.js
     - popup.html
     - popup.js
     - icon16.png, icon48.png, icon128.png (nếu có)

4. **Kiểm tra:**
   - Extension sẽ xuất hiện trong danh sách
   - Icon extension sẽ hiện trên thanh công cụ

## Bước 3: Cấu hình API Key

1. Click vào icon extension trên thanh công cụ
2. Popup sẽ hiện ra
3. Nhập Groq API Key của bạn
4. Click "Lưu"
5. Xong!

## Bước 4: Sử dụng

1. Vào trang buysellvouchers.com
2. Vào phần chat/messages
3. Hover vào tin nhắn → click "Dịch"
4. Hoặc nhập tin nhắn → click "Dịch" bên cạnh ô input

## Troubleshooting

### Extension không load được:
- Kiểm tra file manifest.json có đúng format không
- Kiểm tra console có lỗi gì không (F12)

### Icon không hiển thị:
- Tạm thời bỏ qua, extension vẫn hoạt động
- Hoặc tạo icon như hướng dẫn trên

### Script không hoạt động:
- Kiểm tra console (F12) xem có lỗi không
- Đảm bảo đã cấu hình API key
- Refresh trang


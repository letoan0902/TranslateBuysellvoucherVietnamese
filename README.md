# Auto Translate BuySellVouchers

Script Tampermonkey để tự động dịch tin nhắn từ tiếng Việt sang tiếng Anh trên trang buysellvouchers.com sử dụng Groq AI.

## Tính năng

- ✅ Tự động thêm button "Dịch" cho tin nhắn mới của bạn sau khi gửi
- ✅ Hiển thị button "Dịch" khi hover vào các tin nhắn (của bạn và của người khác)
- ✅ Dịch từ tiếng Việt sang tiếng Anh tự nhiên sử dụng Groq AI
- ✅ Hiển thị bản dịch với khả năng copy
- ✅ Tự động phát hiện tin nhắn mới

## Cài đặt

### 1. Cài đặt Tampermonkey

- Chrome: [Tampermonkey Extension](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- Firefox: [Tampermonkey Add-on](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- Edge: [Tampermonkey Extension](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. Lấy Groq API Key

1. Truy cập [Groq Console](https://console.groq.com/)
2. Đăng ký/Đăng nhập tài khoản
3. Vào phần "API Keys"
4. Tạo API key mới
5. Copy API key

### 3. Cài đặt Script

1. Mở Tampermonkey Dashboard
2. Click "Create a new script"
3. Xóa toàn bộ code mặc định
4. Copy toàn bộ nội dung từ file `auto-translate-buysellvouchers.user.js`
5. Dán vào editor
6. Tìm dòng `GROQ_API_KEY: ''` và thay thế `''` bằng API key của bạn:
   ```javascript
   GROQ_API_KEY: 'your-api-key-here',
   ```
   HOẶC sau khi cài đặt, bạn có thể cấu hình trong script bằng cách:
   - Mở script trong Tampermonkey
   - Tìm phần `CONFIG` và thêm API key
   - Script sẽ tự động lưu vào storage

7. Lưu script (Ctrl+S hoặc Cmd+S)

### 4. Sử dụng

1. Truy cập https://www.buysellvouchers.com
2. Vào phần chat/messages
3. Khi bạn gửi tin nhắn tiếng Việt, button "Dịch" sẽ xuất hiện trên tin nhắn
4. Click vào button "Dịch" để dịch tin nhắn
5. Khi hover vào bất kỳ tin nhắn nào, button "Dịch" sẽ xuất hiện

## Cấu hình

Bạn có thể tùy chỉnh trong script:

```javascript
const CONFIG = {
    GROQ_API_KEY: '', // API key của bạn
    GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    MODEL: 'mixtral-8x7b-32768', // Hoặc 'llama-3.1-70b-versatile'
    TRANSLATE_BUTTON_TEXT: 'Dịch',
    TRANSLATING_TEXT: 'Đang dịch...',
    FROM_LANGUAGE: 'Vietnamese',
    TO_LANGUAGE: 'English'
};
```

### Models có sẵn:

- `llama-3.3-70b-versatile` - **Mặc định, tốt nhất cho dịch và ngôn ngữ tự nhiên** (70B parameters, versatile)
- `meta-llama/llama-4-scout-17b-16e-instruct` - TPM cao nhất (30K), phù hợp khi cần tốc độ
- `openai/gpt-oss-120b` - Model lớn nhất (120B), chất lượng cao nhất
- `qwen/qwen3-32b` - RPM cao (60), tốc độ nhanh

## Cách hoạt động

1. Script tự động phát hiện các tin nhắn trong chat
2. Khi bạn gửi tin nhắn mới, script sẽ thêm button "Dịch" vào tin nhắn đó
3. Khi bạn hover vào tin nhắn, button "Dịch" sẽ xuất hiện
4. Khi click button, script sẽ gửi tin nhắn đến Groq API để dịch
5. Bản dịch sẽ được hiển thị dưới tin nhắn gốc với button "Copy"

## Lưu ý

- Script chỉ dịch khi phát hiện tin nhắn có chứa ký tự tiếng Việt
- Bạn cần có Groq API key hợp lệ
- Groq có giới hạn rate limit, nếu vượt quá sẽ có thông báo lỗi
- Script sẽ tự động lưu API key vào storage của Tampermonkey

## Troubleshooting

### Button "Dịch" không xuất hiện

- Kiểm tra xem script đã được bật chưa (Tampermonkey dashboard)
- Refresh trang web
- Kiểm tra console (F12) xem có lỗi gì không

### Lỗi khi dịch

- Kiểm tra API key đã được cấu hình đúng chưa
- Kiểm tra kết nối internet
- Kiểm tra Groq API có đang hoạt động không

### Script không hoạt động

- Đảm bảo bạn đang ở đúng domain: buysellvouchers.com
- Kiểm tra script có được match với URL không trong phần `@match`

## Phát triển

Để phát triển thêm:

1. Clone repository
2. Chỉnh sửa file `auto-translate-buysellvouchers.user.js`
3. Test trên trang web
4. Cập nhật version trong script khi có thay đổi

## License

MIT


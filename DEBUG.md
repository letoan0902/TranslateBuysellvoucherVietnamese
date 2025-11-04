# Hướng dẫn Debug

Nếu script không hoạt động đúng, bạn có thể debug theo các bước sau:

## 1. Kiểm tra Script đã được load chưa

1. Mở Developer Tools (F12)
2. Vào tab Console
3. Bạn sẽ thấy log: `Auto Translate BuySellVouchers script loaded`
4. Nếu không thấy, kiểm tra:
   - Tampermonkey có đang bật không
   - Script có được enable không
   - URL có match với pattern trong script không

## 2. Kiểm tra API Key

1. Trong Console, gõ: `GM_getValue('groq_api_key')`
2. Nếu trả về `null` hoặc `''`, bạn cần cấu hình API key
3. Click vào button "⚙️ Cấu hình API Key" ở góc dưới bên phải (nếu có)

## 3. Kiểm tra phát hiện tin nhắn

1. Mở Console (F12)
2. Vào tab Console
3. Bạn sẽ thấy log: `Found X messages` (X là số tin nhắn)
4. Nếu `Found 0 messages`, script không tìm thấy tin nhắn

### Cách tìm selector đúng cho tin nhắn

1. Mở Developer Tools (F12)
2. Vào tab Elements (hoặc Inspect)
3. Click vào một tin nhắn trong chat
4. Xem cấu trúc HTML của tin nhắn
5. Tìm class name hoặc selector đặc trưng

Ví dụ, nếu tin nhắn có class là `message-item`, bạn cần thêm vào script:

```javascript
const possibleSelectors = [
    '.message-item', // Thêm selector này
    '[class*="message"]',
    // ... các selector khác
];
```

## 4. Test dịch thủ công

Trong Console, bạn có thể test hàm dịch:

```javascript
// Lấy API key
const apiKey = GM_getValue('groq_api_key');

// Test dịch
translateText('Xin chào, tôi muốn mua sản phẩm này').then(result => {
    console.log('Kết quả:', result);
});
```

## 5. Kiểm tra lỗi API

1. Mở Developer Tools (F12)
2. Vào tab Network
3. Filter: `groq`
4. Click button "Dịch"
5. Xem request có được gửi không
6. Xem response có lỗi không

### Lỗi thường gặp:

- **401 Unauthorized**: API key không đúng hoặc đã hết hạn
- **429 Too Many Requests**: Vượt quá rate limit của Groq
- **500 Internal Server Error**: Lỗi từ phía Groq server

## 6. Tùy chỉnh Selector

Nếu script không tìm thấy tin nhắn, bạn có thể tùy chỉnh selector:

1. Mở script trong Tampermonkey
2. Tìm hàm `findMessages()`
3. Thêm selector mới vào `possibleSelectors`:

```javascript
const possibleSelectors = [
    'your-custom-selector-here', // Thêm selector của bạn
    '[class*="message"]',
    // ...
];
```

4. Lưu và refresh trang

## 7. Kiểm tra xem tin nhắn có phải của mình không

Script tự động phát hiện tin nhắn của mình bằng cách:
- Kiểm tra text-align (right = của mình)
- Kiểm tra class names (có 'own', 'sent', 'my')
- Kiểm tra parent elements

Nếu phát hiện sai, bạn có thể tùy chỉnh hàm `isOwnMessage()`:

```javascript
function isOwnMessage(messageElement) {
    // Thêm logic tùy chỉnh của bạn
    const classList = messageElement.className || '';
    if (classList.includes('your-own-message-class')) {
        return true;
    }
    // ... logic hiện tại
}
```

## 8. Debug Mode

Để bật debug mode, thêm vào đầu hàm `init()`:

```javascript
const DEBUG = true; // Thêm dòng này

function init() {
    if (DEBUG) {
        console.log('Debug mode enabled');
        // Log thêm thông tin
    }
    // ...
}
```

## 9. Common Issues

### Button "Dịch" không xuất hiện

- Kiểm tra xem script có tìm thấy tin nhắn không (xem Console)
- Kiểm tra xem button có bị CSS ẩn không
- Thử thêm `!important` vào CSS của button

### Button xuất hiện nhưng không click được

- Kiểm tra z-index của button
- Kiểm tra xem có element nào che phủ button không
- Thử tăng z-index lên 10000

### Dịch không hoạt động

- Kiểm tra API key
- Kiểm tra console có lỗi gì không
- Kiểm tra network request có được gửi không
- Kiểm tra response từ Groq API

### Script làm chậm trang

- Giảm interval của `setInterval` (hiện tại là 2000ms)
- Tối ưu selector để tìm tin nhắn nhanh hơn
- Chỉ thêm button cho tin nhắn chưa có button

## 10. Liên hệ

Nếu vẫn không giải quyết được, bạn có thể:
1. Chụp screenshot của console errors
2. Chụp screenshot của cấu trúc HTML của tin nhắn
3. Mô tả chi tiết vấn đề gặp phải


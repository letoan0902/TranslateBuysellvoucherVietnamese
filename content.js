(function () {
    'use strict';

    // Kiểm tra extension context còn valid không
    function isExtensionContextValid() {
        try {
            return typeof chrome !== 'undefined' &&
                chrome.storage &&
                chrome.runtime &&
                chrome.runtime.id;
        } catch (e) {
            return false;
        }
    }

    const CONFIG = {
        GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
        MODEL: 'llama-3.3-70b-versatile',
        TRANSLATE_BUTTON_TEXT: 'Dịch',
        BACK_BUTTON_TEXT: '←',
    };

    // ========== UTILITY FUNCTIONS ==========

    async function getApiKey() {
        return new Promise((resolve) => {
            try {
                // Kiểm tra xem chrome API có sẵn không
                if (typeof chrome === 'undefined' || !chrome.storage) {
                    console.warn('Chrome storage API not available');
                    resolve('');
                    return;
                }

                chrome.storage.local.get(['groq_api_key'], (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error getting API key:', chrome.runtime.lastError);
                        resolve('');
                        return;
                    }
                    resolve(result.groq_api_key || '');
                });
            } catch (error) {
                console.error('Error in getApiKey:', error);
                resolve('');
            }
        });
    }

    async function setApiKey(apiKey) {
        return new Promise((resolve) => {
            try {
                // Kiểm tra xem chrome API có sẵn không
                if (typeof chrome === 'undefined' || !chrome.storage) {
                    console.warn('Chrome storage API not available');
                    resolve();
                    return;
                }

                chrome.storage.local.set({ groq_api_key: apiKey }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error setting API key:', chrome.runtime.lastError);
                    }
                    resolve();
                });
            } catch (error) {
                console.error('Error in setApiKey:', error);
                resolve();
            }
        });
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            max-width: 300px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // Phát hiện ngôn ngữ của text
    function detectLanguage(text) {
        const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/;
        if (vietnameseChars.test(text)) {
            return 'Vietnamese';
        }
        return 'English';
    }

    // Tạo loading spinner
    function createSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'auto-translate-spinner';
        spinner.innerHTML = `
            <div style="
                width: 16px;
                height: 16px;
                border: 2px solid #ffffff40;
                border-top-color: #ffffff;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            "></div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
        spinner.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
        `;
        return spinner;
    }

    // ========== GROQ API INTEGRATION ==========

    // Dịch text thông thường (cho tin nhắn cũ, không cần context)
    async function translateText(text, fromLang, toLang, context = '') {
        const apiKey = await getApiKey();
        if (!apiKey) {
            showNotification('Vui lòng cấu hình Groq API key!', 'error');
            return null;
        }

        let prompt = '';
        if (context) {
            prompt = `Translate the following ${fromLang} text to ${toLang}. Consider the conversation context below to provide the most accurate and natural translation. Only return the translated text, nothing else.\n\nContext:\n${context}\n\nText to translate:\n${text}`;
        } else {
            prompt = `Translate the following ${fromLang} text to ${toLang}. Provide a natural, fluent translation. Only return the translated text, nothing else:\n\n${text}`;
        }

        try {
            const response = await fetch(CONFIG.GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: `You are a professional translator. Translate ${fromLang} to ${toLang} accurately and naturally.`
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });

            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content.trim();
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            throw error;
        }
    }

    // Dịch text input với context đầy đủ (Buyer-Seller conversation)
    async function translateInputText(text, fromLang, toLang) {
        const apiKey = await getApiKey();
        if (!apiKey) {
            showNotification('Vui lòng cấu hình Groq API key!', 'error');
            return null;
        }

        // Lấy TẤT CẢ tin nhắn làm context (CHỈ KHI NÀY MỚI LOAD)
        const context = getAllMessagesContext();

        // Xác định người gửi dựa trên context
        const isSellerMessage = true; // Người dùng nhập = Seller (người bán)

        const prompt = `You are translating a message in a buyer-seller conversation on a marketplace website (buysellvouchers.com).

${context}

The ${fromLang} text below is what the ${isSellerMessage ? 'Seller' : 'Buyer'} is about to send. Translate it to ${toLang} accurately, maintaining the buyer-seller conversation tone and ensuring the meaning matches the conversation context above.

Important requirements:
- Translate naturally and fluently
- Maintain the appropriate tone for marketplace communication (professional but friendly)
- Ensure the translation accurately reflects the seller's intent based on the conversation context
- Consider the buyer-seller relationship and conversation flow
- Only return the translated text, nothing else

Text to translate (${isSellerMessage ? 'Seller' : 'Buyer'} message):
${text}`;

        try {
            const response = await fetch(CONFIG.GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a professional translator specializing in marketplace buyer-seller conversations. Translate accurately while maintaining context and appropriate tone. Understand the buyer-seller dynamic and translate messages to reflect the seller\'s true intent.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });

            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content.trim();
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            throw error;
        }
    }

    // ========== MESSAGE FUNCTIONS ==========

    function findMessages() {
        const messages = [];
        const processedMessages = new Set();
        const possibleSelectors = [
            'main div.flex.flex-col.justify-start.gap-1',
            'main [class*="flex flex-col justify-start gap-1"]',
            '[class*="flex flex-col"][class*="items-end"]',
            '[class*="flex flex-col"][class*="items-start"]',
        ];

        for (const selector of possibleSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    elements.forEach(el => {
                        if (processedMessages.has(el)) return;
                        const classList = el.className || '';
                        const hasFlexCol = classList.includes('flex') && classList.includes('flex-col');
                        const hasItems = classList.includes('items-end') || classList.includes('items-start');
                        const hasTimestamp = el.querySelector('.text-xs.text-gray-500, [class*="text-xs"][class*="text-gray-500"]');
                        const hasMessageContent = el.querySelector('[class*="rounded-lg"][class*="p-3"]');

                        if (hasFlexCol && hasItems && (hasTimestamp || hasMessageContent)) {
                            const text = el.textContent && el.textContent.trim();
                            if (text && text.length > 15 && text.length < 1000) {
                                messages.push(el);
                                processedMessages.add(el);
                            }
                        }
                    });
                    if (messages.length > 0) break;
                }
            } catch (e) {
                console.warn('Error with selector:', selector, e);
            }
        }
        return messages;
    }

    function getMessageText(messageElement) {
        const messageContent = messageElement.querySelector('[class*="rounded-lg"][class*="p-3"]');
        if (!messageContent) return '';
        const timestamp = messageElement.querySelector('.text-xs.text-gray-500, [class*="text-xs"][class*="text-gray-500"]');
        let text = messageContent.textContent.trim();
        if (timestamp) {
            const timestampText = timestamp.textContent.trim();
            text = text.replace(timestampText, '').trim();
        }
        return text;
    }

    function setMessageText(messageElement, newText) {
        const messageContent = messageElement.querySelector('[class*="rounded-lg"][class*="p-3"]');
        if (messageContent) {
            messageContent.textContent = newText;
        }
    }

    // Lấy context từ TẤT CẢ tin nhắn, phân tách Buyer/Seller rõ ràng
    function getAllMessagesContext() {
        const messages = findMessages();

        // Phân tách tin nhắn của Buyer và Seller
        const buyerMessages = [];
        const sellerMessages = [];

        messages.forEach(msg => {
            const text = getMessageText(msg);
            if (!text || text.length < 5) return;

            // items-end = tin nhắn của người dùng (có thể là buyer hoặc seller)
            // Giả định: người dùng đang nhập là Seller, người kia là Buyer
            // (Bạn có thể điều chỉnh logic này dựa trên cách xác định buyer/seller)
            const isOwn = msg.className.includes('items-end');

            if (isOwn) {
                // Tin nhắn của người dùng (Seller - người bán)
                sellerMessages.push(text);
            } else {
                // Tin nhắn của người khác (Buyer - người mua)
                buyerMessages.push(text);
            }
        });

        // Format context rõ ràng
        let context = '';
        if (buyerMessages.length > 0 || sellerMessages.length > 0) {
            context = 'Conversation context (Buyer-Seller conversation):\n\n';

            if (buyerMessages.length > 0) {
                context += 'Buyer messages:\n';
                buyerMessages.forEach((msg, idx) => {
                    context += `${idx + 1}. ${msg}\n`;
                });
                context += '\n';
            }

            if (sellerMessages.length > 0) {
                context += 'Seller messages:\n';
                sellerMessages.forEach((msg, idx) => {
                    context += `${idx + 1}. ${msg}\n`;
                });
            }
        }

        return context;
    }

    // Tạo button dịch cho tin nhắn (hover) - chỉ setup listeners, không tự động tìm tin nhắn
    async function setupMessageHoverTranslate() {
        // Sử dụng logic từ findMessages() để đảm bảo chỉ chọn message containers chính xác
        // Tránh duplicate bằng cách chỉ chọn message container chính (có message content bên trong)
        const allElements = document.querySelectorAll('main [class*="flex flex-col"]');
        const messageContainers = new Set(); // Dùng Set để tránh duplicate

        allElements.forEach(element => {
            // Kiểm tra xem element này có phải là message container không
            const classList = element.className || '';
            const hasFlexCol = classList.includes('flex') && classList.includes('flex-col');
            const hasItems = classList.includes('items-end') || classList.includes('items-start');
            const hasMessageContent = element.querySelector('[class*="rounded-lg"][class*="p-3"]');

            // Chỉ chọn message container chính (có đủ điều kiện)
            if (hasFlexCol && hasItems && hasMessageContent) {
                // Kiểm tra xem có phải là nested element không (nằm trong một message container khác)
                let isNested = false;
                for (const existing of messageContainers) {
                    if (existing.contains(element) && existing !== element) {
                        isNested = true;
                        break;
                    }
                }

                // Nếu không phải nested và chưa có trong Set, thêm vào
                if (!isNested) {
                    // Xóa các element nhỏ hơn nếu element này chứa chúng
                    const toRemove = [];
                    for (const existing of messageContainers) {
                        if (element.contains(existing) && element !== existing) {
                            toRemove.push(existing);
                        }
                    }
                    toRemove.forEach(el => messageContainers.delete(el));
                    messageContainers.add(element);
                }
            }
        });

        // Convert Set thành Array để forEach
        Array.from(messageContainers).forEach(messageElement => {
            // Kiểm tra đã setup chưa
            if (messageElement.dataset.translateHoverSetup === 'true') return;

            // Đánh dấu đã setup NGAY LẬP TỨC để tránh duplicate
            messageElement.dataset.translateHoverSetup = 'true';

            let hoverButton = null;
            let originalText = '';
            let translatedText = '';

            messageElement.addEventListener('mouseenter', () => {
                // Kiểm tra kỹ: xóa các button cũ nếu có duplicate
                const existingButtons = messageElement.querySelectorAll('.auto-translate-btn-hover');
                if (existingButtons.length > 1) {
                    // Xóa các button duplicate, chỉ giữ lại 1
                    for (let i = 1; i < existingButtons.length; i++) {
                        existingButtons[i].remove();
                    }
                }
                if (existingButtons.length > 0) return;

                // Chỉ khi hover mới lấy text
                const text = getMessageText(messageElement);
                if (!text || text.length < 5) return;

                // Tạo button mới - đảm bảo unique ID
                hoverButton = document.createElement('button');
                hoverButton.className = 'auto-translate-btn-hover';
                hoverButton.setAttribute('data-translate-btn', 'true'); // Thêm attribute để dễ identify
                hoverButton.textContent = CONFIG.TRANSLATE_BUTTON_TEXT;
                hoverButton.style.cssText = `
                    position: absolute;
                    top: 5px;
                    ${messageElement.className.includes('items-end') ? 'right: 5px;' : 'left: 5px;'}
                    padding: 4px 8px;
                    background: #ff9800;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: bold;
                    z-index: 1000;
                    transition: background 0.3s;
                `;

                hoverButton.addEventListener('mouseenter', () => {
                    hoverButton.style.background = '#f57c00';
                });

                hoverButton.addEventListener('mouseleave', () => {
                    hoverButton.style.background = '#ff9800';
                });

                hoverButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (hoverButton.dataset.translating === 'true') return;

                    originalText = getMessageText(messageElement);
                    if (!originalText) return;

                    const fromLang = detectLanguage(originalText);
                    const toLang = fromLang === 'Vietnamese' ? 'English' : 'Vietnamese';

                    hoverButton.dataset.translating = 'true';
                    hoverButton.innerHTML = '';
                    hoverButton.appendChild(createSpinner());
                    hoverButton.style.padding = '4px';

                    try {
                        translatedText = await translateText(originalText, fromLang, toLang);
                        if (translatedText) {
                            setMessageText(messageElement, translatedText);
                            messageElement.dataset.originalText = originalText;
                            messageElement.dataset.translatedText = translatedText;

                            hoverButton.innerHTML = CONFIG.BACK_BUTTON_TEXT;
                            hoverButton.textContent = CONFIG.BACK_BUTTON_TEXT;
                            hoverButton.style.padding = '4px 8px';
                            hoverButton.dataset.translating = 'false';
                            hoverButton.dataset.isTranslated = 'true';

                            hoverButton.addEventListener('click', (e) => {
                                e.stopPropagation();
                                setMessageText(messageElement, originalText);
                                hoverButton.remove();
                                delete messageElement.dataset.translatedText;
                                delete messageElement.dataset.originalText;
                            }, { once: true });
                        } else {
                            hoverButton.innerHTML = CONFIG.TRANSLATE_BUTTON_TEXT;
                            hoverButton.style.padding = '4px 8px';
                            hoverButton.dataset.translating = 'false';
                        }
                    } catch (error) {
                        console.error('Translation error:', error);
                        showNotification('Lỗi khi dịch: ' + error.message, 'error');
                        hoverButton.innerHTML = CONFIG.TRANSLATE_BUTTON_TEXT;
                        hoverButton.style.padding = '4px 8px';
                        hoverButton.dataset.translating = 'false';
                    }
                });

                if (window.getComputedStyle(messageElement).position === 'static') {
                    messageElement.style.position = 'relative';
                }

                messageElement.appendChild(hoverButton);
            });

            messageElement.addEventListener('mouseleave', () => {
                const hoverBtn = messageElement.querySelector('.auto-translate-btn-hover');
                if (hoverBtn && hoverBtn.dataset.isTranslated !== 'true') {
                    hoverBtn.remove();
                }
            });
        });
    }

    // ========== INPUT FUNCTIONS ==========

    function findMessageInput() {
        const possibleSelectors = [
            'main textarea[placeholder*="message" i]',
            'main textarea[placeholder*="Write" i]',
            'main textarea',
            'main input[type="text"]',
        ];

        for (const selector of possibleSelectors) {
            const input = document.querySelector(selector);
            if (input) return input;
        }
        return null;
    }

    async function setupInputTranslate() {
        const input = findMessageInput();
        if (!input || input.dataset.translateSetup) return;
        input.dataset.translateSetup = 'true';

        let translateButton = null;
        let originalInputText = '';
        let translatedInputText = '';

        // Hàm reset button về trạng thái "Dịch"
        function resetInputTranslateButton() {
            if (!translateButton) return;

            // Xóa button cũ
            translateButton.remove();
            translateButton = null;
            delete input.dataset.translatedText;
            delete input.dataset.originalText;
            originalInputText = '';
            translatedInputText = '';

            // Tạo lại button "Dịch" nếu input có nội dung
            if (input.value.trim().length > 0) {
                createInputTranslateButton();
                const inputContainer = input.parentElement;
                if (inputContainer) {
                    if (window.getComputedStyle(inputContainer).position === 'static') {
                        inputContainer.style.position = 'relative';
                    }
                    inputContainer.appendChild(translateButton);
                }
            }
        }

        // Hàm kiểm tra và reset button nếu cần
        function checkAndResetButton() {
            if (!translateButton) return;

            // Nếu input trống và button đang là "←" (quay về), reset về "Dịch"
            if (input.value.length === 0 && translateButton.dataset.isTranslated === 'true') {
                resetInputTranslateButton();
            }
            // Nếu input có nội dung nhưng khác với text đã dịch, reset về "Dịch"
            else if (input.value.length > 0 && translateButton.dataset.isTranslated === 'true') {
                const translatedText = input.dataset.translatedText || '';
                const originalText = input.dataset.originalText || '';

                if (input.value !== translatedText && input.value !== originalText) {
                    resetInputTranslateButton();
                }
            }
        }

        // Tạo button dịch
        function createInputTranslateButton() {
            if (translateButton) return;

            translateButton = document.createElement('button');
            translateButton.type = 'button'; // Quan trọng: không cho phép submit form
            translateButton.className = 'auto-translate-input-btn';
            translateButton.textContent = CONFIG.TRANSLATE_BUTTON_TEXT;
            translateButton.style.cssText = `
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                padding: 5px 10px;
                background: #ff9800;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000;
                transition: background 0.3s;
            `;

            translateButton.addEventListener('mouseenter', () => {
                translateButton.style.background = '#f57c00';
            });

            translateButton.addEventListener('mouseleave', () => {
                translateButton.style.background = '#ff9800';
            });

            translateButton.addEventListener('click', async (e) => {
                // Ngăn chặn mọi event propagation và default behavior
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();

                // Ngăn chặn submit form nếu button nằm trong form
                const form = translateButton.closest('form');
                if (form) {
                    e.stopPropagation();
                }

                if (translateButton.dataset.translating === 'true') return;

                originalInputText = input.value;
                if (!originalInputText || originalInputText.trim().length < 3) {
                    showNotification('Vui lòng nhập tin nhắn trước khi dịch', 'info');
                    return;
                }

                const fromLang = 'Vietnamese';
                const toLang = 'English';

                translateButton.dataset.translating = 'true';
                translateButton.innerHTML = '';
                translateButton.appendChild(createSpinner());
                translateButton.style.padding = '5px';

                try {
                    // CHỈ KHI NÀY MỚI LOAD TIN NHẮN và dịch với context đầy đủ
                    translatedInputText = await translateInputText(originalInputText, fromLang, toLang);
                    if (translatedInputText) {
                        // Lưu giá trị gốc
                        input.dataset.originalText = originalInputText;
                        input.dataset.translatedText = translatedInputText;

                        // Ghi đè giá trị input - sử dụng React's setter nếu có
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                        if (nativeInputValueSetter) {
                            nativeInputValueSetter.call(input, translatedInputText);
                        } else {
                            input.value = translatedInputText;
                        }

                        // Trigger input event để React biết giá trị đã thay đổi
                        // Sử dụng native event để React nhận diện
                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                        input.dispatchEvent(inputEvent);

                        // Trigger change event nếu cần
                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                        input.dispatchEvent(changeEvent);

                        // Đảm bảo không có event submit nào được trigger
                        // Bằng cách kiểm tra và ngăn chặn mọi form submit trong 100ms
                        const preventSubmit = (submitEvent) => {
                            submitEvent.preventDefault();
                            submitEvent.stopPropagation();
                            submitEvent.stopImmediatePropagation();
                        };

                        const form = input.closest('form');
                        if (form) {
                            form.addEventListener('submit', preventSubmit, { once: true, capture: true });
                            setTimeout(() => {
                                form.removeEventListener('submit', preventSubmit, { capture: true });
                            }, 100);
                        }

                        // Thay button bằng button quay lại
                        translateButton.innerHTML = CONFIG.BACK_BUTTON_TEXT;
                        translateButton.textContent = CONFIG.BACK_BUTTON_TEXT;
                        translateButton.style.padding = '5px 10px';
                        translateButton.dataset.translating = 'false';
                        translateButton.dataset.isTranslated = 'true';

                        // Xóa event listener cũ và thêm listener mới cho button quay lại
                        const newButton = translateButton.cloneNode(true);
                        translateButton.parentNode.replaceChild(newButton, translateButton);
                        translateButton = newButton;

                        translateButton.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            e.preventDefault();

                            // Khôi phục giá trị gốc
                            const originalValue = input.dataset.originalText;
                            if (originalValue) {
                                input.value = originalValue;

                                // Trigger events để React cập nhật
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                                nativeInputValueSetter.call(input, originalValue);

                                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                input.dispatchEvent(inputEvent);

                                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                input.dispatchEvent(changeEvent);
                            }

                            // Reset button về trạng thái "Dịch"
                            resetInputTranslateButton();
                        });
                    } else {
                        translateButton.innerHTML = CONFIG.TRANSLATE_BUTTON_TEXT;
                        translateButton.style.padding = '5px 10px';
                        translateButton.dataset.translating = 'false';
                    }
                } catch (error) {
                    console.error('Translation error:', error);
                    showNotification('Lỗi khi dịch: ' + error.message, 'error');
                    translateButton.innerHTML = CONFIG.TRANSLATE_BUTTON_TEXT;
                    translateButton.style.padding = '5px 10px';
                    translateButton.dataset.translating = 'false';
                }
            });

            const inputContainer = input.parentElement;
            if (inputContainer && window.getComputedStyle(inputContainer).position === 'static') {
                inputContainer.style.position = 'relative';
            }

            inputContainer.appendChild(translateButton);
        }

        input.addEventListener('focus', () => {
            if (!translateButton && input.value.trim().length > 0) {
                createInputTranslateButton();
                const inputContainer = input.parentElement;
                if (inputContainer) {
                    if (window.getComputedStyle(inputContainer).position === 'static') {
                        inputContainer.style.position = 'relative';
                    }
                    inputContainer.appendChild(translateButton);
                }
            }
        });

        // Theo dõi input value thay đổi bằng nhiều cách
        let lastInputValue = input.value;

        // MutationObserver để theo dõi thay đổi value của input (React có thể không trigger input event)
        const inputObserver = new MutationObserver(() => {
            if (input.value !== lastInputValue) {
                lastInputValue = input.value;
                checkAndResetButton();
            }
        });

        // Theo dõi attribute changes (value có thể thay đổi qua attribute)
        inputObserver.observe(input, {
            attributes: true,
            attributeFilter: ['value'],
            childList: false,
            subtree: false
        });

        // Event listeners
        input.addEventListener('input', () => {
            lastInputValue = input.value;
            checkAndResetButton();

            // Nếu input trống và button đang là "Dịch", xóa button
            if (input.value.length === 0 && translateButton && translateButton.dataset.isTranslated !== 'true') {
                translateButton.remove();
                translateButton = null;
            }
            // Nếu input có nội dung và chưa có button, tạo button
            else if (input.value.length > 0 && !translateButton) {
                createInputTranslateButton();
                const inputContainer = input.parentElement;
                if (inputContainer) {
                    if (window.getComputedStyle(inputContainer).position === 'static') {
                        inputContainer.style.position = 'relative';
                    }
                    inputContainer.appendChild(translateButton);
                }
            }
        });

        input.addEventListener('change', () => {
            lastInputValue = input.value;
            checkAndResetButton();
        });

        input.addEventListener('blur', () => {
            lastInputValue = input.value;
            checkAndResetButton();
        });

        // Theo dõi khi form submit để reset button (người dùng đã gửi tin nhắn)
        const form = input.closest('form');
        if (form) {
            form.addEventListener('submit', () => {
                // Sau khi submit, kiểm tra và reset button nhiều lần (React có thể clear input chậm)
                const checkInterval = setInterval(() => {
                    lastInputValue = input.value;
                    checkAndResetButton();

                    // Nếu input đã trống và button đã được reset, dừng kiểm tra
                    if (input.value.length === 0 && (!translateButton || translateButton.dataset.isTranslated !== 'true')) {
                        clearInterval(checkInterval);
                    }
                }, 50); // Check mỗi 50ms

                // Dừng sau 2 giây (đủ thời gian để React clear input)
                setTimeout(() => {
                    clearInterval(checkInterval);
                    lastInputValue = input.value;
                    checkAndResetButton();
                }, 2000);
            });
        }

        // Kiểm tra định kỳ để đảm bảo button luôn đúng trạng thái
        const periodicCheck = setInterval(() => {
            if (input && translateButton) {
                checkAndResetButton();
            }
        }, 500); // Check mỗi 500ms

        // Cleanup khi input bị remove
        const cleanupObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === input || (node.contains && node.contains(input))) {
                        clearInterval(periodicCheck);
                        inputObserver.disconnect();
                        cleanupObserver.disconnect();
                    }
                });
            });
        });
        if (input.parentElement) {
            cleanupObserver.observe(input.parentElement, { childList: true, subtree: true });
        }

        if (input.value.trim().length > 0) {
            createInputTranslateButton();
        }
    }

    // ========== INITIALIZATION ==========

    // Thêm biến để track và debounce
    let isProcessing = false;
    let observerInstance = null;
    let processTimeout = null;
    let lastProcessTime = 0;
    const PROCESS_DEBOUNCE = 500; // 500ms debounce
    const MIN_PROCESS_INTERVAL = 2000; // Tối thiểu 2 giây giữa các lần chạy

    async function init() {
        // Kiểm tra extension context trước khi tiếp tục
        if (!isExtensionContextValid()) {
            console.warn('Extension context invalidated, reloading page may be required');
            return;
        }

        console.log('Auto Translate BuySellVouchers extension loaded');

        try {
            const apiKey = await getApiKey();

            // Nếu chưa có API key, hiển thị thông báo
            if (!apiKey) {
                showNotification('Vui lòng cấu hình Groq API key! Click vào icon extension để cấu hình.', 'error');
            }

            // Đợi trang load xong
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(processPage, 1000);
                });
            } else {
                setTimeout(processPage, 1000);
            }

            observePageChanges();
        } catch (error) {
            console.error('Error initializing extension:', error);
            // Nếu là lỗi extension context, thông báo cho user
            if (error.message && error.message.includes('Extension context invalidated')) {
                showNotification('Extension đã được cập nhật. Vui lòng reload trang để tiếp tục sử dụng.', 'error');
            }
        }
    }

    async function processPage() {
        // Kiểm tra extension context trước khi tiếp tục
        if (!isExtensionContextValid()) {
            // Chỉ log 1 lần để tránh spam console
            if (!processPage.lastWarningTime || Date.now() - processPage.lastWarningTime > 5000) {
                console.warn('Extension context invalidated, skipping processPage. Please reload the page.');
                processPage.lastWarningTime = Date.now();
            }
            return;
        }

        // Tránh chạy đồng thời
        if (isProcessing) {
            return;
        }

        // Kiểm tra thời gian tối thiểu giữa các lần chạy
        const now = Date.now();
        if (now - lastProcessTime < MIN_PROCESS_INTERVAL) {
            return;
        }

        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                return;
            }

            isProcessing = true;
            lastProcessTime = now;

            // CHỈ setup event listeners, KHÔNG tự động tìm/tải tin nhắn
            // Tin nhắn chỉ được load khi user click "Dịch"
            await setupMessageHoverTranslate();
            await setupInputTranslate();
        } catch (error) {
            console.error('Error processing page:', error);
            // Nếu là lỗi extension context invalidated, thử reload page
            if (error.message && error.message.includes('Extension context invalidated')) {
                console.warn('Extension context invalidated, please reload the page');
            }
        } finally {
            isProcessing = false;
        }
    }

    function observePageChanges() {
        // Chỉ tạo 1 observer
        if (observerInstance) {
            return;
        }

        observerInstance = new MutationObserver((mutations) => {
            // Chỉ xử lý nếu có thêm message mới, không xử lý mọi thay đổi
            let hasNewMessage = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        // Kiểm tra xem có phải message container không
                        if (node.matches && node.matches('[class*="flex flex-col"]') &&
                            node.dataset.translateHoverSetup !== 'true') {
                            hasNewMessage = true;
                        }
                        // Kiểm tra trong children
                        if (node.querySelectorAll &&
                            node.querySelectorAll('[class*="flex flex-col"]:not([data-translate-hover-setup])').length > 0) {
                            hasNewMessage = true;
                        }
                    }
                });
            });

            // Chỉ process nếu có message mới
            if (!hasNewMessage) return;

            // Debounce: chỉ chạy sau khi không có thay đổi trong 500ms
            if (processTimeout) {
                clearTimeout(processTimeout);
            }

            processTimeout = setTimeout(() => {
                processPage();
            }, PROCESS_DEBOUNCE);
        });

        observerInstance.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Khởi chạy
    init();

    // Chạy lại sau mỗi 5 giây (giảm tần suất vì đã có MutationObserver)
    setInterval(() => {
        if (!isProcessing) {
            processPage();
        }
    }, 5000);

})();


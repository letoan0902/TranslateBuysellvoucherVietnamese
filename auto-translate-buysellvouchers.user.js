// ==UserScript==
// @name         Auto Translate BuySellVouchers Messages
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Tự động dịch tin nhắn trên buysellvouchers.com
// @author       You
// @match        https://www.buysellvouchers.com/*
// @match        https://buysellvouchers.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api.groq.com
// ==/UserScript==

(function () {
    'use strict';

    // ========== CONFIGURATION ==========
    const CONFIG = {
        GROQ_API_KEY: '', // Người dùng cần nhập API key của họ
        GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
        MODEL: 'llama-3.3-70b-versatile',
        TRANSLATE_BUTTON_TEXT: 'Dịch',
        BACK_BUTTON_TEXT: '←',
    };

    // ========== UTILITY FUNCTIONS ==========

    function getApiKey() {
        let apiKey = GM_getValue('groq_api_key', '');
        if (!apiKey && CONFIG.GROQ_API_KEY) {
            apiKey = CONFIG.GROQ_API_KEY;
            GM_setValue('groq_api_key', apiKey);
        }
        return apiKey;
    }

    function setApiKey(apiKey) {
        GM_setValue('groq_api_key', apiKey);
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
        // Mặc định là English
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

    async function translateText(text, fromLang, toLang, context = '') {
        const apiKey = getApiKey();
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

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: CONFIG.GROQ_API_URL,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                data: JSON.stringify({
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
                }),
                onload: function (response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.choices && data.choices[0] && data.choices[0].message) {
                            resolve(data.choices[0].message.content.trim());
                        } else {
                            reject(new Error('Unexpected response format'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function (error) {
                    reject(error);
                }
            });
        });
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

    // Lấy context từ các tin nhắn gần nhất
    function getRecentMessagesContext(limit = 5) {
        const messages = findMessages();
        const recentMessages = messages.slice(-limit);
        return recentMessages.map(msg => {
            const text = getMessageText(msg);
            const isOwn = msg.className.includes('items-end');
            return `${isOwn ? 'You' : 'Other'}: ${text}`;
        }).join('\n');
    }

    // Tạo button dịch cho tin nhắn (hover)
    function setupMessageHoverTranslate() {
        const messages = findMessages();
        messages.forEach(messageElement => {
            if (messageElement.dataset.translateHoverSetup) return;
            messageElement.dataset.translateHoverSetup = 'true';

            let hoverButton = null;
            let originalText = '';
            let translatedText = '';

            messageElement.addEventListener('mouseenter', () => {
                if (messageElement.querySelector('.auto-translate-btn-hover')) return;

                const text = getMessageText(messageElement);
                if (!text || text.length < 5) return;

                hoverButton = document.createElement('button');
                hoverButton.className = 'auto-translate-btn-hover';
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

                            // Thay button bằng button quay lại
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

    function setupInputTranslate() {
        const input = findMessageInput();
        if (!input || input.dataset.translateSetup) return;
        input.dataset.translateSetup = 'true';

        let translateButton = null;
        let originalInputText = '';
        let translatedInputText = '';

        // Tạo button dịch
        function createInputTranslateButton() {
            if (translateButton) return;

            translateButton = document.createElement('button');
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
                e.stopPropagation();
                if (translateButton.dataset.translating === 'true') return;

                originalInputText = input.value;
                if (!originalInputText || originalInputText.trim().length < 3) {
                    showNotification('Vui lòng nhập tin nhắn trước khi dịch', 'info');
                    return;
                }

                const fromLang = 'Vietnamese'; // Người dùng nhập tiếng Việt
                const toLang = 'English'; // Dịch sang tiếng Anh
                const context = getRecentMessagesContext(5);

                translateButton.dataset.translating = 'true';
                translateButton.innerHTML = '';
                translateButton.appendChild(createSpinner());
                translateButton.style.padding = '5px';

                try {
                    translatedInputText = await translateText(originalInputText, fromLang, toLang, context);
                    if (translatedInputText) {
                        input.value = translatedInputText;
                        input.dataset.originalText = originalInputText;
                        input.dataset.translatedText = translatedInputText;

                        // Thay button bằng button quay lại
                        translateButton.innerHTML = CONFIG.BACK_BUTTON_TEXT;
                        translateButton.textContent = CONFIG.BACK_BUTTON_TEXT;
                        translateButton.style.padding = '5px 10px';
                        translateButton.dataset.translating = 'false';
                        translateButton.dataset.isTranslated = 'true';

                        translateButton.removeEventListener('click', arguments.callee);
                        translateButton.addEventListener('click', (e) => {
                            e.stopPropagation();
                            input.value = originalInputText;
                            translateButton.remove();
                            delete input.dataset.translatedText;
                            delete input.dataset.originalText;
                            translateButton = null;
                        }, { once: true });
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

            // Đảm bảo input container có position relative
            const inputContainer = input.parentElement;
            if (inputContainer && window.getComputedStyle(inputContainer).position === 'static') {
                inputContainer.style.position = 'relative';
            }

            inputContainer.appendChild(translateButton);
        }

        // Hiển thị button khi focus hoặc có text
        input.addEventListener('focus', () => {
            if (!translateButton && input.value.trim().length > 0) {
                createInputTranslateButton();
            }
        });

        input.addEventListener('input', () => {
            if (!translateButton && input.value.trim().length > 0) {
                createInputTranslateButton();
            } else if (translateButton && input.value.trim().length === 0 && translateButton.dataset.isTranslated !== 'true') {
                translateButton.remove();
                translateButton = null;
            }
        });

        // Hiển thị button khi có text
        if (input.value.trim().length > 0) {
            createInputTranslateButton();
        }
    }

    // ========== API KEY UI ==========

    function createApiKeyModal() {
        // Kiểm tra xem modal đã tồn tại chưa
        let existingModal = document.getElementById('auto-translate-api-modal');
        if (existingModal) {
            existingModal.style.display = 'flex';
            return existingModal;
        }

        const modal = document.createElement('div');
        modal.id = 'auto-translate-api-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            font-family: Arial, sans-serif;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        const title = document.createElement('h2');
        title.textContent = 'Cấu hình Groq API Key';
        title.style.cssText = `
            margin: 0 0 15px 0;
            color: #333;
            font-size: 20px;
        `;

        const description = document.createElement('p');
        description.innerHTML = `
            Script cần Groq API key để dịch tin nhắn.<br>
            <a href="https://console.groq.com/" target="_blank" style="color: #2196f3;">Lấy API key tại đây</a>
        `;
        description.style.cssText = `
            margin: 0 0 20px 0;
            color: #666;
            font-size: 14px;
            line-height: 1.5;
        `;

        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = 'Nhập Groq API Key của bạn';
        input.value = getApiKey() || '';
        input.style.cssText = `
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            box-sizing: border-box;
            margin-bottom: 15px;
        `;
        input.addEventListener('focus', () => {
            input.style.borderColor = '#ff9800';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = '#ddd';
        });

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        `;

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Hủy';
        cancelButton.style.cssText = `
            padding: 10px 20px;
            background: #f5f5f5;
            color: #333;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.background = '#e0e0e0';
        });
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.background = '#f5f5f5';
        });

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Lưu';
        saveButton.style.cssText = `
            padding: 10px 20px;
            background: #ff9800;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;
        saveButton.addEventListener('mouseenter', () => {
            saveButton.style.background = '#f57c00';
        });
        saveButton.addEventListener('mouseleave', () => {
            saveButton.style.background = '#ff9800';
        });

        cancelButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        saveButton.addEventListener('click', () => {
            const apiKey = input.value.trim();
            if (!apiKey) {
                alert('Vui lòng nhập API key!');
                return;
            }
            setApiKey(apiKey);
            showNotification('Đã lưu API key thành công!', 'success');
            modal.style.display = 'none';
            // Reload để script hoạt động
            setTimeout(() => {
                processPage();
            }, 500);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveButton.click();
            }
        });

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);

        modalContent.appendChild(title);
        modalContent.appendChild(description);
        modalContent.appendChild(input);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);

        // Đóng khi click bên ngoài
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    function createApiKeyButton() {
        // Kiểm tra xem button đã tồn tại chưa
        if (document.getElementById('auto-translate-api-btn')) return;

        const button = document.createElement('button');
        button.id = 'auto-translate-api-btn';
        button.innerHTML = '⚙️ API Key';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 15px;
            background: #ff9800;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            transition: background 0.3s;
        `;
        button.addEventListener('mouseenter', () => {
            button.style.background = '#f57c00';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = '#ff9800';
        });
        button.addEventListener('click', () => {
            createApiKeyModal();
        });
        document.body.appendChild(button);
    }

    // ========== INITIALIZATION ==========

    function init() {
        console.log('Auto Translate BuySellVouchers script loaded');

        const apiKey = getApiKey();

        // Luôn hiển thị button để cấu hình API key
        createApiKeyButton();

        // Nếu chưa có API key, hiển thị modal ngay
        if (!apiKey) {
            showNotification('Vui lòng cấu hình Groq API key để sử dụng tính năng dịch!', 'error');
            setTimeout(() => {
                createApiKeyModal();
            }, 1000);
        }

        // Đợi trang load xong
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(processPage, 1000);
            });
        } else {
            setTimeout(processPage, 1000);
        }

        // Theo dõi thay đổi
        observePageChanges();
    }

    function processPage() {
        // Chỉ chạy nếu đã có API key
        const apiKey = getApiKey();
        if (!apiKey) {
            console.log('Chưa có API key, bỏ qua xử lý');
            return;
        }

        console.log('Processing page...');
        setupMessageHoverTranslate();
        setupInputTranslate();

        // Debug: kiểm tra xem có tìm thấy tin nhắn không
        const messages = findMessages();
        const input = findMessageInput();
        console.log(`Found ${messages.length} messages, input:`, input ? 'Yes' : 'No');
    }

    function observePageChanges() {
        const observer = new MutationObserver(() => {
            processPage();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Khởi chạy
    init();

    // Chạy lại sau mỗi 2 giây
    setInterval(processPage, 2000);

})();

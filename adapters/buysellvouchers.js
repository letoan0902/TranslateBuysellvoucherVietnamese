/**
 * BuySellVouchers Adapter
 * Handles message translation on buysellvouchers.com
 */
window.AdapterBSV = (function () {
    'use strict';

    const PLATFORM_NAME = 'buysellvouchers.com';

    // ========== MESSAGE FINDING ==========

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
                            if (text && text.length > 15 && text.length < 5000) {
                                messages.push(el);
                                processedMessages.add(el);
                            }
                        }
                    });
                    if (messages.length > 0) break;
                }
            } catch (e) {
                // Skip invalid selectors
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
            text = text.replace(timestamp.textContent.trim(), '').trim();
        }
        return text;
    }

    function setMessageText(messageElement, newText) {
        const messageContent = messageElement.querySelector('[class*="rounded-lg"][class*="p-3"]');
        if (messageContent) {
            messageContent.textContent = newText;
        }
    }

    // ========== CONVERSATION CONTEXT ==========

    /**
     * Get conversation context using ORIGINAL text (not translated DOM text).
     * Limited to last 15 messages to avoid excessive token usage.
     */
    function getConversationContext() {
        const messages = findMessages();
        // Take only the last 15 messages
        const recentMessages = messages.slice(-15);
        const contextParts = [];

        recentMessages.forEach(msg => {
            // Use originalText from dataset (set during hover setup) — this is the REAL language
            // Falls back to current DOM text if originalText not yet stored
            const text = msg.dataset.originalText || getMessageText(msg);
            if (!text || text.length < 3) return;
            const isOwn = msg.className.includes('items-end');
            const role = isOwn ? 'Seller (You)' : 'Buyer (Customer)';
            contextParts.push(`${role}: ${text}`);
        });

        if (contextParts.length === 0) return '';
        return 'Conversation context (Buyer-Seller chat on BuySellVouchers):\n\n' + contextParts.join('\n');
    }

    // ========== HOVER TRANSLATE ==========

    function setupMessageHoverTranslate() {
        const allElements = document.querySelectorAll('main [class*="flex flex-col"]');
        const messageContainers = new Set();

        allElements.forEach(element => {
            const classList = element.className || '';
            const hasFlexCol = classList.includes('flex') && classList.includes('flex-col');
            const hasItems = classList.includes('items-end') || classList.includes('items-start');
            const hasMessageContent = element.querySelector('[class*="rounded-lg"][class*="p-3"]');

            if (hasFlexCol && hasItems && hasMessageContent) {
                let isNested = false;
                for (const existing of messageContainers) {
                    if (existing.contains(element) && existing !== element) {
                        isNested = true;
                        break;
                    }
                }
                if (!isNested) {
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

        Array.from(messageContainers).forEach(messageElement => {
            const isOwn = messageElement.className.includes('items-end');
            window.TranslateUI.createHoverTranslateButton({
                messageElement,
                position: isOwn ? 'right' : 'left',
                getMessageText,
                getConversationContext,
                onTranslated: (el, originalText, translatedText) => {
                    setMessageText(el, translatedText);
                    el.dataset.originalText = originalText;
                }
            });
        });
    }

    // ========== INPUT TRANSLATE ==========

    function findMessageInput() {
        const selectors = [
            'main textarea[placeholder*="message" i]',
            'main textarea[placeholder*="Write" i]',
            'main textarea',
            'main input[type="text"]',
        ];
        for (const selector of selectors) {
            const input = document.querySelector(selector);
            if (input) return input;
        }
        return null;
    }

    function setupInputTranslate() {
        const input = findMessageInput();
        if (!input || input.dataset.translateSetup === 'true') return;
        input.dataset.translateSetup = 'true';

        let translateButton = null;
        let originalInputText = '';

        function resetButton() {
            if (translateButton) {
                translateButton.remove();
                translateButton = null;
            }
            delete input.dataset.translatedText;
            delete input.dataset.originalText;
            originalInputText = '';
            if (input.value.trim().length > 0) {
                createButton();
            }
        }

        function createButton() {
            if (translateButton) return;

            translateButton = document.createElement('button');
            translateButton.type = 'button';
            translateButton.className = 'auto-translate-input-btn';
            translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;

            translateButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();

                if (translateButton.dataset.translating === 'true') return;

                originalInputText = input.value;
                if (!originalInputText || originalInputText.trim().length < 3) {
                    window.TranslateUI.showNotification('Vui lòng nhập tin nhắn trước khi dịch', 'info');
                    return;
                }

                const fromLang = window.TranslateLanguage.detectLanguage(originalInputText);
                const context = getConversationContext();
                const toLang = window.TranslateLanguage.getTargetLanguage(fromLang, context);

                translateButton.dataset.translating = 'true';
                translateButton.textContent = 'Đang dịch...';
                translateButton.style.background = '#e68900';

                try {
                    const translatedText = await window.TranslateAPI.translateInputText(
                        originalInputText, fromLang, toLang, context, PLATFORM_NAME
                    );

                    if (translatedText) {
                        input.dataset.originalText = originalInputText;
                        input.dataset.translatedText = translatedText;

                        // Set value using React-compatible setter
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                        nativeSetter.call(input, translatedText);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } catch (error) {
                    console.error('[AutoTranslate] BSV input translation error:', error);
                    window.TranslateUI.showNotification('Lỗi dịch: ' + error.message, 'error');
                }
                // Always reset button state after translate attempt
                translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
                translateButton.dataset.translating = 'false';
                delete translateButton.dataset.isTranslated;
            });

            const container = input.parentElement;
            if (container) {
                if (window.getComputedStyle(container).position === 'static') {
                    container.style.position = 'relative';
                }
                container.appendChild(translateButton);
            }
        }

        // Show button on input
        input.addEventListener('input', () => {
            // Auto-reset translated state when user types
            if (translateButton && translateButton.dataset.isTranslated === 'true') {
                translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
                delete translateButton.dataset.isTranslated;
            }
            if (input.value.length === 0 && translateButton) {
                translateButton.remove();
                translateButton = null;
            } else if (input.value.length > 0 && !translateButton) {
                createButton();
            }
        });

        input.addEventListener('focus', () => {
            if (!translateButton && input.value.trim().length > 0) createButton();
        });

        if (input.value.trim().length > 0) createButton();
    }

    // ========== PUBLIC API ==========

    function processPage() {
        setupMessageHoverTranslate();
        setupInputTranslate();
    }

    function getObserverConfig() {
        return {
            checkNewMessage: (node) => {
                if (node.matches && node.matches('[class*="flex flex-col"]') && node.dataset.translateHoverSetup !== 'true') {
                    return true;
                }
                if (node.querySelectorAll && node.querySelectorAll('[class*="flex flex-col"]:not([data-translate-hover-setup])').length > 0) {
                    return true;
                }
                return false;
            }
        };
    }

    return {
        PLATFORM_NAME,
        processPage,
        getObserverConfig
    };
})();

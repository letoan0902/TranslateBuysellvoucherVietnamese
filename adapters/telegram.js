/**
 * Telegram Web A Adapter
 * Handles message translation on web.telegram.org/a/
 */
window.AdapterTelegram = (function () {
    'use strict';

    const PLATFORM_NAME = 'Telegram';

    // ========== MESSAGE FINDING ==========

    function findMessageContainer() {
        // Telegram Web A uses .MessageList as container
        return document.querySelector('.MessageList, #MessageList, .messages-container');
    }

    function findMessages() {
        const container = findMessageContainer();
        if (!container) return [];

        // Telegram Web A message structure
        const selectors = [
            '.Message',
            'div[class*="Message "]',
            '.message',
        ];

        for (const selector of selectors) {
            const messages = container.querySelectorAll(selector);
            if (messages.length > 0) return Array.from(messages);
        }
        return [];
    }

    function getMessageText(messageElement) {
        // Try various selectors for message text in Telegram Web A
        const textSelectors = [
            '.text-content',
            '.translatable-message',
            'span.translatable-message',
            '.message-content .text-content',
            '.text-entity',
        ];

        for (const selector of textSelectors) {
            const textEl = messageElement.querySelector(selector);
            if (textEl) {
                // Clone and remove non-text elements (reactions, time, etc.)
                const clone = textEl.cloneNode(true);
                const removeSelectors = [
                    '.message-reactions', '.reactions-container',
                    '.time', '.message-time', 'time',
                    '.message-meta', '.MessageMeta',
                    'button', 'svg',
                    '.hidden-copy-text'
                ];
                removeSelectors.forEach(sel => {
                    clone.querySelectorAll(sel).forEach(el => el.remove());
                });
                const text = clone.textContent.trim();
                if (text.length > 0) return text;
            }
        }

        return '';
    }

    function setMessageText(messageElement, newText) {
        const textSelectors = [
            '.text-content',
            '.translatable-message',
            'span.translatable-message',
        ];

        for (const selector of textSelectors) {
            const textEl = messageElement.querySelector(selector);
            if (textEl) {
                // Preserve meta elements
                const meta = textEl.querySelector('.MessageMeta, .message-time, time');
                textEl.textContent = newText;
                if (meta) textEl.appendChild(meta);
                return;
            }
        }
    }

    function isOwnMessage(messageElement) {
        // IMPORTANT: Must use classList.contains() NOT className.includes()
        // because 'shown' contains substring 'own' which causes false positives
        return messageElement.classList.contains('own') ||
            messageElement.classList.contains('outgoing') ||
            messageElement.classList.contains('is-own') ||
            messageElement.closest('.is-own, .own, .outgoing') !== null;
    }

    // ========== CONVERSATION CONTEXT ==========

    function getConversationContext() {
        const messages = findMessages();
        const contextParts = [];

        // Limit to last 15 messages
        const recentMessages = messages.slice(-15);

        recentMessages.forEach(msg => {
            // Use stored original text (handles translated DOM)
            const text = msg.dataset.originalText || getMessageText(msg);
            if (!text || text.length < 2) return;

            const isOwn = isOwnMessage(msg);
            const role = isOwn ? 'You' : 'Contact';
            contextParts.push(`${role}: ${text}`);
        });

        if (contextParts.length === 0) return '';
        return 'Conversation context (Telegram chat):\n\n' + contextParts.join('\n');
    }

    // ========== HOVER TRANSLATE ==========

    function setupMessageHoverTranslate() {
        const messages = findMessages();

        messages.forEach(messageElement => {
            const text = getMessageText(messageElement);
            if (!text || text.length < 2) return;

            const isOwn = isOwnMessage(messageElement);

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
        // Telegram Web A uses contentEditable div for input
        const selectors = [
            '#editable-message-text',
            'div[contenteditable="true"].form-control',
            'div[contenteditable="true"]',
            '.composer-text-input',
        ];

        for (const selector of selectors) {
            const input = document.querySelector(selector);
            if (input) return input;
        }
        return null;
    }

    function getInputText(inputElement) {
        return inputElement.innerText || inputElement.textContent || '';
    }

    function setInputText(inputElement, text) {
        inputElement.innerHTML = '';
        inputElement.textContent = text;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function setupInputTranslate() {
        const input = findMessageInput();
        if (!input || input.dataset.translateSetup === 'true') return;
        input.dataset.translateSetup = 'true';

        let translateButton = null;

        function createButton() {
            if (translateButton) return;

            translateButton = document.createElement('button');
            translateButton.type = 'button';
            translateButton.className = 'auto-translate-btn';
            translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
            translateButton.style.cssText = `
                position: absolute;
                right: 50px;
                bottom: 10px;
                padding: 5px 10px;
                z-index: 10000;
            `;

            translateButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (translateButton.dataset.translating === 'true') return;

                const text = getInputText(input).trim();
                if (!text || text.length < 3) {
                    window.TranslateUI.showNotification('Vui lòng nhập tin nhắn trước khi dịch', 'info');
                    return;
                }

                const context = getConversationContext();
                const fromLang = window.TranslateLanguage.detectLanguage(text);
                const toLang = window.TranslateLanguage.getTargetLanguage(fromLang, context);

                translateButton.dataset.translating = 'true';
                translateButton.textContent = 'Đang dịch...';
                translateButton.style.background = '#e68900';

                try {
                    const translated = await window.TranslateAPI.translateInputText(text, fromLang, toLang, context, PLATFORM_NAME);
                    if (translated) {
                        setInputText(input, translated);
                    }
                } catch (error) {
                    console.error('[AutoTranslate] Telegram input translation error:', error);
                    window.TranslateUI.showNotification('Lỗi dịch: ' + error.message, 'error');
                }
                // Always reset button state after translate attempt
                translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
                translateButton.style.background = '#ff9800';
                translateButton.dataset.translating = 'false';
                delete translateButton.dataset.isTranslated;
            });

            // Find the composer container to place the button
            const composer = input.closest('.composer, .Composer, form, .message-input-wrapper') || input.parentElement;
            if (composer) {
                if (window.getComputedStyle(composer).position === 'static') {
                    composer.style.position = 'relative';
                }
                composer.appendChild(translateButton);
            }
        }

        // Monitor input changes using MutationObserver (contentEditable)
        const inputObserver = new MutationObserver(() => {
            const text = getInputText(input).trim();
            // Auto-reset translated state when user types
            if (translateButton && translateButton.dataset.isTranslated === 'true') {
                translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
                translateButton.style.background = '#ff9800';
                delete translateButton.dataset.isTranslated;
            }
            if (text.length === 0 && translateButton) {
                translateButton.remove();
                translateButton = null;
            } else if (text.length > 0 && !translateButton) {
                createButton();
            }
        });

        inputObserver.observe(input, {
            childList: true,
            subtree: true,
            characterData: true
        });

        input.addEventListener('input', () => {
            const text = getInputText(input).trim();
            if (text.length > 0 && !translateButton) {
                createButton();
            }
        });

        if (getInputText(input).trim().length > 0) createButton();
    }

    // ========== PUBLIC API ==========

    function processPage() {
        setupMessageHoverTranslate();
        setupInputTranslate();
    }

    function getObserverConfig() {
        return {
            checkNewMessage: (node) => {
                const className = node.className || '';
                if (className.includes('Message') && !className.includes('MessageList') && node.dataset.translateHoverSetup !== 'true') {
                    return true;
                }
                if (node.querySelectorAll) {
                    const msgs = node.querySelectorAll('.Message:not([data-translate-hover-setup])');
                    if (msgs.length > 0) return true;
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

/**
 * Digiseller/Plati Adapter
 * Handles message translation on my.digiseller.com and chat.digiseller.com
 * Supports 2 chat types:
 *   1. Post-purchase debate chat (purchases_inv_detail.asp?view=debate)
 *   2. Pre-purchase Q&A chat (chat.digiseller.com / inline chat widget)
 */
window.AdapterDigiseller = (function () {
    'use strict';

    const PLATFORM_NAME = 'digiseller.com / plati.market';
    const MAX_CONTEXT_MESSAGES = 15;

    // ========== DETECT CHAT TYPE ==========

    function getChatType() {
        const url = window.location.href;
        // Type 1: Post-purchase debate
        if (url.includes('purchases_inv_detail') && url.includes('debate')) {
            return 'debate';
        }
        if (document.querySelector('.debates_content')) {
            return 'debate';
        }
        // Type 2: Pre-purchase Q&A
        if (document.querySelector('#messages') && document.querySelector('#contacts')) {
            return 'chat';
        }
        if (document.querySelector('#message-textarea')) {
            return 'chat';
        }
        return null;
    }

    // ==============================================================
    // TYPE 1: POST-PURCHASE DEBATE CHAT
    // ==============================================================

    const Debate = {
        findMessages() {
            return Array.from(document.querySelectorAll('.debates_content__mess'));
        },

        getMessageText(messageElement) {
            const textSpans = messageElement.querySelectorAll(':scope > span > span');
            for (const span of textSpans) {
                const text = span.textContent.trim();
                if (text.length > 0) return text;
            }
            const spanWithText = messageElement.querySelector('span:not([class])');
            if (spanWithText) {
                const innerSpan = spanWithText.querySelector('span');
                if (innerSpan) return innerSpan.textContent.trim();
                return spanWithText.textContent.trim();
            }
            return '';
        },

        setMessageText(messageElement, newText) {
            const textSpans = messageElement.querySelectorAll(':scope > span > span');
            for (const span of textSpans) {
                if (span.textContent.trim().length > 0) {
                    span.textContent = newText;
                    return;
                }
            }
        },

        isOwnMessage(messageElement) {
            return messageElement.classList.contains('buyer');
        },

        /**
         * Context uses originalText from dataset (handles translated DOM).
         * Limited to last 15 messages.
         */
        getConversationContext() {
            const messages = this.findMessages();
            const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
            const contextParts = [];

            recent.forEach(msg => {
                // Use stored original text if available (DOM may be translated already)
                const text = msg.dataset.originalText || this.getMessageText(msg);
                if (!text || text.length < 2) return;

                const isBuyer = msg.classList.contains('buyer');
                const role = isBuyer ? 'You (Seller)' : 'Customer (Buyer)';
                contextParts.push(`${role}: ${text}`);
            });

            if (contextParts.length === 0) return '';
            return 'Conversation context (Post-purchase support chat on Digiseller):\n\n' + contextParts.join('\n');
        },

        setupHoverTranslate() {
            const messages = this.findMessages();

            messages.forEach(messageElement => {
                const text = this.getMessageText(messageElement);
                if (!text || text.length < 2) return;

                const isOwn = this.isOwnMessage(messageElement);

                window.TranslateUI.createHoverTranslateButton({
                    messageElement,
                    position: isOwn ? 'right' : 'left',
                    getMessageText: (el) => this.getMessageText(el),
                    getConversationContext: () => this.getConversationContext(),
                    onTranslated: (el, originalText, translatedText) => {
                        this.setMessageText(el, translatedText);
                        // originalText is stored by UI module during setup
                    }
                });
            });
        },

        setupInputTranslate() {
            // Exact selector from user's HTML: textarea.form-textarea inside .debate_drop_zone
            const textarea = document.querySelector('.debate_drop_zone textarea.form-textarea') ||
                             document.querySelector('.debates_content textarea.form-textarea') ||
                             document.querySelector('textarea.form-textarea') ||
                             document.querySelector('.debates_content textarea');
            if (!textarea || textarea.dataset.translateSetup === 'true') return;
            textarea.dataset.translateSetup = 'true';

            let translateButton = null;

            const createButton = () => {
                if (translateButton) return;

                translateButton = document.createElement('button');
                translateButton.type = 'button';
                translateButton.className = 'auto-translate-input-btn';
                translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;

                translateButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (translateButton.dataset.translating === 'true') return;

                    const text = textarea.value.trim();
                    if (!text || text.length < 3) {
                        window.TranslateUI.showNotification('Vui lòng nhập tin nhắn trước khi dịch', 'info');
                        return;
                    }

                    const context = Debate.getConversationContext();
                    const fromLang = window.TranslateLanguage.detectLanguage(text);
                    const toLang = window.TranslateLanguage.getTargetLanguage(fromLang, context);

                    translateButton.dataset.translating = 'true';
                    translateButton.textContent = 'Đang dịch...';
                    translateButton.style.background = '#e68900';

                    try {
                        const translated = await window.TranslateAPI.translateInputText(text, fromLang, toLang, context, PLATFORM_NAME);
                        if (translated) {
                            textarea.value = translated;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    } catch (error) {
                        console.error('[AutoTranslate] Debate input translation error:', error);
                        window.TranslateUI.showNotification('Lỗi dịch: ' + error.message, 'error');
                    }
                    // Always reset button state after translate attempt
                    translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
                    translateButton.style.background = '#ff9800';
                    translateButton.dataset.translating = 'false';
                    delete translateButton.dataset.isTranslated;
                });

                // Place button next to the textarea
                // The HTML structure: <td> → <textarea> <span class="message_translate__btn">
                const parentTd = textarea.closest('td') || textarea.parentElement;
                if (parentTd) {
                    if (window.getComputedStyle(parentTd).position === 'static') {
                        parentTd.style.position = 'relative';
                    }
                    parentTd.appendChild(translateButton);
                }
            };

            textarea.addEventListener('input', () => {
                // Auto-reset: if user types anything, reset button state
                if (translateButton && translateButton.dataset.isTranslated === 'true') {
                    translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
                    translateButton.style.background = '#ff9800';
                    delete translateButton.dataset.isTranslated;
                }
                if (textarea.value.length === 0 && translateButton) {
                    translateButton.remove();
                    translateButton = null;
                } else if (textarea.value.length > 0 && !translateButton) {
                    createButton();
                }
            });

            textarea.addEventListener('focus', () => {
                if (!translateButton && textarea.value.trim().length > 0) createButton();
            });

            if (textarea.value.trim().length > 0) createButton();
        }
    };

    // ==============================================================
    // TYPE 2: PRE-PURCHASE Q&A CHAT
    // ==============================================================

    const QAChat = {
        findMessages() {
            return Array.from(document.querySelectorAll('#messages .messageView'));
        },

        getMessageText(messageElement) {
            const guestSpan = messageElement.querySelector('.messages-guest');
            if (guestSpan) return guestSpan.textContent.trim();
            return '';
        },

        setMessageText(messageElement, newText) {
            const guestSpan = messageElement.querySelector('.messages-guest');
            if (guestSpan) {
                guestSpan.textContent = newText;
            }
        },

        isOwnMessage(messageElement) {
            const guestSpan = messageElement.querySelector('.messages-guest');
            return guestSpan && guestSpan.classList.contains('messages-my');
        },

        getConversationContext() {
            const messages = this.findMessages();
            const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
            const contextParts = [];

            recent.forEach(msg => {
                const text = msg.dataset.originalText || this.getMessageText(msg);
                if (!text || text.length < 2) return;

                const isOwn = this.isOwnMessage(msg);
                const role = isOwn ? 'You (Seller)' : 'Customer';
                contextParts.push(`${role}: ${text}`);
            });

            if (contextParts.length === 0) return '';
            return 'Conversation context (Pre-purchase Q&A chat on Digiseller):\n\n' + contextParts.join('\n');
        },

        setupHoverTranslate() {
            const messages = this.findMessages();

            messages.forEach(messageElement => {
                const text = this.getMessageText(messageElement);
                if (!text || text.length < 2) return;

                const isOwn = this.isOwnMessage(messageElement);

                window.TranslateUI.createHoverTranslateButton({
                    messageElement,
                    position: isOwn ? 'right' : 'left',
                    getMessageText: (el) => this.getMessageText(el),
                    getConversationContext: () => this.getConversationContext(),
                    onTranslated: (el, originalText, translatedText) => {
                        this.setMessageText(el, translatedText);
                    }
                });
            });
        },

        setupInputTranslate() {
            // Exact selector from user's HTML: textarea.message-textarea#message-textarea
            const textarea = document.querySelector('#message-textarea') ||
                             document.querySelector('textarea.message-textarea');
            if (!textarea || textarea.dataset.translateSetup === 'true') return;
            textarea.dataset.translateSetup = 'true';

            let translateButton = null;

            const createButton = () => {
                if (translateButton) return;

                translateButton = document.createElement('button');
                translateButton.type = 'button';
                translateButton.className = 'auto-translate-input-btn';
                translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;

                translateButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (translateButton.dataset.translating === 'true') return;

                    const text = textarea.value.trim();
                    if (!text || text.length < 3) {
                        window.TranslateUI.showNotification('Vui lòng nhập tin nhắn trước khi dịch', 'info');
                        return;
                    }

                    const context = QAChat.getConversationContext();
                    const fromLang = window.TranslateLanguage.detectLanguage(text);
                    const toLang = window.TranslateLanguage.getTargetLanguage(fromLang, context);

                    translateButton.dataset.translating = 'true';
                    translateButton.textContent = 'Đang dịch...';
                    translateButton.style.background = '#e68900';

                    try {
                        const translated = await window.TranslateAPI.translateInputText(text, fromLang, toLang, context, PLATFORM_NAME);
                        if (translated) {
                            textarea.value = translated;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    } catch (error) {
                        console.error('[AutoTranslate] QA input translation error:', error);
                        window.TranslateUI.showNotification('Lỗi dịch: ' + error.message, 'error');
                    }
                    // Always reset button state after translate attempt
                    translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
                    translateButton.style.background = '#ff9800';
                    translateButton.dataset.translating = 'false';
                    delete translateButton.dataset.isTranslated;
                });

                // Place button in the message-send-wrap container
                const container = textarea.closest('#message') || textarea.closest('form') || textarea.parentElement;
                if (container) {
                    if (window.getComputedStyle(container).position === 'static') {
                        container.style.position = 'relative';
                    }
                    container.appendChild(translateButton);
                }
            };

            textarea.addEventListener('input', () => {
                if (translateButton && translateButton.dataset.isTranslated === 'true') {
                    translateButton.textContent = window.TranslateUI.TRANSLATE_TEXT;
                    translateButton.style.background = '#ff9800';
                    delete translateButton.dataset.isTranslated;
                }
                if (textarea.value.length === 0 && translateButton) {
                    translateButton.remove();
                    translateButton = null;
                } else if (textarea.value.length > 0 && !translateButton) {
                    createButton();
                }
            });

            textarea.addEventListener('focus', () => {
                if (!translateButton && textarea.value.trim().length > 0) createButton();
            });

            if (textarea.value.trim().length > 0) createButton();
        }
    };

    // ========== PUBLIC API ==========

    function processPage() {
        const chatType = getChatType();
        if (!chatType) return;

        if (chatType === 'debate') {
            Debate.setupHoverTranslate();
            Debate.setupInputTranslate();
        } else if (chatType === 'chat') {
            QAChat.setupHoverTranslate();
            QAChat.setupInputTranslate();
        }
    }

    function getObserverConfig() {
        return {
            checkNewMessage: (node) => {
                if (node.classList) {
                    if (node.classList.contains('debates_content__mess') && node.dataset.translateHoverSetup !== 'true') return true;
                    if (node.classList.contains('messageView') && node.dataset.translateHoverSetup !== 'true') return true;
                }
                if (node.querySelectorAll) {
                    if (node.querySelectorAll('.debates_content__mess:not([data-translate-hover-setup]), .messageView:not([data-translate-hover-setup])').length > 0) return true;
                }
                return false;
            }
        };
    }

    return {
        PLATFORM_NAME,
        processPage,
        getObserverConfig,
        getChatType
    };
})();

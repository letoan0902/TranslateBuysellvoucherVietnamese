/**
 * Shared UI Module
 * Notifications, spinners, buttons for all platforms
 */
window.TranslateUI = (function () {
    'use strict';

    const TRANSLATE_TEXT = 'Dịch';
    const BACK_TEXT = '←';

    // Inject global CSS once
    let cssInjected = false;
    function injectCSS() {
        if (cssInjected) return;
        cssInjected = true;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes auto-translate-spin {
                to { transform: rotate(360deg); }
            }

            .auto-translate-btn {
                padding: 4px 8px;
                background: #ff9800;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                font-weight: bold;
                z-index: 10000;
                transition: background 0.3s;
                font-family: Arial, sans-serif;
                line-height: 1;
                white-space: nowrap;
            }
            .auto-translate-btn:hover {
                background: #f57c00;
            }

            .auto-translate-input-btn {
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
                z-index: 10000;
                transition: background 0.3s;
                font-family: Arial, sans-serif;
            }
            .auto-translate-input-btn:hover {
                background: #f57c00;
            }

            .auto-translate-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                color: white;
                border-radius: 5px;
                z-index: 100000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                max-width: 350px;
                animation: auto-translate-fade-in 0.3s ease;
            }
            @keyframes auto-translate-fade-in {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .auto-translate-translation-box {
                margin-top: 8px;
                padding: 8px 12px;
                background: rgba(255, 152, 0, 0.1);
                border-left: 3px solid #ff9800;
                border-radius: 0 4px 4px 0;
                font-size: 13px;
                line-height: 1.5;
                color: #333;
                position: relative;
            }
            .auto-translate-translation-box .copy-btn {
                position: absolute;
                top: 4px;
                right: 4px;
                padding: 2px 6px;
                background: #ff9800;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
            }
            .auto-translate-translation-box .copy-btn:hover {
                background: #f57c00;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show a notification toast
     */
    function showNotification(message, type = 'info') {
        const bgColors = {
            error: '#f44336',
            success: '#4caf50',
            info: '#2196f3'
        };

        const notification = document.createElement('div');
        notification.className = 'auto-translate-notification';
        notification.style.background = bgColors[type] || bgColors.info;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    /**
     * Create a loading spinner element
     */
    function createSpinner() {
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
        `;
        spinner.innerHTML = `<div style="
            width: 14px;
            height: 14px;
            border: 2px solid #ffffff40;
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: auto-translate-spin 0.8s linear infinite;
        "></div>`;
        return spinner;
    }

    const LOADING_TEXT = 'Đang dịch...';

    /**
     * Create a translate hover button for a message element
     * Key behavior:
     * - Shows "Dịch" on hover, "Đang dịch..." while loading, "←" after translated
     * - Stores original text in messageElement.dataset.originalText BEFORE translating
     *   so that context functions always use original language text even if DOM is already translated
     * - Click "←" restores original text
     */
    function createHoverTranslateButton(options) {
        const { messageElement, position = 'right', getMessageText, onTranslated } = options;

        if (messageElement.dataset.translateHoverSetup === 'true') return;
        messageElement.dataset.translateHoverSetup = 'true';

        // *** IMPORTANT: Store original text immediately when setting up ***
        // This ensures context functions always have the original language text
        // even after the user translates a message (DOM changes to translated language)
        const currentText = getMessageText(messageElement);
        if (currentText && currentText.trim().length > 0) {
            messageElement.dataset.originalText = currentText;
        }

        let hoverButton = null;

        messageElement.addEventListener('mouseenter', () => {
            const existing = messageElement.querySelectorAll('.auto-translate-btn-hover');
            if (existing.length > 0) return;

            const text = getMessageText(messageElement);
            if (!text || text.trim().length < 3) return;

            hoverButton = document.createElement('button');
            hoverButton.type = 'button';
            hoverButton.className = 'auto-translate-btn auto-translate-btn-hover';
            hoverButton.textContent = messageElement.dataset.isTranslated === 'true' ? BACK_TEXT : TRANSLATE_TEXT;
            hoverButton.style.position = 'absolute';
            hoverButton.style.top = '-10px';
            hoverButton.style[position === 'right' ? 'right' : 'left'] = '5px';

            if (messageElement.dataset.isTranslated === 'true') {
                hoverButton.dataset.isTranslated = 'true';
            }

            hoverButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (hoverButton.dataset.translating === 'true') return;

                // If already translated → restore original
                if (messageElement.dataset.isTranslated === 'true') {
                    const origText = messageElement.dataset.originalText;
                    if (origText && onTranslated) {
                        onTranslated(messageElement, null, origText); // restore
                    }
                    messageElement.dataset.isTranslated = 'false';
                    hoverButton.textContent = TRANSLATE_TEXT;
                    hoverButton.dataset.isTranslated = 'false';
                    return;
                }

                // Use stored original text (not current DOM which may be translated)
                const originalText = messageElement.dataset.originalText || getMessageText(messageElement);
                if (!originalText) return;

                const fromLang = window.TranslateLanguage.detectLanguage(originalText);
                const toLang = window.TranslateLanguage.getTargetLanguage(fromLang);

                // Show loading state on button
                hoverButton.dataset.translating = 'true';
                hoverButton.textContent = LOADING_TEXT;
                hoverButton.style.background = '#e68900';

                try {
                    const context = options.getConversationContext ? options.getConversationContext() : '';
                    const translatedText = await window.TranslateAPI.translateText(originalText, fromLang, toLang, context);

                    if (translatedText) {
                        if (onTranslated) {
                            onTranslated(messageElement, originalText, translatedText);
                        }

                        hoverButton.textContent = BACK_TEXT;
                        hoverButton.style.padding = '4px 8px';
                        hoverButton.style.background = '#ff9800';
                        hoverButton.dataset.translating = 'false';
                        hoverButton.dataset.isTranslated = 'true';
                        messageElement.dataset.isTranslated = 'true';
                    } else {
                        hoverButton.textContent = TRANSLATE_TEXT;
                        hoverButton.style.background = '#ff9800';
                        hoverButton.dataset.translating = 'false';
                    }
                } catch (error) {
                    console.error('[AutoTranslate] Translation error:', error);
                    showNotification('Lỗi dịch: ' + error.message, 'error');
                    hoverButton.textContent = TRANSLATE_TEXT;
                    hoverButton.style.background = '#ff9800';
                    hoverButton.dataset.translating = 'false';
                }
            });

            if (window.getComputedStyle(messageElement).position === 'static') {
                messageElement.style.position = 'relative';
            }

            messageElement.appendChild(hoverButton);
        });

        messageElement.addEventListener('mouseleave', () => {
            const btn = messageElement.querySelector('.auto-translate-btn-hover');
            // Keep button visible if translated or currently translating
            if (btn && btn.dataset.isTranslated !== 'true' && btn.dataset.translating !== 'true') {
                btn.remove();
            }
        });
    }

    /**
     * Create a translation display box below a message
     */
    function createTranslationBox(translatedText) {
        const box = document.createElement('div');
        box.className = 'auto-translate-translation-box';
        box.innerHTML = `
            <span class="translated-content">${escapeHTML(translatedText)}</span>
            <button class="copy-btn" title="Copy">📋</button>
        `;

        const copyBtn = box.querySelector('.copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(translatedText).then(() => {
                copyBtn.textContent = '✓';
                setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
            });
        });

        return box;
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Initialize CSS on load
    injectCSS();

    return {
        TRANSLATE_TEXT,
        BACK_TEXT,
        showNotification,
        createSpinner,
        createHoverTranslateButton,
        createTranslationBox,
        injectCSS,
        escapeHTML
    };
})();
